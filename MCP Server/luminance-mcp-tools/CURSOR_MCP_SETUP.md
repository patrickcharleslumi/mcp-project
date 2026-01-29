# Setting Up Cursor to Connect to Prismatic MCP

## Step 1: Get Your Prismatic API Key/Token

### Option A: Using Prismatic CLI (Recommended)

If you have the Prismatic CLI installed (which you do), run:

```bash
prism me:token
```

This will output a short-lived **access token** (valid for a few hours).

**For a longer-lived refresh token** (useful for persistent connections):

```bash
prism me:token --type refresh
```

### Option B: Via Prismatic Web UI

1. **Go to:** `https://app.luminance-production-eu-central-1.prismatic.io/get_auth_token/`
2. **Log in** if prompted
3. **Copy the token** displayed on the page

### Option C: Via Prismatic Settings

1. **Go to:** Prismatic UI → **Settings** (or **Account**)
2. **Click:** **"API Keys"** or **"Access Tokens"**
3. **Create a new API key** if needed
4. **Copy the key** (you may only see it once!)

---

## Step 2: Find Your MCP Endpoint

You need the MCP endpoint URL. Try these locations:

### Option A: Integration MCP Tab

1. **Go to:** Prismatic UI → **"Luminance MCP Tools"** Integration
2. **Look for:** **"MCP"** tab or **"AI"** → **"MCP"** section
3. **Copy the MCP endpoint URL** (should look like `https://mcp.../mcp`)

### Option B: Try Standard Endpoint Formats

For your private Prismatic instance, try:

```
https://mcp.luminance-production-eu-central-1.prismatic.io/mcp
```

Or:

```
https://mcp.eu-central-1.integrations.luminance.com/mcp
```

### Option C: Use Global Endpoint (if available)

If Prismatic exposes a global endpoint for your region:

```
https://mcp.prismatic.io/mcp
```

**💡 Note:** You'll need to test which endpoint works. The integration-specific endpoint is usually preferred.

---

## Step 3: Configure Cursor

### Create/Edit Cursor MCP Config File

1. **Open or create:** `~/.cursor/mcp.json`

   On macOS, this is:
   ```
   /Users/patrick.charles/.cursor/mcp.json
   ```

2. **Add the following JSON:**

```json
{
  "mcpServers": {
    "luminance-mcp-tools": {
      "url": "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PRISMATIC_TOKEN_HERE"
      }
    }
  }
}
```

**Replace:**
- `YOUR_PRISMATIC_TOKEN_HERE` with the token from Step 1
- The `url` with your actual MCP endpoint from Step 2

### Alternative: Using mcp-remote (if HTTP doesn't work)

If Cursor doesn't support HTTP-based MCP servers directly, you might need to use `mcp-remote`:

```json
{
  "mcpServers": {
    "luminance-mcp-tools": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp"
      ],
      "env": {
        "PRISMATIC_TOKEN": "YOUR_PRISMATIC_TOKEN_HERE"
      }
    }
  }
}
```

**Note:** This requires `mcp-remote` to be available. You may need to install it first:
```bash
npm install -g mcp-remote
```

---

## Step 4: Restart Cursor

After saving `~/.cursor/mcp.json`:

1. **Quit Cursor completely** (Cmd+Q on macOS)
2. **Reopen Cursor**
3. **Check if MCP connection is working**

---

## Step 5: Verify Connection

### In Cursor

1. **Open a chat** with Cursor's AI
2. **Ask:** "What MCP tools are available?"
3. **Or ask:** "List the Luminance MCP tools"

You should see your 4 tools:
- `get-company-context`
- `get-similar-msas`
- `get-clause-fallbacks`
- `estimate-signing-likelihood`

### Test a Tool

Try asking:
```
"Get company context for tenant 'test_tenant' and company 'Acme Corporation'"
```

---

## Troubleshooting

### "Cannot connect to MCP server"

1. **Check the endpoint URL** is correct
2. **Verify the token** is valid (run `prism me:token` again)
3. **Check Cursor logs** for error messages
4. **Try the alternative `mcp-remote` method** above

### "401 Unauthorized"

- Your token might be expired
- Get a new token: `prism me:token`
- Update `mcp.json` with the new token
- Restart Cursor

### "404 Not Found"

- The MCP endpoint URL might be wrong
- Try the different endpoint formats from Step 2
- Check Prismatic UI for the correct endpoint

### MCP Tools Not Appearing

1. **Verify flows are deployed:**
   - Check Prismatic → Instance → Flows are active
   - Test flows individually in Prismatic UI

2. **Check flow configuration:**
   - Flows must have `isAgentFlow: true` and `isSynchronous: true`
   - This is already set in your `flows.ts` ✅

3. **Verify MCP endpoint:**
   - The endpoint should return a list of tools
   - Test with curl:
     ```bash
     curl -X POST "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp" \
       -H "Authorization: Bearer YOUR_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
     ```

---

## Quick Reference

### File Location
```
~/.cursor/mcp.json
```

### Get Token
```bash
prism me:token
```

### Test MCP Endpoint
```bash
curl -X POST "YOUR_MCP_ENDPOINT" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

### Example Config
```json
{
  "mcpServers": {
    "luminance-mcp-tools": {
      "url": "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

---

## Next Steps

Once connected:
1. ✅ Test all 4 tools in Cursor
2. ✅ Use tools in your AI conversations
3. ✅ Build workflows that leverage Luminance MCP tools
