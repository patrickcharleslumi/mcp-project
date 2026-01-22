# Prismatic Deployment Guide

This guide explains how to deploy the Integration MCP Server within Prismatic.

## Overview

The Integration MCP Server can be deployed in Prismatic in two ways:

1. **As a Prismatic Agent Flow** (Recommended)
2. **As a Custom MCP Server** connecting to Prismatic's infrastructure

## Prerequisites

- Prismatic account with API access
- Prismatic API key
- Access to create agent flows in Prismatic
- (Optional) Salesforce MCP server for company context enrichment

## Option 1: Deploy as Prismatic Agent Flow

### Step 1: Create Agent Flows

For each tool in the MCP server, create a corresponding agent flow in Prismatic:

1. **Navigate to your Integration in Prismatic**
2. **Create Agent Flows** with invocation schemas matching your tool definitions:

#### Example: `get_company_context` Agent Flow

```json
{
  "name": "get_company_context",
  "description": "Retrieve company context information including size, region, jurisdiction, and industry.",
  "invokeSchema": {
    "type": "object",
    "properties": {
      "tenant_id": {
        "type": "string",
        "description": "Tenant ID for scoping the request"
      },
      "company_name": {
        "type": "string",
        "description": "Company name to look up"
      },
      "company_id": {
        "type": "string",
        "description": "Internal company ID"
      }
    },
    "required": ["tenant_id"]
  },
  "resultSchema": {
    "type": "object",
    "properties": {
      "company_id": {"type": "string"},
      "company_name": {"type": "string"},
      "size_bucket": {"type": "string"},
      "region": {"type": "string"},
      "jurisdiction": {"type": "string"},
      "industry": {"type": "string"}
    }
  }
}
```

### Step 2: Configure Flow Execution

Configure each agent flow to execute the MCP server:

1. **Add a Code Action** that runs the MCP server
2. **Set Environment Variables:**
   - `LUMINANCE_BASE_URL`
   - `LUMINANCE_API_TOKEN`
   - `SALESFORCE_MCP_ENABLED` (if using Salesforce)
   - Other configuration as needed

3. **Configure the flow to call the MCP server** via stdio or HTTP

### Step 3: Access via Prismatic MCP Endpoint

Once agent flows are created, they will be available via Prismatic's MCP flow server:

- **Global endpoint:** `mcp.prismatic.io/mcp`
- **Region-specific endpoints:**
  - US GovCloud: `mcp.us-gov-west-1.prismatic.io/mcp`
  - Europe (Ireland): `mcp.eu-west-1.prismatic.io/mcp`
  - Europe (London): `mcp.eu-west-2.prismatic.io/mcp`
  - Canada (Central): `mcp.ca-central-1.prismatic.io/mcp`
  - Australia (Sydney): `mcp.ap-southeast-2.prismatic.io/mcp`
  - Africa (Cape Town): `mcp.af-south-1.prismatic.io/mcp`

### Step 4: Connect AI Agents

Connect your AI agent (Claude, OpenAI, Cursor, etc.) to Prismatic's MCP endpoint:

```json
{
  "mcpServers": {
    "prismatic-luminance": {
      "url": "https://mcp.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PRISMATIC_API_KEY"
      }
    }
  }
}
```

## Option 2: Custom MCP Server in Prismatic

If you want to build a custom MCP server that queries Prismatic's agent flows:

### Step 1: Query Prismatic GraphQL API

Use Prismatic's GraphQL API to discover agent flows:

```python
from gql import gql, Client
from gql.transport.httpx import HTTPXTransport

transport = HTTPXTransport(
    url="https://app.prismatic.io/api",
    headers={"Authorization": f"Bearer {PRISMATIC_API_KEY}"}
)
client = Client(transport=transport, fetch_schema_from_transport=True)

query = gql("""
    query agentFlows {
      ai {
        agentFlows {
          nodes {
            id
            name
            description
            webhookUrl
            apiKeys
            invokeSchema
            resultSchema
          }
        }
      }
    }
""")

result = client.execute(query)
```

