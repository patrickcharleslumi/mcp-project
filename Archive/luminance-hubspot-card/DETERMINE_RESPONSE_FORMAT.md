# How to Determine Prismatic Response Format

Since your Prismatic webhook uses HMAC signature validation, you can't test it with Postman. Here are the correct ways to determine the response format:

## Method 1: Test Through HubSpot (Recommended)

I've updated `ContractCard.jsx` with **DEBUG_MODE = true** which adds extensive logging.

### Steps:

1. **Deploy the CRM Card to HubSpot:**
   ```bash
   cd /Users/patrick.charles/luminance-hubspot-card
   npm run dev
   ```

2. **Open Browser DevTools:**
   - Press **F12** (or Cmd+Option+I on Mac)
   - Go to **Console** tab
   - Keep it open

3. **Generate a Test Contract:**
   - Navigate to a Deal in HubSpot
   - Find the "Luminance Contracts" card in right sidebar
   - Select a contract type (NDA or DPA)
   - Click "Generate Contract in Luminance"

4. **Check the Console Output:**

   You'll see detailed logs like this:

   ```
   === PRISMATIC REQUEST ===
   URL: https://hooks.luminance-production-eu-central-1...
   Payload: {...}

   === PRISMATIC RESPONSE STATUS ===
   Status: 200
   Status Text: OK

   === PRISMATIC RESPONSE (RAW TEXT) ===
   {"contractUrl":"https://...","contractId":"abc123"}

   === PRISMATIC RESPONSE (PARSED JSON) ===
   {
     "contractUrl": "https://luminance.com/contract/abc123",
     "contractId": "abc123",
     "status": "success"
   }

   === RESPONSE STRUCTURE ===
   Keys: ["contractUrl", "contractId", "status"]
   Type: object

   === EXTRACTED VALUES ===
   Contract URL: https://luminance.com/contract/abc123
   Contract ID: abc123
   ```

5. **Copy the Response Structure:**
   - Copy the "PARSED JSON" section
   - Save it to a file
   - Share it with me if you need help updating the code

6. **The CRM card will also show a debug box** with the response preview if DEBUG_MODE is enabled.

## Method 2: Check Prismatic Execution Logs

### Steps:

1. **Log into Prismatic Dashboard:**
   - Go to https://app.prismatic.io
   - Sign in with your credentials

2. **Navigate to Your Integration:**
   - Find the integration that contains this webhook
   - Click on it to open

3. **Find the Instance:**
   - Go to **Instances** or **Deployments**
   - Find the HubSpot-Luminance instance

4. **View Execution Logs:**
   - Click on the instance
   - Go to **Executions** or **Logs** tab
   - Look for recent executions

5. **Examine a Successful Execution:**
   - Click on a recent successful execution
   - Look for the "Response" or "Output" section
   - Find the step that returns data to HubSpot

6. **Copy the Response:**
   - The logs should show the exact JSON response
   - Copy the entire response structure

### What to Look For in Prismatic:

Look for steps like:
- "HTTP Response"
- "Return Response"
- "Webhook Response"
- "Output"

The response should be JSON format like:
```json
{
  "contractUrl": "...",
  "contractId": "...",
  ...
}
```

## Method 3: Ask Prismatic Support/Team

If you have access to the team that built the Prismatic integration:

1. Ask them: "What is the response format from the HubSpot webhook?"
2. Request the JSON schema for the response
3. Ask for an example response payload

## Method 4: Check Prismatic Integration Configuration

If you have edit access to the Prismatic integration:

1. **Open the Integration in Prismatic:**
   - Go to the integration builder
   - Find the webhook trigger component

2. **Look at the Response Configuration:**
   - Find the "HTTP Response" or final step
   - Check what fields it's configured to return

3. **Check Integration Tests:**
   - Prismatic might have test cases
   - These often show expected response formats

## Common Prismatic Response Formats

Based on typical Prismatic integrations, the response is likely one of these:

### Format A: Flat Structure (Most Common)
```json
{
  "contractUrl": "https://luminance.com/contract/abc123",
  "contractId": "abc123",
  "status": "success",
  "message": "Contract generated successfully"
}
```

