# Prismatic Response Format Verification Guide

Since you mentioned being unsure about the expected response format from your Prismatic integration, this guide will help you determine the correct format and update the CRM card accordingly.

## Current Assumption

The CRM card currently expects this response format:

```json
{
  "contractUrl": "https://luminance.com/contract/abc123",
  "contractId": "abc123",
  "status": "success"
}
```

## How to Find the Actual Response Format

### Option 1: Test with Postman

1. **Open Postman** (or similar API testing tool)

2. **Create POST Request**:
   ```
   URL: https://hooks.luminance-production-eu-central-1.prismatic.io/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmZiMDBmODdiLTZhM2QtNGY0MS1iNTNhLTJiNDViYTAyYjY1NA==
   Method: POST
   ```

3. **Set Headers**:
   ```
   Content-Type: application/json
   ```

4. **Send Test Payload**:
   ```json
   {
     "luminanceAction__c": "generate_contract",
     "contract_type": "NDA",
     "hs_op_id": "test123",
     "matterId": "Test Deal",
     "upload": "Test notes",
     "signature": "HubSpot-1234567890",
     "request_origin": "HubSpot CRM Card"
   }
   ```

5. **Analyze Response**:
   - Look at the response body
   - Note the structure and field names
   - Save a copy of the response

### Option 2: Check Prismatic Logs

1. **Log into Prismatic**:
   - Go to your Prismatic dashboard
   - Navigate to your integration

2. **Find the Webhook Configuration**:
   - Look for the webhook trigger you're using
   - Check the "Test" or "Logs" section

3. **Run a Test Execution**:
   - Use Prismatic's test runner
   - Execute with sample data
   - View the response output

4. **Examine Response Structure**:
   - Note the exact field names
   - Identify where the contract URL is located
   - Check for any nested objects

### Option 3: Monitor Network Traffic in Browser

1. **Start Development Mode**:
   ```bash
   npm run dev
   ```

2. **Open Browser DevTools**:
   - Press F12
   - Go to "Network" tab
   - Filter by "Fetch/XHR"

3. **Generate a Test Contract**:
   - Open a deal in HubSpot
   - Fill out the contract form
   - Click "Generate Contract"

4. **Find the API Call**:
   - Look for POST request to Prismatic URL
   - Click on it
   - Go to "Response" tab
   - Copy the full response

### Option 4: Add Console Logging

Temporarily add logging to the CRM card:

**Edit ContractCard.jsx**:

```javascript
const response = await fetch(PRISMATIC_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const result = await response.json();

// ADD THIS LINE TO SEE THE RESPONSE
console.log('Prismatic Response:', JSON.stringify(result, null, 2));

// Continue with existing code...
```

Then check the browser console after generating a contract.

## Common Response Formats

### Format 1: Flat Structure
```json
{
  "contractUrl": "https://...",
  "contractId": "abc123",
  "status": "success",
  "message": "Contract generated successfully"
}
```

**Code Update**: (Already configured - no changes needed)

### Format 2: Nested Data Object
```json
{
  "success": true,
  "data": {
    "url": "https://...",
    "id": "abc123",
    "status": "generated"
  }
}
```

**Code Update**:
```javascript
const generatedContractUrl = result.data?.url;
const contractId = result.data?.id;
```

### Format 3: Result Object
```json
{
  "result": {
    "contract": {
      "url": "https://...",
      "contractId": "abc123"
    },
    "success": true
  }
}
```

**Code Update**:
```javascript
const generatedContractUrl = result.result?.contract?.url;
const contractId = result.result?.contract?.contractId;
```

### Format 4: Luminance API Style
```json
{
  "contract_url": "https://...",
  "contract_id": "abc123",
  "status": "created",
  "created_at": "2024-01-01T12:00:00Z"
}
```

**Code Update**:
```javascript
const generatedContractUrl = result.contract_url;
const contractId = result.contract_id;
```

## Updating the CRM Card

Once you know the actual response format, update this section in **ContractCard.jsx**:

### Current Code (lines ~158-162):
```javascript
const result = await response.json();

// Extract contract URL from response
// Note: Adjust these field names based on actual Prismatic response format
const generatedContractUrl = result.contractUrl || result.url || result.data?.url;
const contractId = result.contractId || result.id || result.data?.id;
```

### Replace With Your Actual Format:

**Example for nested data:**
```javascript
const result = await response.json();

// Extract contract URL from Prismatic response
const generatedContractUrl = result.data.url;  // Adjust based on actual response
const contractId = result.data.id;              // Adjust based on actual response
```

## Handling Different Response Scenarios

