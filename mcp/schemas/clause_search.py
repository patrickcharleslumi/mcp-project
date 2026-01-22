"""Schemas for clause search."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class TcvRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class ClauseSearchFilters(BaseModel):
    governingLaw: Optional[str] = None
    tcvRange: Optional[TcvRange] = None
    tags: Optional[list[str]] = None
    dateRange: Optional[dict[str, str]] = None


class ClauseSearchRequest(BaseModel):
    clauseId: Optional[str] = None
    clauseText: Optional[str] = None
    filters: ClauseSearchFilters = Field(default_factory=ClauseSearchFilters)
    limit: int = Field(default=10, ge=1, le=100)
    sort: Optional[str] = None
    taskId: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None
    task: Optional[dict[str, Any]] = None


class SimilarClause(BaseModel):
    documentId: int
    groupId: int
    governingLaw: Optional[str] = None
    tcv: Optional[float] = None
    similarityScore: float
    clauseText: str
    excerptPath: str


class ClauseSearchPayload(BaseModel):
    sourceClause: dict[str, Any]
    similarClauses: list[SimilarClause]