### Format B: Nested in `data`
```json
{
  "success": true,
  "data": {
    "contractUrl": "https://luminance.com/contract/abc123",
    "contractId": "abc123"
  }
}
```

### Format C: Prismatic Standard Format
```json
{
  "result": {
    "contractUrl": "https://luminance.com/contract/abc123",
    "contractId": "abc123"
  },
  "executionId": "...",
  "timestamp": "..."
}
```

### Format D: Luminance API Passthrough
```json
{
  "contract": {
    "id": "abc123",
    "url": "https://luminance.com/contract/abc123",
    "status": "created",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

## What to Do After You Find the Format

Once you see the actual response in the console:

### If the Code Already Works:

Great! The flexible extraction logic I wrote handles multiple formats:

```javascript
const generatedContractUrl =
  result.contractUrl ||
  result.contract_url ||
  result.url ||
  result.data?.url ||
  result.data?.contractUrl ||
  result.data?.contract_url ||
  result.result?.contract?.url ||
  result.result?.url ||
  null;
```

If the contract generates successfully, **no changes needed**!

### If You Need to Update the Code:

1. **Find the exact field names** from the console output
2. **Edit ContractCard.jsx** around line 155-170
3. **Update the extraction logic**:

Example for nested format:
```javascript
// If response is: { "data": { "url": "...", "id": "..." } }
const generatedContractUrl = result.data.url;
const contractId = result.data.id;
```

Example for deeply nested:
```javascript
// If response is: { "contract": { "url": "...", "contractId": "..." } }
const generatedContractUrl = result.contract.url;
const contractId = result.contract.contractId;
```

4. **Save the file**
5. **Test again** - the dev server should auto-reload

## Turn Off Debug Mode for Production

Once you've confirmed the response format works:

1. **Edit ContractCard.jsx**
2. **Find line 15:**
   ```javascript
   const DEBUG_MODE = true;
   ```
3. **Change to:**
   ```javascript
   const DEBUG_MODE = false;
   ```
4. **Save and redeploy**

This will:
- Remove console logging
- Remove debug indicator
- Remove response preview box
- Make the card production-ready

## Troubleshooting

### "Contract URL not found in response"

**Meaning**: The flexible extraction didn't find the URL

**Solution**:
1. Look at console output: "=== PRISMATIC RESPONSE (PARSED JSON) ==="
2. Find where the URL is located
3. Update the extraction code with the exact path

### Response is Empty or Null

**Possible Causes**:
1. Prismatic integration failed
2. Luminance API error
3. Webhook timeout

**Check**:
- Prismatic execution logs for errors
- Network tab in DevTools for response
- Luminance API status

### Response is HTML Instead of JSON

**Meaning**: You're hitting an error page or redirect

**Check**:
- The webhook URL is correct
- Prismatic integration is deployed
- No authentication issues in Prismatic

## Expected Timeline

- **Method 1 (HubSpot test)**: 10-15 minutes
- **Method 2 (Prismatic logs)**: 5-10 minutes
- **Method 3 (Ask team)**: Depends on response time
- **Method 4 (Check config)**: 5 minutes

## Need Help?

After you run Method 1 and see the console output:

1. Copy the entire "=== PRISMATIC RESPONSE (PARSED JSON) ===" section
2. Share it with me
3. I'll tell you exactly what code changes (if any) are needed

The code is designed to handle most common formats automatically, so there's a good chance it will "just work" when you test it through HubSpot!

## Quick Checklist

Before testing:
- [ ] CRM card code updated with DEBUG_MODE = true
- [ ] npm run dev is running
- [ ] Browser DevTools Console tab is open
- [ ] Deal record is open in HubSpot
- [ ] Ready to click "Generate Contract"

During test:
- [ ] Watch Console for logs
- [ ] Note any errors
- [ ] Copy the response JSON
- [ ] Check if contract URL appears

After test:
- [ ] Save response format for documentation
- [ ] Verify contract link works
- [ ] Check deal properties updated
- [ ] Turn off DEBUG_MODE if successful
