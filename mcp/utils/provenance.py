"""Provenance tracking utilities."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    """UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def provenance_entry(endpoint: str, detail: str | None = None, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a provenance entry."""
    payload: dict[str, Any] = {"endpoint": endpoint, "timestamp": now_iso()}
    if detail:
        payload["detail"] = detail
    if extra:
        payload.update(extra)
    return payload
