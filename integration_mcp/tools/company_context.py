"""Tool for retrieving company context information."""

from typing import Any, Optional

from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.tools.base import ToolHandler
from integration_mcp.logger import get_logger

logger = get_logger(__name__)

# Optional Salesforce MCP client (imported conditionally to avoid circular deps)
try:
    from integration_mcp.salesforce_mcp_client import SalesforceMcpClient
except ImportError:
    SalesforceMcpClient = None


def get_company_context_tool(
    client: LuminanceClient, salesforce_client: Optional[Any] = None
) -> ToolHandler:
    """Create the get_company_context tool.

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
            "company_name": {
                "type": "string",
                "description": "Company name to look up (optional if company_id provided)",
            },
            "company_id": {
                "type": "string",
                "description": "Internal company ID (optional if company_name provided)",
            },
        },
        "required": ["tenant_id"],
    }

    async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_company_context tool.

        Args:
            arguments: Tool arguments

        Returns:
            Company context information
        """
        tenant_id = arguments["tenant_id"]
        company_name = arguments.get("company_name")
        company_id = arguments.get("company_id")

        logger.info(
            "Getting company context",
            tenant_id=tenant_id,
            company_name=company_name,
            company_id=company_id,
        )

        # Try Salesforce MCP first if enabled
        salesforce_data = None
        if salesforce_client and hasattr(salesforce_client, "is_connected"):
            try:
                if await salesforce_client.is_connected():
                    salesforce_data = await salesforce_client.get_company_info(
                        company_name or ""
                    )
                    if salesforce_data:
                        logger.info(
                            "Retrieved company context from Salesforce MCP",
                            company_name=company_name,
                        )
            except Exception as e:
                logger.warning(
                    "Failed to get company context from Salesforce MCP",
                    error=str(e),
                    company_name=company_name,
                )

        # TODO: In production, this would also query Luminance's company metadata
        # For MVP, we return a placeholder structure if Salesforce doesn't have data
        # This might come from:
        # - Matter annotations (company name, region)
        # - External integrations (Salesforce, HubSpot)
        # - Internal company database

        if salesforce_data:
            result = salesforce_data
        else:
            # Placeholder implementation
            result = {
                "company_id": company_id or f"company_{company_name or 'unknown'}",
                "company_name": company_name or "Unknown",
                "size_bucket": "unknown",  # small, mid, enterprise
                "region": "unknown",
                "jurisdiction": "unknown",
                "industry": "unknown",
                "metadata": {
                    "source": "placeholder",
                    "note": "This is a placeholder. In production, this would query Luminance's company database or external systems.",
                },
            }

        logger.info("Company context retrieved", company_id=result.get("company_id"))
        return result

    handler = ToolHandler(
        name="get_company_context",
        description=(
            "Retrieve company context information including size, region, jurisdiction, "
            "and industry. This metadata is used to filter precedents when finding similar MSAs."
        ),
        input_schema=input_schema,
    )

    # Override _execute with our implementation
    handler._execute = execute

    return handler

