# Build and Deploy Instructions

## Prerequisites

Make sure you have:
- Node.js 18+ installed
- npm installed
- Prismatic CLI installed: `npm i -g @prismatic-io/prism`
- Prismatic account and authentication
- **PRISMATIC_URL environment variable set** (for private instance):
  ```bash
  export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
  ```

## Step 1: Install Dependencies

```bash
cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
npm install
```

This will install all required dependencies including:
- `@prismatic-io/spectral`
- `zod`
- TypeScript and build tools

## Step 2: Build the Integration

```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Bundle the code with webpack
- Create the `dist/` directory with the compiled integration

## Step 3: Import to Prismatic

### Option A: Using npm script (Recommended)

The `import` script in `package.json` is already configured with your Prismatic URL:

```bash
npm run import
```

This will automatically use: `https://app.luminance-production-eu-central-1.prismatic.io`

### Option B: Using Prismatic CLI directly

If you need to set the URL manually:

```bash
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
npm run build
prism integrations:import --open
```

The `--open` flag will open Prismatic in your browser after import.

## Step 4: Configure the Integration in Prismatic

1. **Navigate to the imported integration** in Prismatic UI
2. **Create a new instance:**
   - Click "Create Instance"
   - Give it a name (e.g., "Luminance MCP Tools - Production")
3. **Configure the Luminance Connection:**
   - **Luminance Base URL**: Your Luminance instance URL
     - Example: `https://your-domain.app.luminance.com`
   - **Luminance API Token**: Your Bearer token
     - This is the access token from OAuth2, NOT the client secret
4. **Save the configuration**

## Step 5: Deploy the Instance

1. **Deploy to a customer:**
   - Select a customer or create a test customer
   - Click "Deploy"
2. **Verify deployment:**
   - Check that the instance shows as "Active"
   - Review any deployment logs

## Step 6: Test the Flows

### Test in Prismatic UI

1. **Navigate to:** Integration → Flows
2. **Select a flow** (e.g., "Get Company Context")
3. **Click "Test"**
4. **Provide test inputs:**
   ```json
   {
     "tenantId": "test_tenant",
     "companyName": "Acme Corporation"
   }
   ```
5. **Execute and verify the response**

### Test via Webhook

Each flow has a webhook URL. You can test it with curl:

```bash
curl -X POST https://your-instance-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test_tenant",
    "companyName": "Acme Corporation"
  }'
```

## Step 7: Access MCP Endpoint

1. **Navigate to:** Integration → AI → MCP
2. **Copy your MCP endpoint:**
   - Global: `https://mcp.prismatic.io/mcp`
   - Or integration-specific endpoint shown in the UI
3. **Note your Prismatic API key** (needed for AI agent connection)

## Step 8: Connect AI Agent (When Ready)

Once your AI agent is built, configure it to connect to Prismatic's MCP endpoint:

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

## Troubleshooting

### Build Errors

- **TypeScript errors**: Check `tsconfig.json` and fix any type issues
- **Missing dependencies**: Run `npm install` again
- **Webpack errors**: Check `webpack.config.js` configuration

### Import Errors

- **Not authenticated**: Run `prism auth:login`
- **Permission errors**: Check you have access to create integrations
- **Import fails**: Check Prismatic CLI version: `prism --version`

### Runtime Errors

- **Connection errors**: Verify Luminance Base URL and API Token
- **Flow execution fails**: Check Prismatic logs in the UI
- **MCP endpoint not available**: Ensure instance is deployed and active

## Next Steps

1. ✅ Replace placeholder implementations with actual Luminance API calls
2. ✅ Add error handling and retry logic
3. ✅ Implement actual similarity search (if available in Luminance API)
4. ✅ Add Salesforce MCP integration (when ready)
5. ✅ Add logging and monitoring

## Verification Checklist

- [ ] Dependencies installed (`npm install` completed)
- [ ] Build successful (`npm run build` completed)
- [ ] Integration imported to Prismatic
- [ ] Instance created and configured
- [ ] Instance deployed to customer
- [ ] Flows tested in Prismatic UI
- [ ] MCP endpoint accessible
- [ ] Ready for AI agent connection
