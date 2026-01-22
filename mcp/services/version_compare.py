"""Version comparison service."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from mcp.clients.luminance import LuminanceClient
from mcp.config import config
from mcp.exceptions import NotFoundError
from mcp.logging import get_logger
from mcp.utils.diffing import ClauseDiff, diff_score, explain_diff
from mcp.utils.provenance import provenance_entry

logger = get_logger(__name__)


def _parse_document_id(document_id: Optional[str]) -> Optional[int]:
    if not document_id:
        return None
    digits = "".join([c for c in document_id if c.isdigit()])
    return int(digits) if digits else None


class VersionCompareService:
    """Compute version comparison for a group."""

    def __init__(self, client: LuminanceClient):
        self.client = client

    async def _get_latest_document_ids(self, group_id: int, request_id: Optional[str]) -> tuple[int, int]:
        versions = await self.client.get_matter_versions(config.luminance_project_id, group_id, request_id=request_id)
        if not versions:
            raise NotFoundError("No versions found for group.", hint="Ensure the group has document versions.")

        sorted_versions = sorted(
            versions,
            key=lambda v: v.get("created_at") or v.get("updated_at") or v.get("id"),
            reverse=True,
        )
        latest = sorted_versions[0]
        previous = sorted_versions[1] if len(sorted_versions) > 1 else sorted_versions[0]
        latest_doc = latest.get("document_id") or latest.get("document", {}).get("id")
        previous_doc = previous.get("document_id") or previous.get("document", {}).get("id")
        if not latest_doc or not previous_doc:
            raise NotFoundError("Document IDs missing from matter versions.", hint="Check matter version payloads.")
        return int(previous_doc), int(latest_doc)

    async def _fetch_clause_texts(
        self, document_id: int, request_id: Optional[str]
    ) -> list[dict[str, Any]]:
        annotations = await self.client.get_document_annotations(
            config.luminance_project_id,
            document_id,
            request_id=request_id,
        )
        clause_annotations = annotations[: config.max_clauses_per_document]
        results: list[dict[str, Any]] = []
        for annotation in clause_annotations:
            annotation_id = annotation.get("id")
            if not annotation_id:
                continue
            try:
                text_payload = await self.client.get_annotation_text(
                    config.luminance_project_id,
                    document_id,
                    annotation_id,
                    request_id=request_id,
                )
                text_value = text_payload.get("text") or text_payload.get("content") or ""
            except Exception:
                text_value = annotation.get("content", {}).get("text") or ""
            annotation_type = annotation.get("annotation_type") or annotation.get("type") or {}
            clause_key = None
            if isinstance(annotation_type, dict):
                clause_key = annotation_type.get("key") or annotation_type.get("type") or annotation_type.get("name")
            if not clause_key:
                clause_key = f"clause-{annotation_id}"
            results.append(
                {
                    "id": str(annotation_id),
                    "key": str(clause_key),
                    "text": text_value,
                    "path": annotation.get("path") or annotation.get("location") or str(clause_key),
                }
            )
        return results

    async def compare(
        self,
        group_id: int,
        base_document_id: Optional[str],
        compare_document_id: Optional[str],
        request_id: Optional[str],
    ) -> dict[str, Any]:
        base_id = _parse_document_id(base_document_id)
        compare_id = _parse_document_id(compare_document_id)
        if not base_id or not compare_id:
            base_id, compare_id = await self._get_latest_document_ids(group_id, request_id)

        base_doc = await self.client.get_document(config.luminance_project_id, base_id, request_id=request_id)
        compare_doc = await self.client.get_document(config.luminance_project_id, compare_id, request_id=request_id)

        base_clauses, compare_clauses = await asyncio.gather(
            self._fetch_clause_texts(base_id, request_id),
            self._fetch_clause_texts(compare_id, request_id),
        )

        clause_map = {clause["key"]: clause for clause in base_clauses}
        diffs: list[ClauseDiff] = []
        for clause in compare_clauses:
            key = clause["key"]
            base_clause = clause_map.get(key)
            if not base_clause:
                continue
            score = diff_score(base_clause["text"], clause["text"])
            if score < 0.98:
                diffs.append(
                    ClauseDiff(
                        clause_id=clause["id"],
                        path=str(clause["path"]),
                        old_text=base_clause["text"],
                        new_text=clause["text"],
                        diff_score=score,
                        explanation=explain_diff(base_clause["text"], clause["text"]),
                    )
                )

        diff_summary = {
            "changedCount": len(diffs),
            "baseDocumentId": base_id,
            "compareDocumentId": compare_id,
        }

        references = {
            "base": {"id": base_id, "updated_at": base_doc.get("updated_at")},
            "compare": {"id": compare_id, "updated_at": compare_doc.get("updated_at")},
        }

        confidence = 0.78 if diffs else 0.9

        provenance = [
            provenance_entry(f"/api2/projects/{config.luminance_project_id}/documents/{base_id}"),
            provenance_entry(f"/api2/projects/{config.luminance_project_id}/documents/{compare_id}"),
            provenance_entry(f"/api2/projects/{config.luminance_project_id}/documents/{base_id}/annotations"),
            provenance_entry(f"/api2/projects/{config.luminance_project_id}/documents/{compare_id}/annotations"),
        ]

        return {
            "diffSummary": diff_summary,
            "changedClauses": [
                {
                    "clauseId": diff.clause_id,
                    "path": diff.path,
                    "oldText": diff.old_text,
                    "newText": diff.new_text,
                    "diffScore": diff.diff_score,
                    "explanation": diff.explanation,
                }
                for diff in diffs
            ],
            "confidence": confidence,
            "references": references,
            "provenance": provenance,
        }
