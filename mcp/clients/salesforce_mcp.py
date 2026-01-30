"""Salesforce MCP HTTP client for opportunity context."""

from __future__ import annotations

import re
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

    async def get_commercial_context(
        self,
        query: str,
        matter_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        if not self.client or not query.strip():
            return None

        cleaned = query.strip()
        # Prefer opportunityId when the matter name looks like a Salesforce ID.
        # Fallback to opportunityName for fuzzy matching in the Prismatic flow.
        # NOTE: We don't send matterId because Prismatic can't reach localhost Luminance
        # The local MCP wrapper already resolves counterparty name before calling this
        if re.fullmatch(r"006[0-9A-Za-z]{12,15}", cleaned):
            payload = {"opportunityId": cleaned}
        else:
            payload = {"opportunityName": cleaned}
        # Don't send matterId - Prismatic can't call back to local Luminance
        # if matter_id is not None:
        #     payload["matterId"] = matter_id
        try:
            response = await self.client.post(config.salesforce_mcp_commercial_context_path, json=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            response_text = exc.response.text if exc.response is not None else ""
            logger.warning(
                "Salesforce MCP commercial context request failed",
                status=exc.response.status_code if exc.response else None,
                response=response_text[:1000],
            )
            return None
        except Exception as exc:
            logger.warning("Salesforce MCP commercial context request failed", error=str(exc))
            return None

        if isinstance(data, dict):
            # Prismatic returns data directly (not wrapped in "data" key)
            # Check for opportunity_id to confirm it's valid Salesforce data
            if data.get("opportunity_id") or data.get("opportunity_name"):
                return data
            # Also try wrapped format for compatibility
            payload_data = data.get("data")
            if isinstance(payload_data, dict):
                return payload_data
        return None

    async def get_signing_likelihood(
        self,
        query: str,
        matter_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        """Get signing likelihood estimate for an opportunity."""
        if not self.client or not query.strip():
            return None

        cleaned = query.strip()
        # NOTE: We don't send matterId because Prismatic can't reach localhost Luminance
        if re.fullmatch(r"006[0-9A-Za-z]{12,15}", cleaned):
            payload = {"opportunityId": cleaned}
        else:
            payload = {"opportunityName": cleaned}
        # Don't send matterId - Prismatic can't call back to local Luminance
        # if matter_id is not None:
        #     payload["matterId"] = matter_id

        try:
            response = await self.client.post(config.salesforce_mcp_signing_likelihood_path, json=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            response_text = exc.response.text if exc.response is not None else ""
            logger.warning(
                "Salesforce MCP signing likelihood request failed",
                status=exc.response.status_code if exc.response else None,
                response=response_text[:1000],
            )
            return None
        except Exception as exc:
            logger.warning("Salesforce MCP signing likelihood request failed", error=str(exc))
            return None

        if isinstance(data, dict):
            # Prismatic returns data directly (not wrapped in "data" key)
            if data.get("opportunity_id") or data.get("signing_likelihood"):
                return data
            # Also try wrapped format for compatibility
            payload_data = data.get("data")
            if isinstance(payload_data, dict):
                return payload_data
        return None
