"""
OAuth2 Session Helper for Luminance API

This module provides an OAuth2-based session that works with the setup_external_providers scripts.
"""
import base64
import requests
import os


class OAuthSession:
    """
    OAuth2-based session that mimics lumpy.api.Session interface
    but uses Bearer token authentication instead of session cookies.
    """
    def __init__(self, base_uri, access_token, verify=None):
        self.base_uri = base_uri.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        })
        # Disable SSL verification for development (like lumpy does for 8443)
        if verify is None:
            self.session.verify = '8443' not in base_uri
        else:
            self.session.verify = verify
    
    def get(self, path, **kwargs):
        url = f"{self.base_uri}{path}" if path.startswith('/') else f"{self.base_uri}/{path}"
        res = self.session.get(url, **kwargs)
        res.raise_for_status()
        return res
    
    def put(self, path, **kwargs):
        url = f"{self.base_uri}{path}" if path.startswith('/') else f"{self.base_uri}/{path}"
        res = self.session.put(url, **kwargs)
        res.raise_for_status()
        return res
    
    def post(self, path, **kwargs):
        url = f"{self.base_uri}{path}" if path.startswith('/') else f"{self.base_uri}/{path}"
        res = self.session.post(url, **kwargs)
        res.raise_for_status()
        return res
    
    def patch(self, path, **kwargs):
        url = f"{self.base_uri}{path}" if path.startswith('/') else f"{self.base_uri}/{path}"
        res = self.session.patch(url, **kwargs)
        res.raise_for_status()
        return res


def create_oauth_session(env_id: str, client_id: str = None, client_secret: str = None, base_uri: str = None) -> OAuthSession:
    """
    Create an OAuth2 session for Luminance API.
    
    Args:
        env_id: Luminance environment ID (numeric like '006403' or moniker like 'paddy-integrations-corporate-internal')
        client_id: OAuth2 client ID (or from CLIENT_ID env var)
        client_secret: OAuth2 client secret (or from SECRET_KEY env var)
        base_uri: Optional full base URI (if provided, env_id is ignored)
    
    Returns:
        OAuthSession instance
    """
    import lumpy.api
    
    if client_id is None:
        client_id = os.getenv("CLIENT_ID")
    if client_secret is None:
        client_secret = os.getenv("SECRET_KEY")
    
    if not client_id or not client_secret:
        raise ValueError("CLIENT_ID and SECRET_KEY (client_secret) are required for OAuth2")
    
    # Determine base_uri
    if base_uri:
        # Use provided base URI directly
        pass
    elif env_id.startswith('http://') or env_id.startswith('https://'):
        # Full URL provided
        base_uri = env_id.rstrip('/')
    elif '.app.luminance.com' in env_id or '.support.luminance.com' in env_id:
        # Moniker with domain provided (e.g., 'paddy-integrations-corporate-internal.app.luminance.com')
        base_uri = f"https://{env_id}" if not env_id.startswith('http') else env_id
        base_uri = base_uri.rstrip('/')
    elif len(env_id) == 6 and env_id.isdigit():
        # Numeric ID (e.g., '006403') - use support.luminance.com
        base_uri = lumpy.api.default_base_uri(env_id)
    else:
        # Assume it's a moniker - try .app.luminance.com first (most common)
        base_uri = f"https://{env_id}.app.luminance.com"
    
    token_url = f"{base_uri}/auth/oauth2/token"
    
    # Create Basic Auth header
    auth_str = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    
    # Get access token
    print(f"   Requesting token from: {token_url}")
    print(f"   Using CLIENT_ID: {client_id[:8]}...")
    
    response = requests.post(
        token_url,
        headers={
            "Authorization": f"Basic {auth_str}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data="grant_type=client_credentials",
        verify='8443' not in base_uri  # Disable SSL verify for dev environments
    )
    
    # Better error handling
    if response.status_code != 200:
        error_msg = f"OAuth2 token request failed with status {response.status_code}"
        try:
            error_data = response.json()
            if isinstance(error_data, dict):
                error_msg += f"\n   Error: {error_data.get('error', 'Unknown error')}"
                if 'error_description' in error_data:
                    error_msg += f"\n   Description: {error_data['error_description']}"
            else:
                error_msg += f": {error_data}"
        except:
            error_msg += f"\n   Response: {response.text[:500]}"
        raise Exception(error_msg)
    
    token_data = response.json()
    access_token = token_data['access_token']
    print(f"   ✅ Token obtained successfully")
    
    return OAuthSession(base_uri, access_token)
