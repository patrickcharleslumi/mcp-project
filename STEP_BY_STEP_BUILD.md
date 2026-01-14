# Step-by-Step: Building Luminance MCP Tools Integration

This guide walks you through creating a **new code-native integration** in Prismatic using the generic MCP template.

## Overview

We'll:
1. Clone the Prismatic generic MCP template
2. Adapt it for Luminance MCP tools
3. Convert Python tools to TypeScript actions
4. Create agent flows
5. Deploy and test

---

## Step 1: Clone and Setup the Generic MCP Template

### 1.1 Clone the Template

```bash
# Navigate to where you want the new integration
cd /Users/patrick.charles/Documents/Repository

# Clone the template
git clone https://github.com/prismatic-io/integration-templates.git prismatic-templates
cd prismatic-templates/generic-mcp-example

# Or if you just want to copy the structure:
# Create a new directory for your integration
mkdir -p /Users/patrick.charles/Documents/Repository/luminance-mcp-tools
cd /Users/patrick.charles/Documents/Repository/luminance-mcp-tools
```

### 1.2 Review Template Structure

The generic MCP template should have:
```
generic-mcp-example/
├── src/
│   ├── index.ts          # Main component definition
│   ├── actions/          # MCP tool actions
│   ├── connections.ts    # Connection definitions
│   └── client.ts         # HTTP client setup
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

### 1.3 Initialize Your New Integration

```bash
# Create new directory
mkdir -p /Users/patrick.charles/Documents/Repository/luminance-mcp-tools
cd /Users/patrick.charles/Documents/Repository/luminance-mcp-tools

# Initialize npm project
npm init -y

# Install Prismatic dependencies (based on your existing component)
npm install --save @prismatic-io/spectral@^10.11.2
npm install --save-dev typescript@5.8.3
npm install --save-dev webpack@^5.102.1
npm install --save-dev webpack-cli@6.0.1
npm install --save-dev ts-loader@9.5.2
npm install --save-dev @prismatic-io/eslint-config-spectral@2.1.0
npm install --save-dev eslint@^8.57.1
npm install --save-dev jest@29.7.0
npm install --save-dev @types/jest@29.5.14
npm install --save-dev ts-jest@29.3.2
npm install --save-dev copy-webpack-plugin@13.0.0

# Install additional dependencies for Luminance API
npm install --save httpx  # For HTTP requests (or use Spectral's built-in client)
```

---

## Step 2: Create Project Structure

### 2.1 Create Directory Structure

```bash
mkdir -p src/actions
mkdir -p src/types
mkdir -p assets
```

### 2.2 Create Base Files

**`package.json`** - Update with your project details:

```json
{
  "name": "luminance-mcp-tools",
  "version": "0.1.0",
  "description": "Prismatic integration for Luminance MCP tools",
  "main": "dist/index.js",
  "scripts": {
    "build": "webpack",
    "publish": "npm run build && prism components:publish",
    "generate:manifest": "npm run build && npx @prismatic-io/spectral component-manifest",
    "generate:manifest:dev": "npm run build && npx @prismatic-io/spectral component-manifest --skip-signature-verify",
    "test": "jest",
    "lint": "eslint --ext .ts ."
  },
  "dependencies": {
    "@prismatic-io/spectral": "^10.11.2"
  },
  "devDependencies": {
    "@prismatic-io/eslint-config-spectral": "2.1.0",
    "@types/jest": "29.5.14",
    "copy-webpack-plugin": "13.0.0",
    "eslint": "^8.57.1",
    "jest": "29.7.0",
    "ts-jest": "29.3.2",
    "ts-loader": "9.5.2",
    "typescript": "5.8.3",
    "webpack": "^5.102.1",
    "webpack-cli": "6.0.1"
  }
}
```

**`tsconfig.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`webpack.config.js`** (copy from your existing Luminance component or template):

```javascript
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  mode: "production",
  target: "node",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: "assets", to: "assets" }],
    }),
  ],
  externals: {
    "@prismatic-io/spectral": "commonjs @prismatic-io/spectral",
  },
};
```

