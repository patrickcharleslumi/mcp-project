"""Schemas for version comparison."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class VersionCompareOptions(BaseModel):
    clauseGranularity: bool = Field(default=True)
    sensitivity: str = Field(default="medium")


class VersionCompareRequest(BaseModel):
    baseDocumentId: Optional[str] = None
    compareDocumentId: Optional[str] = None
    options: VersionCompareOptions = Field(default_factory=VersionCompareOptions)
    taskId: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None
    task: Optional[dict[str, Any]] = None


class ChangedClause(BaseModel):
    clauseId: str
    path: str
    oldText: str
    newText: str
    diffScore: float
    explanation: Optional[str] = None


class VersionComparePayload(BaseModel):
    diffSummary: dict[str, Any]
    changedClauses: list[ChangedClause]
    confidence: float
    references: dict[str, Any]
