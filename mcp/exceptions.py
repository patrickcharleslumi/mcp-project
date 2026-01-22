"""Custom exceptions and error mapping."""

from __future__ import annotations


class McpError(Exception):
    """Base MCP error."""

    def __init__(self, message: str, error_code: str, hint: str | None = None, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.hint = hint
        self.status_code = status_code


class AuthError(McpError):
    """Authentication error."""

    def __init__(self, message: str = "Unauthorized", hint: str | None = None):
        super().__init__(message, "AUTH_FAILED", hint=hint, status_code=401)


class ValidationError(McpError):
    """Input validation error."""

    def __init__(self, message: str, hint: str | None = None):
        super().__init__(message, "INVALID_INPUT", hint=hint, status_code=400)


class NotFoundError(McpError):
    """Resource not found."""

    def __init__(self, message: str, hint: str | None = None):
        super().__init__(message, "NOT_FOUND", hint=hint, status_code=404)


class UpstreamError(McpError):
    """Upstream Luminance error."""

    def __init__(self, message: str, hint: str | None = None, status_code: int = 502):
        super().__init__(message, "UPSTREAM_ERROR", hint=hint, status_code=status_code)


class FeatureDisabledError(McpError):
    """Feature flag disabled."""

    def __init__(self, message: str = "Feature disabled", hint: str | None = None):
        super().__init__(message, "FEATURE_DISABLED", hint=hint, status_code=403)
