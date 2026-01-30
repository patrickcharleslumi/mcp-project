# Technical Deep Dive

This document provides implementation details for technical reviewers and future maintainers.

> **Note**: While this document focuses on the Salesforce implementation, the patterns and architecture apply to any external system integration via MCP.

---

## 1. MCP Component Pattern (Salesforce Reference Implementation)

### File: `components/salesforce-mcp/src/flows.ts`

The Prismatic integration exposes two MCP flows via webhook endpoints.

#### Flow 1: `get-salesforce-commercial-context`

**Purpose**: Retrieve comprehensive deal context from Salesforce.

**Input Schema**:
```json
{
  "opportunityId": "006XXXXXXXXXXXXXXX",  // Optional
  "opportunityName": "ACME Corporation",   // Optional
  "matterId": "17"                         // Optional - triggers Luminance lookup
}
```

**Query Strategy**:

1. If `opportunityId` provided → Direct SOQL query by ID
2. If `opportunityName` provided → LIKE search on Opportunity.Name
3. If `matterId` provided → Fetch annotations from Luminance API, extract counterparty tag value
4. If no Opportunity found → Fallback to Account search by name
5. If Account found → Query for Account's most recent Opportunity

**SOQL Fields Retrieved**:

```sql
-- Opportunity (25+ fields)
SELECT Id, Name, StageName, CloseDate, Amount, Probability, NextStep, Type,
       LeadSource, ForecastCategory, ForecastCategoryName, IsClosed, IsWon,
       ExpectedRevenue, TotalOpportunityQuantity, Description, CreatedDate, 
       LastModifiedDate, AccountId,
       -- Account relationship (12 fields)
       Account.Id, Account.Name, Account.Type, Account.Industry, Account.Website,
       Account.Phone, Account.BillingCity, Account.BillingState, Account.BillingCountry,
       Account.AnnualRevenue, Account.NumberOfEmployees, Account.Description,
       Account.Rating, Account.CreatedDate
FROM Opportunity

-- Contracts (separate query)
SELECT Id, ContractNumber, Status, StartDate, EndDate, ContractTerm,
       BillingCity, BillingState, BillingCountry, Description, CreatedDate
FROM Contract WHERE AccountId = '{accountId}' ORDER BY StartDate DESC LIMIT 5

-- Cases (separate query)
SELECT Id, CaseNumber, Subject, Status, Priority, Type, CreatedDate
FROM Case WHERE AccountId = '{accountId}' AND IsClosed = false 
ORDER BY CreatedDate DESC LIMIT 10
```

**Customer Health Calculation**:

```typescript
let customerHealth = "Green";
if (cases.some(c => c.Priority === "High" || c.Priority === "Critical")) {
  customerHealth = "Red";
} else if (cases.some(c => c.Priority === "Medium")) {
  customerHealth = "Yellow";
}
```

**Response Structure**:

```json
{
  "opportunity_id": "006fj000008V9luAAC",
  "opportunity_name": "ACME Corporation – CLM Platform Rollout",
  "deal_stage": {
    "stage_name": "Closed Won",
    "close_date": "2026-08-29",
    "forecast_category": "Closed",
    "is_closed": true,
    "is_won": true
  },
  "account": {
    "id": "001...",
    "name": "ACME Corporation",
    "industry": "Technology",
    "annual_revenue": 50000000,
    "rating": "Hot"
  },
  "financial_metrics": {
    "acv": 240000,
    "arr": 240000,
    "expected_revenue": 240000
  },
  "contracts": [...],
  "customer_health": {
    "open_cases_count": 2,
    "max_open_case_severity": "Low",
    "customer_health": "Green"
  },
  "metadata": {
    "probability": 100,
    "retrieved_at": "2026-01-30T12:00:00Z"
  }
}
```

#### Flow 2: `get-signing-likelihood`

**Purpose**: Calculate probability of deal closing with risk assessment.

**Scoring Algorithm**:

```typescript
// Base score from Salesforce probability
let baseScore = opportunity.Probability || 50;

// Stage adjustments
if (stageName.includes("closed won")) baseScore = 100;
if (stageName.includes("negotiation")) baseScore = Math.max(baseScore, 70);
if (stageName.includes("qualification")) riskFactors.push("Early stage");

// Forecast adjustments
if (forecast.includes("commit")) baseScore += 15;
if (forecast.includes("pipeline")) riskFactors.push("Not committed");

// Account quality
if (account.Rating === "Hot") baseScore += 10;
if (account.Rating === "Cold") baseScore -= 10;

// Close date proximity
if (daysUntilClose < 0) {
  baseScore -= 15;
  riskFactors.push(`Overdue by ${Math.abs(daysUntilClose)} days`);
}

// Support issues
if (openCasesCount > 5) {
  baseScore -= 10;
  riskFactors.push("Multiple open support cases");
}

// Clamp to 0-100
return Math.max(0, Math.min(100, baseScore));
```

