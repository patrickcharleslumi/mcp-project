#!/usr/bin/env python3
"""
Quick test script for DocuSign provider setup
"""
import os
import sys
from dotenv import load_dotenv
from urllib.parse import urlparse

# Add parent directory to path to import setup_external_providers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from setup_external_providers import setup_docusign_provider
import lumpy.api

# Load environment variables
load_dotenv()

ENV_ID = os.getenv("ENV_ID")
SECRET_KEY = os.getenv("SECRET_KEY")

if not ENV_ID:
    print("Error: ENV_ID not set in .env file")
    sys.exit(1)

if not SECRET_KEY:
    print("Error: SECRET_KEY not set in .env file")
    sys.exit(1)

# Your DocuSign credentials
DOCUSIGN_ACCOUNT_ID = "633b43f4-367a-44cb-b843-6152672eee22"
DOCUSIGN_BASE_URL = "https://demo.docusign.net"

# Luminance Account ID - REQUIRED
# You can find this by:
# 1. Logging into Luminance UI → Account Settings
# 2. Checking any existing external providers in the UI
# 3. Or use session-based auth instead (see AUTHENTICATION_OPTIONS.md)
LUMINANCE_ACCOUNT_ID = None  # Set this to your account ID, e.g., 123

# Extract hostname from URL if needed
if DOCUSIGN_BASE_URL.startswith('http'):
    parsed = urlparse(DOCUSIGN_BASE_URL)
    base_url = parsed.hostname or parsed.netloc
else:
    base_url = DOCUSIGN_BASE_URL

print("="*60)
print("DocuSign Provider Setup Test")
print("="*60)
print(f"Environment ID: {ENV_ID}")
print(f"DocuSign Account ID: {DOCUSIGN_ACCOUNT_ID}")
print(f"DocuSign Base URL: {base_url}")
print("="*60)

# Validate ENV_ID
if not ENV_ID or ENV_ID == "your-env-id-here":
    print("\n❌ Error: ENV_ID is not set correctly in .env file!")
    print("   Please update .env file with your actual environment ID.")
    print("   Options:")
    print("   - Numeric ID: 006403")
    print("   - Moniker: paddy-integrations-corporate-internal")
    print("   - Full URL: https://paddy-integrations-corporate-internal.app.luminance.com")
    sys.exit(1)

# Authenticate using OAuth2 client credentials
print("\nAuthenticating...")
try:
    from oauth_session import create_oauth_session
    
    CLIENT_ID = os.getenv("CLIENT_ID")
    if not CLIENT_ID:
        raise ValueError("CLIENT_ID not found in .env file. Please add it.")
    
    # Verify credentials are loaded
    print(f"   CLIENT_ID: {CLIENT_ID[:8]}...{CLIENT_ID[-4:]}")
    print(f"   SECRET_KEY: {SECRET_KEY[:8]}...{SECRET_KEY[-4:]}")
    
    session = create_oauth_session(ENV_ID, CLIENT_ID, SECRET_KEY)
    print("✅ Authentication successful!")
except Exception as e:
    print(f"❌ Authentication failed: {e}")
    print("\nTroubleshooting:")
    print("1. Verify CLIENT_ID and SECRET_KEY in .env match your credentials")
    print("2. Check that credentials are for the correct environment")
    print("3. Try running get_luminance_token.sh to verify credentials work")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Set up DocuSign provider
print("\nSetting up DocuSign provider...")
print("   ⚠️  Note: OAuth2 tokens don't work with /api endpoints.")
print("   The /api/external_providers endpoints require session-based auth.")
print("   You'll need to provide account_id manually.\n")

# Try to get account_id - but it will likely fail with OAuth2
account_id = None
print("   Attempting to get account_id...")
try:
    response = session.get('/api/external_providers?limit=1')
    providers = response.json()
    if providers and len(providers) > 0:
        account_id = providers[0].get('account_id')
        if account_id:
            print(f"   ✅ Found account_id: {account_id}")
except Exception as e:
    print(f"   ⚠️  Could not get account_id (expected with OAuth2): {e}")
    print("\n   💡 Solution: You need to provide account_id manually.")
    print("   You can find it by:")
    print("   1. Logging into Luminance UI and checking Account Settings")
    print("   2. Using session-based auth instead of OAuth2")
    print("   3. Checking any existing external providers in the UI\n")
    
    # For now, let's try with a placeholder and see what error we get
    # This will help us understand what account_id format is expected
    print("   Attempting to create provider without account_id to see error...")

# Check if we have account_id
if not LUMINANCE_ACCOUNT_ID and not account_id:
    print("\n" + "="*60)
    print("⚠️  ACCOUNT_ID NOT FOUND")
    print("="*60)
    print("OAuth2 tokens don't work with /api endpoints for reading.")
    print("However, we can try to create the provider anyway - the API")
    print("might accept it or give us a helpful error message.\n")
    print("Attempting to create provider without account_id...")
    print("(If it fails, you'll need to provide account_id manually)")
    print("="*60 + "\n")
    final_account_id = None  # Try without it
else:
    final_account_id = LUMINANCE_ACCOUNT_ID or account_id
    print(f"   Using account_id: {final_account_id}")

# Use provided account_id or the one we found
final_account_id = LUMINANCE_ACCOUNT_ID or account_id

try:
    provider = setup_docusign_provider(
        session=session,
        account_id_docusign=DOCUSIGN_ACCOUNT_ID,
        base_url=base_url,  # Will be converted to 'account-d.docusign.net'
        provider_name="Test DocuSign Integration",
        environment='testing',  # Since it's demo.docusign.net
        account_id=final_account_id
    )
    
    print("\n✅ DocuSign provider created/updated successfully!")
    print(f"Provider ID: {provider.get('id')}")
    print(f"Provider Name: {provider.get('name')}")
    print(f"State: {provider.get('state')}")
    print(f"\nFull response:")
    import json
    print(json.dumps(provider, indent=2))
    
    if provider.get('state') == 'pending':
        print("\n⚠️  Note: Provider is in 'pending' state.")
        print("   This is normal for DocuSign - support will activate it.")
        print("   You can set the secret later using the updateSecret endpoint.")
    
except Exception as e:
    print(f"\n❌ Failed to set up DocuSign provider: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*60)
print("Setup complete!")
print("="*60)
