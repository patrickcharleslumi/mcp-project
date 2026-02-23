#!/usr/bin/env python3
"""
Helper to create session-based authentication for /api endpoints

The /api/external_providers endpoints require session-based auth (not OAuth2).
This helper creates a session using username:password authentication.
"""
import os
import base64
import requests
import re
from dotenv import load_dotenv

load_dotenv()

class SessionAuth:
    """Session-based authentication for /api endpoints"""
    def __init__(self, base_uri, username, password):
        self.base_uri = base_uri.rstrip('/')
        self.session = requests.Session()
        self._login(username, password)
    
    def _login(self, username, password):
        """Login using session-based auth with CSRF tokens"""
        # Step 1: Get CSRF token from login page
        login_page = self.session.get(self.base_uri + '/login')
        login_page.raise_for_status()
        
        # Extract CSRF token
        csrf_match = re.search(r"csrf.*?'([^']+)'", login_page.text)
        if not csrf_match:
            raise ValueError("Could not extract CSRF token from login page")
        csrf_token = csrf_match.group(1)
        
        # Step 2: POST to /auth/login with CSRF token
        login_response = self.session.post(
            self.base_uri + '/auth/login',
            data={
                'username': username,
                'password': password
            },
            headers={
                'X-CSRF-Token': csrf_token,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        login_response.raise_for_status()
        
        # Step 3: Get new CSRF token from response
        login_data = login_response.json()
        if 'csrf' in login_data:
            self.csrf_token = login_data['csrf']
            self.session.headers.update({'X-CSRF-Token': self.csrf_token})
        else:
            raise ValueError("Could not get CSRF token from login response")
    
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


def create_session_auth(env_id: str, username: str = None, password: str = None, base64_token: str = None):
    """
    Create session-based authentication.
    
    Args:
        env_id: Environment ID or moniker
        username: Username (or from env var)
        password: Password (or from env var)
        base64_token: Base64 encoded username:password token (alternative to username/password)
    
    Returns:
        SessionAuth instance
    """
    import lumpy.api
    
    # Determine base_uri
    if env_id.startswith('http'):
        base_uri = env_id.rstrip('/')
    elif '.app.luminance.com' in env_id or '.support.luminance.com' in env_id:
        base_uri = f"https://{env_id}" if not env_id.startswith('http') else env_id
        base_uri = base_uri.rstrip('/')
    elif len(env_id) == 6 and env_id.isdigit():
        base_uri = lumpy.api.default_base_uri(env_id)
    else:
        base_uri = f"https://{env_id}.app.luminance.com"
    
    # Get credentials
    if base64_token:
        # Decode base64 token
        creds = base64.b64decode(base64_token).decode().split(':')
        username = creds[0]
        password = creds[1] if len(creds) > 1 else ''
    else:
        if not username:
            username = os.getenv("USERNAME")
        if not password:
            password = os.getenv("PASSWORD")
        
        if not username or not password:
            raise ValueError("Username and password required (or provide base64_token)")
    
    return SessionAuth(base_uri, username, password)
