# Components

This directory contains the modular components of the AI-Powered Contract Intelligence platform.

Each MCP component follows a standardized pattern that can be replicated for **any external system**.

---

## Component Overview

```
components/
├── salesforce-mcp/       # Reference implementation: Salesforce CRM
├── ai-insights-ui/       # UI integration documentation
├── agentic-layer/        # Agent architecture docs
└── luminance-mcp/        # Legacy MCP server (deprecated)
```

> **Extensibility**: New systems (ERP, Slack, Zendesk, etc.) follow the same pattern as `salesforce-mcp/`

---

## salesforce-mcp/

**Type**: Prismatic Code-Native Integration  
**Language**: TypeScript  
**Deployment**: Prismatic hosted runtime

### Purpose
Provides MCP-compliant API for retrieving Salesforce commercial context and calculating signing likelihood scores.

### Flows

| Flow | Description | Input | Output |
|------|-------------|-------|--------|
| `get-salesforce-commercial-context` | Full opportunity data | `opportunityName` or `opportunityId` | Opportunity, Account, Contracts, Cases |
| `get-signing-likelihood` | Probability scoring | `opportunityName` or `opportunityId` | Score (0-100), Risk Factors, Recommendations |

### Key Files

```
salesforce-mcp/
├── src/
│   ├── index.ts              # Integration definition
│   ├── flows.ts              # MCP flow implementations
│   ├── salesforceClient.ts   # JWT auth client
│   └── configPages.ts        # Prismatic config UI
├── package.json
└── README.md
```

### Deployment

```bash
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
nvm use 20
prism login
npm run import
```

---

## ai-insights-ui/

**Type**: Documentation  
**Implementation**: Located in `web/` repository

### Purpose
Documents the frontend integration points for the AI Insights panel in Luminance.

### Implementation Files (in web/)

| File | Purpose |
|------|---------|
| `src/public/js/views/corporate/group-overview/group-ai-insights-view.ts` | View logic, data fetching, rendering |
| `views/templates/corporate/group-overview/group-ai-insights-view.hbs` | HTML template structure |
| `src/public/less/views/corporate/group-overview/group-ai-insights-view.less` | Styling with severity colors |

### Features
- Dynamic widget generation based on deal stage
- Real-time loading indicators
- Agent chat panel with formatted responses
- Refresh button for on-demand updates
- Responsive layout on zoom

---

## agentic-layer/

**Type**: Documentation  
**Purpose**: Agent architecture and orchestration patterns

### Structure

```
agentic-layer/
├── architecture/
│   ├── ARCHITECTURE.md       # System design
│   └── CODE_NATIVE_APPROACH.md # Prismatic patterns
├── prismatic/
│   ├── PRISMATIC_QUICK_START.md
│   ├── PRISMATIC_BUILD_GUIDE.md
│   └── PRISMATIC_DEPLOYMENT.md
├── runbooks/
│   ├── GETTING_STARTED.md
│   ├── QUICKSTART.md
│   └── STEP_BY_STEP_BUILD.md
└── README.md
```

### Topics Covered
- MCP protocol compliance
- Agent orchestration patterns
- Prismatic deployment workflows
- Debugging and troubleshooting

---

## luminance-mcp/ (Deprecated)

**Status**: Deprecated - functionality moved to `mcp/` at project root

This directory previously contained an stdio-based MCP server. The HTTP wrapper in `mcp/` is now the primary integration point.

---

## Adding New Components

To add a new MCP integration for **any external system**:

1. **Create directory**: `components/<name>-mcp/`
2. **Implement flows**: Follow Prismatic Code-Native pattern (see `salesforce-mcp/` as reference)
3. **Add client**: Create `mcp/clients/<name>_mcp.py`
4. **Integrate**: Add to `mcp/services/ai_insights.py`
5. **Document**: Update this README and `docs/README.md`

### Example: Slack MCP (Communication Context)

```
components/slack-mcp/
├── src/
│   ├── index.ts
│   ├── flows.ts          # get-channel-context, search-messages
│   └── slackClient.ts    # OAuth2 client
└── package.json

mcp/clients/slack_mcp.py  # HTTP client for Slack MCP
```

### Example: NetSuite MCP (ERP/Financial Context)

```
components/netsuite-mcp/
├── src/
│   ├── index.ts
│   ├── flows.ts          # get-customer-financials, get-payment-history
│   └── netsuiteClient.ts # Token-based auth
└── package.json

mcp/clients/netsuite_mcp.py
```

### Example: Zendesk MCP (Support Context)

```
components/zendesk-mcp/
├── src/
│   ├── index.ts
│   ├── flows.ts          # get-customer-tickets, get-satisfaction-score
│   └── zendeskClient.ts  # API token auth
└── package.json

mcp/clients/zendesk_mcp.py
```

The same UI widgets and agent queries work seamlessly with any combination of connected systems.
