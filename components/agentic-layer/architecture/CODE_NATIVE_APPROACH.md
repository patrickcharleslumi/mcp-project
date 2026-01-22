# Code-Native Integration Approach for Luminance MCP Tools

## Answer: Yes, Use Code-Native Integration

**The "Luminance MCP Tools" should be a code-native integration** because:

1. ✅ You already have a code-native Luminance component
2. ✅ Better integration with existing codebase
3. ✅ Type safety and better error handling
4. ✅ Easier to maintain and version control
5. ✅ Can directly use existing Luminance component actions

## Architecture Options

### Option A: Extend Existing Luminance Component (Recommended)

**Structure:**
```
luminance-component-for-prismatic/luminance-api/
├── src/
│   ├── actions/
│   │   ├── ...existing actions...
│   │   ├── mcpTools/
│   │   │   ├── getCompanyContext.ts
│   │   │   ├── getSimilarMsas.ts
│   │   │   ├── getClauseFallbacks.ts
│   │   │   └── estimateSigningLikelihood.ts
│   ├── index.ts (export new actions)
```

**Pros:**
- Single component to maintain
- Reuses existing Luminance client code
- All Luminance functionality in one place
- Easier to share code between actions

**Cons:**
- Mixes MCP-specific tools with general Luminance API actions
- Slightly larger component

### Option B: Create New Code-Native Integration

**Structure:**
```
luminance-mcp-tools-integration/
├── src/
│   ├── actions/
│   │   ├── getCompanyContext.ts
│   │   ├── getSimilarMsas.ts
│   │   ├── getClauseFallbacks.ts
│   │   └── estimateSigningLikelihood.ts
│   ├── index.ts
│   └── package.json (depends on luminance-api component)
```

**Pros:**
- Separates MCP tools from general Luminance API
- More modular architecture
- Can be versioned independently

**Cons:**
- Two components to maintain
- Need to manage dependencies
- More complex setup

## Recommended: Option A (Extend Existing Component)

### Implementation Steps

#### 1. Add MCP Tool Actions to Luminance Component

Create new action files in `luminance-component-for-prismatic/luminance-api/src/actions/mcpTools/`:

**Example: `getCompanyContext.ts`**

```typescript
import { action } from "@prismatic-io/spectral";
import { createLuminanceClient } from "../../client";

export const getCompanyContext = action({
  display: {
    label: "Get Company Context",
    description: "Retrieve company context information including size, region, jurisdiction, and industry."
  },
  inputs: {
    connection: {
      label: "Luminance Connection",
      type: "connection",
      required: true
    },
    tenantId: {
      label: "Tenant ID",
      type: "string",
      required: true,
      comments: "Tenant ID for scoping the request"
    },
    companyName: {
      label: "Company Name",
      type: "string",
      required: false,
      comments: "Company name to look up (optional if company ID provided)"
    },
    companyId: {
      label: "Company ID",
      type: "string",
      required: false,
      comments: "Internal company ID (optional if company name provided)"
    }
  },
  perform: async (context, { connection, tenantId, companyName, companyId }) => {
    const client = await createLuminanceClient(connection, context);
    
    // Convert your Python logic to TypeScript here
    // This is a placeholder - implement actual logic
    const result = {
      company_id: companyId || `company_${companyName || 'unknown'}`,
      company_name: companyName || "Unknown",
      size_bucket: "unknown",
      region: "unknown",
      jurisdiction: "unknown",
      industry: "unknown",
      metadata: {
        source: "luminance_api",
        note: "Placeholder - implement actual company context retrieval"
      }
    };
    
    return { data: result };
  }
});
```

#### 2. Export Actions from Component

Update `src/actions/index.ts`:

```typescript
import mcpTools from "./mcpTools";

export default {
  ...existingActions,
  ...mcpTools, // Add MCP tool actions
};
```

#### 3. Create Agent Flows in Prismatic

1. **Create Integration** in Prismatic UI (code-native)
2. **Use your Luminance component** (with new MCP tool actions)
3. **Create Agent Flows:**
   - Each agent flow uses one of the MCP tool actions
   - Define invocation schemas matching action inputs
   - Define result schemas matching action outputs

#### 4. Publish and Deploy

```bash
cd luminance-component-for-prismatic/luminance-api
npm install
npm run build
npm run publish
```

## Converting Python to TypeScript

### Key Conversions Needed

1. **Python `async/await` → TypeScript `async/await`** (same syntax)
2. **Python dict → TypeScript object/Record**
3. **Python typing → TypeScript types**
4. **httpx → Prismatic's HTTP client** (already in your component)
5. **Python logging → Prismatic's context.logger**

### Example Conversion

**Python (from your MCP server):**
```python
async def execute(arguments: dict[str, Any]) -> dict[str, Any]:
    tenant_id = arguments["tenant_id"]
    company_name = arguments.get("company_name")
    # ... logic ...
    return result
```

**TypeScript (for Prismatic):**
```typescript
perform: async (context, { tenantId, companyName, companyId }) => {
  // tenantId, companyName, companyId are already extracted
  // ... logic ...
  return { data: result };
}
```

## Agent Flow Creation

Once actions are created, create agent flows:

1. **Go to:** Prismatic UI → Your Integration → AI → Agent Flows
2. **Create Flow** for each MCP tool
3. **Use Action:** Select your new MCP tool action (e.g., "Get Company Context")
4. **Define Invocation Schema:** Copy from action inputs
5. **Define Result Schema:** Copy from action outputs
6. **Save**

Prismatic automatically exposes these agent flows as MCP tools!

## Benefits of Code-Native Approach

1. **Reuse Existing Code:**
   - Your Luminance client code is already in TypeScript
   - Can share utilities, error handling, etc.

2. **Type Safety:**
   - TypeScript catches errors at compile time
   - Better IDE support

3. **Version Control:**
   - Code lives in git
   - Easy to review, test, and deploy

4. **Testing:**
   - Can write unit tests for actions
   - Test locally before publishing

5. **Consistency:**
   - Matches your existing Luminance component pattern
   - Same development workflow

## Next Steps

1. ✅ Decide: Option A (extend) or Option B (new integration)
2. ✅ Convert Python tool logic to TypeScript actions
3. ✅ Add actions to component
4. ✅ Publish component
5. ✅ Create agent flows in Prismatic
6. ✅ Test MCP connection

## References

- [Prismatic Code-Native Integrations](https://prismatic.io/docs/integrations/code-native/)
- [Prismatic Component Development](https://prismatic.io/docs/components/)
- [Existing Luminance Component](../Repository/luminance-component-for-prismatic/luminance-api/)
