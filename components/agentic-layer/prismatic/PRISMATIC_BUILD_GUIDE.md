# Prismatic Build Guide: Connecting AI Agents to Luminance MCP Tools

This guide walks you through building the Integration MCP Server in Prismatic and connecting AI agents to it.

## Recommendation: Option 1 (Deploy as Prismatic Agent Flow)

**Why Option 1 is Recommended:**
- ✅ **Simplest deployment** - Prismatic handles all MCP server infrastructure
- ✅ **Native Prismatic approach** - Uses built-in agent flow capabilities
- ✅ **Automatic MCP exposure** - Agent flows automatically become MCP tools
- ✅ **Less maintenance** - No custom MCP server to maintain
- ✅ **Built-in monitoring** - Prismatic's monitoring and logging included
- ✅ **Easy updates** - Update flows in Prismatic UI, no code deployment needed

## 🚀 Quick Start: Using the Generic MCP Template

**We're building a separate code-native integration** using Prismatic's generic MCP template.

**See the detailed step-by-step guide:** [STEP_BY_STEP_BUILD.md](../runbooks/STEP_BY_STEP_BUILD.md)

**Quick checklist:** [QUICK_CHECKLIST.md](../runbooks/QUICK_CHECKLIST.md)

**Option 2 (Custom MCP Server) is only recommended if:**
- You need to aggregate multiple Prismatic integrations into one MCP server
- You need custom MCP server logic beyond what Prismatic provides
- You're building a multi-tenant MCP server that queries multiple Prismatic instances

For your use case (Luminance API tools), **Option 1 is the clear winner**.

---

## Step-by-Step: Building in Prismatic (Option 1)

### Phase 1: Prerequisites & Setup

#### 1.1 Get Prismatic Access
- Ensure you have a Prismatic account
- Get your Prismatic API key from Settings → API Keys
- Note your Prismatic region (affects MCP endpoint)

#### 1.2 Prepare Your MCP Server Code
Your Python MCP server is ready, but for Prismatic deployment, you have two approaches:

**Approach A: Run Python MCP Server as Subprocess** (Recommended for MVP)
- Keep your Python MCP server as-is
- Create Prismatic agent flows that execute the Python server
- Each flow calls the appropriate tool

**Approach B: Convert to Prismatic Actions** (Recommended for Production)
- Convert each MCP tool into a Prismatic action
- Use Prismatic's code-native integration capabilities
- More integrated with Prismatic ecosystem

We'll use **Approach A** for simplicity, then show how to migrate to Approach B.

---

### Phase 2: Create Prismatic Integration

#### 2.1 Create New Code-Native Integration in Prismatic

**Yes, this should be a code-native integration!** Here's why:

- ✅ **Reuses your existing Luminance component** - You already have a TypeScript/JavaScript Luminance component
- ✅ **Better integration** - Code-native integrations can directly use component actions
- ✅ **Type safety** - TypeScript provides better error checking
- ✅ **Version control** - Code lives in git, easier to manage
- ✅ **Consistent with your existing setup** - Your Luminance component is already code-native

**Two Approaches:**

**Option A: Extend Existing Luminance Component** (Recommended)
- Add MCP tool actions directly to your existing `luminance-api` component
- Create agent flows that use these new actions
- Single component, easier maintenance

**Option B: Create New Code-Native Integration**
- Create a new code-native integration
- Use your existing Luminance component as a dependency
- Add MCP tool actions in the new integration
- More modular, but requires managing two components

**We'll use Option A** (extend existing component) for simplicity.

1. **Navigate to your existing Luminance component:**
   - Location: `Repository/luminance-component-for-prismatic/luminance-api/`
   - This is already a code-native Prismatic component

2. **Add MCP Tool Actions:**
   - Create new actions in `src/actions/` directory
   - Convert your Python tool logic to TypeScript
   - Actions will be: `getCompanyContext`, `getSimilarMsas`, `getClauseFallbacks`, `estimateSigningLikelihood`

#### 2.2 Configure Component/Integration Settings

