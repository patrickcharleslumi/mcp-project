#!/usr/bin/env bash
set -euo pipefail

# Boot Luminance web (if START_WEB.sh exists), fetch token, start MCP wrapper, run smoke tests.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${WEB_DIR:-/Users/joe.pearce/code/web}"
MCP_PORT="${MCP_PORT:-8080}"
MCP_API_KEY="${MCP_API_KEY:-local-mcp}"
LUMINANCE_BASE_URL="${LUMINANCE_BASE_URL:-https://localhost:4000}"
LUMINANCE_PROJECT_ID="${LUMINANCE_PROJECT_ID:-3}"
MCP_VERIFY_TLS="${MCP_VERIFY_TLS:-false}"

if [[ -z "${LUMINANCE_CLIENT_ID:-}" || -z "${LUMINANCE_CLIENT_SECRET:-}" ]]; then
  CRED_FILE="${ROOT_DIR}/credentials/luminance-oauth.json"
  export CRED_FILE
  if [[ -f "${CRED_FILE}" ]]; then
    LUMINANCE_CLIENT_ID="$(python - <<'PY'
import json, os
with open(os.environ["CRED_FILE"]) as f:
    data = json.load(f)
print(data.get("client_id", ""))
PY
)"
    LUMINANCE_CLIENT_SECRET="$(python - <<'PY'
import json, os
with open(os.environ["CRED_FILE"]) as f:
    data = json.load(f)
print(data.get("client_secret", ""))
PY
)"
    export LUMINANCE_CLIENT_ID LUMINANCE_CLIENT_SECRET
  fi
fi

if [[ -z "${LUMINANCE_CLIENT_ID:-}" || -z "${LUMINANCE_CLIENT_SECRET:-}" ]]; then
  echo "Missing LUMINANCE_CLIENT_ID / LUMINANCE_CLIENT_SECRET."
  echo "Export them before running or ensure ${ROOT_DIR}/credentials/luminance-oauth.json exists."
  exit 1
fi

echo "==> Starting Luminance web (if available)"
if [[ -x "${WEB_DIR}/START_WEB.sh" ]]; then
  (cd "${WEB_DIR}" && ./START_WEB.sh) || true
else
  echo "WARN: ${WEB_DIR}/START_WEB.sh not found or not executable. Skipping web start."
fi

echo "==> Waiting for Luminance web"
WEB_READY=false
for _ in {1..40}; do
  if curl -s -k --max-time 2 "${LUMINANCE_BASE_URL}/" >/dev/null 2>&1; then
    WEB_READY=true
    break
  fi
  sleep 0.5
done
if [[ "${WEB_READY}" != "true" ]]; then
  echo "ERROR: Luminance web did not become ready at ${LUMINANCE_BASE_URL}"
  echo "Check /tmp/web-server.log for details."
  exit 1
fi

echo "==> Fetching OAuth2 token"
TOKEN_URL="${LUMINANCE_BASE_URL}/auth/oauth2/token"
TOKEN_JSON=""
for _ in {1..5}; do
  TOKEN_JSON="$(curl -s -k -X POST "${TOKEN_URL}" \
    -u "${LUMINANCE_CLIENT_ID}:${LUMINANCE_CLIENT_SECRET}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials")"
  if echo "${TOKEN_JSON}" | grep -q "access_token"; then
    break
  fi
  sleep 0.5
done

if [[ -z "${TOKEN_JSON}" || "${TOKEN_JSON}" != *"access_token"* ]]; then
  echo "ERROR: Token endpoint did not return an access_token."
  echo "Debug output:"
  curl -i -k -X POST "${TOKEN_URL}" \
    -u "${LUMINANCE_CLIENT_ID}:${LUMINANCE_CLIENT_SECRET}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials"
  exit 1
fi

export TOKEN_JSON
LUMINANCE_API_TOKEN="$(python - <<'PY'
import json, os, sys
data = json.loads(os.environ["TOKEN_JSON"])
token = data.get("access_token")
if not token:
    print("ERROR: access_token not found in response", file=sys.stderr)
    sys.exit(1)
print(token)
PY
)"

export LUMINANCE_API_TOKEN

echo "==> Starting MCP wrapper on port ${MCP_PORT}"
cd "${ROOT_DIR}"
MCP_LOG="${ROOT_DIR}/tmp/mcp-wrapper.log"
mkdir -p "${ROOT_DIR}/tmp"
MCP_API_KEY="${MCP_API_KEY}" MCP_VERIFY_TLS="${MCP_VERIFY_TLS}" \
LUMINANCE_BASE_URL="${LUMINANCE_BASE_URL}" \
LUMINANCE_API_TOKEN="${LUMINANCE_API_TOKEN}" \
LUMINANCE_PROJECT_ID="${LUMINANCE_PROJECT_ID}" \
uvicorn mcp.app:app --port "${MCP_PORT}" > "${MCP_LOG}" 2>&1 &
MCP_PID=$!

cleanup() {
  if ps -p "${MCP_PID}" >/dev/null 2>&1; then
    kill "${MCP_PID}" || true
  fi
}
trap cleanup EXIT

echo "==> Waiting for MCP wrapper"
for _ in {1..20}; do
  if curl -s "http://localhost:${MCP_PORT}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "==> Smoke test: group info"
curl -s "http://localhost:${MCP_PORT}/mcp/groups/19/info" \
  -H "Authorization: Bearer ${MCP_API_KEY}" | python -m json.tool

echo "==> Smoke test: version comparison"
curl -s "http://localhost:${MCP_PORT}/mcp/groups/19/version-comparison" \
  -H "Authorization: Bearer ${MCP_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"baseDocumentId":"2","compareDocumentId":"3","options":{"clauseGranularity":true,"sensitivity":"medium"}}' \
  | python -m json.tool

echo "==> Done"
