"""MCP HTTP routes."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Request

from mcp.exceptions import ValidationError
from mcp.schemas.bulk_enrich import BulkEnrichRequest
from mcp.schemas.clause_search import ClauseSearchRequest
from mcp.schemas.version_compare import VersionCompareRequest
from mcp.services.bulk_enrich import BulkEnrichService
from mcp.services.clause_search import ClauseSearchService
from mcp.services.group_info import GroupInfoService
from mcp.services.templates import TemplateService
from mcp.services.version_compare import VersionCompareService
from mcp.utils.provenance import provenance_entry


def build_router(
    version_service: VersionCompareService,
    clause_service: ClauseSearchService,
    group_service: GroupInfoService,
    template_service: TemplateService,
    bulk_service: BulkEnrichService,
) -> APIRouter:
    router = APIRouter(prefix="/mcp", tags=["MCP"])

    def _task_id_from_request(request: Request, body: Optional[dict[str, Any]] = None) -> Optional[str]:
        header_task = request.headers.get("X-Task-Id")
        if header_task:
            return header_task
        if body and isinstance(body, dict):
            if body.get("taskId"):
                return body.get("taskId")
            task_block = body.get("task")
            if isinstance(task_block, dict):
                return task_block.get("taskId")
        return request.query_params.get("taskId")

    def _unwrap_inputs(body: dict[str, Any]) -> dict[str, Any]:
        if "task" in body and isinstance(body["task"], dict):
            return body["task"].get("inputs", body)
        if "inputs" in body and isinstance(body["inputs"], dict):
            return body["inputs"]
        return body

    def _response(payload: dict[str, Any], summary: str, request: Request, task_id: Optional[str]) -> dict[str, Any]:
        request_id = getattr(request.state, "request_id", None)
        provenance = payload.pop("provenance", [])
        return {
            "status": "success",
            "summary": summary,
            "payload": payload,
            "provenance": provenance,
            "humanReviewRequired": False,
            "requestId": request_id,
            "taskId": task_id,
        }

    @router.post("/groups/{group_id}/version-comparison")
    async def version_comparison(group_id: int, body: VersionCompareRequest, request: Request) -> dict[str, Any]:
        inputs = _unwrap_inputs(body.model_dump())
        result = await version_service.compare(
            group_id=group_id,
            base_document_id=inputs.get("baseDocumentId"),
            compare_document_id=inputs.get("compareDocumentId"),
            request_id=getattr(request.state, "request_id", None),
        )
        summary = f"{result['diffSummary']['changedCount']} clauses changed"
        return _response(result, summary, request, _task_id_from_request(request, body.model_dump()))

    @router.post("/groups/{group_id}/clauses/search")
    async def clause_search(group_id: int, body: ClauseSearchRequest, request: Request) -> dict[str, Any]:
        inputs = _unwrap_inputs(body.model_dump())
        result = await clause_service.search(
            group_id=group_id,
            clause_id=inputs.get("clauseId"),
            clause_text=inputs.get("clauseText"),
            filters=inputs.get("filters", {}),
            limit=inputs.get("limit", 10),
            request_id=getattr(request.state, "request_id", None),
        )
        summary = f"{len(result['similarClauses'])} similar clauses found"
        return _response(result, summary, request, _task_id_from_request(request, body.model_dump()))

    @router.get("/groups/{group_id}/info")
    async def group_info(group_id: int, request: Request) -> dict[str, Any]:
        result = await group_service.get_group_info(group_id, getattr(request.state, "request_id", None))
        summary = "Group info retrieved"
        return _response(result, summary, request, _task_id_from_request(request))

    @router.get("/templates")
    async def list_templates(request: Request) -> dict[str, Any]:
        result = await template_service.list_templates(getattr(request.state, "request_id", None))
        summary = f"{len(result['templates'])} templates available"
        return _response(result, summary, request, _task_id_from_request(request))

    @router.get("/templates/{template_id}")
    async def get_template(template_id: str, request: Request) -> dict[str, Any]:
        result = await template_service.get_template(template_id, getattr(request.state, "request_id", None))
        if result["template"] is None:
            raise ValidationError("Template not found", hint="Check templateId or update catalog.")
        summary = "Template retrieved"
        return _response(result, summary, request, _task_id_from_request(request))

    @router.post("/groups/bulk-enrich")
    async def bulk_enrich(body: BulkEnrichRequest, request: Request) -> dict[str, Any]:
        inputs = _unwrap_inputs(body.model_dump())
        group_ids = inputs.get("groupIds") or []
        if not group_ids:
            raise ValidationError("groupIds are required for bulk enrichment.", hint="Provide at least one group ID.")
        result = await bulk_service.enrich(group_ids, getattr(request.state, "request_id", None))
        result["provenance"] = [provenance_entry("bulk-enrich")]
        summary = f"Enriched {len(result['results'])} groups"
        return _response(result, summary, request, _task_id_from_request(request, body.model_dump()))

    return router