**For Code-Native Integration:**

1. **In your component code** (`src/index.ts`), ensure connections are configured:
   - Luminance OAuth2 connection (already exists)
   - Optional: Custom connection for Salesforce MCP

2. **Configuration Variables** are handled via Prismatic's config variable system:
   - Set in Prismatic UI → Integration → Configuration Variables
   - Or use Prismatic's instance configuration
   - Variables: `LUMINANCE_BASE_URL`, `LUMINANCE_API_TOKEN`, etc.

3. **Publish the component:**
   ```bash
   cd Repository/luminance-component-for-prismatic/luminance-api
   npm run build
   npm run publish
   ```

---

### Phase 3: Create Agent Flows

For each tool in your MCP server, create a corresponding agent flow.

#### 3.1 Create `get_company_context` Agent Flow

1. **Navigate to:** Integration → AI → Agent Flows
2. **Click "Create Agent Flow"**
3. **Configure:**

   **Name:** `get_company_context`
   
   **Description:** `Retrieve company context information including size, region, jurisdiction, and industry. This metadata is used to filter precedents when finding similar MSAs.`
   
   **Invocation Schema:**
   ```json
   {
     "type": "object",
     "properties": {
       "tenant_id": {
         "type": "string",
         "description": "Tenant ID for scoping the request"
       },
       "company_name": {
         "type": "string",
         "description": "Company name to look up (optional if company_id provided)"
       },
       "company_id": {
         "type": "string",
         "description": "Internal company ID (optional if company_name provided)"
       }
     },
     "required": ["tenant_id"]
   }
   ```
   
   **Result Schema:**
   ```json
   {
     "type": "object",
     "properties": {
       "company_id": {"type": "string"},
       "company_name": {"type": "string"},
       "size_bucket": {"type": "string"},
       "region": {"type": "string"},
       "jurisdiction": {"type": "string"},
       "industry": {"type": "string"},
       "metadata": {
         "type": "object",
         "properties": {
           "source": {"type": "string"}
         }
       }
     }
   }
   ```

4. **Add Flow Steps:**
   
   **Step 1: Execute Python MCP Tool**
   - Use Prismatic's "Execute Code" or "HTTP Request" action
   - If using code execution:
     ```python
     import subprocess
     import json
     import os
     
     # Get arguments from flow context
     tenant_id = context.get("tenant_id")
     company_name = context.get("company_name")
     company_id = context.get("company_id")
     
     # Prepare arguments
     args = {
         "tenant_id": tenant_id,
         "company_name": company_name,
         "company_id": company_id
     }
     
     # Call Python MCP server tool
     # Option 1: Direct Python call (if MCP server code is accessible)
     from integration_mcp.tools.company_context import get_company_context_tool
     from integration_mcp.luminance_client import LuminanceClient
     
     client = LuminanceClient()
     tool = get_company_context_tool(client)
     result = await tool.execute(args)
     
     return result
     ```
   
   **OR use HTTP approach:**
   - If your MCP server exposes HTTP endpoints, call them via HTTP Request action
   - This requires adding an HTTP wrapper to your MCP server

5. **Save the Agent Flow**

#### 3.2 Create `get_similar_msas` Agent Flow

Follow the same pattern:

**Name:** `get_similar_msas`

**Description:** `Find signed MSAs similar to a draft, filtered by company attributes. Returns compact metadata including IDs, dates, and similarity scores.`

**Invocation Schema:**
```json
{
  "type": "object",
  "properties": {
    "tenant_id": {
      "type": "string",
      "description": "Tenant ID for scoping the request"
    },
    "msa_id": {
      "type": "integer",
      "description": "MSA document ID to find similar documents for"
    },
    "project_id": {
      "type": "integer",
      "description": "Project ID containing the MSA"
    },
    "region": {
      "type": "string",
      "description": "Optional: Filter by region (e.g., 'US', 'EU')"
    },
    "company_size_bucket": {
      "type": "string",
      "description": "Optional: Filter by company size ('small', 'mid', 'enterprise')"
    },
    "limit": {
      "type": "integer",
      "description": "Maximum number of results",
      "default": 20
    }
  },
  "required": ["tenant_id", "msa_id", "project_id"]
}
```

