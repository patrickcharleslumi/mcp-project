#!/usr/bin/env python3
"""
Check .env file contents and verify format
"""
import os
from dotenv import load_dotenv

print("="*60)
print("Checking .env file")
print("="*60)

# Load .env
load_dotenv()

ENV_ID = os.getenv("ENV_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY")

print(f"\nENV_ID: '{ENV_ID}'")
print(f"  Length: {len(ENV_ID) if ENV_ID else 0}")
print(f"  Has whitespace: {ENV_ID != ENV_ID.strip() if ENV_ID else 'N/A'}")

print(f"\nCLIENT_ID: '{CLIENT_ID}'")
print(f"  Length: {len(CLIENT_ID) if CLIENT_ID else 0}")
print(f"  Has whitespace: {CLIENT_ID != CLIENT_ID.strip() if CLIENT_ID else 'N/A'}")

print(f"\nSECRET_KEY: '{SECRET_KEY[:8] if SECRET_KEY else 'NOT SET'}...{SECRET_KEY[-4:] if SECRET_KEY and len(SECRET_KEY) > 4 else ''}'")
print(f"  Length: {len(SECRET_KEY) if SECRET_KEY else 0}")
print(f"  Has whitespace: {SECRET_KEY != SECRET_KEY.strip() if SECRET_KEY else 'N/A'}")

print("\n" + "="*60)
print("Expected values (from get_luminance_token.sh):")
print("="*60)
print("CLIENT_ID: 887a3bdfc812a52a8d22cff17a25e550")
print("SECRET_KEY: 6b2fea72f6c3a91ade55633ae1f9d798")
print("ENV_ID: paddy-integrations-corporate-internal")

print("\n" + "="*60)
print("Verification:")
print("="*60)

issues = []
if not ENV_ID or ENV_ID == "your-env-id-here":
    issues.append("❌ ENV_ID is not set or still has placeholder value")
else:
    print("✅ ENV_ID is set")

if not CLIENT_ID:
    issues.append("❌ CLIENT_ID is not set")
elif CLIENT_ID != "887a3bdfc812a52a8d22cff17a25e550":
    issues.append(f"⚠️  CLIENT_ID doesn't match expected value")
    print(f"   Expected: 887a3bdfc812a52a8d22cff17a25e550")
    print(f"   Got:      {CLIENT_ID}")
else:
    print("✅ CLIENT_ID matches expected value")

if not SECRET_KEY:
    issues.append("❌ SECRET_KEY is not set")
elif SECRET_KEY != "6b2fea72f6c3a91ade55633ae1f9d798":
    issues.append(f"⚠️  SECRET_KEY doesn't match expected value")
    print(f"   Expected: 6b2fea72f6c3a91ade55633ae1f9d798")
    print(f"   Got:      {SECRET_KEY}")
else:
    print("✅ SECRET_KEY matches expected value")

if issues:
    print("\n" + "="*60)
    print("Issues found:")
    print("="*60)
    for issue in issues:
        print(issue)
    print("\nPlease check your .env file and ensure:")
    print("1. No extra spaces or quotes around values")
    print("2. Values match exactly (case-sensitive)")
    print("3. No trailing/leading whitespace")
else:
    print("\n✅ All credentials look correct!")
    print("\nIf you're still getting 401 errors, the issue might be:")
    print("1. Credentials are for a different environment")
    print("2. Credentials have been rotated/expired")
    print("3. Network/VPN connectivity issue")
