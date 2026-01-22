# Luminance MCP Tools

This Prismatic integration exposes Luminance API tools as MCP (Model Context Protocol) tools for AI agents. It provides semantic tools for MSA optimization workflows, allowing AI agents to interact with Luminance to find similar MSAs, suggest clause fallbacks, estimate signing likelihood, and retrieve company context.

## What this integration does

This integration provides four MCP tools that AI agents can use:

- **Get Company Context**: Retrieve company metadata (size, region, industry) for filtering precedents
- **Get Similar MSAs**: Find signed MSAs similar to a draft, filtered by company attributes
- **Get Clause Fallbacks**: Suggest fallback positions for key clauses based on signed precedents
- **Estimate Signing Likelihood**: Score scenarios for predicted signing likelihood and time-to-sign

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
2. Integrate with external systems (Salesforce, HubSpot) for company context
3. Implement ML-based similarity search
4. Add NLP-based clause analysis
5. Train and integrate ML model for signing likelihood

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
