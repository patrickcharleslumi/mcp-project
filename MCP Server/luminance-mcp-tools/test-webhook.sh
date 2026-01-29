#!/bin/bash

# Test script for Salesforce MCP Tool webhook
# Replace the OPPORTUNITY_ID and OPPORTUNITY_NAME with real values from your Salesforce org

WEBHOOK_URL="https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmI1NDczMmU2LWE2ZTctNDc2MC1hNTliLWU5ZTJlYTVmMjQ5Mg=="

# Test opportunity ID - replace with a real one from your Salesforce org
OPPORTUNITY_ID="006XXXXXXXXXXXXXXX"

# Test opportunity name - replace with a real one from your Salesforce org
OPPORTUNITY_NAME="Test Opportunity Name"

echo "🧪 Testing Salesforce MCP Tool Webhook..."
echo "📡 Endpoint: $WEBHOOK_URL"
echo ""

# Test 1: Query by Opportunity ID
echo "🔍 Test 1: Query by Opportunity ID"
echo "Request payload: {\"data\": {\"opportunityId\": \"$OPPORTUNITY_ID\"}}"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"data\": {\"opportunityId\": \"$OPPORTUNITY_ID\"}}" \
  --verbose \
  --max-time 30

echo ""
echo "================================"
echo ""

# Test 2: Query by Opportunity Name
echo "🔍 Test 2: Query by Opportunity Name"
echo "Request payload: {\"data\": {\"opportunityName\": \"$OPPORTUNITY_NAME\"}}"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"data\": {\"opportunityName\": \"$OPPORTUNITY_NAME\"}}" \
  --verbose \
  --max-time 30

echo ""
echo "================================"
echo ""

# Test 3: Error case - no parameters
echo "🚫 Test 3: Error handling (no parameters)"
echo "Request payload: {\"data\": {}}"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"data\": {}}" \
  --verbose \
  --max-time 30

echo ""
echo "================================"
echo ""

# Test 4: Error case - invalid ID format
echo "🚫 Test 4: Error handling (invalid ID format)"
echo "Request payload: {\"data\": {\"opportunityId\": \"INVALID_ID\"}}"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"data\": {\"opportunityId\": \"INVALID_ID\"}}" \
  --verbose \
  --max-time 30

echo ""
echo ""
echo "✅ Webhook testing completed!"
echo ""
echo "💡 Tips:"
echo "   - Replace OPPORTUNITY_ID and OPPORTUNITY_NAME variables with real values"
echo "   - Successful responses should return JSON with opportunity data"
echo "   - HTTP 200 status indicates successful processing"
echo "   - HTTP 4xx/5xx indicates configuration or data issues"
echo ""
echo "📋 Expected successful response structure:"
echo "   {\"data\": {\"opportunity_id\": \"...\", \"opportunity_name\": \"...\", ...}}"
echo ""
echo "🔧 If tests fail, check:"
echo "   1. Prismatic configuration (5 Salesforce variables)"
echo "   2. Connected App settings in Salesforce"
echo "   3. User permissions and API access"
echo "   4. Opportunity ID/Name exists and is accessible"