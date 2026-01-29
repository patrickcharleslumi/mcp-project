# Finding Your MCP Endpoint in Prismatic

## Understanding What You're Seeing

- **Individual URLs** = Webhook URLs for each flow (for direct HTTP calls)
- **MCP Endpoint** = Single endpoint that exposes all flows as MCP tools (for AI agents)

## Where to Find the MCP Endpoint

### Option 1: Check Integration (Not Instance)

The MCP endpoint is typically at the **Integration level**, not the Instance level:

1. **Go back to the Integration** (not the instance)
   - Navigate away from your instance
   - Go to the "Luminance MCP Tools" integration definition

2. **Look for an "MCP" tab or section:**
   - Integration → **MCP** tab
   - Or Integration → **AI** → **MCP**
   - Or Integration → Settings → **MCP**

3. **You should see:**
   - A custom MCP endpoint URL
   - Format: `https://mcp.prismatic.io/<unique-id>/mcp`
   - Or: `https://mcp.<your-prismatic-domain>/mcp`

### Option 2: Check Instance Settings

Sometimes the MCP endpoint is in instance settings:

1. **In your instance:**
   - Look for a **"Settings"** tab
   - Or **"Configuration"** tab
   - Or **"AI"** section

2. **Look for:**
   - "MCP Endpoint"
   - "Agent Flow Endpoint"
   - "AI Tools Endpoint"

### Option 3: Use Global MCP Endpoint

If you can't find an integration-specific endpoint, you can use Prismatic's global MCP endpoint:

**For your private instance:**
```
https://mcp.luminance-production-eu-central-1.prismatic.io/mcp
```

Or try:
```
https://mcp.app.luminance-production-eu-central-1.prismatic.io/mcp
```

## Using Individual Webhook URLs as MCP Tools

If you can't find the MCP endpoint, you can use the individual webhook URLs directly. Each flow's webhook URL can be called as an MCP tool:

### For Each Tool:

1. **Get the webhook URL** for each flow (you already have these)
2. **Call it with MCP-style headers:**

```bash
curl -X POST "https://your-flow-webhook-url" \
  -H "Content-Type: application/json" \
  -H "prismatic-synchronous: true" \
  -H "Authorization: Bearer YOUR_PRISMATIC_API_KEY" \
  -d '{
    "tenantId": "test_tenant",
    "companyName": "Acme Corp"
  }'
```

### For AI Agents:

If your AI agent supports it, you can configure each webhook URL as a separate MCP tool, or use Prismatic's MCP endpoint which aggregates them all.

## Finding Your Prismatic API Key

You'll need your Prismatic API key to authenticate MCP requests:

1. **In Prismatic UI:**
   - Go to: **Settings** → **API Keys**
   - Or: **Account** → **API Keys**
   - Create a new API key if needed

2. **Copy the API key** - you'll use this in the Authorization header

## Testing the MCP Endpoint

Once you find the MCP endpoint, test it:

```bash
# List available tools
curl -X POST "https://your-mcp-endpoint" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PRISMATIC_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

You should get back a list of your 4 tools with their schemas.

## Alternative: Query via GraphQL

You can also query Prismatic's GraphQL API to find agent flows:

```bash
curl -X POST "https://app.luminance-production-eu-central-1.prismatic.io/api" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PRISMATIC_API_KEY" \
  -d '{
    "query": "query { ai { agentFlows { nodes { id name description webhookUrl invokeSchema } } } }"
  }'
```

This will show you all agent flows with their webhook URLs and schemas.

## Summary

- **Individual URLs** = Webhook URLs (you have these ✅)
- **MCP Endpoint** = Look in Integration → MCP tab (not instance)
- **Global endpoint** = `https://mcp.luminance-production-eu-central-1.prismatic.io/mcp` (try this)
- **API Key needed** = Get from Settings → API Keys
- **Can use webhooks directly** = Each webhook can be called as an MCP tool

Try looking in the **Integration** (not instance) for an MCP tab, or use the global endpoint format above with your Prismatic domain.