---

## Step 3: Create Luminance Client

### 3.1 Create `src/client.ts`

This will be similar to your Python `luminance_client.py` but in TypeScript:

```typescript
import { createHttpClient, HttpClient } from "@prismatic-io/spectral/dist/clients/http";
import { Connection } from "@prismatic-io/spectral";

export interface LuminanceConnection {
  baseUrl: string;
  apiToken: string;
}

export function createLuminanceClient(connection: Connection): HttpClient {
  const baseUrl = (connection.fields?.baseUrl as string) || "";
  const apiToken = (connection.fields?.apiToken as string) || "";

  if (!baseUrl || !apiToken) {
    throw new Error("Luminance baseUrl and apiToken are required");
  }

  return createHttpClient({
    baseUrl: baseUrl.replace(/\/$/, ""), // Remove trailing slash
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });
}
```

---

## Step 4: Create Connection Definition

### 4.1 Create `src/connections.ts`

```typescript
import { connection } from "@prismatic-io/spectral";

export const luminanceConnection = connection({
  key: "luminance",
  label: "Luminance API Connection",
  inputs: {
    baseUrl: {
      label: "Base URL",
      type: "string",
      required: true,
      comments: "Luminance API base URL (e.g., https://your-domain.app.luminance.com)",
    },
    apiToken: {
      label: "API Token",
      type: "string",
      required: true,
      secret: true,
      comments: "Luminance API Bearer token",
    },
  },
});
```

---

## Step 5: Convert Python Tools to TypeScript Actions

### 5.1 Create `src/actions/getCompanyContext.ts`

Convert your Python `get_company_context` tool:

```typescript
import { action, input, util } from "@prismatic-io/spectral";
import { createLuminanceClient } from "../client";

export const getCompanyContext = action({
  display: {
    label: "Get Company Context",
    description:
      "Retrieve company context information including size, region, jurisdiction, and industry. " +
      "This metadata is used to filter precedents when finding similar MSAs.",
  },
  perform: async (context, params) => {
    const { connection, tenantId, companyName, companyId } = params;

    // Log the request
    context.logger.info("Getting company context", {
      tenantId,
      companyName,
      companyId,
    });

    // TODO: In production, this would query Luminance's company metadata
    // For MVP, we return a placeholder structure
    // This might come from:
    // - Matter annotations (company name, region)
    // - External integrations (Salesforce, HubSpot)
    // - Internal company database

    const result = {
      company_id: companyId || `company_${companyName || "unknown"}`,
      company_name: companyName || "Unknown",
      size_bucket: "unknown", // small, mid, enterprise
      region: "unknown",
      jurisdiction: "unknown",
      industry: "unknown",
      metadata: {
        source: "placeholder",
        note:
          "This is a placeholder. In production, this would query Luminance's company database or external systems.",
      },
    };

    context.logger.info("Company context retrieved", {
      companyId: result.company_id,
    });

    return { data: result };
  },
  inputs: {
    connection: input({
      label: "Luminance Connection",
      type: "connection",
      required: true,
    }),
    tenantId: input({
      label: "Tenant ID",
      type: "string",
      required: true,
      comments: "Tenant ID for scoping the request",
    }),
    companyName: input({
      label: "Company Name",
      type: "string",
      required: false,
      comments: "Company name to look up (optional if company ID provided)",
    }),
    companyId: input({
      label: "Company ID",
      type: "string",
      required: false,
      comments: "Internal company ID (optional if company name provided)",
    }),
  },
});
```

### 5.2 Create `src/actions/getSimilarMsas.ts`