**Response Structure**:

```json
{
  "opportunity_id": "006...",
  "signing_likelihood": {
    "score": 85,
    "confidence": "high",
    "assessment": "High likelihood of signing. Deal progressing well."
  },
  "positive_factors": [
    "Deal in advanced negotiation stage",
    "Forecast: Committed deal",
    "Clear next steps defined"
  ],
  "risk_factors": [
    "Close date within 7 days - ensure all blockers resolved"
  ],
  "recommendations": [
    "Finalize contract review",
    "Confirm executive sponsor alignment"
  ]
}
```

---

## 2. MCP HTTP Wrapper (FastAPI)

### File: `mcp/services/ai_insights.py`

#### Widget Generation Logic

Widgets are dynamically generated based on deal stage:

**Won Deals**:
```python
widgets = [
    {"label": "Deal Outcome", "value": "Won · Close {date}", "severity": "low"},
    {"label": "Immediate Action", "value": "Schedule implementation kickoff"},
    {"label": "Customer Success", "value": "Assign CSM and create timeline"},
    {"label": "Contract Action", "value": "Prepare final contract for signature"},
]
```

**Lost Deals**:
```python
widgets = [
    {"label": "Deal Outcome", "value": "Lost", "severity": "high"},
    {"label": "Win-Back Action", "value": "Schedule post-mortem"},
    {"label": "Re-engagement", "value": "Set 90-day follow-up"},
    {"label": "Account Strategy", "value": "Review and adjust approach"},
]
```

**Open Deals** (uses signing likelihood):
```python
score = signing_likelihood.get("score", 50)
if score >= 70:
    urgency = "High Confidence"
    severity = "low"
elif score >= 40:
    urgency = "Moderate Risk"
    severity = "medium"
else:
    urgency = "At Risk"
    severity = "high"

widgets = [
    {"label": "Win Probability", "value": f"{score}% · {urgency}", "severity": severity},
    {"label": "Priority Action", "value": recommendations[0]},
    {"label": "Risk Mitigation", "value": risk_factors[0]},
    {"label": "Stakeholder Action", "value": "Confirm decision-maker alignment"},
]
```

#### Intent Detection for Agent Queries

The agent interprets user queries to determine search parameters:

```python
# Keywords that trigger Salesforce search
wants_search = any(term in query_lower for term in [
    "other compan", "similar deal", "pipeline", "portfolio",
    "list", "search", "find", "in my salesforce"
])

# Stage filters
if "closed won" in query_lower:
    filters["is_won"] = True
    filters["is_closed"] = True
elif "same stage" in query_lower and opportunity:
    filters["stage"] = opportunity.stage_name

# Region filters
if "same region" in query_lower and opportunity.region:
    filters["region"] = opportunity.region

# Health filters
if "at risk" in query_lower:
    filters["health"] = "red"
```

### File: `mcp/services/salesforce_context.py`

#### Caching Strategy

```python
# Module-level cache with 60-second TTL
_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 60.0

def _cache_get(key: str) -> Optional[Any]:
    if key in _CACHE:
        timestamp, value = _CACHE[key]
        if time.time() - timestamp < _CACHE_TTL:
            return value
        del _CACHE[key]
    return None

def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)
```

#### Parallel Query Execution

```python
async def dynamic_search(self, filters: dict, current_opportunity_name: str = None):
    known_companies = [
        "ACME", "Burlington Textiles", "Dickenson", "Edge Communications",
        "Express Logistics", "GenePoint", "Grand Hotels", "United Oil"
    ]
    
    async def fetch_company(company: str) -> Optional[dict]:
        cache_key = f"company:{company}"
        cached = _cache_get(cache_key)
        if cached:
            return cached
        payload = await self.client.get_commercial_context(company)
        if payload:
            _cache_set(cache_key, payload)
        return payload
    
    # Execute ALL company queries in parallel
    payloads = await asyncio.gather(*[fetch_company(c) for c in known_companies])
    
    # Filter and deduplicate results
    seen_ids = set()
    results = []
    for payload in payloads:
        if not payload:
            continue
        opp_id = payload.get("opportunity_id")
        if opp_id in seen_ids:
            continue
        if not self._matches_filters(payload, filters):
            continue
        seen_ids.add(opp_id)
        results.append(payload)
    
    return results
```

#### Filter Matching

