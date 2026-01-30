"""AI insights service using the LLM proxy."""

from __future__ import annotations

import json
import re
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
    signing_likelihood: Optional[dict[str, Any]] = None,
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
            "widgets": [],  # No widgets when Salesforce data unavailable
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

    # Condensed summary items - 4 items for clean 2x2 grid
    items = [
        {"label": "Opportunity", "value": opportunity.opportunity_name},
        {"label": "Stage", "value": opportunity.stage_name or "Unknown"},
        {"label": "Close Date", "value": opportunity.close_date or "Not set"},
        {"label": "Health", "value": opportunity.customer_health or "Unknown", "severity": _health_severity(opportunity.customer_health)},
    ]

    # Build exactly 4 dynamic widgets for clean 2x2 grid layout
    widgets: list[dict[str, Any]] = []

    # Generate contextual, actionable insights based on deal stage
    if opportunity.is_won:
        # WON DEAL - Focus on implementation and success
        widgets = [
            {
                "label": "Deal Outcome",
                "value": f"Won · Close {opportunity.close_date}" if opportunity.close_date else "Won",
                "meta": "Contract ready for execution",
                "severity": "low",
            },
            {
                "label": "Immediate Action",
                "value": "Schedule implementation kickoff with customer",
                "meta": f"Close date: {opportunity.close_date}" if opportunity.close_date else "Proceed to onboarding",
            },
            {
                "label": "Customer Success",
                "value": "Assign CSM and create onboarding timeline",
                "meta": f"Health: {opportunity.customer_health or 'Green'} · Priority handoff",
                "severity": "low" if opportunity.customer_health == "Green" else "medium",
            },
            {
                "label": "Contract Action",
                "value": "Prepare final contract for signature",
                "meta": "Legal review complete · Ready to execute",
            },
        ]
    elif opportunity.is_closed and not opportunity.is_won:
        # LOST DEAL - Focus on learnings
        widgets = [
            {
                "label": "Deal Outcome",
                "value": "Lost",
                "meta": f"Closed {opportunity.close_date}" if opportunity.close_date else "Deal closed",
                "severity": "high",
            },
            {
                "label": "Win-Back Action",
                "value": "Schedule post-mortem and document learnings",
                "meta": "Identify competitive gaps",
                "severity": "medium",
            },
            {
                "label": "Re-engagement",
                "value": "Set 90-day follow-up for renewal opportunity",
                "meta": "Maintain relationship for future deals",
            },
            {
                "label": "Account Strategy",
                "value": "Review account plan and adjust approach",
                "meta": "Update CRM with loss reason",
                "severity": "medium",
            },
        ]
    else:
        # OPEN DEAL - Use signing likelihood data for actionable guidance
        sl_data = signing_likelihood.get("signing_likelihood", {}) if signing_likelihood else {}
        score = sl_data.get("score", 50)
        risk_factors = signing_likelihood.get("risk_factors", []) if signing_likelihood else []
        recommendations = signing_likelihood.get("recommendations", []) if signing_likelihood else []

        # Determine urgency based on score
        if score >= 70:
            urgency_label = "High Confidence"
            urgency_action = "Accelerate to close"
            urgency_severity = "low"
        elif score >= 40:
            urgency_label = "Moderate Risk"
            urgency_action = "Address blockers"
            urgency_severity = "medium"
        else:
            urgency_label = "At Risk"
            urgency_action = "Escalate immediately"
            urgency_severity = "high"

        widgets = [
            {
                "label": "Win Probability",
                "value": f"{score}% · {urgency_label}",
                "meta": urgency_action,
                "severity": urgency_severity,
            },
            {
                "label": "Priority Action",
                "value": recommendations[0] if recommendations else "Define clear next steps",
                "meta": f"Due: {opportunity.close_date}" if opportunity.close_date else "Complete this week",
            },
            {
                "label": "Risk Mitigation",
                "value": risk_factors[0] if risk_factors else "No critical blockers identified",
                "meta": f"{len(risk_factors)} risk(s) to address" if risk_factors else "On track",
                "severity": "high" if len(risk_factors) > 1 else ("medium" if risk_factors else "low"),
            },
            {
                "label": "Stakeholder Action",
                "value": "Confirm decision-maker alignment",
                "meta": f"Next step: {opportunity.next_step}" if opportunity.next_step else "Schedule exec sponsor call",
            },
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
        "widgets": widgets,
        "reasoning": reasoning[:4],
        "confidence": 0.7,
    }


