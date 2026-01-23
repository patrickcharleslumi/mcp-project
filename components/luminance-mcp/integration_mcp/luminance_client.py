"""Client for Luminance API v1 and v2."""

import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from integration_mcp.config import config
from integration_mcp.logger import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """Simple rate limiter for API calls."""

    def __init__(self, max_calls: int, period_seconds: int = 60):
        """Initialize rate limiter.

        Args:
            max_calls: Maximum number of calls allowed
            period_seconds: Time period in seconds
        """
        self.max_calls = max_calls
        self.period_seconds = period_seconds
        self.calls: list[float] = []

    def acquire(self) -> None:
        """Acquire a rate limit slot, blocking if necessary."""
        now = time.time()
        # Remove calls outside the current period
        self.calls = [call_time for call_time in self.calls if now - call_time < self.period_seconds]

        if len(self.calls) >= self.max_calls:
            sleep_time = self.period_seconds - (now - self.calls[0])
            if sleep_time > 0:
                logger.warning("Rate limit reached, sleeping", sleep_seconds=sleep_time)
                time.sleep(sleep_time)
                # Recalculate after sleep
                now = time.time()
                self.calls = [call_time for call_time in self.calls if now - call_time < self.period_seconds]

        self.calls.append(now)


class LuminanceClient:
    """Client for interacting with Luminance API."""

    def __init__(self):
        """Initialize the Luminance API client."""
        self.base_url = config.luminance_base_url.rstrip("/")
        self.api_token = config.luminance_api_token
        self.rate_limiter = RateLimiter(config.rate_limit_per_minute, 60)

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(config.tool_timeout_seconds),
            verify=config.luminance_verify_tls,
        )

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
        retry_on_404: bool = False,
    ) -> dict[str, Any]:
        """Make an HTTP request with rate limiting and retries.

        Args:
            method: HTTP method
            path: API path
            params: Query parameters
            json: JSON body
            retry_on_404: Whether to retry on 404 errors (default: False, as 404s are permanent)

        Returns:
            Response JSON

        Raises:
            httpx.HTTPStatusError: On HTTP error
        """
        self.rate_limiter.acquire()

        url = f"{self.base_url}{path}"
        logger.debug("Making API request", method=method, url=url, params=params)

        async def _do_request():
            response = await self.client.request(method, path, params=params, json=json)
            response.raise_for_status()
            return response.json() if response.content else {}

        # Retry logic: only retry on 5xx errors or 429 (rate limit)
        # Don't retry on 4xx errors (they're permanent client errors)
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            retry=(
                lambda e: isinstance(e, httpx.HTTPStatusError)
                and (e.response.status_code >= 500 or e.response.status_code == 429)
            )
            or not isinstance(e, httpx.HTTPStatusError),  # Network errors
            reraise=True,
        )
        async def _retry_request():
            return await _do_request()

        try:
            return await _retry_request()
        except httpx.HTTPStatusError as e:
            # Try to extract error details from response
            error_detail = str(e)
            try:
                if e.response.content:
                    error_body = e.response.json()
                    error_detail = f"{str(e)} - {error_body}"
            except Exception:
                pass

            # Log 404s as debug (expected for missing resources), others as error
            if e.response.status_code == 404:
                logger.debug(
                    "Resource not found",
                    method=method,
                    path=path,
                    status_code=404,
                )
            else:
                logger.error(
                    "API request failed",
                    method=method,
                    path=path,
                    status_code=e.response.status_code,
                    error=error_detail,
                )
            raise

    # API v2 methods (preferred)

    async def get_project(self, project_id: int) -> dict[str, Any]:
        """Get project by ID."""
        return await self._request("GET", f"/api2/projects/{project_id}")

    async def search_documents(
        self,
        project_id: int,
        filters: Optional[dict[str, Any]] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Search documents in a project.

        Args:
            project_id: Project ID
            filters: Search filters (name, state, folder_id, etc.)
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of documents
        """
        params = {"limit": limit, "offset": offset}
        if filters:
            params.update(filters)

        response = await self._request("GET", f"/api2/projects/{project_id}/documents", params=params)
        return response if isinstance(response, list) else []

    async def get_document(self, project_id: int, document_id: int) -> dict[str, Any]:
        """Get document by ID."""
        return await self._request("GET", f"/api2/projects/{project_id}/documents/{document_id}")

    async def get_document_annotations(
        self,
        project_id: int,
        document_id: int,
        annotation_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Get annotations for a document."""
        params = {}
        if annotation_type:
            params["type"] = annotation_type

        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/documents/{document_id}/annotations",
            params=params,
        )
        return response if isinstance(response, list) else []

    async def get_matter(self, project_id: int, matter_id: int) -> dict[str, Any]:
        """Get matter by ID."""
        return await self._request("GET", f"/api2/projects/{project_id}/matters/{matter_id}")

    async def get_matter_annotations(self, project_id: int, matter_id: int) -> list[dict[str, Any]]:
        """Get annotations for a matter."""
        response = await self._request(
            "GET",
            f"/api2/projects/{project_id}/matters/{matter_id}/annotations",
        )
        return response if isinstance(response, list) else []

    async def search_matters(
        self,
        project_id: int,
        filters: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        """Search matters in a project."""
        params = filters or {}
        response = await self._request("GET", f"/api2/projects/{project_id}/matters", params=params)
        return response if isinstance(response, list) else []

    async def search(
        self,
        group_by: str = "documents",
        filters: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Perform aggregated search.

        Args:
            group_by: One of 'documents', 'matters', 'groups'
            filters: Search filters

        Returns:
            Search results
        """
        params = {"groupBy": group_by}
        if filters:
            params.update(filters)

        return await self._request("GET", "/api2/search", params=params)

    # Helper methods for MSA-specific operations

    async def find_similar_documents(
        self,
        project_id: int,
        document_id: int,
        document_type: str = "MSA",
        state: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Find similar documents (e.g., signed MSAs).

        This is a placeholder that uses search. In production, this would use
        Luminance's similarity/ML search capabilities.

        Note: "signed" is not a document state. To find signed documents,
        search for matters with signed workflow stages instead.

        Args:
            project_id: Project ID
            document_id: Reference document ID
            document_type: Type of document to search for (not currently used)
            state: Optional document state filter (e.g., 'import_complete')
            limit: Maximum results

        Returns:
            List of similar documents
        """
        # Get the reference document to extract metadata
        ref_doc = await self.get_document(project_id, document_id)

        # Search for documents - don't filter by "signed" state (it's not a valid document state)
        # Instead, we'll get all documents and filter by matter state if needed
        filters = {}
        if state and state != "signed":
            # Only add state filter if it's a valid document state
            # Valid states: import_pending, import_complete, import_failure, import_unverified, etc.
            filters["state"] = state

        results = await self.search_documents(project_id, filters=filters, limit=limit * 2)

        # Filter out the reference document itself
        filtered = [doc for doc in results if doc.get("id") != document_id]

        # If we're looking for "signed" documents, we need to check matter states
        # This is a simplified approach - in production, you'd query matters with signed stages
        if state == "signed":
            # For MVP, return all documents (we can't easily filter by matter state here)
            # In production, you'd:
            # 1. Get matters with signed workflow stages
            # 2. Get documents associated with those matters
            logger.warning(
                "Filtering by 'signed' state is not supported for documents. "
                "Returning all documents. In production, filter by matter workflow stages."
            )

        return filtered[:limit]

    async def get_clause_annotations(
        self,
        project_id: int,
        document_id: int,
        clause_types: Optional[list[str]] = None,
    ) -> dict[str, list[dict[str, Any]]]:
        """Get clause-level annotations grouped by type.

        Args:
            project_id: Project ID
            document_id: Document ID
            clause_types: Optional list of clause types to filter

        Returns:
            Dictionary mapping clause_type to list of annotations
        """
        annotations = await self.get_document_annotations(project_id, document_id)

        # Group by clause type (assuming annotation.type or similar field)
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for ann in annotations:
            # Annotation structure can vary - try multiple ways to get the type
            ann_type_obj = ann.get("annotation_type") or ann.get("type")
            if isinstance(ann_type_obj, dict):
                clause_type = ann_type_obj.get("type") or ann_type_obj.get("key") or ann_type_obj.get("name") or "unknown"
            elif isinstance(ann_type_obj, str):
                clause_type = ann_type_obj
            else:
                clause_type = ann.get("type") or "unknown"

            # If no clause types specified, group all annotations
            if clause_types is None:
                grouped[clause_type].append(ann)
            else:
                # Try to match clause type (case-insensitive, partial match)
                clause_type_lower = clause_type.lower()
                matched = False
                for target_type in clause_types:
                    # Check for exact match or if target type is in the annotation type
                    if (target_type.lower() == clause_type_lower or 
                        target_type.lower() in clause_type_lower or 
                        clause_type_lower in target_type.lower()):
                        grouped[target_type].append(ann)
                        matched = True
                        break
                # If no match found, still store it for debugging (as _other)
                if not matched:
                    grouped.setdefault("_other", []).append(ann)

        return dict(grouped)

