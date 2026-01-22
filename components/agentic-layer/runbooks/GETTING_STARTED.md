# Getting Started - Quick Setup Guide

## 1. Create the `.env` File

The `.env` file should be created in the **project root directory**:

```
/Users/patrick.charles/Documents/MCP project/integration-mcp/.env
```

### Quick Method:
```bash
cd "/Users/patrick.charles/Documents/MCP project/integration-mcp"
cp env.example .env
```

Then edit `.env` with your actual values.

## 2. Understanding the API Token

### ❌ Common Misconception
**The `LUMINANCE_API_TOKEN` is NOT your client secret!**

### ✅ What It Actually Is
The `LUMINANCE_API_TOKEN` is an **access token** (Bearer token) that you get from Luminance's OAuth2 endpoint.

### How to Get It

#### Method 1: OAuth2 Flow (Production)

You need:
- `CLIENT_ID` (from Luminance admin)
- `CLIENT_SECRET` (from Luminance admin)
- Token endpoint: `https://<your-moniker>.app.luminance.com/auth/oauth2/token`

Request a token:
```bash
curl -X POST "https://<your-moniker>.app.luminance.com/auth/oauth2/token" \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Copy the `access_token` value** - that's what goes in `LUMINANCE_API_TOKEN`.

#### Method 2: Browser DevTools (Quick Test)

1. Log into Luminance in your browser
2. Open DevTools (F12) → Network tab
3. Interact with Luminance (navigate, open a document, etc.)
4. Find any request to `/api2/` or `/api/`
5. Click on the request → Headers tab
6. Look for `Authorization: Bearer <token>`
7. Copy the token (the part after "Bearer ")

**Note:** Browser tokens expire when you log out or your session expires.

## 3. Complete `.env` Example

```env
# Base URL of your Luminance instance
LUMINANCE_BASE_URL=https://your-company.app.luminance.com

# Access token (from OAuth2 or browser session)
# This is the "access_token" from the OAuth2 response, NOT the client_secret!
LUMINANCE_API_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

# Optional settings
LOG_LEVEL=INFO
RATE_LIMIT_PER_MINUTE=60
TOOL_TIMEOUT_SECONDS=30
ENABLE_SIGNING_LIKELIHOOD=true
```

## 4. Verify Your Setup

Test that your configuration works:

```bash
PYTHONPATH=components/luminance-mcp python -m integration_mcp.test_client
```

If you see errors about authentication, double-check:
- ✅ `.env` file exists in the project root
- ✅ `LUMINANCE_BASE_URL` is correct (no trailing slash)
- ✅ `LUMINANCE_API_TOKEN` is the access_token, not the client_secret
- ✅ Token hasn't expired (OAuth2 tokens expire after 1 hour)

## 5. Token Refresh (Future Enhancement)

For production use, you may want to implement automatic token refresh. Currently, you'll need to manually update the token when it expires. A future enhancement could:
- Store `CLIENT_ID` and `CLIENT_SECRET` securely
- Automatically refresh tokens before they expire
- Handle token refresh errors gracefully

## Troubleshooting

### "Missing credentials" error
- Make sure `.env` file exists in the project root
- Check that variable names match exactly (case-sensitive in some systems)

### "401 Unauthorized" error
- Token may have expired (get a new one)
- Token might be incorrect (make sure it's the access_token, not client_secret)
- Base URL might be wrong

### "404 Not Found" error
- Check that `LUMINANCE_BASE_URL` is correct
- Make sure there's no trailing slash
- Verify the endpoint exists: `{base_url}/api2/`

