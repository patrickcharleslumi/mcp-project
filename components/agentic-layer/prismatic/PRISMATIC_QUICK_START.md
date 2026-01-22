# Prismatic Quick Start: Recommended Approach

## 🎯 Recommendation: Option 1 (Deploy as Prismatic Agent Flow)

**Why?** Best balance of simplicity and functionality:
- ✅ Prismatic handles all MCP infrastructure
- ✅ No custom MCP server to maintain
- ✅ Built-in monitoring and logging
- ✅ Easy to update via Prismatic UI
- ✅ Automatic MCP tool exposure

## 🚀 Quick Start (5 Steps)

### 1. Create Prismatic Integration
- Go to Prismatic UI → Create Integration
- Name: "Luminance MCP Tools"
- Add config variables: `LUMINANCE_BASE_URL`, `LUMINANCE_API_TOKEN`

### 2. Create Agent Flow for Each Tool

For each tool (`get_company_context`, `get_similar_msas`, etc.):

1. Go to: Integration → AI → Agent Flows → Create
2. Set **Name** and **Description**
3. Define **Invocation Schema** (copy from tool definitions)
4. Define **Result Schema** (copy from tool definitions)
5. Add flow step to execute tool logic (Python code or HTTP call)

### 3. Get MCP Endpoint

- Go to: Integration → AI → MCP
- Copy your MCP endpoint: `https://mcp.prismatic.io/mcp` (or integration-specific)

### 4. Connect AI Agent

**Claude Desktop:**
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

### 5. Test

- Test agent flows in Prismatic UI
- Test MCP connection from AI agent
- Verify tools appear and work correctly

## 📋 Agent Flow Checklist

For each tool, create an agent flow with:

- [ ] **Name** matching tool name
- [ ] **Description** from tool definition
- [ ] **Invocation Schema** (JSON schema from tool)
- [ ] **Result Schema** (JSON schema for output)
- [ ] **Flow Logic** (execute tool code or call HTTP endpoint)

## 🔧 Implementation Options

### Option A: Run Python MCP Server (MVP)
- Keep Python server as-is
- Deploy to hosting service (Lambda, Cloud Functions)
- Expose HTTP endpoints
- Call from Prismatic agent flows

### Option B: Convert to Prismatic Actions (Production)
- Convert Python tools to TypeScript/JavaScript
- Create Prismatic component with actions
- Use actions directly in agent flows
- Better integration with Prismatic ecosystem

**Start with Option A, migrate to Option B later.**

## 📚 Full Documentation

See [PRISMATIC_BUILD_GUIDE.md](./PRISMATIC_BUILD_GUIDE.md) for:
- Detailed step-by-step instructions
- Complete invocation schemas for all tools
- Code examples
- Troubleshooting guide
- Alternative approaches

## 🆚 Option Comparison

| Feature | Option 1 (Agent Flows) | Option 2 (Custom MCP) |
|---------|----------------------|----------------------|
| **Complexity** | ⭐ Simple | ⭐⭐⭐ Complex |
| **Deployment** | Prismatic UI | Custom server |
| **Maintenance** | Low | High |
| **Best For** | Your use case ✅ | Multi-integration |

**Verdict: Option 1 is the clear winner for your needs.**
