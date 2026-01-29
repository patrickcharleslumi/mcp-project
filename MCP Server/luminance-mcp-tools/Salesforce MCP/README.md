# Paddy MCP - Salesforce Commercial Context Tool

This Prismatic integration exposes a Salesforce commercial context tool as an MCP (Model Context Protocol) tool for AI agents. It provides a focused tool for retrieving comprehensive commercial context from Salesforce Opportunity records.

## What this integration does

This integration provides one MCP tool that AI agents can use:

- **Get Salesforce Commercial Context**: Retrieve comprehensive commercial context from Salesforce Opportunity records including deal stage, financial metrics, contract terms, renewal information, procurement details, and customer health

When an AI agent needs commercial context for a deal, it can:

1. Discover this tool through MCP
2. Understand the tool's parameters through JSON schema
3. Invoke the tool with opportunity ID or name
4. Receive results synchronously for use in reasoning

## Key features

### Agent-compatible flow

The flow is configured as an agent flow using two key properties in [flows.ts](src/flows.ts):

- **`isAgentFlow: true`**: Makes the flow discoverable and callable by AI agents through MCP
- **`isSynchronous: true`**: Ensures the flow executes synchronously and returns results immediately, so the AI agent can use the response in its reasoning process

### JSON Schema tool definition

The flow includes a JSON schema in the `schemas.invoke` property that describes the tool to the AI agent:

```typescript
schemas: {
  invoke: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $comment: "Retrieve comprehensive commercial context from Salesforce Opportunity records",
    title: "get-salesforce-commercial-context",
    type: "object",
    properties: {
      opportunityId: {
        type: "string",
        description: "Salesforce Opportunity ID (e.g., 006XXXXXXXXXXXXXXX). Optional if opportunityName provided.",
      },
      opportunityName: {
        type: "string",
        description: "Opportunity Name to search for. Optional if opportunityId provided.",
      },
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

The flow uses [Zod](https://zod.dev/) to validate and parse incoming parameters from the AI agent:

```typescript
const SalesforceCommercialContextSchema = zod
  .object({
    opportunityId: zod.string().optional(),
    opportunityName: zod.string().optional(),
  })
  .refine((data) => data.opportunityId || data.opportunityName, {
    message: "Either opportunityId or opportunityName must be provided",
  });
```

This provides:
- **Type safety**: Ensures the parameters match expected types
- **Runtime validation**: Catches invalid data before processing
- **Clear error messages**: Helps debug issues when AI agents send incorrect parameters
- **Type inference**: TypeScript automatically infers types from the Zod schema

## Prerequisites

- Node.js 18+
- Prismatic CLI (`npm i -g @prismatic-io/cli`) and access to a Prismatic organization
- Salesforce org access with appropriate Connected App setup

## Installation

```bash
# Install dependencies
npm install

# Build the integration
npm run build
```

## Configuration

### Salesforce Connection

For the Salesforce commercial context tool, you'll need to configure JWT Bearer authentication with these 4 required fields:

- **Salesforce Token URL**: OAuth2 token URL (use your org's custom domain URL for best results)
  - Example: `https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com/services/oauth2/token`
  - Default: `https://login.salesforce.com/services/oauth2/token`
- **Salesforce Consumer Key**: Your Connected App Consumer Key (Client ID)
- **Salesforce Username**: Salesforce user for API access (must be authorized for the Connected App)
- **Salesforce Private Key**: Private key for JWT signing (full PEM format including BEGIN/END headers)

**Note**: Ensure your Salesforce Connected App has JWT Bearer flows enabled, a certificate uploaded, and the user has appropriate permissions to access Opportunity records.

## Testing the integration

### Building and importing

To build and import the integration to Prismatic:

```bash
npm run build
npm run import
```

### Testing with an AI agent in Prismatic

To test the integration with an AI agent:

1. **Build and import the integration**
2. **Configure an instance** with your Salesforce credentials
3. **Deploy the instance** to a customer
4. **Configure an AI agent** (like Claude or ChatGPT) with MCP access to your Prismatic instance
5. **Ask the AI agent to use the tool:**
   - "Get Salesforce commercial context for opportunity 006XXXXXXXXXXXXXXX"
   - "Get commercial context for opportunity ACME Corporation – Enterprise CLM Implementation"

The AI agent will:
- Discover the tool through MCP
- Determine the appropriate parameters based on your request
- Call the tool with those parameters
- Receive the results
- Present them to you in natural language

### Testing manually

You can also test the flow manually by sending a POST request to the flow's webhook URL:

```bash
curl -X POST https://your-instance-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "opportunityId": "006XXXXXXXXXXXXXXX"
  }'
```

## MCP Tool

### get-salesforce-commercial-context

Retrieves comprehensive commercial context from Salesforce Opportunity records. Returns deal stage, financial metrics, contract terms, renewal information, procurement details, legal/security requirements, and customer health indicators.

**Parameters:**
- `opportunityId` (optional): Salesforce Opportunity ID (e.g., 006XXXXXXXXXXXXXXX). Required if opportunityName not provided.
- `opportunityName` (optional): Opportunity Name to search for. Required if opportunityId not provided.

**Returns:**
Comprehensive commercial context including:
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
  },
  "metadata": {
    "retrieved_at": "2026-01-29T10:30:00.000Z",
    "source": "salesforce"
  }
}
```

## MCP and AI agent integrations

The Model Context Protocol (MCP) is a standardized protocol for connecting AI agents to external tools and data sources. When you mark a Prismatic flow as an agent flow:

1. Prismatic automatically exposes it through MCP
2. AI agents can discover the tool through the MCP protocol
3. The JSON schema you provide becomes the tool's interface definition
4. AI agents can call the tool and receive responses synchronously

This approach allows you to:
- **Extend AI agent capabilities**: Give agents access to Salesforce commercial data
- **Maintain control**: Keep authentication and authorization logic in your integration
- **Reuse integrations**: Use existing Prismatic integrations as AI agent tools
- **Update independently**: Modify tool behavior without changing the AI agent configuration

For more information about building AI agent integrations in Prismatic, see the [Agent Flows documentation](https://prismatic.io/docs/ai/flow-invocation-schema/).

## Development

- Install deps: `npm install`
- Build: `npm run build`
- Import to Prismatic: `npm run import` or `prism integrations:import`

Source code lives under `src/`. The compiled artifact is emitted to `dist/` with `webpack`.

## License

Internal use only.