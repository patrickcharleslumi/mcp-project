"""Schemas for agent query endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AgentQueryRequest(BaseModel):
    text: str = Field(..., min_length=1, description="User question for the agent")
