# Integration Flow Diagram

## Current Flow (Before Modifications)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HubSpot CRM Card                         │
│  User clicks "Generate Contract in Luminance"                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ POST /trigger/...
                           │ Payload: { contract_type: "NDA", hs_op_id: "123", ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Flow 1: Routing Logic                        │
│  _1HubSpotLuminanceTrigger                                       │
│  • Receives webhook from HubSpot                                 │
│  • Splits payload and determines routing                         │
│  • Routes to appropriate flow (2a, 2b, 2c, or 2d)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Internal webhook call
                           │ Payload: { matterId: null, upload: false, ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Flow 2a: Contract Creation                          │
│  _2AContractCreationRequestFromHubSpot                           │
│  • Gets deal & company info from HubSpot                         │
│  • Creates matter in Luminance                                   │
│  • Uploads default file to matter                                │
│  • Adds matter tags/annotations                                  │
│  • Calls Flow 3 via webhook                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Internal webhook call
                           │ Payload: { matterId: "12345", ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│         Flow 3: Get Latest Version & Create Link                 │
│  _3GetLatestVersionofaSpecificMatter                             │
│  • Gets matter info from Luminance                               │
│  • Gets latest document version                                  │
│  • Creates document link ← THIS IS THE CONTRACT URL!             │
│  • Assigns users to matter                                       │
│  • Calls Flow 5 to update HubSpot                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Internal webhook call
                           │ Payload: { document_link: "https://...", ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│            Flow 5: Send Status Update to HubSpot                 │
│  _5SendStatusUpdateToHubSpot                                     │
│  • Updates HubSpot deal properties                               │
│  • Adds note with contract link (maybe)                          │
│  • Returns success                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Response (bubbles back up)
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Flow 1: Returns Result                       │
│  return { data: "2a. New Matter, Contract Gen" }                 │
│  ❌ This is just a string, not the contract URL!                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Response
                           │ { "data": "2a. New Matter, Contract Gen" }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     HubSpot CRM Card                             │
│  ❌ Receives string instead of contract URL                      │
│  ❌ Shows error: "Contract URL not found in response"            │
└─────────────────────────────────────────────────────────────────┘
```

## Modified Flow (After Prismatic Changes)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HubSpot CRM Card                         │
│  User clicks "Generate Contract in Luminance"                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ POST /trigger/...
                           │ Payload: { contract_type: "NDA", hs_op_id: "123", ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Flow 1: Routing Logic                        │
│  _1HubSpotLuminanceTrigger                                       │
│  • Receives webhook from HubSpot                                 │
│  • Splits payload and determines routing                         │
│  • Routes to appropriate flow (2a, 2b, 2c, or 2d)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Internal webhook call
                           │ Payload: { matterId: null, upload: false, ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Flow 2a: Contract Creation                          │
│  _2AContractCreationRequestFromHubSpot                           │
│  • Gets deal & company info from HubSpot                         │
│  • Creates matter in Luminance                                   │
│  • Uploads default file to matter                                │
│  • Adds matter tags/annotations                                  │
│  • Calls Flow 3 via webhook                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Internal webhook call
                           │ Payload: { matterId: "12345", ... }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│         Flow 3: Get Latest Version & Create Link                 │
│  _3GetLatestVersionofaSpecificMatter                             │
│  • Gets matter info from Luminance                               │
│  • Gets latest document version                                  │
│  • Creates document link ← THIS IS THE CONTRACT URL!             │
│  • Assigns users to matter                                       │
│  • Calls Flow 5 to update HubSpot                                │
│  ✅ NEW: Creates response object with contractUrl                │
│  ✅ NEW: return { data: { contractUrl, contractId, ... } }       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Response
                           │ { "data": { "contractUrl": "https://...", ... } }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Flow 2a: Passes Response Through                    │
│  ✅ NEW: Parses Flow 3 response                                  │
│  ✅ NEW: Returns contract data instead of storing it             │
│  return { data: flow3Response }                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Response
                           │ { "data": { "contractUrl": "https://...", ... } }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                Flow 1: Passes Response Through                   │
│  ✅ NEW: Parses Flow 2a response                                 │
│  ✅ NEW: Returns contract data to HubSpot                        │
│  return { data: flowResponse }                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Response
                           │ {
                           │   "data": {
                           │     "contractUrl": "https://luminance.com/doc/123",
                           │     "contractId": "12345",
                           │     "matterId": "12345",
                           │     "status": "success"
                           │   }
                           │ }
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     HubSpot CRM Card                             │
│  ✅ Receives contract URL                                        │
│  ✅ Extracts: result.data.contractUrl                            │
│  ✅ Updates deal properties                                      │
│  ✅ Shows "Contract Generated Successfully"                      │
│  ✅ Displays clickable link to Luminance                         │
│  ✅ User clicks link → Opens contract in Luminance               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Differences

### Before Modifications ❌

| Flow | Returns | Issue |
|------|---------|-------|
| Flow 3 | Sends to Flow 5, then returns Flow 5 result | Contract URL created but not returned |
| Flow 2a | `{ data: hmacResponse }` | Just stores the webhook response |
| Flow 1 | `{ data: "2a. New Matter, Contract Gen" }` | Returns routing message string |
| **HubSpot** | **Receives string** | **Cannot extract contract URL** |

### After Modifications ✅

| Flow | Returns | Result |
|------|---------|--------|
| Flow 3 | `{ data: { contractUrl, contractId, ... } }` | Contract data in response |
| Flow 2a | Parses and returns Flow 3 response | Passes contract data through |
| Flow 1 | Parses and returns Flow 2a response | Passes contract data to HubSpot |
| **HubSpot** | **Receives contract object** | **Extracts URL successfully** |

## Data Flow

### Current Payload Structure

**HubSpot → Flow 1:**
```json
{
  "luminanceAction__c": "generate_contract",
  "contract_type": "NDA",
  "hs_op_id": "123456",
  "matterId": "",
  "upload": "",
  "signature": "HubSpot-1234567890",
  "request_origin": "HubSpot CRM Card"
}
```

**Flow 1 → Flow 2a:**
```json
{
  "luminanceAction__c": "generate_contract",
  "contract_type": "NDA",
  "hs_op_id": "123456",
  "matterId": null,
  "upload": false,
  "signature": "HubSpot-1234567890",
  "request_origin": "HubSpot CRM Card"
}
```

**Flow 2a → Flow 3:**
```json
{
  "matterId": "12345",
  "hs_company_id": "789",
  "contract_status": "Draft Contract",
  "hs_deal_id": "123456",
  "sendContractToHubSpot": true,
  "contract_type": "NDA",
  "request_origin": "HubSpot CRM Card"
}
```

**Flow 3 → Flow 5:**
```json
{
  "document_link": "https://luminance.com/document/abc123",
  "assignee": "user@company.com",
  "contract_status": "Draft Contract",
  "hs_deal_id": "123456",
  "hs_company_id": "789",
  "matterId": "12345",
  "contract_type": "NDA",
  "request_origin": "HubSpot CRM Card"
}
```

### New Response Structure (After Modifications)

**Flow 3 → Flow 2a:**
```json
{
  "contractUrl": "https://luminance.com/document/abc123",
  "contractId": "12345",
  "matterId": "12345",
  "status": "success",
  "message": "Contract generated successfully"
}
```

**Flow 2a → Flow 1:**
```json
{
  "contractUrl": "https://luminance.com/document/abc123",
  "contractId": "12345",
  "matterId": "12345",
  "status": "success",
  "message": "Contract generated successfully"
}
```

**Flow 1 → HubSpot CRM Card:**
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

## Timing

| Phase | Time |
|-------|------|
| HubSpot → Flow 1 | < 1 second |
| Flow 1 → Flow 2a | < 1 second |
| Flow 2a creates matter | 2-5 seconds |
| Flow 2a → Flow 3 | < 1 second |
| Flow 3 gets version | 1-3 seconds |
| Flow 3 creates link | < 1 second |
| Flow 3 → Flow 5 | < 1 second |
| Flow 5 updates HubSpot | 1-2 seconds |
| Response back to CRM Card | < 1 second |
| **Total** | **5-15 seconds** |

## Error Paths

### Scenario 1: Matter Creation Fails
```
HubSpot → Flow 1 → Flow 2a → ❌ Error → Stops
Response: { error: "Failed to create matter", status: 500 }
```

### Scenario 2: File Upload Fails
```
HubSpot → Flow 1 → Flow 2a → ❌ Error at upload → Stops
Response: { error: "Failed to upload file", status: 500 }
```

### Scenario 3: Invalid Routing
```
HubSpot → Flow 1 → ❌ Invalid conditions → Stops
Response: { error: "Invalid branching", status: 400 }
```

## Success Indicators

When everything works:

1. ✅ **In Prismatic Logs**: All flows complete successfully
2. ✅ **In HubSpot**: Deal properties updated with contract URL
3. ✅ **In CRM Card**: "Contract Generated Successfully" message
4. ✅ **In Luminance**: New matter created with document
5. ✅ **User Experience**: Click link → Opens contract in Luminance

## Debug Checklist

If contract generation fails, check:

- [ ] Prismatic logs show all flows completing
- [ ] Flow 3 successfully creates document_link
- [ ] Flow 1 returns object (not string)
- [ ] HubSpot receives JSON object (not string)
- [ ] Contract URL is valid Luminance link
- [ ] Deal properties updated in HubSpot
- [ ] Browser console shows extracted values

---

**Visual Summary**: The contract URL is created in Flow 3, but currently gets lost on the way back to HubSpot. The modifications ensure it gets passed back up through the flow chain so the CRM card can display it.
