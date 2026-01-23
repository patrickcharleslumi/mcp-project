"""Agentic layer routes for AI insights and chat."""

from __future__ import annotations

from fastapi import APIRouter, Request

from mcp.exceptions import FeatureDisabledError
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

    return router
