"""Base classes and utilities for MCP tools."""

import asyncio
import time
from typing import Any, Callable

from mcp.types import Tool, TextContent

from integration_mcp.config import config
from integration_mcp.logger import get_logger, redact_sensitive

logger = get_logger(__name__)


class ToolHandler:
    """Base class for tool handlers with timing and error handling."""

    def __init__(self, name: str, description: str, input_schema: dict[str, Any]):
        """Initialize tool handler.

        Args:
            name: Tool name
            description: Tool description
            input_schema: JSON schema for tool inputs
        """
        self.name = name
        self.description = description
        self.input_schema = input_schema

    def get_tool_definition(self) -> Tool:
        """Get MCP tool definition."""
        return Tool(
            name=self.name,
            description=self.description,
            inputSchema=self.input_schema,
        )

    async def execute(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Execute the tool with timing and error handling.

        Args:
            arguments: Tool arguments

        Returns:
            List of text content results

        Raises:
            Exception: If tool execution fails
        """
        start_time = time.time()
        logger.info(
            "Tool execution started",
            tool=self.name,
            arguments=redact_sensitive(arguments),
        )

        try:
            # Enforce timeout
            result = await asyncio.wait_for(
                self._execute(arguments),
                timeout=config.tool_timeout_seconds,
            )

            duration = time.time() - start_time
            logger.info(
                "Tool execution completed",
                tool=self.name,
                duration_seconds=duration,
                status="success",
            )

            return [TextContent(type="text", text=str(result))]

        except asyncio.TimeoutError:
            duration = time.time() - start_time
            logger.error(
                "Tool execution timed out",
                tool=self.name,
                duration_seconds=duration,
                timeout=config.tool_timeout_seconds,
            )
            raise TimeoutError(f"Tool {self.name} exceeded timeout of {config.tool_timeout_seconds}s")

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Tool execution failed",
                tool=self.name,
                duration_seconds=duration,
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def _execute(self, arguments: dict[str, Any]) -> Any:
        """Execute the tool logic. Subclasses must implement this.

        Args:
            arguments: Tool arguments

        Returns:
            Tool result (will be serialized to JSON)
        """
        raise NotImplementedError("Subclasses must implement _execute")


def validate_tenant_access(tenant_id: str, user_tenant_id: str) -> None:
    """Validate that the user has access to the requested tenant.

    Args:
        tenant_id: Requested tenant ID
        user_tenant_id: User's tenant ID

    Raises:
        PermissionError: If tenant access is denied
    """
    if tenant_id != user_tenant_id:
        raise PermissionError(f"Access denied to tenant {tenant_id}")

