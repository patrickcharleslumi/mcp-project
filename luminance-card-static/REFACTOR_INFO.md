# Card Refactor Documentation

## What Changed

### Old Architecture (Using External Fetch)
```
Card → hubspot.fetch() → Vercel Middleware → HubSpot API → Update Deal
                                                ↓
                                          Workflow Triggers
```

**Problem:** HubSpot's proxy blocks external fetch calls for marketplace OAuth apps (400 error)

### New Architecture (Direct Property Updates)
```
Card → actions.updateCrmObjectProperties() → Update Deal Properties
                                                ↓
                                          Workflow Detects Change
                                                ↓
                                          Workflow → Vercel/Prismatic
                                                ↓
                                          Prismatic Updates Deal with Contract URL
                                                ↓
                                          Card Polls for Contract URL
```

**Benefits:**
- ✅ No external fetch required from card
- ✅ Card only uses HubSpot SDK (no proxy restrictions)
- ✅ Cleaner separation of concerns
- ✅ More reliable for marketplace apps

## Files Backed Up

- `ContractCardV2.jsx.backup` - Original implementation
- `app-hsmeta.json.backup` - Original app config
- `ContractCardV2-refactored.jsx` - New implementation

## How to Revert

If you need to go back to the original version:

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-card-static/src/app/cards

# Revert the card
cp ContractCardV2.jsx.backup ContractCardV2.jsx

# Revert app config
cd ../
cp app-hsmeta.json.backup app-hsmeta.json

# Upload to HubSpot
hs project upload
```

## How to Apply Refactor

To use the new refactored version:

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-card-static/src/app/cards

# Apply the refactored card
cp ContractCardV2-refactored.jsx ContractCardV2.jsx

# Upload to HubSpot
hs project upload

# Reinstall app in test portal
```

## What the Refactored Card Does

1. **User clicks "Generate Contract"**
   - Card calls `actions.updateCrmObjectProperties()` to set:
     - `luminance_trigger_action`: "generate"
     - `luminance_contract_type`: "NDA"
     - `luminance_trigger_timestamp`: Current timestamp
     - `luminance_contract_status`: "processing"

2. **HubSpot Workflow triggers** (detects `luminance_trigger_timestamp` change)
   - Workflow calls Vercel middleware OR Prismatic directly
   - Passes deal properties to integration

3. **Prismatic generates contract**
   - Calls Luminance API
   - Updates deal properties with:
     - `luminance_contract_url`: URL to contract
     - `luminance_contract_id`: Contract/matter ID
     - `luminance_contract_status`: "generated"

4. **Card polls for contract URL**
   - Checks `luminance_contract_url` every 2 seconds
   - Shows success when URL appears
   - Times out after 60 seconds if not found

## Middleware Changes Needed

The Vercel middleware is NO LONGER called by the card, so you have two options:

### Option A: Keep Middleware for Workflow
- Workflow calls middleware
- Middleware updates deal properties
- Workflow then calls Prismatic

### Option B: Direct Workflow → Prismatic
- Remove middleware entirely
- Workflow calls Prismatic directly
- Prismatic updates deal properties

Both work! The card doesn't care how the contract URL gets set.

## Testing the Refactored Version

1. Upload the refactored card to HubSpot
2. Reinstall app in test portal
3. Create/open a deal with required fields (dealname, amount)
4. Open the Luminance Contracts card
5. Select action type and contract type
6. Click "Generate Contract"
7. Watch console logs for property updates
8. Card should poll and show success when contract URL appears

## Key Differences

| Aspect | Old Version | New Version |
|--------|-------------|-------------|
| External fetch | Required | Not required |
| permittedUrls | Needed middleware URL | Only needs api.hubapi.com |
| Dependencies | Vercel middleware must be up | Only needs workflow + Prismatic |
| Error handling | Network errors from fetch | Only HubSpot SDK errors |
| Architecture | Card → Middleware → Deal | Card → Deal → Workflow |
