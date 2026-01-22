"""Middleware for request IDs and auth."""

from __future__ import annotations

import uuid
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from mcp.config import config
from mcp.exceptions import AuthError, FeatureDisabledError
from mcp.logging import get_logger

logger = get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Ensure every request has an X-Request-ID."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class FeatureFlagMiddleware(BaseHTTPMiddleware):
    """Block requests when feature flag is disabled."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not config.feature_enabled and request.url.path.startswith("/mcp"):
            raise FeatureDisabledError()
        return await call_next(request)


class ApiKeyAuthMiddleware(BaseHTTPMiddleware):
    """Enforce API key for MCP endpoints."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not request.url.path.startswith("/mcp"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        api_key = request.headers.get("X-API-Key")
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        elif api_key:
            token = api_key

        if token != config.mcp_api_key:
            raise AuthError(hint="Provide a valid MCP API key in Authorization or X-API-Key.")
        return await call_next(request)


def mcp_error_response(error: Exception, request_id: str) -> JSONResponse:
    """Render a structured error response."""
    if isinstance(error, (AuthError, FeatureDisabledError)):
        status_code = error.status_code
        payload = {
            "status": "failed",
            "errorCode": error.error_code,
            "message": error.message,
            "hint": error.hint,
            "requestId": request_id,
        }
        return JSONResponse(status_code=status_code, content=payload)

    return JSONResponse(
        status_code=500,
        content={
            "status": "failed",
            "errorCode": "INTERNAL_ERROR",
            "message": "Unexpected server error",
            "hint": "Check server logs for details.",
            "requestId": request_id,
        },
    )
