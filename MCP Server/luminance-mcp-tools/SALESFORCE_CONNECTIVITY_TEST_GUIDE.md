# Salesforce MCP Tool Connectivity Testing Guide

## Overview

You have configured a Salesforce "Get Commercial Context" MCP tool with these components:

- **Prismatic Integration**: Luminance MCP Tools
- **Tool**: `get-salesforce-commercial-context`
- **Webhook URL**: `https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmI1NDczMmU2LWE2ZTctNDc2MC1hNTliLWU5ZTJlYTVmMjQ5Mg==`
- **Authentication**: OAuth2 Username-Password flow

## Testing Steps

### Step 1: Verify Salesforce Configuration

Your Prismatic instance should have these 5 configuration variables set:

```
Salesforce Token URL: https://login.salesforce.com/services/oauth2/token
Salesforce Consumer Key: [Your Connected App Consumer Key]
Salesforce Consumer Secret: [Your Connected App Consumer Secret]
Salesforce Username: [Your API user username]
Salesforce Password: [Your password + security token if required]
```

### Step 2: Test Basic Connectivity

Run the connection test script:

```bash
# First, update the config in test-salesforce-connection.js with your credentials
node test-salesforce-connection.js
```

This will:
- ✅ Test OAuth2 token acquisition
- ✅ Verify SOQL query permissions
- ✅ Check custom field accessibility
- 📋 List sample opportunities for testing

### Step 3: Test via HTTP Request (Direct webhook test)

Use this curl command to test your webhook endpoint directly:

```bash
curl -X POST "https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmI1NDczMmU2LWE2ZTctNDc2MC1hNTliLWU5ZTJlYTVmMjQ5Mg==" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "opportunityId": "006XXXXXXXXXXXXXXX"
    }
  }'
```

**Replace `006XXXXXXXXXXXXXXX` with an actual Opportunity ID from your Salesforce org.**

Alternative test by opportunity name:

```bash
curl -X POST "https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmI1NDczMmU2LWE2ZTctNDc2MC1hNTliLWU5ZTJlYTVmMjQ5Mg==" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "opportunityName": "Your Opportunity Name Here"
    }
  }'
```

### Step 4: Expected Response Format

A successful response should look like this:

```json
{
  "data": {
    "opportunity_id": "006XXXXXXXXXXXXXXX",
    "opportunity_name": "Example Deal 2024",
    "deal_stage": {
      "stage_name": "Qualification",
      "close_date": "2024-12-31"
    },
    "organization": {
      "region": "North America",
      "business_unit": "Enterprise"
    },
    "financial_metrics": {
      "acv": 150000,
      "arr": 150000,
      "discount": 10,
      "total_discount": 15000,
      "payment_terms": "Net 30"
    },
    "legal_and_security": {
      "legal_required": true,
      "security_review_required": true,
      "non_standard_terms_requested": false,
      "redline_count": 3
    },
    "competitive_landscape": {
      "main_competitors": "Competitor A, Competitor B",
      "procurement_pressure": "High",
      "procurement_category": "Software"
    },
    "contract_dates": {
      "contract_start_date": "2024-01-01",
      "contract_end_date": "2024-12-31"
    },
    "renewal_information": {
      "renewal_date": "2024-12-31",
      "renewal_notice_period": 90,
      "auto_renewal": true
    },
    "next_steps": {
      "next_step": "Send proposal to customer"
    },
    "customer_health": {
      "open_cases_count": 2,
      "max_open_case_severity": "Medium",
      "sla_breach": false,
      "customer_health": "Green"
    },
    "metadata": {
      "retrieved_at": "2024-01-28T10:30:00.000Z",
      "source": "salesforce"
    }
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. **"Invalid client_id" Error**
- ✅ Verify your Consumer Key is correct
- ✅ Check that your Connected App is deployed and approved
- ✅ Ensure the Connected App has "API (Enable OAuth Settings)" scope

#### 2. **"Invalid username, password, security token" Error**
- ✅ Verify username and password are correct
- ✅ Check if you need to append the security token to your password
- ✅ Ensure the user has API access enabled
- ✅ Try resetting the security token in Salesforce Setup

#### 3. **"INVALID_FIELD" in SOQL Query**
- ✅ The custom fields may not exist in your Salesforce org
- ✅ Check field permissions for your API user
- ✅ Custom fields ending with `__c` are organization-specific

#### 4. **"Opportunity not found" Error**
- ✅ Verify the Opportunity ID format (15 or 18 characters)
- ✅ Check that the opportunity exists and is accessible to your user
- ✅ Ensure proper SOQL escaping for opportunity names with special characters

#### 5. **Webhook Returns 500 Error**
- ✅ Check Prismatic execution logs in the dashboard
- ✅ Verify all 5 Salesforce configuration variables are set
- ✅ Test the individual connection first (Step 2)

### Debugging Commands

1. **Test with minimal SOQL query:**
```bash
# Test basic Salesforce access
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"data": {"opportunityId": "006XXXXXXXXXXXXXXX"}}'
```

2. **Check Prismatic logs:**
   - Go to Prismatic dashboard → Your Integration → Executions
   - Look for recent execution logs with error details

3. **Validate Opportunity ID format:**
```javascript
// Valid Salesforce ID regex
const isValidSalesforceId = /^[a-zA-Z0-9]{15,18}$/.test(opportunityId);
```

## Custom Fields Reference

The tool queries these custom fields (your org may not have all of them):

| Field Name | Description | Required |
|------------|-------------|----------|
| `Region__c` | Geographic region | No |
| `Business_Unit__c` | Business unit classification | No |
| `ACV__c` | Annual Contract Value | No |
| `ARR__c` | Annual Recurring Revenue | No |
| `Legal_Required__c` | Legal review required flag | No |
| `Security_Review_Required__c` | Security review flag | No |
| `MainCompetitors__c` | Primary competitors | No |
| `Procurement_Pressure__c` | Procurement pressure level | No |
| `Contract_Start_Date__c` | Contract start date | No |
| `Contract_End_Date__c` | Contract end date | No |
| `Renewal_Date__c` | Next renewal date | No |
| `Customer_Health__c` | Customer health score | No |

**Note**: Missing custom fields will return `null` values but won't break the query.

## Next Steps After Successful Test

1. **Document working Opportunity IDs** for future testing
2. **Set up monitoring** for the webhook endpoint
3. **Test error scenarios** (invalid IDs, missing opportunities)
4. **Validate custom field mapping** with your Salesforce admin
5. **Test the MCP integration** with your AI agent/client

## Security Notes

- Use a dedicated **integration user** for API access
- Set **IP restrictions** on the Connected App if possible
- **Rotate credentials** regularly
- **Monitor API usage** in Salesforce Setup → API Usage

---

**Tool Endpoint**: `https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmI1NDczMmU2LWE2ZTctNDc2MC1hNTliLWU5ZTJlYTVmMjQ5Mg==`

**Required Parameters**: Either `opportunityId` OR `opportunityName` (not both)

**Response Time**: Typically 2-5 seconds depending on Salesforce response