class AiInsightsService:
    def __init__(
        self,
        luminance_client: LuminanceClient,
        llm_proxy: Optional[LlmProxyClient],
        salesforce_context: SalesforceContextService,
    ) -> None:
        self.luminance_client = luminance_client
        self.llm_proxy = llm_proxy  # Can be None if LLM proxy is disabled
        self.salesforce_context = salesforce_context
        self._conversation_memory: dict[int, list[dict[str, str]]] = {}

    def _append_memory(self, group_id: int, role: str, content: str) -> None:
        history = self._conversation_memory.setdefault(group_id, [])
        history.append({"role": role, "content": content})
        if len(history) > _MAX_CHAT_HISTORY:
            self._conversation_memory[group_id] = history[-_MAX_CHAT_HISTORY:]

    def _get_memory(self, group_id: int) -> list[dict[str, str]]:
        return self._conversation_memory.get(group_id, [])

    def _extract_company_from_query(self, text: str, current_counterparty: Optional[str]) -> Optional[str]:
        """Extract a company name from user query if they're asking about a different company."""
        if not text:
            return None

        query_lower = text.lower()

        # Common patterns for asking about other companies
        patterns = [
            r"(?:what about|how about|tell me about|status of|look up|find|search for)\s+([A-Z][A-Za-z\s&]+?)(?:\s+deal|\s+opportunity|\s+account|\?|$)",
            r"(?:compare.*?with|versus|vs\.?)\s+([A-Z][A-Za-z\s&]+)",
            r"([A-Z][A-Za-z\s&]{2,}(?:Corp|Inc|LLC|Ltd|Company|Co\.|Corporation))",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                company = match.group(1).strip()
                # Don't return if it's the current counterparty
                if current_counterparty and company.lower() in current_counterparty.lower():
                    continue
                if len(company) > 2 and company.lower() not in ["the", "this", "that", "deal"]:
                    return company

        return None

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
        # HARDCODED FOR DEMO: Use "ACME Corporation" for Salesforce lookup
        counterparty_name = counterparty_name or "ACME Corporation"
        opportunity = await self.salesforce_context.find_opportunity(
            counterparty_name=counterparty_name,
            matter_name=matter_name,
            document_name=document_name,
            matter_id=group_id,
        )

        # Fetch signing likelihood for richer insights
        signing_likelihood = await self.salesforce_context.get_signing_likelihood(
            counterparty_name=counterparty_name,
            matter_name=matter_name,
        )

        summary = _build_summary_from_salesforce(opportunity, matter_name, document_name, signing_likelihood)

        recommendations: list[dict[str, Any]] = []
        workflow_preview = {"transitions": [], "notifications": [], "systems": []}

        # Only generate LLM recommendations if proxy is enabled
        if self.llm_proxy is not None:
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
        else:
            logger.info("LLM proxy disabled - returning Salesforce data without AI recommendations")

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
        # HARDCODED FOR DEMO: Use "ACME Corporation" for Salesforce lookup
        counterparty_name = counterparty_name or "ACME Corporation"

        # Current matter's opportunity
        opportunity = await self.salesforce_context.find_opportunity(
            counterparty_name=counterparty_name,
            matter_name=matter_name,
            document_name=document_name,
            matter_id=group_id,
        )

        # Check if user is asking about a DIFFERENT company
        other_company = self._extract_company_from_query(text, counterparty_name)
        other_opportunity = None
        if other_company:
            other_opportunity = await self.salesforce_context.find_opportunity(
                counterparty_name=other_company,
                matter_name=None,
                document_name=None,
                matter_id=None,
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

        # Intelligent query interpretation - detect what the user is asking for
        query_lower = text.lower()
        
        # Build dynamic filters based on query intent
        search_filters: dict[str, Any] = {}
        search_type = "none"
        
        # Detect if user wants to search Salesforce
        wants_search = any(term in query_lower for term in [
            "other compan", "other account", "other opportunit", "compare", "comparison",
            "similar deal", "other deal", "how many", "list", "all my", "portfolio", 
            "pipeline", "search", "find", "show me", "what do i have", "in my salesforce",
            "in salesforce", "deals", "opportunities"
        ])
        
        if wants_search:
            search_type = "dynamic"
            
            # Stage filters
            if "closed won" in query_lower or "won deal" in query_lower:
                search_filters["is_won"] = True
                search_filters["is_closed"] = True
            elif "closed lost" in query_lower or "lost deal" in query_lower:
                search_filters["is_won"] = False
                search_filters["is_closed"] = True
            elif "open" in query_lower or "pipeline" in query_lower or "in progress" in query_lower:
                search_filters["is_closed"] = False
            elif "same stage" in query_lower and opportunity:
                search_filters["stage"] = opportunity.stage_name
            elif "negotiation" in query_lower:
                search_filters["stage"] = "negotiation"
            elif "prospecting" in query_lower:
                search_filters["stage"] = "prospecting"
            
            # Region filters
            region_patterns = ["same region", "in region", "emea", "apac", "americas", "na", "eu"]
            for pattern in region_patterns:
                if pattern in query_lower:
                    if "same region" in query_lower and opportunity and opportunity.region:
                        search_filters["region"] = opportunity.region
                    elif pattern in ["emea", "apac", "americas", "na", "eu"]:
                        search_filters["region"] = pattern.upper()
                    break
            
            # Health filters
            if "green health" in query_lower or "healthy" in query_lower:
                search_filters["health"] = "green"
            elif "red health" in query_lower or "at risk" in query_lower:
                search_filters["health"] = "red"
            elif "yellow" in query_lower:
                search_filters["health"] = "yellow"
            
            # Probability filters
            if "high probability" in query_lower or "likely to close" in query_lower:
                search_filters["min_probability"] = 70

        # Execute dynamic search if needed
        search_results: list[dict[str, Any]] = []
        if search_type == "dynamic":
            # Only exclude current opportunity if user explicitly asks for "other" companies
            exclude_current = any(term in query_lower for term in ["other compan", "other deal", "other opportun", "compare"])
            search_results = await self.salesforce_context.dynamic_search(
                filters=search_filters,
                current_opportunity_name=opportunity.opportunity_name if (opportunity and exclude_current) else None,
            )
        
        # Build context for the LLM
        additional_context = {
            "search_type": search_type,
            "filters_applied": search_filters,
            "results_count": len(search_results),
            "search_results": search_results[:10],  # Limit to 10 results for LLM context
        }

        # Build context about search results
        search_context = ""
        if search_results:
            search_context = f"\n\nSALESFORCE SEARCH RESULTS ({len(search_results)} found):\n"
            for opp in search_results[:5]:
                search_context += (
                    f"- {opp.get('opportunity_name', 'Unknown')}: "
                    f"Stage={opp.get('stage', 'N/A')}, "
                    f"Close={opp.get('close_date', 'N/A')}, "
                    f"Health={opp.get('customer_health', 'N/A')}, "
                    f"Probability={opp.get('probability', 0)}%"
                )
                if opp.get('region'):
                    search_context += f", Region={opp.get('region')}"
                if opp.get('acv'):
                    search_context += f", ACV=${opp.get('acv'):,.0f}"
                search_context += "\n"
        elif search_type == "dynamic":
            search_context = "\n\nSALESFORCE SEARCH: No matching opportunities found with the specified criteria.\n"

        system_prompt = (
            "You are Lumi, an AI agent connected to Salesforce via MCP (Model Context Protocol).\n\n"
            "CAPABILITIES:\n"
            "- You CAN search and query Salesforce data dynamically\n"
            "- You CAN filter by stage, region, health, probability, and more\n"
            "- You CAN compare opportunities and provide insights\n"
            "- You CAN access contract provisions, financial metrics, and account details\n\n"
            "RESPONSE RULES:\n"
            "1. Be CONCISE - 2-3 sentences max\n"
            "2. Use ACTUAL DATA from search results - cite specific companies and numbers\n"
            "3. Be ACTIONABLE - give specific next steps\n"
            "4. Plain text only - no markdown or bullet points\n"
            "5. If search returned results, LIST THEM with key details\n"
            "6. If no results, clearly state 'I searched Salesforce and found no matches for [criteria]'\n\n"
            "CURRENT MATTER:\n"
            f"- Opportunity: {opportunity.opportunity_name if opportunity else 'Unknown'}\n"
            f"- Stage: {opportunity.stage_name if opportunity else 'Unknown'}\n"
            f"- Close Date: {opportunity.close_date if opportunity else 'Unknown'}\n"
            f"- Health: {opportunity.customer_health if opportunity else 'Unknown'}"
            f"{search_context}\n\n"
            "Respond naturally as an intelligent agent with full Salesforce access."
        )

        user_prompt = {
            "question": text,
            "current_opportunity": {
                "name": opportunity.opportunity_name if opportunity else counterparty_name,
                "stage": opportunity.stage_name if opportunity else None,
                "close_date": opportunity.close_date if opportunity else None,
                "is_won": opportunity.is_won if opportunity else None,
                "is_closed": opportunity.is_closed if opportunity else None,
                "probability": opportunity.probability if opportunity else None,
                "customer_health": opportunity.customer_health if opportunity else None,
                "region": opportunity.region if opportunity else None,
                "acv": opportunity.acv if opportunity else None,
            } if opportunity else None,
            "queried_company": other_company,
            "queried_opportunity": {
                "name": other_opportunity.opportunity_name,
                "stage": other_opportunity.stage_name,
                "close_date": other_opportunity.close_date,
                "is_won": other_opportunity.is_won,
                "probability": other_opportunity.probability,
                "customer_health": other_opportunity.customer_health,
            } if other_opportunity else None,
            "salesforce_search": {
                "executed": search_type == "dynamic",
                "filters": search_filters,
                "results_count": len(search_results),
                "results": search_results[:10],
            },
            "conversation_history": self._get_memory(group_id)[-4:],
        }

        summary_payload = _build_summary_from_salesforce(opportunity, matter_name, document_name)
        
        # If LLM proxy is disabled, return Salesforce context as a structured response
        if self.llm_proxy is None:
            sf_context = opportunity.__dict__ if opportunity else {}
            fallback_message = (
                f"LLM proxy is not configured. Here is the Salesforce context for this matter:\n\n"
                f"Opportunity: {sf_context.get('opportunity_name', 'N/A')}\n"
                f"Stage: {sf_context.get('stage_name', 'N/A')}\n"
                f"Close Date: {sf_context.get('close_date', 'N/A')}\n"
                f"ARR: ${sf_context.get('arr', 0):,.0f}" if sf_context.get('arr') else "ARR: N/A"
            )
            return {
                "message": fallback_message,
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
                    "salesforce_context": sf_context,
                },
                "model": None,
                "usage": None,
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