### Step 2: Create MCP Tools from Agent Flows

For each agent flow, create an MCP tool:

```python
for flow in result['ai']['agentFlows']['nodes']:
    server.tool(
        flow['name'],
        flow['description'],
        JSON.parse(flow['invokeSchema']),
        async (args) => {
            # Call the agent flow webhook
            response = await fetch(flow['webhookUrl'], {
                method: 'POST',
                body: JSON.stringify(args),
                headers: {
                    'Content-Type': 'application/json',
                    'prismatic-synchronous': 'true',
                    'Authorization': f'Bearer {flow['apiKeys'][0]}'
                }
            })
            return await response.json()
        }
    )
```

## Configuration

### Environment Variables in Prismatic

When deploying in Prismatic, configure these environment variables:

```env
# Required
LUMINANCE_BASE_URL=https://your-domain.app.luminance.com
LUMINANCE_API_TOKEN=your-bearer-token

# Optional: Prismatic
PRISMATIC_API_KEY=your-prismatic-api-key
PRISMATIC_BASE_URL=https://app.prismatic.io
PRISMATIC_REGION=us

# Optional: Salesforce MCP
SALESFORCE_MCP_ENABLED=true
SALESFORCE_MCP_ENDPOINT=http://salesforce-mcp-server:3000
```

### Prismatic Configuration Variables

In Prismatic, you can use Prismatic's configuration variables system instead of environment variables:

1. **Navigate to Integration Settings**
2. **Add Configuration Variables:**
   - `LUMINANCE_BASE_URL`
   - `LUMINANCE_API_TOKEN`
   - `SALESFORCE_MCP_ENABLED`
   - etc.

3. **Reference in your flows** using Prismatic's variable syntax

## Salesforce MCP Integration

To enable Salesforce MCP integration for company context enrichment:

1. **Set up Salesforce MCP Server** separately (see [Salesforce MCP Repository](https://github.com/salesforcecli/mcp))
2. **Configure Salesforce authentication** in the Salesforce MCP server
3. **Enable in Integration MCP Server:**
   - Set `SALESFORCE_MCP_ENABLED=true`
   - Configure `SALESFORCE_MCP_ENDPOINT` if not using default
4. **The `get_company_context` tool** will automatically query Salesforce when enabled

## Testing

### Test Locally First

Before deploying to Prismatic, test locally:

```bash
PYTHONPATH=components/luminance-mcp python -m integration_mcp.server
```

### Test in Prismatic

1. **Deploy to Prismatic test instance**
2. **Use Prismatic's test tools** to invoke agent flows
3. **Verify tool execution** and responses
4. **Check logs** in Prismatic's monitoring dashboard

## Monitoring

### Prismatic Monitoring

- **Flow Execution Logs:** View in Prismatic's integration dashboard
- **Error Tracking:** Prismatic's error monitoring
- **Performance Metrics:** Prismatic's analytics

### MCP Server Logs

The MCP server uses structured logging (JSON format) that integrates with Prismatic's logging:

- Tool execution timing
- Error tracking
- API call details
- Sensitive data redaction

## Troubleshooting

### Agent Flows Not Appearing

- Verify agent flows have invocation schemas
- Check that flows are in test instances (for organization team members)
- Verify API key has correct permissions

### Connection Issues

- Verify Prismatic API key is correct
- Check Prismatic base URL matches your region
- Ensure network connectivity to Prismatic endpoints

### Tool Execution Failures

- Check Luminance API credentials
- Verify tenant permissions
- Review Prismatic flow execution logs
- Check MCP server logs for detailed errors

## References

- [Prismatic MCP Documentation](https://prismatic.io/docs/ai/model-context-protocol/)
- [Salesforce MCP Repository](https://github.com/salesforcecli/mcp)
- [Prismatic API Documentation](https://prismatic.io/docs/)

