"""Luminance LLM Proxy client (OpenAI-compatible)."""

from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

import httpx

from mcp.config import config
from mcp.logging import get_logger

logger = get_logger(__name__)


class LlmProxyClient:
    """HTTP client for the Luminance LLM Proxy."""

    def __init__(self) -> None:
        if not config.llm_proxy_base_url or not config.llm_proxy_api_key:
            raise ValueError("LLM proxy configuration missing base URL or API key")

        self.base_url = config.llm_proxy_base_url.rstrip("/")
        self.api_key = config.llm_proxy_api_key
        self.default_model = config.llm_proxy_model

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(config.llm_proxy_timeout_seconds),
        )

    async def close(self) -> None:
        await self.client.aclose()

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "Luminance-Txn-Id": str(uuid4()),
            "Luminance-Fastlane": str(config.llm_proxy_fastlane).lower(),
        }
        if config.llm_proxy_env:
            headers["Luminance-Env"] = config.llm_proxy_env
        if config.llm_proxy_request_purpose:
            headers["Luminance-Request-Purpose"] = config.llm_proxy_request_purpose
        if config.llm_proxy_provider_allowlist:
            headers["Luminance-AI-Provider-Allowlist"] = config.llm_proxy_provider_allowlist
        return headers

    async def chat_completions(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        reasoning: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if reasoning is not None:
            payload["reasoning"] = reasoning

        logger.info("LLM proxy request", model=payload.get("model"))

        response = await self.client.post(
            "/v1/chat/completions",
            json=payload,
            headers=self._build_headers(),
        )
        response.raise_for_status()
        return response.json()
