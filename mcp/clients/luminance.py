"""Luminance API client wrapper."""

from __future__ import annotations

import time
from typing import Any, Optional

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from mcp.config import config
from mcp.exceptions import UpstreamError
from mcp.logging import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """Simple rate limiter for API calls."""

    def __init__(self, max_calls: int, period_seconds: int = 60) -> None:
        self.max_calls = max_calls
        self.period_seconds = period_seconds
        self.calls: list[float] = []

    def acquire(self) -> None:
        now = time.time()
        self.calls = [call_time for call_time in self.calls if now - call_time < self.period_seconds]
        if len(self.calls) >= self.max_calls:
            sleep_time = self.period_seconds - (now - self.calls[0])
            if sleep_time > 0:
                logger.warning("Rate limit reached, sleeping", sleep_seconds=sleep_time)
                time.sleep(sleep_time)
                now = time.time()
                self.calls = [call_time for call_time in self.calls if now - call_time < self.period_seconds]
        self.calls.append(now)


class LuminanceClient:
    """Client for interacting with Luminance API v2."""

    def __init__(self) -> None:
        self.base_url = config.luminance_base_url.rstrip("/")
        self.api_token = config.luminance_api_token
        self.rate_limiter = RateLimiter(config.rate_limit_per_minute, 60)
        self.failure_count = 0
        self.circuit_open_until: Optional[float] = None
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(config.request_timeout_seconds),
            verify=config.luminance_verify_tls,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> Any:
        now = time.time()
        if self.circuit_open_until and now < self.circuit_open_until:
            raise UpstreamError(
                "Circuit breaker open for Luminance API",
                hint="Upstream failing recently. Retry after cooldown.",
                status_code=503,
            )

        self.rate_limiter.acquire()

        headers = {}
        if request_id:
            headers["X-Request-ID"] = request_id

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            retry=retry_if_exception(
                lambda e: isinstance(e, httpx.HTTPStatusError)
                and (e.response.status_code >= 500 or e.response.status_code == 429)
                or isinstance(e, httpx.RequestError)
            ),
            reraise=True,
        )
        async def _do_request() -> Any:
            response = await self.client.request(method, path, params=params, json=json, headers=headers)
            response.raise_for_status()
            if not response.content:
                return {}
            return response.json()

        try:
            response = await _do_request()
            self.failure_count = 0
            self.circuit_open_until = None
            return response
        except httpx.HTTPStatusError as exc:
            self._track_failure()
            response_preview = ""
            try:
                response_preview = exc.response.text[:500]
            except Exception:
                response_preview = ""
            logger.error(
                "Luminance API error",
                status_code=exc.response.status_code,
                path=path,
                error=str(exc),
                response_body=response_preview or None,
            )
            raise UpstreamError(
                f"Luminance API error: {exc.response.status_code}",
                hint="Check Luminance API availability and credentials.",
                status_code=502 if exc.response.status_code >= 500 else 424,
            ) from exc
        except Exception as exc:
            self._track_failure()
            logger.error("Luminance API request failed", path=path, error=str(exc))
            raise UpstreamError("Luminance API request failed", hint="Retry later.") from exc

    def _track_failure(self) -> None:
        self.failure_count += 1
        if self.failure_count >= config.circuit_breaker_threshold:
            self.circuit_open_until = time.time() + config.circuit_breaker_reset_seconds

    async def get_document(self, project_id: int, document_id: int, request_id: Optional[str] = None) -> dict[str, Any]:
        return await self._request("GET", f"/api2/projects/{project_id}/documents/{document_id}", request_id=request_id)

    async def list_documents(
        self,
        project_id: int,
        params: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/documents",
            params=params,
            request_id=request_id,
        )
        return response if isinstance(response, list) else []

    async def get_document_annotations(
        self,
        project_id: int,
        document_id: int,
        params: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/documents/{document_id}/annotations",
            params=params,
            request_id=request_id,
        )
        return response if isinstance(response, list) else []

    async def get_annotation_text(
        self,
        project_id: int,
        document_id: int,
        annotation_id: int,
        request_id: Optional[str] = None,
    ) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/api2/projects/{project_id}/documents/{document_id}/annotations/annotationText",
            params={"id": annotation_id, "fullParagraph": "true"},
            request_id=request_id,
        )

    async def get_matter(self, project_id: int, matter_id: int, request_id: Optional[str] = None) -> dict[str, Any]:
        return await self._request("GET", f"/api2/projects/{project_id}/matters/{matter_id}", request_id=request_id)

    async def get_matter_annotations(
        self, project_id: int, matter_id: int, request_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/matters/{matter_id}/annotations",
            request_id=request_id,
        )
        return response if isinstance(response, list) else []

    async def get_matter_versions(
        self, project_id: int, matter_id: int, request_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/matters/{matter_id}/versions",
            request_id=request_id,
        )
        return response if isinstance(response, list) else []

    async def list_tasks(
        self, project_id: int, request_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/tasks",
            request_id=request_id,
        )
        return response if isinstance(response, list) else []
