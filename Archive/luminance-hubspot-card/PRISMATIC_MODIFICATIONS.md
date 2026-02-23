# Prismatic Integration Modifications for Synchronous Response

## Problem

Currently, the Prismatic integration returns a routing message (e.g., "2a. New Matter, Contract Gen") instead of the contract URL that the HubSpot CRM card needs.

## Current Flow

```
HubSpot CRM Card → Flow 1 → Flow 2a → Flow 3 → Flow 5
                     ↓
                Returns: { data: "2a. New Matter, Contract Gen" }
```

Flow 3 creates the document link but doesn't return it back up the chain.

## Solution: Modify Flow Returns

### Change 1: Flow 3 - Return Document Link

**File**: `_3GetLatestVersionofaSpecificMatter.ts`

**Current** (line ~140):
```typescript
const sendStatusUpdateWithAssignee =
  await context.components.luminanceApi.postPrismaticWebhook({
    contentType: "application/json",
    debug: false,
    hmacAlgorithm: "sha256",
    hmacHeaderName: "x-hmac-hash",
    payload: addAssigneeToUpdateObject.data,
    secretKey: configVars["Luminance HMAC"],
    webhookUrl:
      params.onTrigger.results.webhookUrls["5SendStatusUpdateTOHubSpot"],
  });
return { data: sendStatusUpdateWithAssignee };
```

**Change to**:
```typescript
const sendStatusUpdateWithAssignee =
  await context.components.luminanceApi.postPrismaticWebhook({
    contentType: "application/json",
    debug: false,
    hmacAlgorithm: "sha256",
    hmacHeaderName: "x-hmac-hash",
    payload: addAssigneeToUpdateObject.data,
    secretKey: configVars["Luminance HMAC"],
    webhookUrl:
      params.onTrigger.results.webhookUrls["5SendStatusUpdateTOHubSpot"],
  });

// Create response object with contract URL for HubSpot
const responseForHubSpot = await context.components.collectionTools.createObject({
  keyValueInput: {
    contractUrl: createDocumentLink.data,
    contractId: params.onTrigger.results.body.data.matterId,
    matterId: params.onTrigger.results.body.data.matterId,
    status: "success",
    message: "Contract generated successfully"
  },
});

return { data: responseForHubSpot.data };
```

### Change 2: Flow 2a - Pass Through Response

**File**: `_2AContractCreationRequestFromHubSpot.ts`

**Current** (line ~180):
```typescript
const repointToGetVersionOfASpecificMatterFlow =
  await context.components.luminanceApi.postPrismaticWebhook({
    contentType: "application/json",
    debug: false,
    hmacAlgorithm: "sha256",
    hmacHeaderName: "x-hmac-hash",
    payload: matteridObject.data,
    secretKey: configVars["Luminance HMAC"],
    webhookUrl:
      params.onTrigger.results.webhookUrls[
        "3GetLatestVersionofaSpecificMatter"
      ],
  });
return { data: repointToGetVersionOfASpecificMatterFlow };
```

**Change to**:
```typescript
const repointToGetVersionOfASpecificMatterFlow =
  await context.components.luminanceApi.postPrismaticWebhook({
    contentType: "application/json",
    debug: false,
    hmacAlgorithm: "sha256",
    hmacHeaderName: "x-hmac-hash",
    payload: matteridObject.data,
    secretKey: configVars["Luminance HMAC"],
    webhookUrl:
      params.onTrigger.results.webhookUrls[
        "3GetLatestVersionofaSpecificMatter"
      ],
  });

// Parse the response from Flow 3
const flow3Response = JSON.parse(repointToGetVersionOfASpecificMatterFlow.data);

// Return the contract information from Flow 3
return { data: flow3Response };
```

### Change 3: Flow 1 - Pass Through Response

**File**: `_1HubSpotLuminanceTrigger.ts`

**Current** (end of conditionals, ~line 80):
```typescript
if (/* conditions */) {
  const hmacToContractGeneration =
    await context.components.luminanceApi.postPrismaticWebhook({
      contentType: "application/json",
      debug: false,
      hmacAlgorithm: "sha256",
      hmacHeaderName: "x-hmac-hash",
      payload: aLuminanceTransactionAsObject.data,
      secretKey: configVars["Luminance HMAC"],
      webhookUrl:
        triggerluminanceWebhook.data.webhookUrls[
          "2aContractCreationRequestFROMHubSpot"
        ],
    });
  selectTheCorrectFlow = "2a. New Matter, Contract Gen";
}
// ... other conditions

return { data: selectTheCorrectFlow };
```

