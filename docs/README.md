# Documentation Index

## Quick Navigation

| Document | Audience | Description |
|----------|----------|-------------|
| [README.md](../README.md) | All | Main project documentation with architecture diagrams |
| [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) | Executives | Business context, value proposition, demo scenario |
| [TECHNICAL_DEEP_DIVE.md](./TECHNICAL_DEEP_DIVE.md) | Engineers | Implementation details, code examples, data flows |

> **Note**: While Salesforce is the reference implementation, the architecture supports any external system via MCP.

---

## Component Documentation

### MCP HTTP Wrapper (`mcp/`)
- **Location**: `../mcp/`
- **Purpose**: FastAPI service that orchestrates AI insights and agent queries
- **Key Files**:
  - `services/ai_insights.py` - Insight generation and agent query handling
  - `services/salesforce_context.py` - Salesforce data retrieval with caching
  - `clients/salesforce_mcp.py` - Prismatic webhook client
  - `clients/llm_proxy.py` - LLM proxy integration

### Salesforce MCP Component (`components/salesforce-mcp/`)
- **Location**: `../components/salesforce-mcp/`
- **Purpose**: Prismatic Code-Native Integration for Salesforce
- **Key Files**:
  - `src/flows.ts` - MCP flow definitions (commercial context, signing likelihood)
  - `src/salesforceClient.ts` - JWT authentication client
  - `src/index.ts` - Integration definition

### AI Insights UI (`components/ai-insights-ui/`)
- **Location**: `../components/ai-insights-ui/`
- **Purpose**: Documentation for Luminance frontend integration
- **Implementation Files** (in `web/` repo):
  - `src/public/js/views/corporate/group-overview/group-ai-insights-view.ts`
  - `views/templates/corporate/group-overview/group-ai-insights-view.hbs`
  - `src/public/less/views/corporate/group-overview/group-ai-insights-view.less`

### Agentic Layer (`components/agentic-layer/`)
- **Location**: `../components/agentic-layer/`
- **Purpose**: Agent architecture and orchestration documentation
- **Subdirectories**:
  - `architecture/` - System design documents
  - `prismatic/` - Prismatic deployment guides
  - `runbooks/` - Operational procedures

---

## API Reference

### MCP Wrapper Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/v1/groups/{id}/insights` | GET | Generate AI insights for a matter |
| `POST /api/v1/groups/{id}/agent` | POST | Handle natural language agent queries |
| `GET /health` | GET | Health check endpoint |

### Prismatic Webhook Flows

| Flow | Trigger | Description |
|------|---------|-------------|
| `get-salesforce-commercial-context` | Webhook POST | Retrieve Salesforce opportunity data |
| `get-signing-likelihood` | Webhook POST | Calculate deal signing probability |

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMINANCE_BASE_URL` | Yes | Luminance API base URL |
| `LUMINANCE_API_TOKEN` | Yes | OAuth access token |
| `LUMINANCE_PROJECT_ID` | Yes | Division/project ID |
| `SALESFORCE_MCP_WEBHOOK_URL` | Yes | Prismatic webhook endpoint |
| `LLM_PROXY_BASE_URL` | No | LLM proxy URL (optional) |
| `LLM_PROXY_API_KEY` | No | LLM proxy API key (optional) |

### Prismatic Config Variables

| Variable | Description |
|----------|-------------|
| `Salesforce Instance URL` | e.g., `https://yourorg.my.salesforce.com` |
| `Salesforce Client ID` | Connected App consumer key |
| `Salesforce Private Key` | JWT signing key (PEM format) |
| `Salesforce Username` | Integration user email |
| `Luminance Token URL` | e.g., `https://instance.luminance.com/auth/oauth2/token` |
| `Luminance Client ID` | OAuth client ID |
| `Luminance Client Secret` | OAuth client secret |
| `Luminance Division` | Project/division ID |
| `Counterparty Name Tag` | Matter tag key for counterparty mapping |

---

## Runbooks

### Local Development

1. **Start MCP Wrapper**:
   ```bash
   cd mcp-project
   source .venv/bin/activate
   python -m mcp.main
   ```

2. **Start Luminance Web** (with MCP integration):
   ```bash
   cd web
   ./START_WEB.sh
   ```

3. **Test Prismatic Webhook**:
   ```bash
   curl -X POST "https://hooks.prismatic.io/trigger/<instance-id>" \
     -H "Content-Type: application/json" \
     -d '{"opportunityName": "ACME Corporation"}'
   ```

### Deploying Prismatic Updates

```bash
cd mcp-project/components/salesforce-mcp
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
nvm use 20  # Requires Node 20+
prism login
npm run import
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "No Salesforce context" | Check Prismatic webhook URL and customer instance |
| "LLM proxy disabled" | Verify `LLM_PROXY_BASE_URL` and `LLM_PROXY_API_KEY` |
| Agent slow responses | Check cache hit rate; first query is slower |
| Widgets not rendering | Verify `summary.widgets` array in response |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **MCP Protocol** | Industry standard for AI-tool interop; future-proof; extensible to any system |
| **Prismatic Hosting** | Multi-tenant, managed auth, version control; works with any API |
| **FastAPI Wrapper** | Unified API, caching, LLM orchestration; aggregates multiple MCP servers |
| **60s Cache TTL** | Balance freshness vs. API rate limits; configurable per source |
| **Parallel Queries** | 5x performance improvement; scales across multiple external systems |
| **Normalized Response Format** | Consistent UI regardless of data source |

---

## Related Resources

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Prismatic Documentation](https://prismatic.io/docs/)
- [Salesforce JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