```typescript
import { action, input, util } from "@prismatic-io/spectral";
import { createLuminanceClient } from "../client";

export const getSimilarMsas = action({
  display: {
    label: "Get Similar MSAs",
    description:
      "Find signed MSAs similar to a draft, filtered by company attributes. " +
      "Returns compact metadata including IDs, dates, and similarity scores.",
  },
  perform: async (context, params) => {
    const {
      connection,
      tenantId,
      msaId,
      projectId,
      region,
      companySizeBucket,
      limit,
    } = params;

    context.logger.info("Finding similar MSAs", {
      tenantId,
      msaId,
      projectId,
      region,
      companySizeBucket,
      limit,
    });

    const client = createLuminanceClient(connection);

    // Get the reference document
    const refDoc = await client.get(
      `/api2/projects/${projectId}/documents/${msaId}`
    );

    // Search for similar documents
    // TODO: In production, use Luminance's similarity/ML search capabilities
    const searchParams: Record<string, any> = {
      limit: limit || 20,
      offset: 0,
    };

    const results = await client.get(
      `/api2/projects/${projectId}/documents`,
      { params: searchParams }
    );

    // Filter out the reference document itself
    const filtered = (results.data || []).filter(
      (doc: any) => doc.id !== msaId
    );

    // Format results
    const similarMsas = filtered.slice(0, limit || 20).map((doc: any) => ({
      msa_id: doc.id,
      project_id: projectId,
      name: doc.name,
      created_at: doc.created_at,
      similarity_score: 0.85, // Placeholder - would come from ML similarity
      metadata: {
        state: doc.state,
        folder_id: doc.folder_id,
      },
    }));

    context.logger.info("Similar MSAs found", { count: similarMsas.length });

    return { data: similarMsas };
  },
  inputs: {
    connection: input({
      label: "Luminance Connection",
      type: "connection",
      required: true,
    }),
    tenantId: input({
      label: "Tenant ID",
      type: "string",
      required: true,
    }),
    msaId: input({
      label: "MSA ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
      comments: "ID of the draft MSA document in Luminance",
    }),
    projectId: input({
      label: "Project ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
      comments: "Project ID containing the MSA",
    }),
    region: input({
      label: "Region",
      type: "string",
      required: false,
      comments: "Optional: Filter by region/jurisdiction",
    }),
    companySizeBucket: input({
      label: "Company Size Bucket",
      type: "string",
      required: false,
      comments: "Optional: Filter by company size (small, mid, enterprise)",
    }),
    limit: input({
      label: "Limit",
      type: "string",
      required: false,
      clean: (value) => (value ? util.types.toNumber(value) : 20),
      comments: "Maximum number of results",
    }),
  },
});
```

### 5.3 Create `src/actions/getClauseFallbacks.ts`

```typescript
import { action, input, util } from "@prismatic-io/spectral";
import { createLuminanceClient } from "../client";

export const getClauseFallbacks = action({
  display: {
    label: "Get Clause Fallbacks",
    description:
      "Suggest fallback positions for key clauses based on signed precedents. " +
      "Returns 1-3 fallback options per clause type with frequency statistics.",
  },
  perform: async (context, params) => {
    const {
      connection,
      tenantId,
      msaId,
      projectId,
      clauseTypes,
      similarMsaIds,
    } = params;

    context.logger.info("Getting clause fallbacks", {
      tenantId,
      msaId,
      projectId,
      clauseTypes,
    });

    const client = createLuminanceClient(connection);

    // Get annotations for the reference document
    const annotations = await client.get(
      `/api2/projects/${projectId}/documents/${msaId}/annotations`
    );

    // TODO: Implement actual clause analysis
    // This would:
    // 1. Extract clause positions from annotations
    // 2. Query similar MSAs for clause positions
    // 3. Calculate frequency statistics
    // 4. Suggest fallback positions

    // Placeholder implementation
    const result: Record<string, any> = {};

    (clauseTypes || []).forEach((clauseType: string) => {
      result[clauseType] = {
        clause_type: clauseType,
        fallbacks: [
          {
            position: "market_standard",
            frequency: 0.65,
            description: "Most common position in signed MSAs",
          },
          {
            position: "customer_friendly",
            frequency: 0.25,
            description: "Customer-friendly alternative",
          },
        ],
        metadata: {
          sample_size: 100,
          note: "Placeholder - needs actual clause analysis",
        },
      };
    });

    return { data: result };
  },
  inputs: {
    connection: input({
      label: "Luminance Connection",
      type: "connection",
      required: true,
    }),
    tenantId: input({
      label: "Tenant ID",
      type: "string",
      required: true,
    }),
    msaId: input({
      label: "MSA ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
    }),
    projectId: input({
      label: "Project ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
    }),
    clauseTypes: input({
      label: "Clause Types",
      type: "string",
      collection: "valuelist",
      required: false,
      comments:
        "List of clause types to analyze (e.g., liability_cap, indemnity)",
    }),
    similarMsaIds: input({
      label: "Similar MSA IDs",
      type: "string",
      collection: "valuelist",
      required: false,
      comments: "Optional: Pre-filtered list of similar MSA IDs",
    }),
  },
});
```