#### 3.3 Create `get_clause_fallbacks` Agent Flow

**Name:** `get_clause_fallbacks`

**Description:** `Suggest fallback positions for key clauses based on signed precedents. Returns 1-3 fallback options per clause type with frequency statistics.`

**Invocation Schema:**
```json
{
  "type": "object",
  "properties": {
    "tenant_id": {"type": "string"},
    "msa_id": {"type": "integer"},
    "project_id": {"type": "integer"},
    "clause_types": {
      "type": "array",
      "items": {"type": "string"},
      "description": "List of clause types to analyze (e.g., ['liability_cap', 'indemnity'])"
    },
    "similar_msa_ids": {
      "type": "array",
      "items": {"type": "integer"},
      "description": "Optional: Pre-filtered list of similar MSA IDs"
    }
  },
  "required": ["tenant_id", "msa_id", "project_id"]
}
```

#### 3.4 Create `estimate_signing_likelihood` Agent Flow (Optional)

**Name:** `estimate_signing_likelihood`

**Description:** `Score scenarios for predicted signing likelihood and time-to-sign based on clause combinations and company context.`

**Invocation Schema:**
```json
{
  "type": "object",
  "properties": {
    "tenant_id": {"type": "string"},
    "msa_id": {"type": "integer"},
    "project_id": {"type": "integer"},
    "company_context": {
      "type": "object",
      "description": "Company context from get_company_context"
    },
    "scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "scenario_id": {"type": "string"},
          "scenario_name": {"type": "string"},
          "clause_overrides": {"type": "object"}
        }
      }
    }
  },
  "required": ["tenant_id", "msa_id", "project_id", "scenarios"]
}
```

---

### Phase 4: Deploy Python MCP Server Code

#### 4.1 Option A: Package as Prismatic Component

If you want to use your Python code directly in Prismatic:

1. **Create a Prismatic Component** (similar to the Luminance API component)
2. **Package your Python code** as a Prismatic component
3. **Publish to Prismatic**
4. **Use in agent flows**

**Note:** This requires converting Python to TypeScript/JavaScript or using Prismatic's Python support (if available).

#### 4.2 Option B: Run as External Service

1. **Deploy your Python MCP server** to a hosting service (AWS Lambda, Google Cloud Functions, etc.)
2. **Expose HTTP endpoints** for each tool
3. **Call HTTP endpoints** from Prismatic agent flows

#### 4.3 Option C: Use Prismatic's Code Actions (Simplest for MVP)

