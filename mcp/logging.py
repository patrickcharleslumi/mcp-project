"""Structured logging for MCP HTTP wrapper."""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from mcp.config import config


def setup_logging() -> None:
    """Configure structured logging."""
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, config.log_level.upper(), logging.INFO),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


def redact_sensitive(data: Any, fields: list[str] | None = None) -> Any:
    """Redact sensitive fields from log data."""
    if fields is None:
        fields = ["token", "password", "api_token", "authorization", "api_key"]

    if isinstance(data, dict):
        return {
            key: "***REDACTED***" if key.lower() in [f.lower() for f in fields] else redact_sensitive(value, fields)
            for key, value in data.items()
        }
    if isinstance(data, list):
        return [redact_sensitive(item, fields) for item in data]
    return data
