# AI-Powered Contract Intelligence Platform

**Luminance × External Systems MCP Integration**

> Bridging the gap between contract intelligence and business context through the Model Context Protocol (MCP)

---

## Executive Summary

This project demonstrates a production-ready integration architecture that connects Luminance's contract intelligence platform with **any external business system** using the **Model Context Protocol (MCP)** standard. Salesforce CRM serves as the reference implementation, but the pattern extends to ERP systems, communication platforms, support tools, and more.

### The Problem We Solved

Luminance users lack key deal context contained in external systems and applications when reviewing contracts:
- **Deal value, probability, and stage** live in CRM systems (Salesforce, HubSpot, Dynamics)
- **Financial data and payment history** live in ERP systems (Sage, NetSuite, SAP)
- **Customer health and support history** live in ticketing systems (Zendesk, ServiceNow)
- **Negotiation context and urgency** live in communication tools (Slack, Teams, Email)
- **Contract terms and obligations** live in Luminance

Without this context, users make decisions in isolation, leading to:
- Over-negotiation of low-risk deals
- Under-prioritization of high-value opportunities
- Delayed deal velocity due to context-switching between systems

### Our Solution

An **AI agent** embedded within Luminance that:
1. **Automatically fetches** external context from connected systems when a user opens a matter
2. **Surfaces actionable insights** through dynamic widgets (deal status, recommended actions, risk factors)
3. **Responds to natural language queries** about the current deal or broader portfolio
4. **Performs intelligent searches** across connected systems (CRM, ERP, support platforms)

**Reference Implementation**: Salesforce CRM integration demonstrating the full pattern

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LUMINANCE WEB APPLICATION                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AI Insights Panel                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Deal Outcome │  │   Priority   │  │    Risk      │  [Widgets]    │   │
│  │  │    Widget    │  │   Action     │  │  Mitigation  │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │              AI Agent Chat Interface                          │   │   │
│  │  │  User: "Which companies are in a similar stage?"             │   │   │
│  │  │  Agent: 📊 RESULTS: Burlington Textiles, Express Logistics...│   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCP HTTP WRAPPER (FastAPI)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  AI Insights    │  │   Salesforce    │  │      LLM Proxy Client       │ │
│  │    Service      │──│    Context      │──│  (Claude/GPT via Proxy)     │ │
│  │                 │  │    Service      │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│         │                     │                                             │
│         │                     ▼                                             │
│         │    ┌─────────────────────────────────────────────────────────┐   │
│         │    │              SALESFORCE MCP CLIENT                       │   │
│         │    │   • Caching (60s TTL) • Parallel requests (asyncio)     │   │
│         │    │   • Dynamic filtering • Deduplication                    │   │
│         │    └─────────────────────────────────────────────────────────┘   │
│         │                     │                                             │
└─────────┼─────────────────────┼─────────────────────────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────┐  ┌─────────────────────────────────────────────────────┐
│   LUMINANCE API     │  │              PRISMATIC INTEGRATION PLATFORM         │
│  • Matters          │  │  ┌─────────────────────────────────────────────┐   │
│  • Documents        │  │  │        SALESFORCE MCP COMPONENT             │   │
│  • Annotations      │  │  │  • JWT Bearer Authentication               │   │
│  └───────────────── │  │  │  • SOQL Queries (Opportunities, Accounts)  │   │
└─────────────────────┘  │  │  • Contract & Case retrieval               │   │
                         │  │  • Signing Likelihood calculation          │   │
                         │  └─────────────────────────────────────────────┘   │
                         └─────────────────────────────────────────────────────┘
                                            │
                                            ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                 SALESFORCE CRM                       │
                         │  Opportunities │ Accounts │ Contracts │ Cases       │
                         └─────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Salesforce MCP Component (`components/salesforce-mcp/`)

A **Prismatic Code-Native Integration** that provides two MCP flows:

| Flow | Purpose | Data Returned |
|------|---------|---------------|
| `get-salesforce-commercial-context` | Retrieve comprehensive deal context | Opportunity, Account, Contracts, Cases, Customer Health |
| `get-signing-likelihood` | Calculate probability of deal closing | Score (0-100), Risk Factors, Recommendations |

**Authentication**: Salesforce JWT Bearer Flow using a private key certificate.

**SOQL Queries**: Extended queries that pull from multiple Salesforce objects in a single call:
- Opportunity with 25+ fields
- Account relationship data (revenue, employees, industry)
- Associated Contracts (up to 5 most recent)
- Open Cases for customer health assessment

### 2. MCP HTTP Wrapper (`mcp/`)

