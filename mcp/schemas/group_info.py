"""Schemas for group information."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class GroupTag(BaseModel):
    key: str
    value: Any
    source: str
    lastUpdated: Optional[str] = None


class GroupInfoPayload(BaseModel):
    groupInfo: dict[str, Any]
    tags: list[GroupTag] = Field(default_factory=list)
