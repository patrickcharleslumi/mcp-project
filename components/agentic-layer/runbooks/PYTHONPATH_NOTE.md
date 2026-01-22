## Running the stdio MCP server after the move

The `integration_mcp/` package now lives under:

`components/luminance-mcp/integration_mcp/`

For local runs without installing the package, add the component path to
`PYTHONPATH`:

```bash
PYTHONPATH=components/luminance-mcp python -m integration_mcp.server
```