### Success Response

```javascript
if (!response.ok) {
  throw new Error(`API request failed: ${response.status}`);
}

const result = await response.json();

// Check for success indicator
if (result.success === false || result.error) {
  throw new Error(result.message || result.error || 'Contract generation failed');
}

const generatedContractUrl = result.contractUrl; // Adjust as needed
```

### Error Response

```javascript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  throw new Error(
    errorData.message ||
    errorData.error ||
    `API Error: ${response.status}`
  );
}
```

### Async/Polling Response

If Prismatic returns immediately but contract generation happens asynchronously:

```javascript
const result = await response.json();

if (result.status === 'pending') {
  // Contract is being generated
  // You might need to poll for status
  const contractId = result.id;

  // Show different message
  setSuccess(true);
  setMessage('Contract generation in progress...');

  // Optionally: implement polling
  // pollContractStatus(contractId);
}
```

## Testing Different Response Formats

### Create Test Responses

**Edit ContractCard.jsx** to add a test mode:

```javascript
// At the top of the file, add:
const TEST_MODE = false; // Set to true for testing

// In handleGenerateContract, replace the fetch with:
if (TEST_MODE) {
  // Simulate API response
  const result = {
    contractUrl: 'https://test.luminance.com/contract/test123',
    contractId: 'test123',
    status: 'success'
  };

  // Continue with success flow...
  setSuccess(true);
  setContractUrl(result.contractUrl);
  return;
}

// Normal API call...
const response = await fetch(PRISMATIC_WEBHOOK_URL, ...);
```

## Verification Checklist

After updating the response parsing:

- [ ] Test with real Prismatic integration
- [ ] Verify contract URL is extracted correctly
- [ ] Verify contract ID is captured
- [ ] Check that URL opens in Luminance correctly
- [ ] Verify deal properties update with correct values
- [ ] Test error scenarios
- [ ] Remove any console.log statements
- [ ] Remove test mode code

## Common Issues and Solutions

### Issue: "Contract URL not found in response"

**Cause**: Field name doesn't match what Prismatic returns

**Solution**:
1. Log the full response: `console.log('Full response:', result)`
2. Find the actual field name
3. Update the extraction code

### Issue: "Cannot read property 'url' of undefined"

**Cause**: Response structure is nested differently

**Solution**:
1. Check response structure
2. Use optional chaining: `result.data?.url`
3. Add null checks

### Issue: "URL is null or empty string"

**Cause**: Luminance contract may not be created yet

**Solution**:
1. Check if response indicates async processing
2. Implement status polling if needed
3. Show appropriate message to user

## Example: Complete Response Handling

Here's a robust example that handles multiple formats:

```javascript
const response = await fetch(PRISMATIC_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`API Error (${response.status}): ${errorText}`);
}

const result = await response.json();

// Log for debugging (remove in production)
console.log('Prismatic Response:', result);

// Try multiple possible field names
const generatedContractUrl =
  result.contractUrl ||           // Format 1
  result.contract_url ||          // Format 4
  result.url ||                   // Simple format
  result.data?.url ||             // Format 2
  result.data?.contractUrl ||     // Format 2 variant
  result.result?.contract?.url;   // Format 3

const contractId =
  result.contractId ||
  result.contract_id ||
  result.id ||
  result.data?.id ||
  result.data?.contractId ||
  result.result?.contract?.contractId;

// Validate we got a URL
if (!generatedContractUrl) {
  console.error('Could not extract contract URL from response:', result);
  throw new Error('Contract URL not found in API response');
}

// Continue with success flow...
```

## Need Help?

If you're still having trouble determining the response format:

1. **Share the Response**: Copy the full response and we can update the code together
2. **Check Prismatic Docs**: Look for documentation on your specific integration
3. **Contact Prismatic Support**: They can provide the exact response schema
4. **Test in Stages**: Use console.log at each step to narrow down the issue

## Quick Test Script

Create a test file to verify the webhook independently:

**test-webhook.js**:
```javascript
const fetch = require('node-fetch');

const WEBHOOK_URL = 'https://hooks.luminance-production-eu-central-1.prismatic.io/trigger/...';

const testPayload = {
  luminanceAction__c: 'generate_contract',
  contract_type: 'NDA',
  hs_op_id: 'test123',
  matterId: 'Test Deal',
  upload: 'Test notes',
  signature: `HubSpot-${Date.now()}`,
  request_origin: 'Test Script'
};

async function testWebhook() {
  try {
    console.log('Sending request...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    console.log('Status:', response.status);

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook();
```

Run with: `node test-webhook.js`
