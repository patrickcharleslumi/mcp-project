# Next Steps: Testing & Finding MCP Endpoint

## ✅ Step 1: Test All 4 Flows (Current Status)

You've successfully tested **"Get Company Context"**. Now test the other 3 flows:

### 2. Test "Get Similar MSAs"

```bash
curl -X POST "https://hooks.eu-central-1.integrations.luminance.com/trigger/WEBHOOK_ID_FOR_GET_SIMILAR_MSAS" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test_tenant",
    "msaId": 123,
    "projectId": 456
  }'
```

**Expected Response:**
```json
{
  "similar_msas": [],
  "metadata": {
    "source": "placeholder",
    "note": "This is a placeholder..."
  }
}
```

### 3. Test "Get Clause Fallbacks"

```bash
curl -X POST "https://hooks.eu-central-1.integrations.luminance.com/trigger/WEBHOOK_ID_FOR_GET_CLAUSE_FALLBACKS" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test_tenant",
    "msaId": 123,
    "projectId": 456,
    "clauseTypes": ["liability_cap", "indemnity"]
  }'
```

### 4. Test "Estimate Signing Likelihood"

```bash
curl -X POST "https://hooks.eu-central-1.integrations.luminance.com/trigger/WEBHOOK_ID_FOR_ESTIMATE_SIGNING_LIKELIHOOD" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test_tenant",
    "msaId": 123,
    "projectId": 456,
    "scenarios": [
      {
        "scenario_id": "base",
        "scenario_name": "Base Case",
        "clause_overrides": {}
      }
    ]
  }'
```

**💡 Tip:** You can also test these in Prismatic UI → Instance → Test tab (easier than curl).

---

## 🔍 Step 2: Find the MCP Endpoint

Since your flows are marked with `isAgentFlow: true` and `isSynchronous: true`, Prismatic should automatically expose them as MCP tools. Here's where to find the MCP endpoint:

### Option A: Check Integration Settings

1. **Go to:** Prismatic UI → **"Luminance MCP Tools"** Integration (not the instance)
2. **Look for:**
   - **"AI"** tab or section
   - **"MCP"** tab or section
   - **"Settings"** → **"MCP"** or **"AI"**
   - **"Agent Flows"** → **"MCP Endpoint"**

### Option B: Check Instance Settings

1. **Go to:** Your deployed **Instance**
2. **Look for:**
   - **"AI"** tab
   - **"MCP"** section
   - **"Settings"** → **"MCP"**

### Option C: Try Standard Endpoint Formats

For your private Prismatic instance, try these URLs:

```
https://mcp.luminance-production-eu-central-1.prismatic.io/mcp
```

Or:

```
https://mcp.eu-central-1.integrations.luminance.com/mcp
```

Or:

```
https://app.luminance-production-eu-central-1.prismatic.io/mcp
```

### Option D: Use Prismatic GraphQL API

Query Prismatic's API to find agent flows and their MCP endpoint:

```bash
curl -X POST "https://app.luminance-production-eu-central-1.prismatic.io/api" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PRISMATIC_API_KEY" \
  -d '{
    "query": "query { ai { agentFlows { nodes { id name description webhookUrl invokeSchema resultSchema } } } }"
  }'
```

This will show all your agent flows and their details.

---

## 🔗 Step 3: Connect an AI Agent

Once you have the MCP endpoint, connect your AI agent:

### For Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luminance-mcp-tools": {
      "url": "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PRISMATIC_API_KEY"
      }
    }
  }
}
```

### For Cursor / Other MCP Clients

```json
{
  "mcpServers": {
    "luminance-mcp-tools": {
      "url": "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PRISMATIC_API_KEY"
      }
    }
  }
}
```

### Test MCP Connection

Once connected, your AI agent should be able to:
- List all 4 tools: `get-company-context`, `get-similar-msas`, `get-clause-fallbacks`, `estimate-signing-likelihood`
- Call each tool with appropriate parameters
- Receive structured responses

---

## 📋 Checklist

- [x] Test "Get Company Context" ✅ (Done!)
- [ ] Test "Get Similar MSAs"
- [ ] Test "Get Clause Fallbacks"
- [ ] Test "Estimate Signing Likelihood"
- [ ] Find MCP endpoint URL
- [ ] Get Prismatic API key (if needed)
- [ ] Connect AI agent to MCP endpoint
- [ ] Test AI agent can list tools
- [ ] Test AI agent can call tools

---

## 🆘 If You Can't Find MCP Endpoint

If you can't find an MCP endpoint in Prismatic UI:

1. **Check Prismatic Documentation:**
   - Look for "MCP" or "Model Context Protocol" in Prismatic docs
   - Check if your Prismatic version supports MCP

2. **Contact Prismatic Support:**
   - Ask about MCP endpoint location for private instances
   - Verify that `isAgentFlow: true` flows are automatically exposed

3. **Alternative: Use Individual Webhook URLs:**
   - You can use each flow's webhook URL directly
   - Some MCP clients support multiple endpoints
   - Or build a simple MCP server that wraps these webhooks

4. **Check Prismatic CLI:**
   ```bash
   prism integration list
   prism integration get YOUR_INTEGRATION_ID
   ```
   This might show MCP-related information.

---

## 🎯 Current Priority

**Right now, focus on:**
1. ✅ Testing all 4 flows (you've done 1/4)
2. 🔍 Finding the MCP endpoint in Prismatic UI
3. 🔗 Getting your Prismatic API key (if you don't have one)

Once you have the MCP endpoint, connecting an AI agent is straightforward!
