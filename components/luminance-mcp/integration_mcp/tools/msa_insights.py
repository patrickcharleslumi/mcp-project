"""Tool for generating MSA insights using the Luminance LLM Proxy."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from integration_mcp.llm_proxy_client import LlmProxyClient
from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.logger import get_logger
from integration_mcp.tools.base import ToolHandler

logger = get_logger(__name__)


def _extract_annotation_text(annotation: dict[str, Any]) -> Optional[str]:
    candidate_keys = [
        "text",
        "content",
        "value",
        "excerpt",
        "snippet",
        "clause_text",
        "clauseText",
    ]
    for key in candidate_keys:
        value = annotation.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def get_msa_insights_tool(
    client: LuminanceClient, llm_proxy_client: LlmProxyClient
) -> ToolHandler:
    """Create the generate_msa_insights tool."""
    input_schema = {
        "type": "object",
        "properties": {
            "project_id": {
                "type": "integer",
                "description": "Project ID containing the MSA document",
            },
            "document_id": {
                "type": "integer",
                "description": "MSA document ID to analyze",
            },
            "clause_types": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional clause types to focus on (e.g., liability_cap)",
            },
            "focus_area": {
                "type": "string",
                "description": "Optional focus for recommendations (e.g., risk, negotiation)",
            },
            "max_clauses_per_type": {
                "type": "integer",
                "default": 5,
                "minimum": 1,
                "maximum": 20,
                "description": "Max clauses per type to send to the model",
            },
            "model": {
                "type": "string",
                "description": "Optional override for the LLM proxy model",
            },
            "temperature": {
                "type": "number",
                "minimum": 0,
                "maximum": 2,
                "description": "Sampling temperature for the model",
            },
            "max_tokens": {
                "type": "integer",
                "minimum": 64,
                "maximum": 4096,
                "description": "Max tokens for the LLM response",
            },
        },
        "required": ["project_id", "document_id"],
    }

    async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
        project_id = arguments["project_id"]
        document_id = arguments["document_id"]
        clause_types = arguments.get("clause_types")
        focus_area = arguments.get("focus_area", "msa_optimization")
        max_clauses_per_type = arguments.get("max_clauses_per_type", 5)

        model_override = arguments.get("model")
        temperature = arguments.get("temperature")
        max_tokens = arguments.get("max_tokens")

        logger.info(
            "Generating MSA insights",
            project_id=project_id,
            document_id=document_id,
            clause_types=clause_types,
            focus_area=focus_area,
        )

        document = await client.get_document(project_id, document_id)
        grouped = await client.get_clause_annotations(project_id, document_id, clause_types)

        clause_summaries: list[dict[str, Any]] = []
        for clause_type, annotations in grouped.items():
            if not annotations:
                continue
            extracted = []
            for ann in annotations:
                text = _extract_annotation_text(ann)
                if text:
                    extracted.append(text)
                if len(extracted) >= max_clauses_per_type:
                    break
            if extracted:
                clause_summaries.append(
                    {
                        "clause_type": clause_type,
                        "clauses": extracted,
                    }
                )

        system_prompt = (
            "You are a Luminance solutions engineer helping optimize MSAs. "
            "Return ONLY valid JSON with keys: summary, recommendations, workflow_preview. "
            "Keep responses concise and specific to the provided clauses."
        )
        user_prompt = {
            "document": {
                "id": document.get("id"),
                "name": document.get("name"),
                "project_id": project_id,
            },
            "focus_area": focus_area,
            "clauses": clause_summaries,
            "instructions": (
                "Provide 3-5 key risk or negotiation insights, "
                "and 3-5 actionable recommendations."
            ),
        }

        response = await llm_proxy_client.chat_completions(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
            model=model_override,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = (
            response.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        insights_payload = None
        if isinstance(content, str) and content.strip():
            try:
                normalized = content.strip()
                if "```" in normalized:
                    parts = normalized.split("```")
                    if len(parts) >= 3:
                        normalized = parts[1].strip()
                    if normalized.startswith("json"):
                        normalized = normalized[4:].strip()
                insights_payload = json.loads(normalized)
            except json.JSONDecodeError:
                insights_payload = None

        return {
            "document": {
                "id": document.get("id"),
                "name": document.get("name"),
                "project_id": project_id,
            },
            "model": response.get("model"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "insights_payload": insights_payload,
            "insights_text": content,
            "usage": response.get("usage"),
        }

    handler = ToolHandler(
        name="generate_msa_insights",
        description=(
            "Generate MSA optimization insights using the Luminance LLM Proxy. "
            "Returns a JSON-ready payload if the model responds with valid JSON."
        ),
        input_schema=input_schema,
    )

    handler._execute = execute
    return handler