A **FastAPI application** that serves as the integration gateway:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/groups/{id}/insights` | GET | Generate AI insights for a matter |
| `/api/v1/groups/{id}/agent` | POST | Handle natural language queries |
| `/health` | GET | Health check |

**Key Services**:

- **`ai_insights.py`**: Orchestrates insight generation with intelligent widget building
- **`salesforce_context.py`**: Manages Salesforce data retrieval with caching and parallel execution
- **`llm_proxy.py`**: Interfaces with the LLM proxy for natural language processing

**Performance Optimizations**:
- 60-second LRU cache for Salesforce responses
- `asyncio.gather()` for parallel API calls (9 companies queried in ~2 seconds)
- Deduplication by Opportunity ID

### 3. AI Insights UI (`web/` integration)

Frontend components integrated into the Luminance matter view:

| Component | Location | Function |
|-----------|----------|----------|
| `group-ai-insights-view.ts` | TypeScript view | Handles data fetching, widget rendering, agent chat |
| `group-ai-insights-view.hbs` | Handlebars template | UI structure with loading states |
| `group-ai-insights-view.less` | LESS styles | Responsive grid layout, severity colors |

**Features**:
- Dynamic widget generation based on deal stage (Won/Lost/Open)
- Real-time loading indicators with "Lumi thinking" animation
- Refresh button for on-demand data refresh
- Agent chat with formatted responses (📊 💡 ⚡ sections)
- Responsive scaling on zoom

---

## Data Flow

### Automatic Insights (Tab Selection)

```
User clicks "AI Insights" tab
         │
         ▼
Luminance UI → GET /api/v1/groups/{id}/insights
         │
         ▼
MCP Wrapper: AiInsightsService.generate_insights()
         │
         ├──→ Luminance API: Get matter, document, annotations
         │
         ├──→ Salesforce MCP: Get commercial context
         │         │
         │         ▼
         │    Prismatic: SOQL query → Salesforce CRM
         │
         ├──→ Salesforce MCP: Get signing likelihood
         │
         ▼
Build Summary + Widgets based on deal stage
         │
         ▼
Return to UI → Render widgets with severity indicators
```

### Agent Query (Natural Language)

```
User types: "Which companies are in a similar stage?"
         │
         ▼
Luminance UI → POST /api/v1/groups/{id}/agent
         │
         ▼
MCP Wrapper: AiInsightsService.query_agent()
         │
         ├──→ Intent Detection: "wants_search = true, filters = {stage: 'Closed Won'}"
         │
         ├──→ SalesforceContextService.dynamic_search()
         │         │
         │         ▼
         │    Parallel queries to Prismatic (9 companies)
         │         │
         │         ▼
         │    Apply filters, deduplicate, return matches
         │
         ├──→ LLM Proxy: Generate structured response
         │         │
         │         ▼
         │    System prompt enforces: 📊 RESULTS, 💡 INSIGHT, ⚡ ACTION
         │
         ▼
Return formatted response → Render in chat panel
```

---

## Configuration

### Environment Variables

```bash
# Luminance Connection
LUMINANCE_BASE_URL=https://your-instance.luminance.com
LUMINANCE_API_TOKEN=<oauth-token>
LUMINANCE_PROJECT_ID=<division-id>

# Salesforce MCP (Prismatic)
SALESFORCE_MCP_WEBHOOK_URL=https://hooks.prismatic.io/trigger/<instance-id>

# LLM Proxy (Optional)
LLM_PROXY_BASE_URL=https://llm-proxy.internal
LLM_PROXY_API_KEY=<api-key>
```

### Prismatic Configuration

The Salesforce MCP component requires these config variables in Prismatic:

| Variable | Purpose |
|----------|---------|
| `Salesforce Instance URL` | e.g., `https://yourorg.my.salesforce.com` |
| `Salesforce Client ID` | Connected App consumer key |
| `Salesforce Private Key` | JWT signing key (PEM format) |
| `Salesforce Username` | Integration user |
| `Luminance Token URL` | For matter ID resolution |
| `Luminance Client ID/Secret` | OAuth credentials |
| `Luminance Division` | Project ID |
| `Counterparty Name Tag` | Tag key for mapping |

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 20+ (for Prismatic CLI)
- PostgreSQL (Luminance local database)
- Salesforce Developer Org with Connected App

### Quick Start

```bash
# 1. Start the MCP wrapper
cd /path/to/mcp-project
source .venv/bin/activate
python -m mcp.main

# 2. Start Luminance web (includes MCP in START_WEB.sh)
cd /path/to/web
./START_WEB.sh
```

### Testing Salesforce Connection

```bash
# Test Prismatic webhook directly
curl -X POST "https://hooks.prismatic.io/trigger/<your-instance>" \
  -H "Content-Type: application/json" \
  -d '{"opportunityName": "ACME Corporation"}'
```

