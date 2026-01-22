"""Schemas for bulk enrichment."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class BulkEnrichRequest(BaseModel):
    groupIds: list[int] = Field(default_factory=list)
    taskId: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None
    task: Optional[dict[str, Any]] = None


class BulkEnrichPayload(BaseModel):
    results: list[dict[str, Any]]
