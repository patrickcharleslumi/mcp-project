"""FastAPI app for MCP HTTP wrapper."""

from __future__ import annotations

import time
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import generate_latest

from mcp.clients.luminance import LuminanceClient
from mcp.clients.llm_proxy import LlmProxyClient
from mcp.config import config
from mcp.controllers.agent_routes import build_agent_router
from mcp.controllers.mcp_routes import build_router
from mcp.exceptions import McpError
from mcp.logging import get_logger, setup_logging
from mcp.metrics import REQUEST_COUNT, REQUEST_LATENCY
from mcp.middleware import ApiKeyAuthMiddleware, FeatureFlagMiddleware, RequestIdMiddleware
from mcp.services.bulk_enrich import BulkEnrichService
from mcp.services.clause_search import ClauseSearchService
from mcp.services.group_info import GroupInfoService
from mcp.services.templates import TemplateService
from mcp.services.version_compare import VersionCompareService
from mcp.services.ai_insights import AiInsightsService
from mcp.services.salesforce_context import SalesforceContextService

logger = get_logger(__name__)


async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    client = LuminanceClient()
    app.state.luminance_client = client
    llm_proxy_client = None
    salesforce_service = SalesforceContextService()
    version_service = VersionCompareService(client)
    clause_service = ClauseSearchService(client)
    group_service = GroupInfoService(client)
    template_service = TemplateService(client)
    bulk_service = BulkEnrichService(group_service)
    
    # Create LLM proxy client if enabled (optional - for AI recommendations)
    if config.llm_proxy_enabled:
        llm_proxy_client = LlmProxyClient()
    
    # Always create agent service (Salesforce data works without LLM proxy)
    agent_service = AiInsightsService(client, llm_proxy_client, salesforce_service)
    app.include_router(
        build_router(
            version_service=version_service,
            clause_service=clause_service,
            group_service=group_service,
            template_service=template_service,
            bulk_service=bulk_service,
        )
    )
    app.include_router(build_agent_router(agent_service))
    logger.info("MCP wrapper started")
    yield
    if llm_proxy_client:
        await llm_proxy_client.close()
    await salesforce_service.close()
    await client.close()
    logger.info("MCP wrapper shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Luminance MCP Wrapper",
        version="1.0.0",
        description="HTTP MCP wrapper for Luminance API",
        lifespan=lifespan,
    )

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(FeatureFlagMiddleware)
    app.add_middleware(ApiKeyAuthMiddleware)

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        start = time.time()
        user_id = request.headers.get("X-User-Id") or request.headers.get("X-Actor-Id")
        logger.info(
            "MCP request received",
            path=request.url.path,
            method=request.method,
            user_id=user_id,
            request_id=getattr(request.state, "request_id", None),
        )
        response = await call_next(request)
        elapsed = time.time() - start
        endpoint = request.url.path
        REQUEST_LATENCY.labels(endpoint=endpoint).observe(elapsed)
        REQUEST_COUNT.labels(endpoint=endpoint, status=str(response.status_code)).inc()
        logger.info(
            "MCP request complete",
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(elapsed * 1000, 2),
            user_id=user_id,
            request_id=getattr(request.state, "request_id", None),
        )
        return response

    @app.exception_handler(McpError)
    async def mcp_error_handler(request: Request, exc: McpError) -> JSONResponse:
        logger.warning(
            "MCP error",
            error=exc.message,
            code=exc.error_code,
            status=exc.status_code,
            path=request.url.path,
            method=request.method,
            request_id=getattr(request.state, "request_id", None),
            hint=exc.hint,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "failed",
                "errorCode": exc.error_code,
                "message": exc.message,
                "hint": exc.hint,
                "requestId": getattr(request.state, "request_id", None),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled error",
            error=str(exc),
            path=request.url.path,
            method=request.method,
            request_id=getattr(request.state, "request_id", None),
        )
        return JSONResponse(
            status_code=500,
            content={
                "status": "failed",
                "errorCode": "INTERNAL_ERROR",
                "message": "Unexpected server error",
                "hint": "Check server logs for details.",
                "requestId": getattr(request.state, "request_id", None),
            },
        )

    @app.get("/metrics")
    async def metrics() -> PlainTextResponse:
        return PlainTextResponse(content=generate_latest().decode("utf-8"))

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
