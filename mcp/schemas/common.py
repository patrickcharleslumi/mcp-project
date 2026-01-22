"""Common request/response schemas."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class TaskEnvelope(BaseModel):
    taskId: str = Field(..., description="Agent task identifier")
    inputs: dict[str, Any] = Field(default_factory=dict)


class ProvenanceEntry(BaseModel):
    endpoint: str
    timestamp: str
    detail: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class McpResponse(BaseModel):
    status: Literal["success", "failed", "partial"]
    summary: str
    payload: dict[str, Any] | list[Any] | None = None
    provenance: list[ProvenanceEntry] = Field(default_factory=list)
    humanReviewRequired: bool = False
    requestId: Optional[str] = None
    taskId: Optional[str] = None
