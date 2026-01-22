"""Bulk enrichment service."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from mcp.services.group_info import GroupInfoService
from mcp.config import config


class BulkEnrichService:
    """Run group info enrichment in parallel."""

    def __init__(self, group_info_service: GroupInfoService):
        self.group_info_service = group_info_service
        self.semaphore = asyncio.Semaphore(config.max_concurrency)

    async def enrich(self, group_ids: list[int], request_id: Optional[str]) -> dict[str, Any]:
        async def _enrich_group(group_id: int) -> dict[str, Any]:
            async with self.semaphore:
                return await self.group_info_service.get_group_info(group_id, request_id)

        results = await asyncio.gather(*[_enrich_group(group_id) for group_id in group_ids])
        return {"results": results}