```python
def _matches_filters(self, payload: dict, filters: dict) -> bool:
    deal_stage = payload.get("deal_stage", {})
    
    if "stage" in filters:
        opp_stage = (deal_stage.get("stage_name") or "").lower()
        filter_stage = filters["stage"].lower()
        if filter_stage not in opp_stage:
            return False
    
    if "is_closed" in filters:
        if deal_stage.get("is_closed") != filters["is_closed"]:
            return False
    
    if "is_won" in filters:
        if deal_stage.get("is_won") != filters["is_won"]:
            return False
    
    if "min_probability" in filters:
        prob = payload.get("metadata", {}).get("probability") or 0
        if prob < filters["min_probability"]:
            return False
    
    return True
```

---

## 3. LLM Integration

### System Prompt Design

The agent uses a structured system prompt to ensure consistent output:

```python
system_prompt = """
You are Lumi, a sales intelligence AI. Provide CLEAN, STRUCTURED responses.

RESPONSE FORMAT (use these exact section headers with emojis):

📊 RESULTS
[If listing companies, use this format - one per line]
• Company Name — Stage, Key Metric (e.g. ACV $X or Probability X%)

💡 INSIGHT
[2-3 sentences of analysis. Be specific with numbers and comparisons.]

⚡ ACTION
[One clear, specific action starting with a verb.]

RULES:
1. ALWAYS use the three sections above (📊 💡 ⚡)
2. Keep total response under 120 words
3. Be PRESCRIPTIVE - 'Prioritize X' not 'consider X'
4. Use actual data - cite ACVs, probabilities, dates
5. If no results, say 'No matching deals found' in RESULTS section

CURRENT DEAL:
{opportunity_name} — {stage}, Health: {health}, ACV: {acv}

{search_context}

Deliver conclusions like an expert advisor.
"""
```

### Response Formatting

Agent responses are post-processed for clean display:

```python
# Ensure line breaks before section headers
for header in ["📊 RESULTS", "💡 INSIGHT", "⚡ ACTION"]:
    formatted = formatted.replace(header, f"\n\n{header}\n")

# Ensure bullet points are on new lines
formatted = formatted.replace("• ", "\n• ")

# Clean up excessive newlines
while "\n\n\n" in formatted:
    formatted = formatted.replace("\n\n\n", "\n\n")
```

---

## 4. Frontend Integration

### TypeScript View (`group-ai-insights-view.ts`)

#### Dynamic Widget Rendering

```typescript
renderSummary(summary: SummaryPayload): void {
    // Render summary grid items
    const $grid = this.$summary_grid;
    $grid.empty();
    summary.items.forEach(item => {
        const $item = $('<div class="summary-item">')
            .append($('<span class="label">').text(item.label))
            .append($('<span class="value">').text(item.value));
        if (item.severity) {
            $item.addClass(`severity-${item.severity}`);
        }
        $grid.append($item);
    });

    // Render dynamic widgets
    const $widgets = this.$summary_widgets;
    $widgets.empty();
    (summary.widgets || []).forEach(widget => {
        const $widget = $('<div class="insight-widget">')
            .append($('<div class="widget-label">').text(widget.label))
            .append($('<div class="widget-value">').text(widget.value));
        if (widget.meta) {
            $widget.append($('<div class="widget-meta">').text(widget.meta));
        }
        if (widget.severity) {
            $widget.addClass(`severity-${widget.severity}`);
        }
        $widgets.append($widget);
    });
}
```

#### Loading State Management

```typescript
showSummaryLoading(show: boolean): void {
    if (show) {
        this.$summary_loading.removeClass('hidden');
        this.$summary_grid.addClass('hidden');
        this.$summary_widgets.addClass('hidden');
        this.$confidence_badge.addClass('hidden');
        this.$refresh_insights_button.addClass('hidden');
    } else {
        this.$summary_loading.addClass('hidden');
        this.$summary_grid.removeClass('hidden');
        this.$summary_widgets.removeClass('hidden');
        this.$confidence_badge.removeClass('hidden');
        this.$refresh_insights_button.removeClass('hidden');
    }
}
```

### LESS Styling (`group-ai-insights-view.less`)

#### Responsive Widget Grid

```less
.summary-widgets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-top: 16px;
    
    .insight-widget {
        background: @widget-bg;
        border-radius: 8px;
        padding: 16px;
        border-left: 4px solid @border-color;
        
        &.severity-high {
            border-left-color: @red-500;
            background: fade(@red-500, 5%);
        }
        
        &.severity-medium {
            border-left-color: @yellow-500;
            background: fade(@yellow-500, 5%);
        }
        
        &.severity-low {
            border-left-color: @green-500;
            background: fade(@green-500, 5%);
        }
    }
}
```

#### Agent Response Formatting

```less
.agent-chat-message {
    .text {
        white-space: pre-wrap;  // Preserve line breaks
        font-size: 14px;
        line-height: 1.5;
    }
}
```

---

## 5. Authentication

### Salesforce JWT Bearer Flow

