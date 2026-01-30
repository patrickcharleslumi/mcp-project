# Project Overview: AI-Powered Contract Intelligence

**Build Something Brilliant - Competition Entry**

---

## The Vision

Transform Luminance from a standalone contract intelligence platform into the **central hub** for all contract-related decision-making—by bringing external context from any connected system directly into the user's workflow.

---

## Problem Statement

### The Context Gap

Luminance users lack key deal context contained in external systems and applications when reviewing contracts.

When a user reviews a contract in Luminance, they see:
- ✅ Contract terms and clauses
- ✅ Deviation from precedent
- ✅ Risk indicators based on language

What they **don't** see:
- ❌ Is this a $50K deal or a $5M deal? *(lives in CRM)*
- ❌ Is the customer a strategic account or a one-off? *(lives in CRM/ERP)*
- ❌ Are there open support issues affecting the relationship? *(lives in support systems)*
- ❌ What's the probability this deal actually closes? *(lives in CRM)*
- ❌ How does this compare to similar deals in the pipeline? *(lives in CRM)*
- ❌ What's the negotiation history and urgency? *(lives in email/Slack)*

This context lives in **CRM systems**, **ERP platforms**, **support tools**, and **communication apps**—all separate from Luminance.

### The Impact

Without external context:
- Users apply the same rigor to every deal regardless of value
- High-value deals get delayed while low-risk contracts receive excessive attention
- Cross-functional teams operate in silos, leading to friction
- AI recommendations are based on contract language alone, missing the "why"

---

## Our Solution

### Model Context Protocol (MCP) Integration Layer

We built an **AI agent** that sits within Luminance and connects to **any external system** via the **Model Context Protocol (MCP)**—an emerging standard for AI-to-tool communication.

**Key Capabilities**:

1. **Automatic Context Enrichment**  
   When a user opens a matter, the agent fetches data from connected systems and displays it in actionable widgets.

2. **Intelligent Recommendations**  
   Widgets show context-appropriate actions based on external data: deal stage, customer health, support status.

3. **Natural Language Queries**  
   Users can ask questions like "Which other companies are in a similar stage?" and receive structured, data-driven responses.

4. **Cross-System Intelligence**  
   The agent can search across all connected systems, not just the current matter.

**Reference Implementation**: Salesforce CRM—demonstrating the full integration pattern that can be replicated for any external system.

---

## What We Built

### 1. MCP Server Framework

A **pluggable architecture** for connecting any external system:
- Standardized MCP flow interface
- Authentication abstraction (OAuth, JWT, API keys)
- Normalized response format for UI consumption

**Reference Implementation - Salesforce MCP Component**:
- Authenticates via JWT Bearer Flow
- Executes SOQL queries across Opportunities, Accounts, Contracts, Cases
- Returns normalized, structured data via webhook

### 2. MCP HTTP Wrapper

A **FastAPI Python service** that:
- Orchestrates calls between Luminance UI and any number of MCP servers
- Implements caching (60s TTL) and parallel execution for performance
- Integrates with LLM proxy for natural language understanding
- Provides unified `/insights` and `/agent` endpoints
- Aggregates data from multiple external sources

### 3. AI Insights UI

**Frontend components** integrated into Luminance:
- Dynamic widget grid that adapts to external data
- Real-time loading indicators
- Agent chat panel with formatted responses
- Refresh button for on-demand updates
- Extensible to display data from any connected system

---

## Technical Highlights

| Aspect | Implementation |
|--------|---------------|
| **Authentication** | Salesforce JWT Bearer, Luminance OAuth 2.0 |
| **Data Sources** | Salesforce Opportunities, Accounts, Contracts, Cases |
| **Performance** | 60s cache TTL, asyncio parallel queries, 9 companies in ~2s |
| **AI Model** | Claude/GPT via LLM proxy with structured system prompts |
| **UI Framework** | Backbone.js views, Handlebars templates, LESS styling |
| **Deployment** | Prismatic hosted runtime, FastAPI on Kubernetes |

---

## Demo Scenario

**User Story**: A legal professional is reviewing the ACME Corporation MSA.

1. **User opens the matter** in Luminance
2. **AI Insights tab** automatically loads with Salesforce context:
   - "Deal Outcome: Won · Close 2026-08-29"
   - "Immediate Action: Schedule implementation kickoff"
   - "Customer Health: Green"
   - "Contract Action: Prepare final contract for signature"

3. **User asks**: "Which other companies are in a similar stage?"
4. **Agent responds**:
   ```
   📊 RESULTS
   • Burlington Textiles — Closed Won, ACV $240,000
   • Express Logistics — Closed Won, ACV $180,000
   • GenePoint — Closed Won, ACV $320,000
   
   💡 INSIGHT
   Your portfolio has 4 Closed Won deals with combined ACV of $980,000.
   All accounts show Green health status.
   
   ⚡ ACTION
   Prioritize post-sale engagement for ACME to match successful patterns.
   ```

5. **User asks**: "Show me deals at risk"
6. **Agent searches** for opportunities with low probability or open support cases
7. **Structured response** highlights accounts needing attention

---

## Business Value

### For Luminance Users
- **Prioritization**: Know which deals deserve deep review vs. fast-track
- **Context**: Understand commercial significance without leaving Luminance
- **Efficiency**: Fewer context switches, faster decision-making

### For Cross-Functional Teams
- **Visibility**: All stakeholders see the same context, reducing friction
- **Speed**: High-value deals get appropriate urgency
- **Intelligence**: AI recommendations consider data from all systems

### For the Organization
- **Integration**: Luminance becomes the single pane for contract decisions
- **Extensibility**: MCP standard allows adding any external system
- **Competitive Edge**: AI-powered contract intelligence with full business awareness
- **Future-Proof**: Built on emerging MCP standard for AI-tool interoperability

---

## Future Roadmap

| Phase | Enhancement | External System |
|-------|-------------|-----------------|
| **Phase 1** | ✅ CRM commercial context | Salesforce |
| **Phase 2** | ERP financial context | Sage, NetSuite, SAP |
| **Phase 3** | Communication context | Slack, Teams, Email |
| **Phase 4** | Support/ticketing context | Zendesk, ServiceNow |
| **Phase 5** | Proactive alerts from external changes | All systems |
| **Phase 6** | Bi-directional sync | Push insights back to external systems |

---

## Repository Structure

```
mcp-project/
├── README.md                 # Main documentation (start here)
├── PROJECT_OVERVIEW.md       # This file - executive summary
├── docs/
│   ├── TECHNICAL_DEEP_DIVE.md # Implementation details
│   └── README.md             # Documentation index
├── mcp/                      # FastAPI MCP wrapper
├── components/
│   ├── salesforce-mcp/       # Prismatic Salesforce integration
│   ├── ai-insights-ui/       # UI component docs
│   └── agentic-layer/        # Agent architecture docs
├── credentials/              # Local dev credentials
├── deploy/                   # Kubernetes manifests
└── tests/                    # Unit and integration tests
```

---

## Getting Started

```bash
# Quick local setup
cd mcp-project
source .venv/bin/activate
python -m mcp.main  # Start MCP wrapper

# Or use the integrated start script
cd web
./START_WEB.sh  # Starts Luminance + MCP wrapper
```

---

## Contributors

**Joe Pearce** - Solutions Engineering

---

*This project demonstrates how Luminance can evolve from a contract intelligence platform to a comprehensive contract decision platform by leveraging the Model Context Protocol for seamless external system integration.*