1. **Copy your Python tool logic** into Prismatic code actions
2. **Convert to JavaScript/TypeScript** (Prismatic's native language)
3. **Use directly in agent flows**

**Recommended for MVP:** Start with Option C, migrate to Option A/B later.

---

### Phase 5: Connect AI Agents

#### 5.1 Get Your Prismatic MCP Endpoint

1. **Navigate to:** Integration → AI → MCP
2. **Find your MCP endpoint:**
   - Global: `https://mcp.prismatic.io/mcp`
   - Or integration-specific: `https://mcp.prismatic.io/SW5...../mcp`
   - Region-specific: See [Prismatic MCP Documentation](https://prismatic.io/docs/ai/model-context-protocol/)

#### 5.2 Configure AI Agent

**For Claude Desktop:**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

**For Cursor/VS Code:**

Configure in MCP settings:

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

**For Custom Agent:**

```python
from mcp import ClientSession
import httpx

async with httpx.AsyncClient() as client:
    async with ClientSession(
        client,
        base_url="https://mcp.prismatic.io/mcp",
        headers={"Authorization": "Bearer YOUR_PRISMATIC_API_KEY"}
    ) as session:
        # List available tools
        tools = await session.list_tools()
        
        # Call a tool
        result = await session.call_tool(
            "get_company_context",
            arguments={
                "tenant_id": "tenant_123",
                "company_name": "Acme Corp"
            }
        )
```

---

### Phase 6: Testing

#### 6.1 Test Agent Flows in Prismatic

1. **Navigate to:** Integration → AI → Agent Flows
2. **Click on a flow** → "Test"
3. **Provide test inputs**
4. **Verify outputs**

#### 6.2 Test MCP Connection

1. **Use Prismatic's MCP test tool** (if available)
2. **Or use your AI agent** to call the tools
3. **Verify responses**

#### 6.3 Monitor Execution

1. **Check Prismatic logs** for flow executions
2. **Monitor error rates**
3. **Verify performance**

---

## Alternative: Convert to Prismatic Actions (Approach B)

If you want deeper Prismatic integration:

### Step 1: Create Prismatic Component

1. **Create new component** (TypeScript/JavaScript)
2. **Define actions** for each tool:
   - `getCompanyContext`
   - `getSimilarMsas`
   - `getClauseFallbacks`
   - `estimateSigningLikelihood`

### Step 2: Implement Actions

Each action calls your Luminance API client:

```typescript
import { action } from "@prismatic-io/spectral";
import { LuminanceClient } from "./luminance-client";

export const getCompanyContext = action({
  display: {
    label: "Get Company Context",
    description: "Retrieve company context information"
  },
  inputs: {
    tenantId: { type: "string", required: true },
    companyName: { type: "string", required: false },
    companyId: { type: "string", required: false }
  },
  perform: async (context, { tenantId, companyName, companyId }) => {
    const client = new LuminanceClient(context.connection);
    return await client.getCompanyContext(tenantId, companyName, companyId);
  }
});
```

### Step 3: Create Agent Flows from Actions

1. **Create agent flows** that use these actions
2. **Define invocation schemas** matching action inputs
3. **Prismatic automatically exposes** as MCP tools

---

## Comparison: Option 1 vs Option 2

| Aspect | Option 1 (Agent Flows) | Option 2 (Custom MCP Server) |
|--------|----------------------|------------------------------|
| **Simplicity** | ⭐⭐⭐⭐⭐ Very Simple | ⭐⭐ Complex |
| **Deployment** | Prismatic UI | Custom server deployment |
| **Maintenance** | Low (Prismatic handles it) | High (You maintain it) |
| **Monitoring** | Built-in Prismatic monitoring | Custom monitoring needed |
| **Scalability** | Prismatic handles scaling | You handle scaling |
| **Flexibility** | Limited to Prismatic features | Full control |
| **Best For** | Single integration, MVP | Multi-integration aggregation |

---

## Next Steps

1. ✅ **Start with Option 1** (Agent Flows)
2. ✅ **Create first agent flow** (`get_company_context`)
3. ✅ **Test in Prismatic UI**
4. ✅ **Connect AI agent** to Prismatic MCP endpoint
5. ✅ **Test end-to-end**
6. ✅ **Create remaining agent flows**
7. ✅ **Deploy to production**

---

## Troubleshooting

### Agent Flows Not Appearing in MCP

- ✅ Verify agent flows have invocation schemas
- ✅ Check flows are in test instances (for org team members)
- ✅ Verify Prismatic API key has correct permissions
- ✅ Check Prismatic region matches MCP endpoint

### Tool Execution Fails

- ✅ Verify Luminance API credentials in Prismatic config
- ✅ Check Prismatic flow execution logs
- ✅ Verify Python code is accessible (if using Approach A)
- ✅ Check network connectivity

### MCP Connection Issues

- ✅ Verify Prismatic API key is correct
- ✅ Check MCP endpoint URL matches your region
- ✅ Ensure AI agent has network access to Prismatic

---

## References

- [Prismatic MCP Documentation](https://prismatic.io/docs/ai/model-context-protocol/)
- [Prismatic Agent Flows Guide](https://prismatic.io/docs/ai/)
- [Prismatic Code-Native Integrations](https://prismatic.io/docs/integrations/code-native/)
- [Luminance Component Example](../Repository/luminance-component-for-prismatic/luminance-api/)
