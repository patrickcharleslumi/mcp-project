# Action Plan: What You Need to Do

Based on analyzing your Prismatic integration code, here's what needs to happen:

## 🔍 The Issue

Your Prismatic integration **currently returns this** to the HubSpot CRM card:

```json
{
  "data": "2a. New Matter, Contract Gen"
}
```

The CRM card **needs this**:

```json
{
  "data": {
    "contractUrl": "https://luminance.com/document/abc123",
    "contractId": "12345",
    "matterId": "12345",
    "status": "success"
  }
}
```

## ✅ What I've Done

### 1. Updated CRM Card Code

✅ Added smart detection for current Prismatic response format
✅ Added helpful error messages that explain the issue
✅ Made extraction work with both current AND modified Prismatic format
✅ Enhanced debug logging to show exactly what's being returned

### 2. Created Modification Guide

✅ **PRISMATIC_MODIFICATIONS.md** - Detailed instructions for modifying your Prismatic flows

## 🎯 Your Next Steps

### Immediate Testing (5 minutes)

Test the current setup to confirm the issue:

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card

# If not already authenticated
hs auth

# If not already installed
npm install

# Start dev server
npm run dev
```

**What you'll see**:
1. Browser console will show Prismatic response
2. Error message: `Prismatic integration needs modification. Currently returns: "2a. New Matter, Contract Gen"`
3. This confirms the diagnosis is correct

### Fix the Integration (30-60 minutes)

Follow **PRISMATIC_MODIFICATIONS.md** to modify 3 flows:

1. **Flow 3** (`_3GetLatestVersionofaSpecificMatter.ts`)
   - Change return to include `contractUrl` and `contractId`
   - ~10 lines of code changes

2. **Flow 2a** (`_2AContractCreationRequestFromHubSpot.ts`)
   - Pass through Flow 3's response instead of storing it
   - ~5 lines of code changes

3. **Flow 1** (`_1HubSpotLuminanceTrigger.ts`)
   - Return actual contract data instead of routing message
   - ~30 lines of code changes (mostly conditional branches)

### Test Again (5 minutes)

After deploying Prismatic changes:

1. Refresh HubSpot page
2. Generate a contract
3. Check console - should now show:
   ```
   === EXTRACTED VALUES ===
   Contract URL: https://luminance.com/document/abc123
   Contract ID: 12345
   ```
4. Should see "Contract Generated Successfully" with working link

### Turn Off Debug Mode (1 minute)

Once working:

1. Edit `ContractCard.jsx`
2. Line 15: Change `const DEBUG_MODE = true;` to `false`
3. Save and test

## 📊 Timeline Estimate

| Task | Time | Status |
|------|------|--------|
| Test current setup | 5 min | ⏳ Next |
| Modify Prismatic Flow 3 | 10 min | 📋 Planned |
| Modify Prismatic Flow 2a | 5 min | 📋 Planned |
| Modify Prismatic Flow 1 | 15 min | 📋 Planned |
| Deploy Prismatic changes | 5 min | 📋 Planned |
| Test integration | 5 min | 📋 Planned |
| Turn off debug mode | 1 min | 📋 Planned |
| **Total** | **~45 min** | |

## 🚦 Decision Points

### Can you modify Prismatic flows?

**YES** → Follow PRISMATIC_MODIFICATIONS.md (recommended)
**NO** → See "Alternative Solutions" below

### Do you have Prismatic edit access?

**YES** → Great! Proceed with modifications
**NO** → Contact the person who built the Prismatic integration

## 🔄 Alternative Solutions

If you **cannot modify Prismatic**:

### Option A: Async/Polling Approach

Make the CRM card:
1. Call the webhook (triggers contract generation)
2. Show "Generating..." message
3. Poll HubSpot deal properties every 2 seconds
4. When `luminance_contract_url` property appears, show success

**Pros**: No Prismatic changes needed
**Cons**: Slower user experience, more complex code

### Option B: Use Flow 5 Webhook

If Flow 5 already updates HubSpot with the contract URL:
1. Change CRM card to just trigger Flow 1
2. Show "Contract generation started"
3. Tell user to refresh page to see contract link
4. Contract URL appears when Flow 5 completes

**Pros**: Minimal changes
**Cons**: User must refresh page manually

### Option C: Webhook Notifications

Add a HubSpot webhook that Flow 5 can call:
1. CRM card triggers contract generation
2. Shows "Generating..." with loading state
3. Flow 5 sends webhook to HubSpot when complete
4. CRM card listens for webhook and updates UI

**Pros**: Best user experience
**Cons**: Most complex, requires additional HubSpot setup

## 📞 Need Help?

After testing, share:
1. Console output (full "PRISMATIC RESPONSE" section)
2. Any error messages
3. Whether you can modify Prismatic flows

I can then provide specific next steps!

## 📁 Key Files

| File | Purpose |
|------|---------|
| **ContractCard.jsx** | HubSpot CRM card (already updated) |
| **PRISMATIC_MODIFICATIONS.md** | Step-by-step Prismatic changes |
| **ACTION_PLAN.md** | This file - your roadmap |
| **QUICK_START.md** | Original quick start guide |

## 🎬 Quick Start Command

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card && npm run dev
```

Open DevTools Console (F12), generate a contract, and check the logs!

---

**Bottom Line**: Your CRM card code is ready. The Prismatic integration just needs to return the contract URL instead of a routing message. The modifications are straightforward - about 30-50 lines across 3 files.
