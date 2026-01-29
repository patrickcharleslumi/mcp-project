# Updating Existing Prismatic Integration

## Can I Update Instead of Creating New?

**Yes!** Prismatic will update your existing integration when you re-import. Here's how it works:

### How Prismatic Identifies Updates

Prismatic uses **`stableKey`** values to identify flows and connections:

- **Existing flows** with matching `stableKey` → **Updated** (code changes applied)
- **New flows** with new `stableKey` → **Added** (like `get-salesforce-commercial-context`)
- **Existing connections** with matching `stableKey` → **Updated** (if config changed)
- **New connections** with new `stableKey` → **Added** (like `salesforce-connection`)

### What Gets Updated

✅ **Updated:**
- All 4 existing flows (Get Company Context, Get Similar MSAs, Get Clause Fallbacks, Estimate Signing Likelihood)
- Luminance Connection configuration (if you changed it)

✅ **Added:**
- New flow: **Get Salesforce Commercial Context**
- New connection: **Salesforce Connection**

### What Stays the Same

- ✅ Existing instances and their configurations
- ✅ Existing deployments
- ✅ Flow webhook URLs (for existing flows)
- ✅ MCP endpoint URLs

## Steps to Update

### 1. Build the Integration

```bash
cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
npm run build
```

### 2. Import to Prismatic

```bash
npm run import
```

This will:
- Build the integration
- Import/update it in Prismatic
- Open Prismatic in your browser (if `--open` flag is used)

### 3. Verify the Update

After import, check in Prismatic UI:

1. **Go to your Integration**
2. **Check Flows tab:**
   - You should see 5 flows now (4 existing + 1 new)
   - The new flow: "Get Salesforce Commercial Context"
3. **Check Connections tab:**
   - You should see 2 connections now
   - The new connection: "Salesforce Connection"

### 4. Configure Salesforce Connection

For any **new instances** you create, you'll need to configure the Salesforce connection:

1. **Create or edit an instance**
2. **Configure Salesforce Connection:**
   - **Authorization URL**: 
     - Production: `https://login.salesforce.com/services/oauth2/authorize`
     - Sandbox: `https://test.salesforce.com/services/oauth2/authorize`
   - **Token URL**: 
     - Production: `https://login.salesforce.com/services/oauth2/token`
     - Sandbox: `https://test.salesforce.com/services/oauth2/token`
   - **Client ID**: Your Salesforce Connected App Consumer Key
   - **Client Secret**: Your Salesforce Connected App Consumer Secret
   - **Scopes**: `api refresh_token`

3. **Authenticate** the Salesforce connection (OAuth flow)

### 5. Test the New Flow

1. **Navigate to:** Integration → Flows → "Get Salesforce Commercial Context"
2. **Click "Test"**
3. **Provide test input:**
   ```json
   {
     "opportunityName": "ACME Corporation – Enterprise CLM Implementation (Legal Review)"
   }
   ```
   OR
   ```json
   {
     "opportunityId": "006XXXXXXXXXXXXXXX"
   }
   ```
4. **Execute and verify** the response includes all commercial context fields

## Important Notes

### Existing Instances

- **Existing instances** will automatically have access to the new flow
- **You'll need to configure** the Salesforce connection for each instance that needs it
- **Existing deployments** continue to work without interruption

### Version Compatibility

- The integration version in `package.json` is `0.1.0`
- Consider bumping the version if you want to track this as a significant update:
  ```json
  "version": "0.2.0"
  ```

### Breaking Changes

There are **no breaking changes** in this update:
- ✅ All existing flows remain unchanged
- ✅ All existing connections remain unchanged
- ✅ Only additions (new flow, new connection)

## Troubleshooting

### Import Says "Integration Already Exists"

This is **normal and expected**. Prismatic will update the existing integration.

### New Flow Doesn't Appear

1. **Refresh the Prismatic UI**
2. **Check the Flows tab** (not just Agent Flows)
3. **Verify the build succeeded** - check for any TypeScript errors

### Salesforce Connection Not Available

1. **Check that the connection was imported** - go to Connections tab
2. **Verify the connection configuration** in `configPages.ts`
3. **Re-import if needed** - sometimes connections need a fresh import

### Existing Instances Need Salesforce Config

Each instance needs its own Salesforce connection configuration. You'll need to:
1. Edit each instance
2. Configure the Salesforce Connection
3. Authenticate with OAuth

## Next Steps After Update

1. ✅ Test the new Salesforce commercial context flow
2. ✅ Configure Salesforce connection in your instances
3. ✅ Update any AI agent configurations to use the new tool
4. ✅ Test end-to-end with your dummy Salesforce data