### 5.4 Create `src/actions/estimateSigningLikelihood.ts`

```typescript
import { action, input, util } from "@prismatic-io/spectral";
import { createLuminanceClient } from "../client";

export const estimateSigningLikelihood = action({
  display: {
    label: "Estimate Signing Likelihood",
    description:
      "Score scenarios for predicted signing likelihood and time-to-sign " +
      "based on clause combinations and company context.",
  },
  perform: async (context, params) => {
    const { connection, tenantId, msaId, projectId, companyContext, scenarios } =
      params;

    context.logger.info("Estimating signing likelihood", {
      tenantId,
      msaId,
      projectId,
      scenarioCount: scenarios?.length || 0,
    });

    // TODO: Implement actual ML model for signing likelihood
    // This would:
    // 1. Analyze clause combinations
    // 2. Consider company context
    // 3. Use historical data
    // 4. Predict probability and time-to-sign

    // Placeholder implementation
    const results = (scenarios || []).map((scenario: any) => ({
      scenario_id: scenario.scenario_id,
      scenario_name: scenario.scenario_name,
      signing_probability: 0.75, // Placeholder
      estimated_days_to_sign: 14, // Placeholder
      confidence: 0.65, // Placeholder
      factors: {
        company_size: companyContext?.size_bucket || "unknown",
        region: companyContext?.region || "unknown",
        clause_risk: "medium", // Placeholder
      },
      metadata: {
        note: "Placeholder - needs trained ML model",
      },
    }));

    return { data: results };
  },
  inputs: {
    connection: input({
      label: "Luminance Connection",
      type: "connection",
      required: true,
    }),
    tenantId: input({
      label: "Tenant ID",
      type: "string",
      required: true,
    }),
    msaId: input({
      label: "MSA ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
    }),
    projectId: input({
      label: "Project ID",
      type: "string",
      required: true,
      clean: (value) => util.types.toNumber(value),
    }),
    companyContext: input({
      label: "Company Context",
      type: "jsonForm",
      required: false,
      comments: "Company context from get_company_context",
    }),
    scenarios: input({
      label: "Scenarios",
      type: "jsonForm",
      required: true,
      comments: "Array of scenarios to evaluate",
    }),
  },
});
```

### 5.5 Create `src/actions/index.ts`

```typescript
import { getCompanyContext } from "./getCompanyContext";
import { getSimilarMsas } from "./getSimilarMsas";
import { getClauseFallbacks } from "./getClauseFallbacks";
import { estimateSigningLikelihood } from "./estimateSigningLikelihood";

export default {
  getCompanyContext,
  getSimilarMsas,
  getClauseFallbacks,
  estimateSigningLikelihood,
};
```

---

## Step 6: Create Main Component

### 6.1 Create `src/index.ts`

```typescript
import { component } from "@prismatic-io/spectral";
import { handleErrors } from "@prismatic-io/spectral/dist/clients/http";
import actions from "./actions";
import { luminanceConnection } from "./connections";

export default component({
  key: "luminanceMcpTools",
  display: {
    label: "Luminance MCP Tools",
    description:
      "MCP tools for Luminance API: company context, similar MSAs, clause fallbacks, and signing likelihood estimation",
    iconPath: "icon.png",
  },
  hooks: { error: handleErrors },
  actions,
  connections: [luminanceConnection],
});
```

