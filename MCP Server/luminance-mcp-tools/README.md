# Luminance MCP Tools

This Prismatic integration exposes Luminance API tools and Salesforce commercial context tools as MCP (Model Context Protocol) tools for AI agents. It provides semantic tools for MSA optimization workflows, allowing AI agents to interact with Luminance to find similar MSAs, suggest clause fallbacks, estimate signing likelihood, retrieve company context, and get comprehensive commercial context from Salesforce Opportunities.

## What this integration does

This integration provides five MCP tools that AI agents can use:

- **Get Company Context**: Retrieve company metadata (size, region, industry) for filtering precedents
- **Get Similar MSAs**: Find signed MSAs similar to a draft, filtered by company attributes
- **Get Clause Fallbacks**: Suggest fallback positions for key clauses based on signed precedents
- **Estimate Signing Likelihood**: Score scenarios for predicted signing likelihood and time-to-sign
- **Get Salesforce Commercial Context**: Retrieve comprehensive commercial context from Salesforce Opportunity records including deal stage, financial metrics, contract terms, renewal information, procurement details, and customer health

When an AI agent needs to optimize an MSA, it can:

1. Discover these tools through MCP
2. Understand each tool's parameters through JSON schemas
3. Invoke tools with appropriate criteria
4. Receive results synchronously for use in reasoning

## Key features

### Agent-compatible flows

Each flow is configured as an agent flow using two key properties in [flows.ts](src/flows.ts):

- **`isAgentFlow: true`**: Makes the flow discoverable and callable by AI agents through MCP
- **`isSynchronous: true`**: Ensures the flow executes synchronously and returns results immediately, so the AI agent can use the response in its reasoning process

### JSON Schema tool definitions

Each flow includes a JSON schema in the `schemas.invoke` property that describes the tool to the AI agent:

```typescript
schemas: {
  invoke: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $comment: "Retrieve company context information...",
    title: "get-company-context",
    type: "object",
    properties: {
      tenantId: {
        type: "string",
        description: "Tenant ID for scoping the request",
      },
      // ... more properties
    },
  },
}
```

This schema serves as the tool's interface definition:
- The **`title`** becomes the tool name that AI agents see
- The **`$comment`** explains the tool's purpose and usage
- The **`properties`** define the tool's parameters with descriptions
- The **`description`** fields help the AI agent understand what each parameter does

### Payload validation with Zod