```typescript
// salesforceClient.ts
export async function createSalesforceClient(context: any) {
    const privateKey = getConfigString(context, "Salesforce Private Key");
    const clientId = getConfigString(context, "Salesforce Client ID");
    const username = getConfigString(context, "Salesforce Username");
    const instanceUrl = getConfigString(context, "Salesforce Instance URL");
    
    // Create JWT
    const jwt = jsonwebtoken.sign(
        {
            iss: clientId,
            sub: username,
            aud: instanceUrl,
            exp: Math.floor(Date.now() / 1000) + 300,
        },
        privateKey,
        { algorithm: "RS256" }
    );
    
    // Exchange JWT for access token
    const tokenResponse = await fetch(`${instanceUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Return configured axios client
    return axios.create({
        baseURL: instanceUrl,
        headers: { Authorization: `Bearer ${access_token}` },
    });
}
```

### Luminance OAuth (MCP Wrapper)

```python
# mcp/clients/luminance.py
async def _ensure_token(self):
    if self._token_expires_at and time.time() < self._token_expires_at - 60:
        return
    
    auth = base64.b64encode(
        f"{self._client_id}:{self._client_secret}".encode()
    ).decode()
    
    async with self._session.post(
        f"{self._base_url}/auth/oauth2/token",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data="grant_type=client_credentials",
    ) as response:
        data = await response.json()
        self._access_token = data["access_token"]
        self._token_expires_at = time.time() + data.get("expires_in", 3600)
```

---

## 6. Error Handling

### Graceful Degradation

```python
# If Salesforce unavailable, return partial insights
try:
    opportunity = await self.salesforce_context.find_opportunity(...)
except Exception as e:
    logger.warning("Salesforce lookup failed", error=str(e))
    opportunity = None

# Build response with available data
summary = _build_summary_from_salesforce(
    opportunity,  # May be None
    matter_name,
    document_name,
)

# If no Salesforce data, summary includes fallback widgets
if not opportunity:
    summary["widgets"] = []  # No widgets without Salesforce
    summary["confidence"] = 0.3  # Low confidence indicator
```

### Prismatic Error Propagation

```typescript
try {
    queryResult = await salesforceClient.get("/services/data/v58.0/query", { params: { q: soqlQuery } });
} catch (queryError: any) {
    const errorMsg = queryError?.response?.data?.message || queryError?.message;
    const errorBody = JSON.stringify(queryError?.response?.data || {});
    context.logger.error("SOQL query failed", { error: errorMsg, body: errorBody });
    throw new Error(`Salesforce query failed: ${errorMsg}`);
}
```

---

## 7. Testing

### Unit Tests (`tests/unit/`)

```python
# test_salesforce_context.py
async def test_find_opportunity_returns_parsed_data():
    mock_client = Mock()
    mock_client.get_commercial_context.return_value = {
        "opportunity_id": "006abc",
        "opportunity_name": "Test Deal",
        "deal_stage": {"stage_name": "Negotiation", "is_won": False},
    }
    
    service = SalesforceContextService()
    service.client = mock_client
    
    result = await service.find_opportunity("Test Company", None, None, None)
    
    assert result.opportunity_id == "006abc"
    assert result.stage_name == "Negotiation"
    assert result.is_won is False
```

### Integration Tests (`tests/integration/`)

```python
# test_prismatic_integration.py
async def test_prismatic_webhook_returns_valid_response():
    async with aiohttp.ClientSession() as session:
        async with session.post(
            PRISMATIC_WEBHOOK_URL,
            json={"opportunityName": "ACME Corporation"},
        ) as response:
            assert response.status == 200
            data = await response.json()
            assert "opportunity_id" in data
            assert "deal_stage" in data
```

---

## Summary

This integration demonstrates production-ready patterns for connecting Luminance to **any external system**:

1. **External API Integration**: Flexible auth (JWT, OAuth, API keys), query abstraction, error handling
2. **Caching & Performance**: TTL cache, parallel execution, deduplication—scales to multiple sources
3. **AI Orchestration**: Intent detection, structured prompts, response formatting—source-agnostic
4. **Frontend Integration**: Dynamic rendering, loading states, responsive design—adapts to any data
5. **Observability**: Structured logging, request tracing, graceful degradation

### Extending to New Systems

The architecture is designed for extensibility. To add a new external system:

1. **Create MCP Component**: Follow the Salesforce pattern in `components/`
2. **Add Client**: Create `mcp/clients/<system>_mcp.py`
3. **Integrate Service**: Update `mcp/services/ai_insights.py` to aggregate data
4. **Update UI**: Widgets automatically render data from any source

**Example systems that can be integrated**:
- **ERP**: Sage, NetSuite, SAP (financial data, payment history)
- **Communication**: Slack, Teams (negotiation context, urgency)
- **Support**: Zendesk, ServiceNow (customer health, open tickets)
- **Identity**: Okta, Azure AD (user context, permissions)