---

## Step 7: Build and Publish

### 7.1 Build the Component

```bash
npm run build
```

### 7.2 Generate Manifest (for local testing)

```bash
npm run generate:manifest:dev
```

### 7.3 Publish to Prismatic

```bash
# Make sure you're logged in to Prismatic CLI
prism auth:login

# Publish the component
npm run publish
```

---

## Step 8: Create Integration in Prismatic UI

### 8.1 Create New Integration

1. Go to Prismatic UI → Integrations
2. Click "Create Integration"
3. Select "Code-Native Integration"
4. Name: "Luminance MCP Tools"
5. Select your published component

### 8.2 Configure Connection

1. Go to Integration → Connections
2. Create a new Luminance connection
3. Enter:
   - Base URL: Your Luminance instance URL
   - API Token: Your Luminance API token

---

## Step 9: Create Agent Flows

### 9.1 Create Agent Flow for `get_company_context`

1. Go to: Integration → AI → Agent Flows → Create
2. **Name:** `get_company_context`
3. **Description:** Copy from action description
4. **Invocation Schema:**
   ```json
   {
     "type": "object",
     "properties": {
       "tenantId": {
         "type": "string",
         "description": "Tenant ID for scoping the request"
       },
       "companyName": {
         "type": "string",
         "description": "Company name to look up"
       },
       "companyId": {
         "type": "string",
         "description": "Internal company ID"
       }
     },
     "required": ["tenantId"]
   }
   ```
5. **Result Schema:**
   ```json
   {
     "type": "object",
     "properties": {
       "company_id": {"type": "string"},
       "company_name": {"type": "string"},
       "size_bucket": {"type": "string"},
       "region": {"type": "string"},
       "jurisdiction": {"type": "string"},
       "industry": {"type": "string"}
     }
   }
   ```
6. **Flow Steps:**
   - Add action: "Get Company Context"
   - Map inputs from invocation schema
   - Return action output

### 9.2 Repeat for Other Tools

Create agent flows for:
- `get_similar_msas`
- `get_clause_fallbacks`
- `estimate_signing_likelihood`

---

## Step 10: Connect AI Agent

### 10.1 Get MCP Endpoint

1. Go to: Integration → AI → MCP
2. Copy your MCP endpoint (e.g., `https://mcp.prismatic.io/mcp`)

### 10.2 Configure AI Agent

**Claude Desktop:**
```json
{
  "mcpServers": {
    "prismatic-luminance-mcp": {
      "url": "https://mcp.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PRISMATIC_API_KEY"
      }
    }
  }
}
```

---

## Step 11: Test

### 11.1 Test Agent Flows

1. Go to each agent flow → Test
2. Provide test inputs
3. Verify outputs

### 11.2 Test MCP Connection

1. Connect your AI agent
2. List available tools
3. Call a tool
4. Verify response

---

## Next Steps

1. ✅ Complete placeholder implementations with actual Luminance API calls
2. ✅ Add error handling and retry logic
3. ✅ Implement actual similarity search (if available in Luminance API)
4. ✅ Add Salesforce MCP integration (when ready)
5. ✅ Add logging and monitoring

---

## Troubleshooting

### Build Errors
- Check TypeScript version matches
- Verify all imports are correct
- Ensure webpack config is correct

### Publish Errors
- Verify Prismatic CLI is logged in
- Check component key is unique
- Ensure all dependencies are listed

### Agent Flow Issues
- Verify invocation schemas match action inputs
- Check result schemas match action outputs
- Review Prismatic logs for errors

---

## References

- [Prismatic Generic MCP Template](https://github.com/prismatic-io/integration-templates/tree/68e71ab7d06af29c53cc39db59b474c0af899fc4/generic-mcp-example)
- [Prismatic Code-Native Integrations](https://prismatic.io/docs/integrations/code-native/)
- [Prismatic Component Development](https://prismatic.io/docs/components/)
- [Existing Luminance Component](../luminance-component-for-prismatic/luminance-api/)
