#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
# - SF_USERNAME
# - SF_CLIENT_ID
# - SF_PRIVATE_KEY_PATH (PKCS#8, unencrypted)
# - SF_TOKEN_URL
# Optional:
# - SF_AUD (defaults to token URL host)

python3 /Users/joe.pearce/code/mcp-project/scripts/salesforce_jwt_auth.py
