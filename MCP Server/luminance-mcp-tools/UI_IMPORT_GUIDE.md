# Importing via Prismatic UI - Code Native Integration

## The Challenge

Prismatic's UI shows options to create a **new** code-native integration, but doesn't have a direct "import existing" option. Code-native integrations are typically imported via CLI.

## Solution Options

### Option 1: Create New Integration, Then Replace via CLI (If CLI Works)

1. **In Prismatic UI:**
   - Click **"New Code-Native Integration"**
   - Follow the setup (or just create a placeholder)
   - Note the **Integration ID** from the URL or integration details

2. **In your terminal:**
   ```bash
   cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
   npm run build
   PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io \
   prism integrations:import --replace -i <INTEGRATION_ID>
   ```
   
   Replace `<INTEGRATION_ID>` with the ID from step 1.

**Note**: This may still fail with the "File is not defined" error if the CLI bug persists.

### Option 2: Initialize New Integration Structure, Then Copy Your Code

1. **Create a new code-native integration in Prismatic UI:**
   - Click **"New Code-Native Integration"**
   - Run the command it suggests: `prism integrations:init mcp-salesforce`
   - This creates a new folder structure

2. **Copy your existing code into the new structure:**
   ```bash
   # The init command creates a new folder, e.g., mcp-salesforce
   # Copy your src/ files into that folder
   cp -r "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools/src/"* ./mcp-salesforce/src/
   cp "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools/package.json" ./mcp-salesforce/
   cp "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools/tsconfig.json" ./mcp-salesforce/
   cp "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools/webpack.config.js" ./mcp-salesforce/
   ```

3. **Build and import from the new location:**
   ```bash
   cd mcp-salesforce
   npm install
   npm run build
   prism integrations:import
   ```

**Note**: This might also hit the CLI bug, but the fresh structure might help.

### Option 3: Contact Prismatic Support

Since the CLI has a bug (`Error: File is not defined`), you may need to:

1. **Report the bug to Prismatic support:**
   - Error: `Error: File is not defined`
   - Command: `prism integrations:import`
   - Prismatic CLI Version: `@prismatic-io/prism/9.1.1`
   - Context: Trying to import code-native integration with OAuth2 connection

2. **Ask for:**
   - Workaround for importing code-native integrations
   - Or a fix for the CLI bug
   - Or alternative import method

### Option 4: Manual Upload (If Available)

Some Prismatic instances allow uploading a zip file of the `dist/` folder:

1. **Zip the dist folder:**
   ```bash
   cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
   zip -r integration.zip dist/
   ```

2. **Check if Prismatic UI has an "Upload" or "Import from File" option** in the integration creation flow.

## Recommended Approach

**Try Option 1 first** (create new, then replace) - it's the quickest if the CLI works with `--replace`.

If that fails, **contact Prismatic support** about the CLI bug - this is clearly a tooling issue that needs to be fixed on their end.

## What's Ready

✅ Your integration code is complete and builds successfully  
✅ All 5 MCP tools are implemented  
✅ Salesforce OAuth2 connection is configured  
✅ All commercial context fields are included  

The only blocker is the Prismatic CLI import bug.
