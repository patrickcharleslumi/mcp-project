"""Structured logging setup."""

import logging
import sys
from typing import Any

import structlog

from integration_mcp.config import config


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

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, config.log_level.upper(), logging.INFO),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


def redact_sensitive(data: Any, fields: list[str] = None) -> Any:
    """Redact sensitive fields from log data."""
    if fields is None:
        fields = ["token", "password", "api_token", "api_key", "authorization"]

    if isinstance(data, dict):
        return {
            k: "***REDACTED***" if k.lower() in [f.lower() for f in fields] else redact_sensitive(v, fields)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [redact_sensitive(item, fields) for item in data]
    return data

