"""Clause search service."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from mcp.clients.luminance import LuminanceClient
from mcp.config import config
from mcp.exceptions import NotFoundError, ValidationError
from mcp.logging import get_logger
from mcp.utils.provenance import provenance_entry
from mcp.utils.similarity import combined_similarity

logger = get_logger(__name__)


class ClauseSearchService:
    """Search similar clauses based on clause text."""

    def __init__(self, client: LuminanceClient):
        self.client = client
        self.semaphore = asyncio.Semaphore(config.max_concurrency)

    async def _fetch_clause_from_document(
        self, document_id: int, clause_id: int, request_id: Optional[str]
    ) -> Optional[dict[str, Any]]:
        annotations = await self.client.get_document_annotations(
            config.luminance_project_id,
            document_id,
            params={"id": clause_id},
            request_id=request_id,
        )
        if not annotations:
            return None
        annotation = annotations[0]
        annotation_id = annotation.get("id")
        if not annotation_id:
            return None
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
        return {
            "annotationId": annotation_id,
            "documentId": document_id,
            "clauseText": text_value,
        }

    async def _resolve_source_clause(
        self,
        group_id: int,
        clause_id: Optional[str],
        clause_text: Optional[str],
        request_id: Optional[str],
    ) -> dict[str, Any]:
        if clause_text:
            return {"clauseText": clause_text}
        if not clause_id:
            raise ValidationError("clauseId or clauseText is required.", hint="Provide one input.")

        versions = await self.client.get_matter_versions(
            config.luminance_project_id, group_id, request_id=request_id
        )
        document_ids = []
        for version in versions[: config.max_documents_scan]:
            doc_id = version.get("document_id") or version.get("document", {}).get("id")
            if doc_id:
                document_ids.append(int(doc_id))
        if not document_ids:
            raise NotFoundError("No documents found for group.", hint="Ensure versions are available.")

        clause_id_int = int("".join([c for c in clause_id if c.isdigit()]) or 0)
        if not clause_id_int:
            raise ValidationError("Invalid clauseId format.", hint="Use numeric clause IDs.")

        for doc_id in document_ids:
            result = await self._fetch_clause_from_document(doc_id, clause_id_int, request_id)
            if result and result.get("clauseText"):
                return result
        raise NotFoundError("Clause not found in group documents.", hint="Check clauseId and group documents.")

    async def _candidate_documents(self, request_id: Optional[str]) -> list[dict[str, Any]]:
        params = {"limit": config.max_documents_scan, "offset": 0}
        return await self.client.list_documents(
            config.luminance_project_id, params=params, request_id=request_id
        )

    async def _fetch_document_clauses(
        self, document: dict[str, Any], request_id: Optional[str]
    ) -> list[dict[str, Any]]:
        async with self.semaphore:
            annotations = await self.client.get_document_annotations(
                config.luminance_project_id,
                int(document["id"]),
                request_id=request_id,
            )
        return annotations[: config.max_clauses_per_document]

    async def _document_metadata(self, document: dict[str, Any], request_id: Optional[str]) -> dict[str, Any]:
        matter_id = document.get("matter_id") or document.get("version_group") or document.get("group_id")
        if not matter_id:
            return {"groupId": None, "governingLaw": None, "tcv": None}
        try:
            matter = await self.client.get_matter(
                config.luminance_project_id, int(matter_id), request_id=request_id
            )
            info = matter.get("info", {})
            return {
                "groupId": int(matter_id),
                "governingLaw": info.get("governing_law") or info.get("governingLaw"),
                "tcv": info.get("total_contract_value") or info.get("tcv"),
            }
        except Exception:
            return {"groupId": int(matter_id), "governingLaw": None, "tcv": None}

    def _passes_filters(self, metadata: dict[str, Any], filters: dict[str, Any]) -> bool:
        governing_law = filters.get("governingLaw")
        tcv_range = filters.get("tcvRange") or {}
        if governing_law and metadata.get("governingLaw"):
            if governing_law.lower() not in str(metadata["governingLaw"]).lower():
                return False
        if tcv_range:
            tcv = metadata.get("tcv")
            if tcv is None:
                return False
            min_val = tcv_range.get("min")
            max_val = tcv_range.get("max")
            if min_val is not None and tcv < min_val:
                return False
            if max_val is not None and tcv > max_val:
                return False
        return True

    async def search(
        self,
        group_id: int,
        clause_id: Optional[str],
        clause_text: Optional[str],
        filters: dict[str, Any],
        limit: int,
        request_id: Optional[str],
    ) -> dict[str, Any]:
        source_clause = await self._resolve_source_clause(group_id, clause_id, clause_text, request_id)
        source_text = source_clause.get("clauseText", "")

        documents = await self._candidate_documents(request_id)
        results: list[dict[str, Any]] = []
        provenance = [
            provenance_entry(f"/api2/projects/{config.luminance_project_id}/documents"),
        ]

        async def process_document(document: dict[str, Any]) -> None:
            clauses = await self._fetch_document_clauses(document, request_id)
            metadata = await self._document_metadata(document, request_id)
            if not self._passes_filters(metadata, filters):
                return
            for annotation in clauses:
                text = annotation.get("content", {}).get("text") or annotation.get("text") or ""
                if not text:
                    continue
                score = combined_similarity(source_text, text)
                results.append(
                    {
                        "documentId": int(document["id"]),
                        "groupId": metadata.get("groupId") or group_id,
                        "governingLaw": metadata.get("governingLaw"),
                        "tcv": metadata.get("tcv"),
                        "similarityScore": score,
                        "clauseText": text,
                        "excerptPath": annotation.get("path") or annotation.get("location") or "unknown",
                    }
                )

        await asyncio.gather(*(process_document(doc) for doc in documents))

        results_sorted = sorted(results, key=lambda item: item["similarityScore"], reverse=True)[:limit]
        return {
            "sourceClause": source_clause,
            "similarClauses": results_sorted,
            "provenance": provenance,
        }