---

## Demo Guide

### What You'll Show

1. **AI Insights Panel** - Auto-populated widgets when opening a matter:
   - Deal Outcome (Won/Lost/Open with close date)
   - Immediate Action (context-appropriate next step)
   - Customer Success (health status and recommendations)
   - Contract Action (specific contract-related guidance)

2. **AI Agent** - Natural language queries about the deal and portfolio

### Demo Prompts (ACME Corporation Example)

```
Prompt 1: What is the current status of this ACME deal and what should I do next?
```
*Shows: Context-aware status summary with actionable next steps*

```
Prompt 2: How does ACME compare to our other closed won deals in terms of value?
```
*Shows: Cross-portfolio analysis with concrete ACV numbers*

```
Prompt 3: What similar deals have we closed that I can use as precedent for ACME?
```
*Shows: AI-powered search to find comparable deals for benchmarking*

### Demo Flow

1. Open the **ACME Corporation** matter in Luminance
2. Click the **AI Insights** tab
3. Point out the auto-populated **widgets** (pulled from Salesforce in real-time)
4. Use the **agent chat** to ask the demo prompts above
5. Highlight how external CRM data informs contract decisions

---

## Key Technical Decisions

### Why MCP?

The **Model Context Protocol** provides a standardized interface for AI agents to interact with external tools. By implementing MCP:

1. **Interoperability**: The same Salesforce integration works with any MCP-compatible agent
2. **Auditability**: All tool calls are logged with structured schemas
3. **Extensibility**: Additional data sources (ERP, Slack, etc.) can be added as MCP servers

### Why Prismatic?

Prismatic offers **hosted integration runtime** with:
- Built-in OAuth/JWT authentication
- Webhook triggers for synchronous calls
- Multi-tenant deployment (one component, many customers)
- Version management and deployment automation

### Why FastAPI Wrapper?

The MCP HTTP wrapper provides:
- **Unified API** for Luminance UI (single endpoint vs. multiple MCP servers)
- **Caching layer** to reduce external API calls
- **LLM orchestration** for natural language query handling
- **Security boundary** (tokens never exposed to frontend)

---

## Metrics & Observability

### Logging

All requests include `request_id` for tracing:

```json
{
  "timestamp": "2026-01-30T12:45:54Z",
  "level": "INFO",
  "message": "Salesforce commercial context retrieved",
  "request_id": "abc-123",
  "opportunity_id": "006fj000008V9luAAC",
  "duration_ms": 1250
}
```

### Performance

| Operation | Latency (uncached) | Latency (cached) |
|-----------|-------------------|------------------|
| Single company lookup | ~1.5s | <100ms |
| Portfolio search (9 companies) | ~9s | ~2s |
| Agent query with LLM | ~3-5s | N/A |

---

## Repository Structure

```
mcp-project/
├── README.md                    # This file
├── PROJECT_OVERVIEW.md          # Detailed project overview
├── mcp/                         # FastAPI MCP wrapper
│   ├── app.py                   # Application factory
│   ├── config.py                # Configuration management
│   ├── controllers/             # HTTP endpoints
│   ├── services/                # Business logic
│   │   ├── ai_insights.py       # Insight generation + agent queries
│   │   └── salesforce_context.py # Salesforce data retrieval
│   └── clients/                 # External service clients
│       ├── luminance.py         # Luminance API client
│       ├── salesforce_mcp.py    # Prismatic webhook client
│       └── llm_proxy.py         # LLM proxy client
├── components/
│   ├── salesforce-mcp/          # Prismatic integration
│   │   ├── src/
│   │   │   ├── flows.ts         # MCP flow definitions
│   │   │   ├── salesforceClient.ts # JWT auth client
│   │   │   └── index.ts         # Integration definition
│   │   └── package.json
│   ├── ai-insights-ui/          # UI component documentation
│   └── agentic-layer/           # Agent architecture docs
├── credentials/                 # Local dev credentials (gitignored)
├── deploy/                      # Kubernetes manifests
└── tests/                       # Unit and integration tests
```

---

## Future Enhancements

1. **Additional MCP Servers**: ERP (Sage/NetSuite), Communication (Slack/Teams), Support (Zendesk/ServiceNow)
2. **Proactive Alerts**: Notify users when external system data changes (deal stage, support escalation)
3. **Clause-Level Recommendations**: Map external context to specific contract provisions
4. **Bulk Operations**: Update multiple matters from external system changes
5. **Audit Trail**: Full provenance tracking for all AI recommendations
6. **Bi-directional Sync**: Push Luminance insights back to external systems

---

## Contributors

- **Joe Pearce** - Solutions Engineering

---

## License

Internal Luminance use only. Copyright © 2026 Luminance.
