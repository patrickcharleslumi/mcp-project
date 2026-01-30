# Salesforce MCP Component

A **Prismatic Code-Native Integration** that provides MCP-compliant access to Salesforce CRM data.

> **Reference Implementation**: This component serves as the template for integrating any external system with Luminance via MCP. The same patterns (authentication, flow structure, response normalization) apply to ERP, communication, and support systems.

---

## Overview

This component enables AI agents to query Salesforce for commercial context during contract review. It exposes two MCP flows via webhook endpoints:

| Flow | Purpose |
|------|---------|
| `get-salesforce-commercial-context` | Retrieve comprehensive opportunity and account data |
| `get-signing-likelihood` | Calculate probability of deal closing |

---

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   MCP Wrapper   │ ──── │    Prismatic    │ ──── │   Salesforce    │
│   (FastAPI)     │ HTTP │   (This Code)   │ REST │      CRM        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## MCP Flows

### 1. Get Salesforce Commercial Context

**Endpoint**: Prismatic webhook trigger  
**Method**: POST

**Input**:
```json
{
  "opportunityId": "006XXXXXXXXXXXXXXX",  // Optional
  "opportunityName": "ACME Corporation",   // Optional
  "matterId": "17"                         // Optional - triggers Luminance lookup
}
```

**Output**:
```json
{
  "opportunity_id": "006fj000008V9luAAC",
  "opportunity_name": "ACME Corporation – CLM Platform Rollout",
  "deal_stage": {
    "stage_name": "Closed Won",
    "close_date": "2026-08-29",
    "is_closed": true,
    "is_won": true,
    "forecast_category": "Closed"
  },
  "account": {
    "id": "001...",
    "name": "ACME Corporation",
    "industry": "Technology",
    "annual_revenue": 50000000,
    "number_of_employees": 500,
    "rating": "Hot"
  },
  "financial_metrics": {
    "acv": 240000,
    "arr": 240000,
    "expected_revenue": 240000
  },
  "contracts": [
    {
      "id": "800...",
      "contract_number": "00000123",
      "status": "Activated",
      "start_date": "2026-01-01",
      "end_date": "2027-01-01"
    }
  ],
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

### 2. Get Signing Likelihood

**Endpoint**: Prismatic webhook trigger  
**Method**: POST

**Input**: Same as commercial context

**Output**:
```json
{
  "opportunity_id": "006fj000008V9luAAC",
  "opportunity_name": "ACME Corporation – CLM Platform Rollout",
  "signing_likelihood": {
    "score": 85,
    "confidence": "high",
    "assessment": "High likelihood of signing. Deal progressing well.",
    "salesforce_probability": 100
  },
  "positive_factors": [
    "Deal already closed and won",
    "Forecast: Committed deal",
    "Clear next steps defined"
  ],
  "risk_factors": [],
  "recommendations": [
    "Continue current engagement strategy"
  ],
  "deal_context": {
    "stage": "Closed Won",
    "close_date": "2026-08-29",
    "amount": 240000,
    "account_name": "ACME Corporation"
  }
}
```

---

## Configuration

### Prismatic Config Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `Salesforce Instance URL` | Salesforce org URL | `https://yourorg.my.salesforce.com` |
| `Salesforce Client ID` | Connected App consumer key | `3MVG9...` |
| `Salesforce Private Key` | JWT signing key (PEM) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `Salesforce Username` | Integration user | `integration@yourorg.com` |
| `Luminance Token URL` | For matter ID resolution | `https://instance.luminance.com/auth/oauth2/token` |
| `Luminance Client ID` | OAuth client ID | `client_id` |
| `Luminance Client Secret` | OAuth client secret | `client_secret` |
| `Luminance Division` | Project/division ID | `123` |
| `Counterparty Name Tag` | Matter tag key | `counterparty_name` |

### Salesforce Connected App Setup

1. Create Connected App in Salesforce Setup
2. Enable OAuth, select "Enable for Device Flow"
3. Enable JWT Bearer Flow:
   - Check "Use digital signatures"
   - Upload X509 certificate
4. Pre-authorize integration user
5. Note Consumer Key (Client ID)

---

## SOQL Queries

### Opportunity Query

```sql
SELECT 
  Id, Name, StageName, CloseDate, Amount, Probability, NextStep, Type,
  LeadSource, ForecastCategory, ForecastCategoryName, IsClosed, IsWon,
  ExpectedRevenue, Description, CreatedDate, LastModifiedDate, AccountId,
  Account.Id, Account.Name, Account.Type, Account.Industry, Account.Website,
  Account.Phone, Account.BillingCity, Account.BillingState, Account.BillingCountry,
  Account.AnnualRevenue, Account.NumberOfEmployees, Account.Description,
  Account.Rating, Account.CreatedDate
FROM Opportunity 
WHERE Name LIKE '%{name}%' 
ORDER BY CloseDate DESC 
LIMIT 1
```

### Contract Query

```sql
SELECT 
  Id, ContractNumber, Status, StartDate, EndDate, ContractTerm,
  BillingCity, BillingState, BillingCountry, Description, CreatedDate
FROM Contract 
WHERE AccountId = '{accountId}' 
ORDER BY StartDate DESC 
LIMIT 5
```

### Case Query

```sql
SELECT 
  Id, CaseNumber, Subject, Status, Priority, Type, CreatedDate
FROM Case 
WHERE AccountId = '{accountId}' AND IsClosed = false 
ORDER BY CreatedDate DESC 
LIMIT 10
```

---

## Development

### Prerequisites

- Node.js 20+
- Prismatic CLI (`npm install -g @prismatic-io/prism`)
- Access to Prismatic organization

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Deployment

```bash
# Login to Prismatic
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
prism login

# Import integration
npm run import

# Or publish component (deprecated)
# prism integrations:import --integrationId <id>
```

---

## File Structure

```
salesforce-mcp/
├── src/
│   ├── index.ts              # Integration definition
│   ├── flows.ts              # MCP flow implementations
│   ├── salesforceClient.ts   # JWT Bearer auth client
│   └── configPages.ts        # Prismatic config UI definition
├── package.json
├── tsconfig.json
└── README.md                  # This file
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `INVALID_SESSION_ID` | Token expired | Re-authenticate; check JWT clock skew |
| `INVALID_GRANT` | JWT assertion invalid | Verify private key matches certificate |
| `INSUFFICIENT_ACCESS` | User lacks permissions | Pre-authorize user in Connected App |
| `No Opportunity found` | Name mismatch | Try partial name; check Salesforce data |
| `Luminance token failed` | Invalid credentials | Verify client ID/secret |

---

## Security

- Private key stored securely in Prismatic credential store
- JWT tokens have 5-minute expiry
- Luminance OAuth tokens refreshed automatically
- No credentials logged or exposed in responses
