"""Schemas for template catalog."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class TemplateSummary(BaseModel):
    templateId: str
    name: str
    applicableWorkflowStages: list[str]
    fields: list[dict[str, Any]]
    examples: list[dict[str, Any]] | None = None
    governingLaw: Optional[str] = None


class TemplateCatalogPayload(BaseModel):
    templates: list[TemplateSummary]


class TemplateDetailPayload(BaseModel):
    template: TemplateSummary