**Change to**:
```typescript
let flowResponse: any;

if (
  evaluatesNull(aLuminanceTransactionAsObject.data.matterId) &&
  evaluatesFalse(aLuminanceTransactionAsObject.data.upload)
) {
  const hmacToContractGeneration =
    await context.components.luminanceApi.postPrismaticWebhook({
      contentType: "application/json",
      debug: false,
      hmacAlgorithm: "sha256",
      hmacHeaderName: "x-hmac-hash",
      payload: aLuminanceTransactionAsObject.data,
      secretKey: configVars["Luminance HMAC"],
      webhookUrl:
        triggerluminanceWebhook.data.webhookUrls[
          "2aContractCreationRequestFROMHubSpot"
        ],
    });
  selectTheCorrectFlow = "2a. New Matter, Contract Gen";
  flowResponse = JSON.parse(hmacToContractGeneration.data);
} else if (
  evaluatesNull(aLuminanceTransactionAsObject.data.matterId) &&
  evaluatesTrue(aLuminanceTransactionAsObject.data.upload)
) {
  const hmacNewMatterWithExistingContract =
    await context.components.luminanceApi.postPrismaticWebhook({
      contentType: "application/json",
      debug: false,
      hmacAlgorithm: "sha256",
      hmacHeaderName: "x-hmac-hash",
      payload: aLuminanceTransactionAsObject.data,
      secretKey: configVars["Luminance HMAC"],
      webhookUrl:
        triggerluminanceWebhook.data.webhookUrls[
          "2bMatterCreationwithExistingContractFROMHubSpot"
        ],
    });
  selectTheCorrectFlow = "2b. New Matter, Existing Contract";
  flowResponse = JSON.parse(hmacNewMatterWithExistingContract.data);
} else if (
  !evaluatesNull(aLuminanceTransactionAsObject.data.matterId) &&
  evaluatesTrue(aLuminanceTransactionAsObject.data.upload)
) {
  const hmacExistingMatterExistingContract =
    await context.components.luminanceApi.postPrismaticWebhook({
      contentType: "application/json",
      debug: false,
      hmacAlgorithm: "sha256",
      hmacHeaderName: "x-hmac-hash",
      payload: aLuminanceTransactionAsObject.data,
      secretKey: configVars["Luminance HMAC"],
      webhookUrl:
        triggerluminanceWebhook.data.webhookUrls[
          "2cSendExistingContracttoExistingMatter"
        ],
    });
  selectTheCorrectFlow = "2c. Existing Matter, Existing Contract";
  flowResponse = JSON.parse(hmacExistingMatterExistingContract.data);
} else if (
  !evaluatesNull(aLuminanceTransactionAsObject.data.matterId) &&
  evaluatesFalse(aLuminanceTransactionAsObject.data.upload)
) {
  const hmacExistingMatterGoToNext =
    await context.components.luminanceApi.postPrismaticWebhook({
      contentType: "application/json",
      debug: false,
      hmacAlgorithm: "sha256",
      hmacHeaderName: "x-hmac-hash",
      payload: aLuminanceTransactionAsObject.data,
      secretKey: configVars["Luminance HMAC"],
      webhookUrl:
        triggerluminanceWebhook.data.webhookUrls[
          "2dSendNextStepOnlytoExistingMatter"
        ],
    });
  selectTheCorrectFlow = "Existing Matter, Just Move to Next Step";
  flowResponse = JSON.parse(hmacExistingMatterGoToNext.data);
} else {
  const invalidBranching =
    await context.components.stopExecution.stopExecution({
      contentType: "application/json",
      headers: [],
      jsonBody: "Invalid Branching. Check Luminance Transaction payload",
      statusCode: "400",
    });
  selectTheCorrectFlow = "Else";
  flowResponse = { error: "Invalid branching" };
}

// Return the actual contract response instead of just the flow name
return { data: flowResponse };
```

## After These Changes

The webhook will return:
```json
{
  "data": {
    "contractUrl": "https://luminance.com/document/abc123",
    "contractId": "12345",
    "matterId": "12345",
    "status": "success",
    "message": "Contract generated successfully"
  }
}
```

## HubSpot CRM Card Code Update

After making these Prismatic changes, update the CRM card extraction:

**File**: `ContractCard.jsx` (line ~160)

```javascript
const result = await response.json();

// With the Prismatic changes, response is now flat
const generatedContractUrl = result.data?.contractUrl || result.contractUrl;
const contractId = result.data?.contractId || result.contractId;
```

## Testing the Changes

1. **Deploy Prismatic changes** to your integration
2. **Test with the HubSpot CRM card** (with DEBUG_MODE = true)
3. **Check console** - you should now see:
   ```
   === PRISMATIC RESPONSE (PARSED JSON) ===
   {
     "data": {
       "contractUrl": "https://...",
       "contractId": "12345",
       ...
     }
   }
   ```

## Rollback Plan

If these changes cause issues:
1. Revert each flow file to original
2. Deploy reverted version
3. Use Option 2 or 3 below instead

---

# Alternative Solutions (If You Can't Modify Prismatic)

## Option 2: Use Polling in CRM Card

Make the CRM card call the webhook, then poll for completion.

## Option 3: Use a Different Endpoint

Call Flow 3 or Flow 5 directly from the CRM card if you already have a matterId.
