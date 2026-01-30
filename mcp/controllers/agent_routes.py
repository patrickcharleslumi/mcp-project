"""Agentic layer routes for AI insights and chat."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request

from mcp.exceptions import FeatureDisabledError, NotFoundError
from mcp.schemas.agent_query import AgentQueryRequest
from mcp.services.ai_insights import AiInsightsService


def build_agent_router(agent_service: AiInsightsService | None) -> APIRouter:
    router = APIRouter(prefix="/agent", tags=["Agentic"])

    def _ensure_enabled() -> None:
        if agent_service is None:
            raise FeatureDisabledError(
                message="Agentic layer disabled",
                hint="Enable LLM_PROXY_* env vars to use agent endpoints.",
            )

    @router.get("/groups/{group_id}/ai_insights")
    async def get_ai_insights(group_id: int, request: Request) -> dict[str, object]:
        _ensure_enabled()
        return await agent_service.generate_insights(group_id, getattr(request.state, "request_id", None))

    @router.post("/groups/{group_id}/query")
    async def query_agent(group_id: int, body: AgentQueryRequest, request: Request) -> dict[str, object]:
        _ensure_enabled()
        return await agent_service.query_agent(group_id, body.text, getattr(request.state, "request_id", None))

    @router.get("/groups/{group_id}/signing_likelihood")
    async def get_signing_likelihood(
        group_id: int,
        counterparty: Optional[str] = Query(None, description="Counterparty name for Salesforce lookup"),
        request: Request = None,
    ) -> dict[str, object]:
        """Get signing likelihood estimate based on Salesforce opportunity data."""
        _ensure_enabled()
        result = await agent_service.salesforce_context.client.get_signing_likelihood(
            counterparty or "ACME Corporation",  # Fallback for demo
            matter_id=group_id,
        )
        if not result:
            raise NotFoundError(
                message="Signing likelihood unavailable",
                hint="Check Salesforce MCP connection and opportunity name.",
            )
        return result

    @router.get("/signing_likelihood")
    async def get_signing_likelihood_by_name(
        opportunity_name: str = Query(..., description="Opportunity name or ID to look up"),
        request: Request = None,
    ) -> dict[str, object]:
        """Get signing likelihood estimate for any opportunity by name or ID."""
        _ensure_enabled()
        result = await agent_service.salesforce_context.client.get_signing_likelihood(opportunity_name)
        if not result:
            raise NotFoundError(
                message="Signing likelihood unavailable",
                hint="Check Salesforce MCP connection and opportunity name.",
            )
        return result

    return router
