# Integration MCP Server

A Model Context Protocol (MCP) server that provides semantic tools for MSA optimization workflows, sitting above the Luminance API.

## Overview

This MCP server exposes semantic tools to an agent/LLM for:
- Finding similar signed MSAs
- Suggesting clause fallback positions
- Estimating signing likelihood
- Getting company context

## Architecture

```
Luminance UI/API → Agent/Orchestrator (LLM) → MCP Client → Local MCP Server → Luminance APIs
```

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

### Step 1: Create `.env` file

Create a `.env` file in the project root directory (`/Users/patrick.charles/Documents/MCP project/integration-mcp/.env`):

```bash
# Copy the example file
cp env.example .env

# Or create it manually
touch .env
```

### Step 2: Get Your Luminance API Token

**Important:** The `LUMINANCE_API_TOKEN` is **NOT** your client secret. It's an **access token** (Bearer token) obtained via OAuth2.

#### Option A: OAuth2 Client Credentials Flow (Recommended for Production)

1. Get your OAuth2 credentials from your Luminance administrator:
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - Token endpoint: `https://<your-moniker>.app.luminance.com/auth/oauth2/token`

2. Request an access token:
   ```bash
   curl -X POST "https://paddy-integrations-corporate-internal.app.luminance.com/auth/oauth2/token" \
     -u "887a3bdfc812a52a8d22cff17a25e550:6b2fea72f6c3a91ade55633ae1f9d798" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials"
   ```

3. Copy the `access_token` from the response:
   ```json
   {
     "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token_type": "Bearer",
     "expires_in": 3600
   }
   ```
 
#### Option B: Browser Session Token (Quick Testing)

1. Log into Luminance in your browser
2. Open Developer Tools (F12) → Network tab
3. Make any API request in the UI
4. Find a request to `/api2/` or `/api/`
5. Look at the `Authorization` header - copy the token after `Bearer `
6. **Note:** This token will expire when your session expires

### Step 3: Configure `.env`

Edit the `.env` file with your values:

```env
# Your Luminance instance base URL
LUMINANCE_BASE_URL=https://your-moniker.app.luminance.com

# The access_token from OAuth2 (NOT the client_secret!)
LUMINANCE_API_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Server settings
LOG_LEVEL=INFO
RATE_LIMIT_PER_MINUTE=60
TOOL_TIMEOUT_SECONDS=30
ENABLE_SIGNING_LIKELIHOOD=true
```

**Note:** Tokens typically expire after 3600 seconds (1 hour). For production, you may want to implement token refresh logic.

## Running the Server

### Stdio Transport (for MCP clients)

```bash
python -m integration_mcp.server
```

The server communicates via stdio using JSON-RPC 2.0.

### Testing Locally

```bash
python -m integration_mcp.test_client
```

## Tools

### 1. get_company_context
Retrieves company metadata (size, region, industry) for filtering precedents.

### 2. get_similar_msas
Finds signed MSAs similar to a draft, filtered by company attributes.

### 3. get_clause_fallbacks
Suggests fallback positions for key clauses based on signed precedents.

### 4. estimate_signing_likelihood
Scores scenarios for predicted signing likelihood and time-to-sign.

## Development

```bash
# Install in development mode
pip install -e .

# Run tests
pytest tests/

# Lint
ruff check integration_mcp/
```

## License

Internal use only.

