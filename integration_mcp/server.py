"""MCP server implementation for Luminance API tools."""

import asyncio
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from integration_mcp.config import config
from integration_mcp.luminance_client import LuminanceClient
from integration_mcp.logger import setup_logging, get_logger
from integration_mcp.tools.company_context import get_company_context_tool
from integration_mcp.tools.similar_msas import get_similar_msas_tool
from integration_mcp.tools.clause_fallbacks import get_clause_fallbacks_tool
from integration_mcp.tools.signing_likelihood import estimate_signing_likelihood_tool

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Initialize MCP server
server = Server("integration-mcp")

# Global client instance (initialized in main)
luminance_client: LuminanceClient | None = None


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools.

    Returns:
        List of tool definitions
    """
    if luminance_client is None:
        raise RuntimeError("Luminance client not initialized")

    tools = [
        get_company_context_tool(luminance_client).get_tool_definition(),
        get_similar_msas_tool(luminance_client).get_tool_definition(),
        get_clause_fallbacks_tool(luminance_client).get_tool_definition(),
    ]

    # Add signing likelihood tool if enabled
    if config.enable_signing_likelihood:
        tools.append(estimate_signing_likelihood_tool(luminance_client).get_tool_definition())

    logger.info("Tools listed", tool_count=len(tools))
    return tools


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any] | None) -> list[TextContent]:
    """Execute a tool by name.

    Args:
        name: Tool name
        arguments: Tool arguments

    Returns:
        Tool execution results

    Raises:
        ValueError: If tool not found or arguments invalid
    """
    if luminance_client is None:
        raise RuntimeError("Luminance client not initialized")

    if arguments is None:
        arguments = {}

    logger.info("Tool called", tool_name=name, arguments=arguments)

    # Route to appropriate tool handler
    tool_handlers = {
        "get_company_context": get_company_context_tool(luminance_client),
        "get_similar_msas": get_similar_msas_tool(luminance_client),
        "get_clause_fallbacks": get_clause_fallbacks_tool(luminance_client),
        "estimate_signing_likelihood": estimate_signing_likelihood_tool(luminance_client),
    }

    if name not in tool_handlers:
        raise ValueError(f"Unknown tool: {name}")

    handler = tool_handlers[name]

    # Execute tool with error handling
    try:
        result_contents = await handler.execute(arguments)
        # handler.execute already returns list[TextContent]
        return result_contents

    except Exception as e:
        logger.error("Tool execution failed", tool_name=name, error=str(e), error_type=type(e).__name__)
        raise


async def main() -> None:
    """Main entry point for the MCP server."""
    global luminance_client

    logger.info("Starting MCP server", version="0.1.0")

    # Initialize Luminance client
    try:
        luminance_client = LuminanceClient()
        logger.info("Luminance client initialized", base_url=config.luminance_base_url)
    except Exception as e:
        logger.error("Failed to initialize Luminance client", error=str(e))
        sys.exit(1)

    # Run server with stdio transport
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )

    # Cleanup
    if luminance_client:
        await luminance_client.close()
        logger.info("MCP server shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error("Server error", error=str(e))
        sys.exit(1)

