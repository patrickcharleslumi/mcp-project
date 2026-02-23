# START HERE - Quick Decision Guide

## 🎯 You Have Two Versions of the CRM Card

Since you **don't want to modify Prismatic**, use the **Polling Version**.

## 📦 Files in This Project

### CRM Card Files (choose one)

| File | What It Does | Use When |
|------|--------------|----------|
| **ContractCard-Polling.jsx** | ✅ **USE THIS** - Works with existing Prismatic, polls for contract URL | You don't want to change Prismatic |
| ContractCard.jsx | Debug version with extensive logging | You want to see what Prismatic returns |

### Documentation Files

| File | Purpose |
|------|---------|
| **NO_PRISMATIC_CHANGES_SOLUTION.md** | ✅ **READ THIS** - Complete guide for polling approach |
| START_HERE.md | This file - quick decision guide |
| ACTION_PLAN.md | Original plan (assumes Prismatic modifications) |
| PRISMATIC_MODIFICATIONS.md | How to modify Prismatic (not needed for you) |
| FLOW_DIAGRAM.md | Visual flow diagrams |
| SETUP.md | Initial setup instructions |
| QUICK_START.md | Quick start guide |
| README.md | Main documentation |

## 🚀 Quick Deploy (3 Steps)

### Step 1: Use the Polling Version

The file is ready! Just deploy it:

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card

# If not already authenticated
hs auth

# Start development
npm run dev
```

**Note:** The file is named `ContractCard-Polling.jsx`. HubSpot will look for `ContractCard.jsx` based on `extensions.json`. You need to either:

**Option A:** Rename the file:
```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card/src/app/extensions
mv ContractCard.jsx ContractCard-Debug-Backup.jsx
mv ContractCard-Polling.jsx ContractCard.jsx
```

**Option B:** Update `extensions.json` to point to the polling version (see below).

### Step 2: Update Configuration (if using Option B)

Edit `public/extensions.json` and change:

```json
{
  "crm": {
    "cards": [
      {
        "type": "crm-card",
        "data": {
          "title": "Luminance Contracts",
          "location": "crm.record.deal.right",
          "module": {
            "file": "extensions/ContractCard-Polling.jsx"
          }
        },
        "scopes": [
          "crm.objects.deals.read",
          "crm.objects.deals.write"
        ]
      }
    ]
  }
}
```

### Step 3: Test in HubSpot

1. Open any Deal record in HubSpot
2. Look for "Luminance Contracts" card in right sidebar
3. Select contract type (NDA or DPA)
4. Click "Generate Contract in Luminance"
5. Watch the status: "Contract generation in progress... (2s, 4s, 6s...)"
6. After 10-20 seconds: "Contract Generated Successfully!"
7. Click the link to open in Luminance

## 🎯 What to Expect

### Timeline

| Time | What You See |
|------|--------------|
| 0s | Click "Generate Contract" |
| 0-2s | "Initializing contract generation..." |
| 2s | "Contract generation in progress... (2s)" |
| 4s | "Contract generation in progress... (4s)" |
| 6s | "Contract generation in progress... (6s)" |
| ... | Counter keeps going up |
| 10-20s | "Contract Generated Successfully!" |

### What's Happening Behind the Scenes

```
You click "Generate"
    ↓
CRM card calls Prismatic webhook
    ↓
Prismatic starts: Flow 1 → 2a → 3 → 5
    ↓
CRM card polls deal properties every 2 seconds
    ↓
Poll 1 (2s): Not ready yet...
Poll 2 (4s): Not ready yet...
Poll 3 (6s): Not ready yet...
...
    ↓
Flow 5 completes, updates deal property
    ↓
Next poll: Contract URL found! ✅
    ↓
Shows "Contract Generated Successfully"
```

## ✅ Why This Works Without Prismatic Changes

Your Prismatic integration **already does this**:
1. ✅ Flow 1 receives webhook from HubSpot
2. ✅ Flow 2a creates matter in Luminance
3. ✅ Flow 3 creates document link
4. ✅ **Flow 5 updates HubSpot deal properties with contract URL**

We just need the CRM card to **wait and check** for when Flow 5 sets that property!

## 🔧 Adjust Polling Settings (Optional)

If you want faster or slower polling, edit `ContractCard-Polling.jsx` lines 9-10:

```javascript
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Give up after 60 seconds (30 x 2s)
```

**Faster polling:**
```javascript
const POLL_INTERVAL_MS = 1000; // Check every 1 second
const MAX_POLL_ATTEMPTS = 60; // Give up after 60 seconds (60 x 1s)
```

**Longer timeout:**
```javascript
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const MAX_POLL_ATTEMPTS = 60; // Give up after 120 seconds (60 x 2s)
```

## ❓ FAQ

### Q: Will this work without changing Prismatic?
**A:** Yes! That's the whole point of this approach.

### Q: How long does it take?
**A:** Typically 10-20 seconds end-to-end. The polling just checks every 2 seconds until ready.

### Q: What if it times out?
**A:** After 1 minute, it shows a message asking the user to refresh. The contract is still being generated in the background.

### Q: Does this use more API calls?
**A:** Yes, it polls HubSpot every 2 seconds. Typical usage: 5-10 API calls per contract generation. This is acceptable for HubSpot's rate limits.

### Q: Can I see what Prismatic returns?
**A:** Yes! Use the debug version (`ContractCard.jsx`) with `DEBUG_MODE = true` to see full console logs.

### Q: What if I want to modify Prismatic later?
**A:** See `PRISMATIC_MODIFICATIONS.md` for exact code changes needed. You can switch to the synchronous approach later if desired.

## 🐛 If Something Goes Wrong

### Console Shows Error
1. Open browser DevTools (F12)
2. Check Console tab
3. Look for error messages
4. Share the full error with me

### Contract Never Appears
1. Check Prismatic logs - did flows complete?
2. Open the deal in HubSpot
3. Click "View all properties"
4. Search for "luminance_contract_url"
5. Is it populated?

### "Taking Longer Than Expected" Message
- This is normal if Prismatic is slow
- Just click "Try Again" or refresh the page
- Contract will appear when Flow 5 completes

## 📞 Need Help?

After testing, share:
1. What happens when you click "Generate Contract"
2. What status messages you see
3. How long it takes
4. Whether the contract link appears
5. Any errors in the console

## 🎬 Deploy Command (Copy This!)

```bash
# Navigate to project
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card

# Rename files to use polling version
cd src/app/extensions
mv ContractCard.jsx ContractCard-Debug.jsx
mv ContractCard-Polling.jsx ContractCard.jsx
cd ../../..

# Deploy to HubSpot
npm run dev
```

That's it! Your CRM card will work with the existing Prismatic integration. No modifications needed! 🎉
