# Authentication Options for External Providers

## The Problem

The `/api/external_providers` endpoints are part of the **legacy API v1**, which requires **session-based authentication** (CSRF tokens), not OAuth2 client credentials.

- ✅ OAuth2 tokens work for `/api2` endpoints (Public API v2)
- ❌ OAuth2 tokens don't work for `/api` endpoints (Legacy API v1)
- ✅ External providers are only in `/api`, not `/api2`

## Solution Options

### Option 1: Use Session-Based Authentication (Recommended)

Use username/password authentication instead of OAuth2:

```python
from session_auth_helper import create_session_auth
from setup_external_providers import setup_docusign_provider

# Create session with username/password
session = create_session_auth(
    env_id="paddy-integrations-corporate-internal",
    username="your-username",
    password="your-password"
)

# Now setup_docusign_provider will work and can get account_id automatically
provider = setup_docusign_provider(
    session=session,
    account_id_docusign="633b43f4-367a-44cb-b843-6152672eee22",
    base_url="demo.docusign.net"
)
```

**Add to .env:**
```
USERNAME=your-username
PASSWORD=your-password
```

### Option 2: Provide Account ID Manually

If you must use OAuth2, provide the account_id explicitly:

```python
from oauth_session import create_oauth_session
from setup_external_providers import setup_docusign_provider

session = create_oauth_session(ENV_ID, CLIENT_ID, SECRET_KEY)

# You need to know your account_id
provider = setup_docusign_provider(
    session=session,
    account_id_docusign="633b43f4-367a-44cb-b843-6152672eee22",
    base_url="demo.docusign.net",
    account_id=123  # Your Luminance account ID
)
```

**How to find account_id:**
1. Log into Luminance UI
2. Go to Account Settings
3. Look for Account ID
4. Or check any existing external providers - they'll show the account_id

### Option 3: Use Base64 Token (For Scripts)

If you have a base64-encoded `username:password` token:

```python
from session_auth_helper import create_session_auth

session = create_session_auth(
    env_id="paddy-integrations-corporate-internal",
    base64_token="dXNlcm5hbWU6cGFzc3dvcmQ="  # base64(username:password)
)
```

## Recommendation

**Use Option 1 (Session-Based Auth)** because:
- ✅ Works with all `/api` endpoints
- ✅ Can automatically get `account_id`
- ✅ No need to manually provide account_id
- ✅ More reliable for external provider management

The OAuth2 client credentials are great for `/api2` endpoints, but for managing external providers, session-based auth is required.