The flows use [Zod](https://zod.dev/) to validate and parse incoming parameters from the AI agent:

```typescript
const CompanyContextSchema = zod.object({
  tenantId: zod.string(),
  companyName: zod.string().optional(),
  companyId: zod.string().optional(),
});

const { tenantId, companyName, companyId } = CompanyContextSchema.parse(
  params.onTrigger.results.body.data
);
```

This provides:
- **Type safety**: Ensures the parameters match expected types
- **Runtime validation**: Catches invalid data before processing
- **Clear error messages**: Helps debug issues when AI agents send incorrect parameters
- **Type inference**: TypeScript automatically infers types from the Zod schema

## Prerequisites

- Node.js 18+
- Prismatic CLI (`npm i -g @prismatic-io/cli`) and access to a Prismatic organization
- Luminance API access with Bearer token authentication
- Access to a Luminance instance (base URL and API token)

## Installation

```bash
# Install dependencies
npm install

# Build the integration
npm run build
```

## Configuration

### Luminance Connection

When configuring an instance of this integration, you'll need to provide:

- **Luminance Base URL**: Your Luminance instance URL (e.g., `https://your-domain.app.luminance.com`)
- **Luminance API Token**: A Bearer token for API authentication (access token from OAuth2, not client secret)

### Salesforce Connection

For the Salesforce commercial context tool, you'll need to configure OAuth2 authentication:

- **Authorization URL**: Salesforce OAuth2 authorization URL
  - Production: `https://login.salesforce.com/services/oauth2/authorize`
  - Sandbox/Developer: `https://test.salesforce.com/services/oauth2/authorize`
- **Token URL**: Salesforce OAuth2 token URL
  - Production: `https://login.salesforce.com/services/oauth2/token`
  - Sandbox/Developer: `https://test.salesforce.com/services/oauth2/token`
- **Client ID**: Your Salesforce Connected App Consumer Key
- **Client Secret**: Your Salesforce Connected App Consumer Secret
- **Scopes**: OAuth2 scopes (default: `api refresh_token`)

**Note**: Ensure your Salesforce Connected App has the appropriate OAuth scopes and callback URL configured. See [SALESFORCE_OAUTH_CONFIG.md](../lumpy/SALESFORCE_OAUTH_CONFIG.md) for detailed setup instructions.

## Testing the integration

### Running unit tests

The integration includes unit tests. Run tests with:

```bash
npm test
```

### Testing with an AI agent in Prismatic

To test the integration with an AI agent:

1. **Build and import the integration:**

```bash
npm run build
prism integrations:import --open
```

2. **Configure an instance:**
   - Set the **Luminance Base URL**
   - Enter your **Luminance API Token**

3. **Deploy the instance** to a customer

4. **Configure an AI agent** (like Claude or ChatGPT) with MCP access to your Prismatic instance

5. **Ask the AI agent to use the tools:**
   - "Get company context for Acme Corporation"
   - "Find similar MSAs to document 123 in project 456"
   - "What are the clause fallbacks for liability cap in MSA 789?"
   - "Estimate signing likelihood for these scenarios..."
   - "Get Salesforce commercial context for opportunity ACME Corporation – Enterprise CLM Implementation"

The AI agent will:
- Discover the tools through MCP
- Determine the appropriate parameters based on your request
- Call the tools with those parameters
- Receive the results
- Present them to you in natural language

### Testing flows manually

You can also test flows manually by sending POST requests to the flow's webhook URL:

```bash
curl -X POST https://your-instance-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_123",
    "companyName": "Acme Corp"
  }'
```

## MCP Tools

### 1. get-company-context

Retrieves company context information including size, region, jurisdiction, and industry.

**Parameters:**
- `tenantId` (required): Tenant ID for scoping the request
- `companyName` (optional): Company name to look up
- `companyId` (optional): Internal company ID

**Returns:**
- Company metadata (size_bucket, region, jurisdiction, industry)

### 2. get-similar-msas

Finds signed MSAs similar to a draft MSA, filtered by company attributes.

**Parameters:**
- `tenantId` (required): Tenant ID for scoping the request
- `msaId` (required): ID of the draft MSA document
- `projectId` (required): Project ID containing the MSA
- `region` (optional): Filter by region/jurisdiction
- `companySizeBucket` (optional): Filter by company size (small, mid, enterprise)
- `limit` (optional): Maximum number of results (default: 20)

**Returns:**
- List of similar MSAs with metadata (IDs, dates, similarity scores)

### 3. get-clause-fallbacks

Suggests fallback positions for key clauses based on signed precedents.

**Parameters:**
- `tenantId` (required): Tenant ID for scoping the request
- `msaId` (required): MSA document ID to analyze
- `projectId` (required): Project ID containing the MSA
- `clauseTypes` (optional): List of clause types to analyze
- `similarMsaIds` (optional): Pre-filtered list of similar MSA IDs

**Returns:**
- Fallback suggestions per clause type with frequency statistics

### 4. estimate-signing-likelihood

Scores scenarios for predicted signing likelihood and time-to-sign.

**Parameters:**
- `tenantId` (required): Tenant ID for scoping the request
- `msaId` (required): MSA document ID
- `projectId` (required): Project ID containing the MSA
- `companyContext` (optional): Company context from get-company-context
- `scenarios` (required): Array of scenarios to evaluate

**Returns:**
- Scoring for each scenario (signing probability, estimated days to sign, confidence)

### 5. get-salesforce-commercial-context

Retrieves comprehensive commercial context from Salesforce Opportunity records. Returns deal stage, financial metrics, contract terms, renewal information, procurement details, legal/security requirements, and customer health indicators.

**Parameters:**
- `opportunityId` (optional): Salesforce Opportunity ID (e.g., 006XXXXXXXXXXXXXXX). Required if opportunityName not provided.
- `opportunityName` (optional): Opportunity Name to search for. Required if opportunityId not provided.

**Returns:**
- Comprehensive commercial context including:
  - **Deal Stage**: Stage name and close date
  - **Organization**: Region and business unit
  - **Financial Metrics**: ACV, ARR, discounts, payment terms
  - **Legal and Security**: Legal/security requirements, non-standard terms, redline count
  - **Competitive Landscape**: Main competitors, procurement pressure, procurement category
  - **Contract Dates**: Contract start and end dates
  - **Renewal Information**: Renewal date, notice period, auto-renewal status
  - **Next Steps**: Next step actions
  - **Customer Health**: Open cases count, max case severity, SLA breach status, overall health score

**Example Response:**
```json
{
  "opportunity_id": "006XXXXXXXXXXXXXXX",
  "opportunity_name": "ACME Corporation – Enterprise CLM Implementation",
  "deal_stage": {
    "stage_name": "Proposal/Price Quote",
    "close_date": "2026-05-17"
  },
  "financial_metrics": {
    "acv": 40000,
    "arr": 38000,
    "discount": 5,
    "total_discount": 2000,
    "payment_terms": "Net 30"
  },
  "legal_and_security": {
    "legal_required": true,
    "security_review_required": true,
    "non_standard_terms_requested": false,
    "redline_count": 0
  },
  "customer_health": {
    "open_cases_count": 0,
    "max_open_case_severity": "None",
    "sla_breach": false,
    "customer_health": "Green"
  }
}
```

## Extending this integration

### Adding more tools

To add additional MCP tools:

1. Create new flows in [flows.ts](src/flows.ts) with `isAgentFlow: true` and `isSynchronous: true`
2. Define JSON schemas for each tool in the `schemas.invoke` property
3. Implement the tool logic in the `onExecution` function
4. Add Zod validation schemas
5. Export the new flows from the flows array

### Improving implementations

Current implementations include placeholders for:
- Company context retrieval (needs integration with company database or external systems)
- Similarity search (needs ML-based document similarity)
- Clause analysis (needs NLP-based clause extraction and clustering)
- Signing likelihood prediction (needs trained ML model)

To improve:
1. Replace placeholder logic with actual Luminance API calls
2. Integrate with external systems (HubSpot) for additional company context
3. Implement ML-based similarity search
4. Add NLP-based clause analysis
5. Train and integrate ML model for signing likelihood

**Note**: Salesforce integration is now implemented and functional. The `get-salesforce-commercial-context` tool queries Salesforce Opportunities for comprehensive commercial context data.

## MCP and AI agent integrations

The Model Context Protocol (MCP) is a standardized protocol for connecting AI agents to external tools and data sources. When you mark a Prismatic flow as an agent flow:

1. Prismatic automatically exposes it through MCP
2. AI agents can discover the tool through the MCP protocol
3. The JSON schema you provide becomes the tool's interface definition
4. AI agents can call the tool and receive responses synchronously

This approach allows you to:
- **Extend AI agent capabilities**: Give agents access to Luminance data and analysis
- **Maintain control**: Keep authentication and authorization logic in your integration
- **Reuse integrations**: Use existing Prismatic integrations as AI agent tools
- **Update independently**: Modify tool behavior without changing the AI agent configuration

For more information about building AI agent integrations in Prismatic, see the [Agent Flows documentation](https://prismatic.io/docs/ai/flow-invocation-schema/).

## Development

- Install deps: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Import to Prismatic: `npm run import` or `prism integrations:import`

Source code lives under `src/`. The compiled artifact is emitted to `dist/` with `webpack`.

## License

Internal use only.
