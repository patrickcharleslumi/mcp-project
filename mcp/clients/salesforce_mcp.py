"""Salesforce MCP HTTP client for opportunity context."""

from __future__ import annotations

from typing import Any, Optional

import httpx

from mcp.config import config
from mcp.logging import get_logger

logger = get_logger(__name__)


class SalesforceMcpClient:
    """HTTP client for a Salesforce MCP server."""

    def __init__(self) -> None:
        self.enabled = config.salesforce_mcp_enabled
        self.base_url = config.salesforce_mcp_endpoint.rstrip("/") if config.salesforce_mcp_endpoint else None
        self.client: Optional[httpx.AsyncClient] = None

        if not self.enabled or not self.base_url:
            return

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(config.request_timeout_seconds),
            verify=config.luminance_verify_tls,
            headers={"Content-Type": "application/json"},
        )

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()

    async def get_commercial_context(self, query: str) -> Optional[dict[str, Any]]:
        if not self.client or not query.strip():
            return None

        payload = {"query": query.strip()}
        try:
            response = await self.client.post(config.salesforce_mcp_commercial_context_path, json=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Salesforce MCP commercial context request failed", error=str(exc))
            return None

        if isinstance(data, dict):
            payload_data = data.get("data")
            if isinstance(payload_data, dict):
                return payload_data
        return None

    async def estimate_signing_likelihood(self, scenarios: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not self.client or not scenarios:
            return []

        payload = {"scenarios": scenarios}
        try:
            response = await self.client.post(config.salesforce_mcp_signing_likelihood_path, json=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Salesforce MCP signing likelihood request failed", error=str(exc))
            return []

        if isinstance(data, dict):
            results = data.get("data")
            if isinstance(results, list):
                return [result for result in results if isinstance(result, dict)]
        return []
