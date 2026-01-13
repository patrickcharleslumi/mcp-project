"""Simple test client for the MCP server (for development/testing)."""

import asyncio
import json
import sys

from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.tools.company_context import get_company_context_tool
from integration_mcp.tools.similar_msas import get_similar_msas_tool
from integration_mcp.tools.clause_fallbacks import get_clause_fallbacks_tool
from integration_mcp.tools.signing_likelihood import estimate_signing_likelihood_tool
from integration_mcp.logger import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)


async def test_tools():
    """Test all tools with sample data."""
    client = LuminanceClient()

    try:
        # Sample test data
        tenant_id = "test_tenant"
        project_id = 1
        msa_id = 1

        print("\n=== Testing get_company_context ===")
        company_tool = get_company_context_tool(client)
        company_result = await company_tool._execute({
            "tenant_id": tenant_id,
            "company_name": "Acme Corp",
        })
        print(json.dumps(company_result, indent=2))

        print("\n=== Testing get_similar_msas ===")
        similar_tool = get_similar_msas_tool(client)
        similar_result = await similar_tool._execute({
            "tenant_id": tenant_id,
            "msa_id": msa_id,
            "project_id": project_id,
            "limit": 5,
        })
        print(json.dumps(similar_result, indent=2, default=str))

        print("\n=== Testing get_clause_fallbacks ===")
        fallbacks_tool = get_clause_fallbacks_tool(client)
        fallbacks_result = await fallbacks_tool._execute({
            "tenant_id": tenant_id,
            "msa_id": msa_id,
            "project_id": project_id,
        })
        print(json.dumps(fallbacks_result, indent=2, default=str))

        print("\n=== Testing estimate_signing_likelihood ===")
        likelihood_tool = estimate_signing_likelihood_tool(client)
        likelihood_result = await likelihood_tool._execute({
            "tenant_id": tenant_id,
            "msa_id": msa_id,
            "project_id": project_id,
            "company_context": {
                "company_id": "acme_corp",
                "size_bucket": "enterprise",
                "region": "US",
                "jurisdiction": "Delaware",
                "industry": "Technology",
            },
            "scenarios": [
                {
                    "scenario_id": "base",
                    "scenario_name": "Base Case",
                    "clause_overrides": {},
                },
                {
                    "scenario_id": "market_standard",
                    "scenario_name": "Market Standard Fallbacks",
                    "clause_overrides": {
                        "liability_cap": "market_standard",
                        "indemnity": "market_standard",
                    },
                },
            ],
        })
        print(json.dumps(likelihood_result, indent=2, default=str))

        print("\n=== All tests completed ===")

    except Exception as e:
        logger.error("Test failed", error=str(e))
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(test_tools())

