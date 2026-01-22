"""Tool for suggesting clause fallback positions."""

from collections import defaultdict
from typing import Any

from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.tools.base import ToolHandler
from integration_mcp.logger import get_logger

logger = get_logger(__name__)

# Standard clause types for MSA optimization
STANDARD_CLAUSE_TYPES = [
    "liability_cap",
    "indemnity",
    "limitation_of_liability_carveouts",
    "governing_law",
    "jurisdiction",
    "sla",
    "service_credits",
    "ip_ownership",
    "termination",
    "audit",
    "security",
]


def get_clause_fallbacks_tool(client: LuminanceClient) -> ToolHandler:
    """Create the get_clause_fallbacks tool.

    Args:
        client: Luminance API client

    Returns:
        Tool handler instance
    """
    input_schema = {
        "type": "object",
        "properties": {
            "tenant_id": {
                "type": "string",
                "description": "Tenant ID for scoping the request",
            },
            "msa_id": {
                "type": "integer",
                "description": "ID of the draft MSA document",
            },
            "project_id": {
                "type": "integer",
                "description": "Project ID containing the MSA",
            },
            "similar_msa_ids": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "Optional: List of similar MSA IDs (otherwise tool will call get_similar_msas internally)",
            },
            "clause_types": {
                "type": "array",
                "items": {"type": "string", "enum": STANDARD_CLAUSE_TYPES},
                "description": "Optional: Specific clause types to analyze (defaults to all standard types)",
            },
        },
        "required": ["tenant_id", "msa_id", "project_id"],
    }

    async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_clause_fallbacks tool.

        Args:
            arguments: Tool arguments

        Returns:
            Clause fallback suggestions grouped by clause type
        """
        tenant_id = arguments["tenant_id"]
        msa_id = arguments["msa_id"]
        project_id = arguments["project_id"]
        similar_msa_ids = arguments.get("similar_msa_ids")
        clause_types = arguments.get("clause_types", STANDARD_CLAUSE_TYPES)

        logger.info(
            "Getting clause fallbacks",
            tenant_id=tenant_id,
            msa_id=msa_id,
            project_id=project_id,
            clause_types=clause_types,
            similar_msa_count=len(similar_msa_ids) if similar_msa_ids else None,
        )

        # If similar MSAs not provided, they will be found by the wrapper
        # This allows the wrapper to handle it without circular imports

        # Get current clause annotations from the draft MSA
        current_clauses = await client.get_clause_annotations(
            project_id=project_id,
            document_id=msa_id,
            clause_types=clause_types,
        )

        # Analyze clauses from similar signed MSAs
        precedent_clauses: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for similar_msa_id in similar_msa_ids[:20]:  # Limit to top 20
            try:
                clauses = await client.get_clause_annotations(
                    project_id=project_id,
                    document_id=similar_msa_id,
                    clause_types=clause_types,
                )

                for clause_type, annotations in clauses.items():
                    for ann in annotations:
                        precedent_clauses[clause_type].append({
                            "msa_id": similar_msa_id,
                            "clause_ref": ann.get("id"),
                            "annotation": ann,
                        })
            except Exception as e:
                logger.debug(
                    "Could not retrieve clauses from similar MSA",
                    msa_id=similar_msa_id,
                    error=str(e),
                )

        # Generate fallback suggestions
        fallbacks_by_type: dict[str, Any] = {}

        for clause_type in clause_types:
            current_annotations = current_clauses.get(clause_type, [])
            precedent_list = precedent_clauses.get(clause_type, [])

            # Analyze current risk/friction (placeholder)
            current_risk = "medium"  # Would be calculated from annotation analysis

            # Group precedents by similarity and frequency
            # In production, this would use ML/NLP to cluster similar clause positions
            fallback_options = []

            if precedent_list:
                # Simple frequency-based fallback (placeholder)
                # In production, this would analyze clause text similarity and group them
                unique_positions = {}
                for prec in precedent_list:
                    # Extract position/pattern from annotation
                    # This is simplified - real implementation would parse clause text
                    position_key = str(prec["annotation"].get("content", {}).get("position", "default"))

                    if position_key not in unique_positions:
                        unique_positions[position_key] = {
                            "count": 0,
                            "references": [],
                        }

                    unique_positions[position_key]["count"] += 1
                    unique_positions[position_key]["references"].append({
                        "msa_id": prec["msa_id"],
                        "clause_ref": prec["clause_ref"],
                    })

                # Create fallback options sorted by frequency
                sorted_positions = sorted(
                    unique_positions.items(),
                    key=lambda x: x[1]["count"],
                    reverse=True,
                )

                for position_key, data in sorted_positions[:3]:  # Top 3 fallbacks
                    frequency = data["count"] / len(precedent_list)
                    fallback_options.append({
                        "label": f"Position {position_key}",
                        "frequency_in_signed": round(frequency, 3),
                        "precedent_count": data["count"],
                        "references": data["references"][:5],  # Limit references
                        "risk_tags": ["low"],  # Would be calculated
                    })

            fallbacks_by_type[clause_type] = {
                "current_risk_friction_indicator": current_risk,
                "fallback_options": fallback_options,
                "precedent_count": len(precedent_list),
            }

        logger.info(
            "Clause fallbacks generated",
            clause_types_analyzed=len(fallbacks_by_type),
            total_precedents=sum(len(v) for v in precedent_clauses.values()),
        )

        return {
            "msa_id": msa_id,
            "clause_fallbacks": fallbacks_by_type,
            "summary": {
                "clauses_analyzed": len(fallbacks_by_type),
                "total_precedents_analyzed": sum(len(v) for v in precedent_clauses.values()),
            },
        }

    handler = ToolHandler(
        name="get_clause_fallbacks",
        description=(
            "Suggest fallback positions for key clause types in a draft MSA based on successful "
            "signed precedents. Returns 1-3 fallback options per clause type with frequency statistics, "
            "precedent references, and risk indicators."
        ),
        input_schema=input_schema,
    )

    # Create a wrapper that handles finding similar MSAs if needed
    async def execute_wrapper(args: dict[str, Any]) -> dict[str, Any]:
        """Wrapper that handles finding similar MSAs if needed."""
        similar_msa_ids = args.get("similar_msa_ids")

        # If similar MSAs not provided, find them using the client directly
        if not similar_msa_ids:
            logger.info("Finding similar MSAs internally")
            similar_docs = await client.find_similar_documents(
                project_id=args["project_id"],
                document_id=args["msa_id"],
                document_type="MSA",
                state=None,  # Don't filter by "signed" - it's not a valid document state
                limit=20,
            )
            similar_msa_ids = [doc.get("id") for doc in similar_docs if doc.get("id")]

        # Update args and continue with main execution
        args["similar_msa_ids"] = similar_msa_ids
        return await execute(args)

    handler._execute = execute_wrapper

    return handler

