# Prismatic Flows: What to Expect

## Understanding Prismatic Flows vs Agent Flows

When you import a code-native integration with flows, here's what you should see:

### ✅ Expected Behavior

1. **Flows are automatically imported** - The 4 flows defined in `src/flows.ts` should appear in Prismatic
2. **They appear as Agent Flows** - Because they have `isAgentFlow: true`
3. **They're available for MCP** - Because they have `isSynchronous: true` and invocation schemas

### Where to Find Your Flows

1. **In Prismatic UI:**
   - Go to: **Integration → Flows** (or **Integration → AI → Agent Flows**)
   - You should see 4 flows:
     - Get Company Context
     - Get Similar MSAs
     - Get Clause Fallbacks
     - Estimate Signing Likelihood

2. **Each flow should show:**
   - Name and description
   - Invocation schema (input parameters)
   - The flow logic (onExecution function)

### If Flows Appear "Blank"

This is **normal** for code-native integrations! Here's why:

#### The flows ARE there, but they're defined in code, not in the UI

- **Code-native flows** are defined in your TypeScript code (`src/flows.ts`)
- They don't show a visual flow designer because the logic is in code
- The "blank" appearance is expected - the flow logic is in the `onExecution` function

#### What you CAN see:

1. **Flow metadata:**
   - Name: "Get Company Context"
   - Description: "Retrieve company context information..."
   - Stable Key: "get-company-context"

2. **Invocation Schema:**
   - The JSON schema that defines the tool's inputs
   - This is what AI agents see when discovering the tool

3. **Test the flow:**
   - You can test each flow with sample inputs
   - The flow will execute the `onExecution` function from your code

### How to Verify Flows Are Working

#### Option 1: Test in Prismatic UI

1. Go to: **Integration → Flows** (or **AI → Agent Flows**)
2. Click on a flow (e.g., "Get Company Context")
3. Click **"Test"** or **"Run"**
4. Provide test inputs:
   ```json
   {
     "tenantId": "test_tenant",
     "companyName": "Acme Corporation"
   }
   ```
5. Execute and verify the response

#### Option 2: Check MCP Endpoint

1. Go to: **Integration → AI → MCP**
2. You should see your MCP endpoint
3. The 4 tools should be listed as available MCP tools
4. Each tool should show its invocation schema

#### Option 3: Test via Webhook

Each flow has a webhook URL. You can test it:

```bash
curl -X POST https://your-instance-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test_tenant",
    "companyName": "Acme Corporation"
  }'
```

### What "Blank" Flows Mean

If flows appear blank/empty in the UI:

✅ **This is NORMAL for code-native integrations!**

- The flow logic is in your TypeScript code, not in a visual designer
- Prismatic reads the flow definition from your code
- The `onExecution` function contains all the logic
- You can't edit flows in the UI - you edit the code and re-import

### To See Flow Details

1. **View flow definition:**
   - Click on a flow name
   - You should see the flow metadata and schema

2. **Test the flow:**
   - Use the "Test" button to execute the flow
   - This will run the `onExecution` function from your code

3. **Check logs:**
   - After testing, check execution logs
   - You'll see the flow executing your code

### If Flows Don't Appear at All

If you don't see ANY flows:

1. **Check import was successful:**
   - Verify the integration imported without errors
   - Check Prismatic logs for import errors

2. **Verify flows are exported:**
   - In `src/flows.ts`, make sure all 4 flows are exported
   - Check `src/index.ts` imports flows correctly

3. **Rebuild and re-import:**
   ```bash
   npm run build
   npm run import
   ```

4. **Check Prismatic version:**
   - Make sure your Prismatic instance supports agent flows
   - Agent flows require Prismatic version that supports MCP

### Next Steps

1. ✅ **Verify flows are listed** in Integration → Flows
2. ✅ **Test each flow** with sample inputs
3. ✅ **Check MCP endpoint** shows all 4 tools
4. ✅ **Deploy instance** to make flows available
5. ✅ **Connect AI agent** to test MCP tools

### Summary

- **"Blank" flows are normal** - logic is in code, not UI
- **Flows are functional** - they execute your `onExecution` functions
- **Test flows** to verify they work
- **MCP tools** are automatically created from agent flows
- **Edit flows** by modifying code and re-importing
