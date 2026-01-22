"""HTTP server entrypoint for MCP wrapper."""

from __future__ import annotations

import uvicorn

from mcp.app import create_app


def main() -> None:
    """Run the MCP HTTP server."""
    uvicorn.run(create_app(), host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
