"""Template catalog service."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from mcp.clients.luminance import LuminanceClient
from mcp.config import config
from mcp.utils.cache import build_cache
from mcp.utils.provenance import provenance_entry


class TemplateService:
    """Resolve template metadata."""

    def __init__(self, client: LuminanceClient):
        self.client = client
        self.cache = build_cache()

    def _load_catalog_from_file(self) -> list[dict[str, Any]]:
        if not config.template_catalog_path:
            return []
        path = Path(config.template_catalog_path)
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))

    async def _load_catalog_from_tasks(self, request_id: Optional[str]) -> list[dict[str, Any]]:
        tasks = await self.client.list_tasks(config.luminance_project_id, request_id=request_id)
        templates: list[dict[str, Any]] = []
        for task in tasks:
            template_id = task.get("document_template_id") or task.get("template_id")
            if not template_id:
                continue
            templates.append(
                {
                    "templateId": str(template_id),
                    "name": task.get("name") or f"Template {template_id}",
                    "applicableWorkflowStages": [],
                    "fields": task.get("fields") or [],
                    "examples": task.get("examples") or [],
                    "governingLaw": None,
                }
            )
        return templates

    async def list_templates(self, request_id: Optional[str]) -> dict[str, Any]:
        cache_key = "template-catalog"
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            return cached

        templates = self._load_catalog_from_file()
        provenance = []
        if templates:
            provenance.append(provenance_entry("file:template_catalog", detail="Loaded from MCP_TEMPLATE_CATALOG_PATH"))
        else:
            templates = await self._load_catalog_from_tasks(request_id)
            provenance.append(
                provenance_entry(f"/api2/projects/{config.luminance_project_id}/tasks")
            )

        payload = {"templates": templates, "provenance": provenance}
        self.cache[cache_key] = payload
        return payload

    async def get_template(self, template_id: str, request_id: Optional[str]) -> dict[str, Any]:
        catalog = await self.list_templates(request_id)
        for template in catalog.get("templates", []):
            if str(template.get("templateId")) == str(template_id):
                return {
                    "template": template,
                    "provenance": catalog.get("provenance", []),
                }
        return {"template": None, "provenance": catalog.get("provenance", [])}
