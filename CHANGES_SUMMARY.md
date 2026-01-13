# Changes Summary: Prismatic and Salesforce MCP Integration

This document summarizes the changes made to integrate the MCP server with Prismatic and Salesforce MCP.

## Overview

Based on the Prismatic MCP documentation and Salesforce MCP repository, the following changes were made to align the Integration MCP Server with Prismatic deployment and Salesforce MCP integration.

## Changes Made

### 1. Architecture Documentation Updates

**File:** `ARCHITECTURE.md`

- **Updated architecture diagram** to show Prismatic MCP Flow Server in the flow
- **Added Prismatic deployment context** explaining how the server runs in Prismatic
- **Added Salesforce MCP integration** to the architecture diagram
- **Updated deployment section** with Prismatic-specific instructions
- **Added Prismatic configuration** details
- **Added Salesforce MCP integration** details

### 2. Configuration Updates

**File:** `integration_mcp/config.py`

Added new configuration options:
- `prismatic_api_key`: API key for Prismatic GraphQL API
- `prismatic_base_url`: Prismatic stack base URL (default: `https://app.prismatic.io`)
- `prismatic_region`: Prismatic region (us, eu-west-1, etc.)
- `salesforce_mcp_enabled`: Enable Salesforce MCP integration (default: false)
- `salesforce_mcp_endpoint`: Custom Salesforce MCP server endpoint (optional)

**File:** `env.example`

Added example configuration for:
- Prismatic API key, base URL, and region
- Salesforce MCP enabled flag and endpoint

### 3. Salesforce MCP Client

**File:** `integration_mcp/salesforce_mcp_client.py` (NEW)

Created a new Salesforce MCP client module that:
- Connects to Salesforce MCP server (placeholder implementation)
- Provides `get_company_info()` method to query Salesforce for company data
- Handles connection lifecycle (connect/disconnect)
- Integrates with the company context tool

**Note:** The implementation includes placeholder code with TODOs for actual Salesforce MCP connection. The structure is in place for:
- Stdio connection to Salesforce MCP server
- HTTP/WebSocket connection (if hosted)
- Tool calls to Salesforce MCP (e.g., `soql_query`, `describe_sobject`)
- Parsing Salesforce Account data into company context format

### 4. Company Context Tool Integration

**File:** `integration_mcp/tools/company_context.py`

- **Added optional Salesforce MCP client parameter** to `get_company_context_tool()`
- **Integrated Salesforce MCP query** in the tool execution
- **Fallback logic** to use Salesforce data if available, otherwise use placeholder
- **Error handling** for Salesforce MCP failures (graceful degradation)

### 5. Server Updates

**File:** `integration_mcp/server.py`

- **Added Salesforce MCP client initialization** in `main()`
- **Integrated Salesforce MCP client** into tool handlers
- **Added cleanup** for Salesforce MCP client on shutdown
- **Conditional imports** to handle optional Salesforce MCP dependency

### 6. Documentation Updates

**File:** `README.md`

- **Updated overview** to mention Prismatic and Salesforce MCP
- **Updated architecture diagram** to show Prismatic in the flow
- **Added Prismatic deployment section** with:
  - Option 1: Deploy as Prismatic Agent Flow
  - Option 2: Connect to Prismatic's MCP Flow Server
  - Prismatic region endpoints
- **Added Prismatic configuration** instructions
- **Added Salesforce MCP configuration** instructions

**File:** `QUICKSTART.md`

- **Added Prismatic prerequisites**
- **Added Prismatic configuration** to environment variables example
- **Added Prismatic deployment section** with:
  - Agent flow creation instructions
  - Prismatic connection configuration
  - Salesforce MCP integration setup
- **Updated next steps** with Prismatic and Salesforce references

**File:** `PRISMATIC_DEPLOYMENT.md` (NEW)

Created comprehensive Prismatic deployment guide covering:
- Two deployment options (Agent Flow vs Custom MCP Server)
- Step-by-step agent flow creation
- Prismatic GraphQL API integration
- Configuration management
- Salesforce MCP integration
- Testing and monitoring
- Troubleshooting

## Key Integration Points

### Prismatic Integration

1. **Agent Flows**: The MCP server tools can be exposed as Prismatic agent flows with invocation schemas
2. **MCP Flow Server**: Can connect to Prismatic's hosted MCP flow server at `mcp.prismatic.io/mcp`
3. **GraphQL API**: Can query Prismatic's GraphQL API to discover agent flows (Option 2)
4. **Configuration**: Uses Prismatic's configuration variable system

### Salesforce MCP Integration

1. **Company Context Enrichment**: The `get_company_context` tool can query Salesforce MCP server for company data
2. **Optional Integration**: Salesforce MCP is optional and gracefully degrades if not available
3. **Future Implementation**: Placeholder code structure ready for:
   - SOQL queries via Salesforce MCP tools
   - Account/Contact data retrieval
   - Mapping Salesforce fields to company context format

## Next Steps for Full Implementation

### Prismatic Integration

1. **Create Agent Flows** in Prismatic with invocation schemas matching tool definitions
2. **Configure Flow Execution** to run the MCP server
3. **Test Connection** to Prismatic's MCP endpoint
4. **Deploy to Production** Prismatic instance

### Salesforce MCP Integration

1. **Set up Salesforce MCP Server** (see [Salesforce MCP Repository](https://github.com/salesforcecli/mcp))
2. **Implement Connection Logic** in `salesforce_mcp_client.py`:
   - Stdio connection to Salesforce MCP server subprocess
   - Or HTTP/WebSocket connection if hosted
3. **Implement Tool Calls**:
   - Use `soql_query` tool to query Account objects
   - Use `describe_sobject` to get schema information
4. **Implement Data Mapping**:
   - Map Salesforce Account fields to company context format
   - Handle NumberOfEmployees → size_bucket mapping
   - Handle BillingCountry → region mapping
   - Handle Industry → industry mapping

## Testing

### Local Testing

```bash
# Test without Salesforce MCP
python -m integration_mcp.server

# Test with Salesforce MCP (when implemented)
SALESFORCE_MCP_ENABLED=true python -m integration_mcp.server
```

### Prismatic Testing

1. Deploy to Prismatic test instance
2. Create test agent flows
3. Invoke flows via Prismatic's MCP endpoint
4. Verify tool execution and responses

## References

- [Prismatic MCP Documentation](https://prismatic.io/docs/ai/model-context-protocol/)
- [Salesforce MCP Repository](https://github.com/salesforcecli/mcp)
- [Prismatic API Documentation](https://prismatic.io/docs/)

