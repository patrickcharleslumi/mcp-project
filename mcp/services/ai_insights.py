"""AI insights service using the LLM proxy."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from mcp.clients.llm_proxy import LlmProxyClient
from mcp.clients.luminance import LuminanceClient
from mcp.config import config
from mcp.exceptions import NotFoundError, UpstreamError
from mcp.logging import get_logger
from mcp.services.salesforce_context import SalesforceContextService, SalesforceOpportunity

logger = get_logger(__name__)

_MAX_CHAT_HISTORY = 6
_MAX_CLAUSE_SAMPLES = 12


def _extract_annotation_text(annotation: dict[str, Any]) -> Optional[str]:
    for key in ("text", "content", "value", "excerpt", "snippet", "clause_text", "clauseText"):
        value = annotation.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_json(content: str) -> Optional[dict[str, Any]]:
    normalized = content.strip()
    if "```" in normalized:
        parts = normalized.split("```")
        if len(parts) >= 3:
            normalized = parts[1].strip()
        if normalized.startswith("json"):
            normalized = normalized[4:].strip()
    try:
        return json.loads(normalized)
    except json.JSONDecodeError:
        return None


def _format_currency(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    return f"${value:,.0f}"


def _format_percent(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    if value.is_integer():
        return f"{int(value)}%"
    return f"{value:.1f}%"


def _format_bool(value: Optional[bool]) -> Optional[str]:
    if value is None:
        return None
    return "Required" if value else "Not required"


def _health_severity(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized == "red":
        return "high"
    if normalized == "yellow":
        return "medium"
    if normalized == "green":
        return "low"
    return None


def _review_severity(legal_required: Optional[bool], security_required: Optional[bool]) -> Optional[str]:
    if legal_required or security_required:
        return "medium"
    if legal_required is False and security_required is False:
        return "low"
    return None


def _format_stage_close(stage: Optional[str], close_date: Optional[str]) -> Optional[str]:
    if stage and close_date:
        return f"{stage} · Close {close_date}"
    return stage or close_date


def _extract_counterparty_name(matter: Optional[dict[str, Any]]) -> Optional[str]:
    if not isinstance(matter, dict):
        return None
    raw = matter.get("counterparty") or matter.get("counterparty_value") or matter.get("counterpartyValue")
    if isinstance(raw, str):
        return raw.strip() or None
    if isinstance(raw, dict):
        for key in ("name", "value", "label", "counterparty_name"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _extract_salesforce_query(text: str) -> Optional[str]:
    if not text:
        return None
    normalized = text.strip()
    match = re.search(r"\bfor\s+(.+)$", normalized, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip().strip('"').strip("'") or None
    match = re.search(r"\babout\s+(.+)$", normalized, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip().strip('"').strip("'") or None
    return None


def _pick_fields(source: Any, keys: list[str]) -> dict[str, Any]:
    if not isinstance(source, dict):
        return {}
    picked: dict[str, Any] = {}
    for key in keys:
        value = source.get(key)
        if value is not None:
            picked[key] = value
    return picked


def _build_summary_from_salesforce(
    opportunity: Optional[SalesforceOpportunity],
    matter_name: Optional[str],
    document_name: Optional[str],
) -> dict[str, Any]:
    if not opportunity:
        fallback_items = []
        if matter_name:
            fallback_items.append({"label": "Matter", "value": matter_name})
        if document_name:
            fallback_items.append({"label": "Document", "value": document_name})
        fallback_items.append(
            {
                "label": "Salesforce context",
                "value": "Not available",
                "severity": "medium",
            }
        )
        return {
            "items": fallback_items,
            "reasoning": [
                "Salesforce context was not found for this matter. Verify the Salesforce MCP connection or data source.",
            ],
            "confidence": 0.3,
        }

    stage_close = _format_stage_close(opportunity.stage_name, opportunity.close_date) or "Unknown"
    arr_value = _format_currency(opportunity.arr) or _format_currency(opportunity.acv) or "Unknown"
    org_value_parts = [part for part in [opportunity.region, opportunity.business_unit] if part]
    organization_value = " · ".join(org_value_parts) if org_value_parts else "Unknown"
    review_value_parts = [
        f"Legal: {_format_bool(opportunity.legal_required) or 'Unknown'}",
        f"Security: {_format_bool(opportunity.security_review_required) or 'Unknown'}",
    ]
    review_value = " · ".join(review_value_parts)

    discount_percent = _format_percent(opportunity.discount)
    discount_amount = _format_currency(opportunity.total_discount)
    discount_value = "No discount"
    if discount_percent or discount_amount:
        discount_value = " ".join(
            part for part in [discount_percent, discount_amount] if part is not None
        )

    health_value = opportunity.customer_health or "Unknown"
    if opportunity.procurement_pressure:
        health_value = f"{health_value} · Procurement pressure {opportunity.procurement_pressure}"

    items = [
        {"label": "Opportunity", "value": opportunity.opportunity_name},
        {"label": "Stage / Close", "value": stage_close},
        {"label": "ARR (est.)", "value": arr_value},
        {"label": "Region / BU", "value": organization_value},
        {
            "label": "Legal / Security review",
            "value": review_value,
            "severity": _review_severity(opportunity.legal_required, opportunity.security_review_required),
        },
        {
            "label": "Commercials",
            "value": discount_value if opportunity.payment_terms is None else f"{discount_value} · {opportunity.payment_terms}",
            "severity": "medium" if opportunity.discount and opportunity.discount >= 15 else None,
        },
        {"label": "Customer health", "value": health_value, "severity": _health_severity(opportunity.customer_health)},
    ]

    reasoning = []
    if opportunity.next_step:
        reasoning.append(f"Next step: {opportunity.next_step}")
    if opportunity.non_standard_terms_requested is not None:
        flag = "Yes" if opportunity.non_standard_terms_requested else "No"
        reasoning.append(f"Non-standard terms requested: {flag}")
    if opportunity.redline_count is not None:
        reasoning.append(f"Redlines to date: {opportunity.redline_count}")
    if opportunity.open_cases_count is not None:
        open_cases = f"Open cases: {opportunity.open_cases_count}"
        if opportunity.max_open_case_severity:
            open_cases += f" (max severity {opportunity.max_open_case_severity})"
        reasoning.append(open_cases)
    if opportunity.sla_breach is not None:
        reasoning.append(f"SLA breach: {'Yes' if opportunity.sla_breach else 'No'}")

    return {
        "items": items,
        "reasoning": reasoning[:4],
        "confidence": 0.7,
    }


class AiInsightsService:
    def __init__(
        self,
        luminance_client: LuminanceClient,
        llm_proxy: LlmProxyClient,
        salesforce_context: SalesforceContextService,
    ) -> None:
        self.luminance_client = luminance_client
        self.llm_proxy = llm_proxy
        self.salesforce_context = salesforce_context
        self._conversation_memory: dict[int, list[dict[str, str]]] = {}

    def _append_memory(self, group_id: int, role: str, content: str) -> None:
        history = self._conversation_memory.setdefault(group_id, [])
        history.append({"role": role, "content": content})
        if len(history) > _MAX_CHAT_HISTORY:
            self._conversation_memory[group_id] = history[-_MAX_CHAT_HISTORY:]

    def _get_memory(self, group_id: int) -> list[dict[str, str]]:
        return self._conversation_memory.get(group_id, [])

    async def generate_insights(self, group_id: int, request_id: Optional[str] = None) -> dict[str, Any]:
        versions = await self.luminance_client.get_matter_versions(
            config.luminance_project_id,
            group_id,
            request_id=request_id,
        )
        if not versions:
            raise NotFoundError("No versions found for group", hint="Check group ID or permissions.")

        first = versions[0]
        document_id = first.get("document_id") or first.get("documentId") or first.get("id")
        if not document_id:
            raise NotFoundError("No document found for group", hint="Missing document_id in versions response.")

        document = await self.luminance_client.get_document(
            config.luminance_project_id,
            int(document_id),
            request_id=request_id,
        )
        matter = await self.luminance_client.get_matter(
            config.luminance_project_id,
            group_id,
            request_id=request_id,
        )
        annotations = await self.luminance_client.get_document_annotations(
            config.luminance_project_id,
            int(document_id),
            request_id=request_id,
        )

        clause_texts = []
        for ann in annotations:
            text = _extract_annotation_text(ann)
            if text:
                clause_texts.append(text)
            if len(clause_texts) >= config.max_clauses_per_document:
                break

        matter_name = matter.get("name") if isinstance(matter, dict) else None
        document_name = document.get("name") if isinstance(document, dict) else None
        counterparty_name = _extract_counterparty_name(matter)
        query_override = _extract_salesforce_query(text)
        if query_override:
            counterparty_name = query_override
        opportunity = await self.salesforce_context.find_opportunity(
            counterparty_name=counterparty_name,
            matter_name=matter_name,
            document_name=document_name,
            matter_id=group_id,
        )
        summary = _build_summary_from_salesforce(opportunity, matter_name, document_name)

        recommendations: list[dict[str, Any]] = []
        workflow_preview = {"transitions": [], "notifications": [], "systems": []}

        system_prompt = (
            "You are Lumi, the Luminance AI assistant. "
            "Return ONLY valid JSON with keys: recommendations and workflow_preview. "
            "recommendations is an array of {id,title,description,rationale,confidence?,preview?}. "
            "workflow_preview has transitions, notifications, systems arrays. "
            "Do not mention internal IDs or the term 'group'."
        )

        user_prompt = {
            "matter_name": matter_name,
            "document_name": document_name,
            "salesforce_commercial_context": opportunity.__dict__ if opportunity else None,
            "clauses": clause_texts,
            "instructions": "Generate 3-5 concise, actionable recommendations for this matter.",
        }

        try:
            response = await self.llm_proxy.chat_completions(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_prompt)},
                ],
            )
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            payload = _extract_json(content) if isinstance(content, str) else None
            if payload:
                recommendations = payload.get("recommendations", recommendations)
                workflow_preview = payload.get("workflow_preview", workflow_preview)
        except Exception as exc:
            logger.warning("LLM proxy failed to generate recommendations", error=str(exc))

        return {
            "summary": summary,
            "recommendations": recommendations,
            "workflow_preview": workflow_preview,
            "metadata": {
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "new_insights_count": len(recommendations),
            },
        }

    async def query_agent(self, group_id: int, text: str, request_id: Optional[str] = None) -> dict[str, Any]:
        versions = await self.luminance_client.get_matter_versions(
            config.luminance_project_id,
            group_id,
            request_id=request_id,
        )
        if not versions:
            raise NotFoundError("No versions found for group", hint="Check group ID or permissions.")

        first = versions[0]
        document_id = first.get("document_id") or first.get("documentId") or first.get("id")
        if not document_id:
            raise NotFoundError("No document found for group", hint="Missing document_id in versions response.")

        document = await self.luminance_client.get_document(
            config.luminance_project_id,
            int(document_id),
            request_id=request_id,
        )
        matter = await self.luminance_client.get_matter(
            config.luminance_project_id,
            group_id,
            request_id=request_id,
        )
        annotations = await self.luminance_client.get_document_annotations(
            config.luminance_project_id,
            int(document_id),
            request_id=request_id,
        )

        clause_texts = []
        for ann in annotations:
            text_value = _extract_annotation_text(ann)
            if text_value:
                clause_texts.append(text_value)
            if len(clause_texts) >= config.max_clauses_per_document:
                break

        matter_name = matter.get("name") if isinstance(matter, dict) else None
        document_name = document.get("name") if isinstance(document, dict) else None
        counterparty_name = _extract_counterparty_name(matter)
        opportunity = await self.salesforce_context.find_opportunity(
            counterparty_name=counterparty_name,
            matter_name=matter_name,
            document_name=document_name,
            matter_id=group_id,
        )

        matter_summary = _pick_fields(
            matter,
            [
                "id",
                "name",
                "status",
                "stage",
                "state",
                "counterparty",
                "created_at",
                "updated_at",
            ],
        )
        document_summary = _pick_fields(
            document,
            [
                "id",
                "name",
                "status",
                "source",
                "created_at",
                "updated_at",
            ],
        )

        clause_samples = clause_texts[:_MAX_CLAUSE_SAMPLES]

        system_prompt = (
            "You are Lumi, the Luminance AI assistant for legal document analysis. "
            "Always respond using the latest context provided. "
            "Prioritise Salesforce commercial context when present. "
            "If Salesforce context is missing, clearly state that it could not be resolved from the "
            "Counterparty Name matter tag and suggest verifying the tag mapping. "
            "Do not speculate or claim Salesforce data you do not have. "
            "Do not ask the user to provide basic context that is already in the payload. "
            "Use matter-centric language (not 'group'). "
            "Keep responses concise, professional, and plain text (no markdown)."
        )
        user_prompt = {
            "question": text,
            "matter": matter_summary or {"name": matter_name},
            "document": document_summary or {"name": document_name},
            "counterparty_name": counterparty_name,
            "matter_id": group_id,
            "clauses_sample": clause_samples,
            "clause_count": len(clause_texts),
            "salesforce_commercial_context": opportunity.__dict__ if opportunity else None,
            "conversation_history": self._get_memory(group_id),
        }

        response = await self.llm_proxy.chat_completions(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ]
        )
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not isinstance(content, str) or not content.strip():
            raise UpstreamError("LLM proxy returned empty response", hint="Check model configuration.")
        self._append_memory(group_id, "user", text)
        self._append_memory(group_id, "assistant", content.strip())
        summary_payload = _build_summary_from_salesforce(opportunity, matter_name, document_name)
        return {
            "message": content.strip(),
            "insights_payload": {
                "summary": summary_payload,
                "recommendations": [],
                "workflow_preview": {"transitions": [], "notifications": [], "systems": []},
                "metadata": {"last_updated": datetime.now(timezone.utc).isoformat()},
            },
            "context": {
                "document_id": document.get("id"),
                "document_name": document.get("name"),
                "clause_count": len(clause_texts),
            },
            "model": response.get("model"),
            "usage": response.get("usage"),
        }
