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

    async def search_opportunities(self, query: str) -> list[dict[str, Any]]:
        if not self.client or not query.strip():
            return []

        payload = {"query": query.strip(), "limit": 5}
        try:
            response = await self.client.post("/opportunities/search", json=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Salesforce MCP request failed", error=str(exc))
            return []

        if isinstance(data, dict):
            records = data.get("records")
            if isinstance(records, list):
                return [record for record in records if isinstance(record, dict)]
        if isinstance(data, list):
            return [record for record in data if isinstance(record, dict)]
        return []
