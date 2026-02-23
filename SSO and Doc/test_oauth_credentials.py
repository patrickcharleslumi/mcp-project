#!/usr/bin/env python3
"""
Quick test to verify OAuth2 credentials work
"""
import os
import requests
import base64
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("SECRET_KEY")
ENV_ID = os.getenv("ENV_ID")

print("="*60)
print("OAuth2 Credentials Test")
print("="*60)
print(f"ENV_ID: {ENV_ID}")
print(f"CLIENT_ID: {CLIENT_ID}")
print(f"SECRET_KEY: {CLIENT_ID[:8]}...{CLIENT_SECRET[-4:] if CLIENT_SECRET else 'NOT SET'}")
print("="*60)

if not all([CLIENT_ID, CLIENT_SECRET, ENV_ID]):
    print("❌ Missing credentials in .env file")
    sys.exit(1)

# Determine base URI
if ENV_ID.startswith('http'):
    base_uri = ENV_ID.rstrip('/')
elif '.app.luminance.com' in ENV_ID or '.support.luminance.com' in ENV_ID:
    base_uri = f"https://{ENV_ID}" if not ENV_ID.startswith('http') else ENV_ID
    base_uri = base_uri.rstrip('/')
elif len(ENV_ID) == 6 and ENV_ID.isdigit():
    base_uri = f"https://{ENV_ID}.support.luminance.com"
else:
    base_uri = f"https://{ENV_ID}.app.luminance.com"

token_url = f"{base_uri}/auth/oauth2/token"

print(f"\nToken URL: {token_url}")

# Create Basic Auth
auth_str = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
print(f"Auth header: Basic {auth_str[:20]}...")

# Test request
print("\nMaking OAuth2 request...")
try:
    response = requests.post(
        token_url,
        headers={
            "Authorization": f"Basic {auth_str}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data="grant_type=client_credentials",
        verify=False  # For testing
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        token_data = response.json()
        print("✅ SUCCESS!")
        print(f"Token Type: {token_data.get('token_type')}")
        print(f"Expires In: {token_data.get('expires_in')} seconds")
        print(f"Access Token: {token_data.get('access_token', '')[:50]}...")
    else:
        print("❌ FAILED")
        print(f"Response: {response.text}")
        try:
            error_data = response.json()
            print(f"Error: {error_data}")
        except:
            pass
except Exception as e:
    print(f"❌ Exception: {e}")
    import traceback
    traceback.print_exc()
