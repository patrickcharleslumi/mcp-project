"""Group info service."""

from __future__ import annotations

from typing import Any, Optional

from mcp.clients.luminance import LuminanceClient
from mcp.config import config
from mcp.utils.cache import build_cache
from mcp.utils.provenance import provenance_entry


class GroupInfoService:
    """Aggregate group metadata and tags."""

    def __init__(self, client: LuminanceClient):
        self.client = client
        self.cache = build_cache()

    async def get_group_info(self, group_id: int, request_id: Optional[str]) -> dict[str, Any]:
        cache_key = f"group-info:{group_id}"
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            return cached

        matter = await self.client.get_matter(config.luminance_project_id, group_id, request_id=request_id)
        annotations = await self.client.get_matter_annotations(
            config.luminance_project_id, group_id, request_id=request_id
        )
        tags = []
        for annotation in annotations:
            key = annotation.get("annotation_type", {}).get("key") or annotation.get("type") or "tag"
            tags.append(
                {
                    "key": key,
                    "value": annotation.get("content"),
                    "source": "luminance",
                    "lastUpdated": annotation.get("updated_at") or annotation.get("created_at"),
                }
            )

        payload = {
            "groupInfo": {
                "id": matter.get("id"),
                "name": matter.get("name"),
                "state": matter.get("state"),
                "info": matter.get("info", {}),
            },
            "tags": tags,
            "provenance": [
                provenance_entry(f"/api2/projects/{config.luminance_project_id}/matters/{group_id}"),
                provenance_entry(f"/api2/projects/{config.luminance_project_id}/matters/{group_id}/annotations"),
            ],
        }
        self.cache[cache_key] = payload
        return payload
