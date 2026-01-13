# Quick Start Guide

## Prerequisites

- Python 3.10+
- Access to Luminance API (base URL and bearer token)

## Installation

1. **Clone/Navigate to the project:**
   ```bash
   cd integration-mcp
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

5. **Edit `.env` with your Luminance API credentials:**
   ```env
   LUMINANCE_BASE_URL=https://your-domain.example
   LUMINANCE_API_TOKEN=your-bearer-token
   LOG_LEVEL=INFO
   RATE_LIMIT_PER_MINUTE=60
   TOOL_TIMEOUT_SECONDS=30
   ENABLE_SIGNING_LIKELIHOOD=true
   ```

## Running the Server

### Stdio Transport (for MCP clients)

The server communicates via stdio using JSON-RPC 2.0:

```bash
python -m integration_mcp.server
```

This will read from stdin and write to stdout. MCP clients should launch this as a subprocess.

### Testing Locally

Run the test client to verify tools work:

```bash
python -m integration_mcp.test_client
```

**Note:** Update the test data in `test_client.py` with real `project_id` and `msa_id` values from your Luminance instance.

## Using with an MCP Client

### Example: Claude Desktop

Add to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "integration-mcp": {
      "command": "python",
      "args": ["-m", "integration_mcp.server"],
      "env": {
        "LUMINANCE_BASE_URL": "https://your-domain.example",
        "LUMINANCE_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Example: Custom Agent/Orchestrator

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Start MCP server as subprocess
    server_params = StdioServerParameters(
        command="python",
        args=["-m", "integration_mcp.server"],
        env={
            "LUMINANCE_BASE_URL": "https://your-domain.example",
            "LUMINANCE_API_TOKEN": "your-token"
        }
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize
            await session.initialize()

            # List tools
            tools = await session.list_tools()
            print(f"Available tools: {[t.name for t in tools.tools]}")

            # Call a tool
            result = await session.call_tool(
                "get_company_context",
                arguments={
                    "tenant_id": "your_tenant",
                    "company_name": "Acme Corp"
                }
            )
            print(result)

if __name__ == "__main__":
    asyncio.run(main())
```

## Tool Usage Examples

### 1. Get Company Context

```python
result = await session.call_tool(
    "get_company_context",
    arguments={
        "tenant_id": "tenant_123",
        "company_name": "Acme Corporation"
    }
)
```

### 2. Find Similar MSAs

```python
result = await session.call_tool(
    "get_similar_msas",
    arguments={
        "tenant_id": "tenant_123",
        "msa_id": 456,
        "project_id": 789,
        "region": "US",
        "company_size_bucket": "enterprise",
        "limit": 20
    }
)
```

### 3. Get Clause Fallbacks

```python
result = await session.call_tool(
    "get_clause_fallbacks",
    arguments={
        "tenant_id": "tenant_123",
        "msa_id": 456,
        "project_id": 789,
        "clause_types": ["liability_cap", "indemnity", "termination"]
    }
)
```

### 4. Estimate Signing Likelihood

```python
result = await session.call_tool(
    "estimate_signing_likelihood",
    arguments={
        "tenant_id": "tenant_123",
        "msa_id": 456,
        "project_id": 789,
        "company_context": {
            "company_id": "acme_corp",
            "size_bucket": "enterprise",
            "region": "US",
            "jurisdiction": "Delaware",
            "industry": "Technology"
        },
        "scenarios": [
            {
                "scenario_id": "base",
                "scenario_name": "Base Case",
                "clause_overrides": {}
            },
            {
                "scenario_id": "optimized",
                "scenario_name": "Optimized Fallbacks",
                "clause_overrides": {
                    "liability_cap": "market_standard",
                    "indemnity": "customer_friendly"
                }
            }
        ]
    }
)
```

## Troubleshooting

### Server won't start
- Check `.env` file exists and has required variables
- Verify Python version: `python --version` (should be 3.10+)
- Check dependencies: `pip list | grep mcp`

### API errors
- Verify `LUMINANCE_BASE_URL` and `LUMINANCE_API_TOKEN` are correct
- Check network connectivity to Luminance instance
- Review logs for detailed error messages

### Tool execution fails
- Verify `project_id` and `msa_id` exist in your Luminance instance
- Check tenant permissions
- Review tool input schemas in tool definitions

### Rate limiting
- Adjust `RATE_LIMIT_PER_MINUTE` in `.env` if hitting limits
- Check logs for rate limit warnings

## Next Steps

- Review [ARCHITECTURE.md](ARCHITECTURE.md) for design details
- See [README.md](README.md) for full documentation
- Customize tools for your specific use case
- Integrate with your agent/orchestrator

