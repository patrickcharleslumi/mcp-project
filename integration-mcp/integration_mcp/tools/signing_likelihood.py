"""Tool for estimating signing likelihood for MSA scenarios."""

from typing import Any

from integration_mcp.config import config
from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.tools.base import ToolHandler
from integration_mcp.logger import get_logger

logger = get_logger(__name__)


def estimate_signing_likelihood_tool(client: LuminanceClient) -> ToolHandler:
    """Create the estimate_signing_likelihood tool.

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
            "company_context": {
                "type": "object",
                "description": "Company context object (from get_company_context)",
                "properties": {
                    "company_id": {"type": "string"},
                    "size_bucket": {"type": "string"},
                    "region": {"type": "string"},
                    "jurisdiction": {"type": "string"},
                    "industry": {"type": "string"},
                },
            },
            "scenarios": {
                "type": "array",
                "description": "List of scenarios to score, each specifying clause overrides",
                "items": {
                    "type": "object",
                    "properties": {
                        "scenario_id": {"type": "string"},
                        "scenario_name": {"type": "string"},
                        "clause_overrides": {
                            "type": "object",
                            "description": "Map of clause_type to fallback selection",
                        },
                    },
                    "required": ["scenario_id", "scenario_name"],
                },
            },
        },
        "required": ["tenant_id", "msa_id", "project_id", "company_context", "scenarios"],
    }

    async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute estimate_signing_likelihood tool.

        Args:
            arguments: Tool arguments

        Returns:
            Scoring results for each scenario
        """
        if not config.enable_signing_likelihood:
            raise ValueError("Signing likelihood estimation is disabled")

        tenant_id = arguments["tenant_id"]
        msa_id = arguments["msa_id"]
        project_id = arguments["project_id"]
        company_context = arguments["company_context"]
        scenarios = arguments["scenarios"]

        logger.info(
            "Estimating signing likelihood",
            tenant_id=tenant_id,
            msa_id=msa_id,
            project_id=project_id,
            scenario_count=len(scenarios),
        )

        # Get clause fallbacks to understand available options
        from integration_mcp.tools.clause_fallbacks import get_clause_fallbacks_tool

        fallbacks_tool = get_clause_fallbacks_tool(client)
        fallbacks_result = await fallbacks_tool._execute({
            "tenant_id": tenant_id,
            "msa_id": msa_id,
            "project_id": project_id,
        })

        clause_fallbacks = fallbacks_result.get("clause_fallbacks", {})

        # Score each scenario
        scenario_results = []

        for scenario in scenarios:
            scenario_id = scenario["scenario_id"]
            scenario_name = scenario.get("scenario_name", scenario_id)
            clause_overrides = scenario.get("clause_overrides", {})

            logger.debug("Scoring scenario", scenario_id=scenario_id, scenario_name=scenario_name)

            # Heuristic scoring (placeholder for ML model)
            # In production, this would use a trained model that considers:
            # - Historical signing patterns for similar companies
            # - Clause-level risk scores
            # - Company size/region/industry factors
            # - Time-to-sign patterns

            base_score = 0.5  # Base signing probability
            risk_score = 0.5  # Base risk

            # Adjust based on company context
            size_bucket = company_context.get("size_bucket", "unknown")
            if size_bucket == "enterprise":
                base_score += 0.1  # Enterprise companies more likely to sign
            elif size_bucket == "small":
                base_score -= 0.1

            # Adjust based on clause overrides
            # More "market standard" fallbacks increase likelihood
            for clause_type, fallback_selection in clause_overrides.items():
                fallback_info = clause_fallbacks.get(clause_type, {})
                fallback_options = fallback_info.get("fallback_options", [])

                if fallback_options:
                    # Assume selecting higher-frequency fallbacks increases likelihood
                    # This is simplified - real model would be more sophisticated
                    avg_frequency = sum(
                        opt.get("frequency_in_signed", 0) for opt in fallback_options
                    ) / len(fallback_options)
                    base_score += avg_frequency * 0.1

            # Clamp scores
            signing_probability = max(0.0, min(1.0, base_score))
            risk_score = max(0.0, min(1.0, risk_score))

            # Estimate time to sign (heuristic)
            # In production, this would use historical data
            expected_time_to_sign_days = 30  # Placeholder

            # Adjust based on probability
            if signing_probability > 0.7:
                expected_time_to_sign_days = 14
            elif signing_probability < 0.4:
                expected_time_to_sign_days = 60

            scenario_results.append({
                "scenario_id": scenario_id,
                "scenario_name": scenario_name,
                "signing_probability": round(signing_probability, 3),
                "expected_time_to_sign_days": expected_time_to_sign_days,
                "risk_score": round(risk_score, 3),
                "risk_band": _get_risk_band(risk_score),
                "clause_overrides": clause_overrides,
            })

        logger.info(
            "Signing likelihood estimated",
            msa_id=msa_id,
            scenarios_scored=len(scenario_results),
        )

        return {
            "msa_id": msa_id,
            "company_context": company_context,
            "scenarios": scenario_results,
            "model_info": {
                "type": "heuristic",
                "note": "This is a placeholder heuristic model. In production, this would use a trained ML model.",
            },
        }

    def _get_risk_band(risk_score: float) -> str:
        """Convert risk score to risk band."""
        if risk_score < 0.3:
            return "low"
        elif risk_score < 0.7:
            return "medium"
        else:
            return "high"

    handler = ToolHandler(
        name="estimate_signing_likelihood",
        description=(
            "Score candidate scenarios (base vs. applying certain fallbacks) and return predicted "
            "signing likelihood, expected time-to-sign, and risk scores. Uses heuristic scoring "
            "in MVP; production would use a trained ML model."
        ),
        input_schema=input_schema,
    )

    handler._execute = execute

    return handler

