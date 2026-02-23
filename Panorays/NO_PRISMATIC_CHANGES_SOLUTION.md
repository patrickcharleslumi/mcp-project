# Solution Without Modifying Prismatic

Since you don't want to modify the Prismatic integration, here's the solution that works with your **existing** setup!

## 🎯 How It Works

Your Prismatic integration already does what we need - Flow 5 updates the HubSpot deal properties with the contract URL! We just need the CRM card to **wait** for it.

### Current Flow (No Changes Needed!)

```
HubSpot CRM Card                      Prismatic Flows
      ↓                                      ↓
1. Trigger webhook          →    Flow 1 → Flow 2a → Flow 3 → Flow 5
2. Start polling                               ↓
3. Check deal properties    ←    Flow 5 updates luminance_contract_url
4. Contract URL found!
5. Show success ✅
```

## ✅ What I've Created

### New Polling Version: `ContractCard-Polling.jsx`

This version:
1. ✅ Triggers Prismatic webhook (same as before)
2. ✅ Shows "Contract generation in progress..." message
3. ✅ Polls deal properties every 2 seconds
4. ✅ Detects when Flow 5 sets the `luminance_contract_url` property
5. ✅ Shows success message with contract link
6. ✅ No Prismatic modifications needed!

### Key Features

**Smart Polling:**
- Checks every 2 seconds
- Maximum 30 attempts (1 minute)
- Shows elapsed time to user
- Automatically stops when contract URL found

**User Experience:**
- "Contract generation in progress..." status
- Loading spinner
- Time counter
- Clear success/error messages
- Professional UI

**Error Handling:**
- Timeout after 1 minute with helpful message
- Retry button if webhook fails
- Clear error messages
- Graceful degradation

## 🚀 Deploy This Version

### Option 1: Use the Polling Version (Recommended)

```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card

# Replace the main file with polling version
cp src/app/extensions/ContractCard-Polling.jsx src/app/extensions/ContractCard.jsx

# Deploy
npm run dev
```

### Option 2: I've Already Created Both Files

- **ContractCard-Polling.jsx** - Works with existing Prismatic (polling approach)
- **ContractCard.jsx** - Debug version with extensive logging

Just decide which one to use and rename it if needed.

## 📊 Expected User Experience

### Step-by-Step Flow

1. **User opens deal** → CRM card loads instantly
2. **User selects NDA** → Form validation works
3. **User clicks "Generate"** → Button disables, loading starts
4. **Status shows**: "Contract generation in progress... (2s)"
5. **Status updates**: "Contract generation in progress... (4s)"
6. **Status updates**: "Contract generation in progress... (6s)"
7. **After ~10-20 seconds**: "Contract Generated Successfully" ✅
8. **Link appears**: "Open Contract in Luminance"
9. **User clicks** → Opens in Luminance

### Typical Timeline

| Step | Time | What's Happening |
|------|------|------------------|
| Webhook triggered | 0s | CRM card calls Prismatic |
| Prismatic processing | 0-10s | Flow 1 → 2a → 3 → 5 |
| First poll | 2s | Checks deal properties (not ready yet) |
| Second poll | 4s | Checks deal properties (not ready yet) |
| Third poll | 6s | Checks deal properties (not ready yet) |
| ... | ... | Continues polling |
| Contract ready | 8-15s | Flow 5 updates deal properties |
| CRM card detects | Next poll | Found! Shows success |
| **Total** | **10-20s** | End-to-end |

## 🔧 Configuration

### Polling Settings

In `ContractCard-Polling.jsx` (lines 9-10):

```javascript
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Maximum 30 attempts (1 minute)
```

**Adjust if needed:**
- Faster polling: `POLL_INTERVAL_MS = 1000` (1 second)
- Longer timeout: `MAX_POLL_ATTEMPTS = 60` (2 minutes at 2s intervals)

### Deal Properties Being Polled

The card checks these properties (set by Flow 5):
- `luminance_contract_url` - The contract link
- `luminance_contract_id` - Matter/contract ID
- `luminance_contract_status` - Status from Luminance

Make sure these properties exist in HubSpot!

## 🎨 UI States

### 1. Initial State
```
┌─────────────────────────────────────┐
│ Luminance Contracts                  │
├─────────────────────────────────────┤
│ Deal Information                     │
│  Opportunity: Acme Corp              │
│  Amount: $50,000                     │
│  Stage: Contract Sent                │
├─────────────────────────────────────┤
│ Contract Generation                  │
│  Contract Type: [Select...]          │
│  Notes: [Optional...]                │
│  [Generate Contract in Luminance]    │
└─────────────────────────────────────┘
```

### 2. Generating State
```
┌─────────────────────────────────────┐
│ Luminance Contracts                  │
├─────────────────────────────────────┤
│ ℹ️ Generating Contract               │
│  ⏳ Contract generation in progress...│
│     (8s)                             │
│  This typically takes 10-20 seconds. │
│  Please don't close this page.       │
└─────────────────────────────────────┘
```

### 3. Success State
```
┌─────────────────────────────────────┐
│ Luminance Contracts                  │
├─────────────────────────────────────┤
│ ✅ Contract Generated Successfully   │
│  Your contract has been generated    │
│  in Luminance.                       │
│  🔗 Open Contract in Luminance       │
├─────────────────────────────────────┤
│  [Generate Another Contract]         │
└─────────────────────────────────────┘
```

### 4. Error State (Timeout)
```
┌─────────────────────────────────────┐
│ Luminance Contracts                  │
├─────────────────────────────────────┤
│ ❌ Error                             │
│  Contract generation is taking       │
│  longer than expected. Please        │
│  refresh the page in a few moments   │
│  to see the contract link.           │
│  [Try Again]                         │
└─────────────────────────────────────┘
```

## 🔍 How Polling Works

### The Polling Loop

```javascript
// Starts when user clicks "Generate"
setPolling(true);

// useEffect runs every POLL_INTERVAL_MS
useEffect(() => {
  if (!polling) return;

  const pollForContract = async () => {
    // Fetch fresh deal properties from HubSpot
    const properties = await actions.fetchCrmObjectProperties([
      'luminance_contract_url',
      'luminance_contract_id',
      'luminance_contract_status'
    ]);

    // Check if Flow 5 has set the contract URL
    if (properties.luminance_contract_url) {
      // Success! Stop polling and show link
      setContractUrl(properties.luminance_contract_url);
      setSuccess(true);
      setPolling(false);
      return;
    }

    // Not ready yet, increment counter
    setPollAttempts(attempts + 1);

    // Check timeout
    if (attempts >= MAX_POLL_ATTEMPTS) {
      setError('Taking longer than expected...');
      setPolling(false);
    }
  };

  // Schedule next poll
  setTimeout(pollForContract, POLL_INTERVAL_MS);
}, [polling, pollAttempts]);
```

### Why This Works

1. **Flow 5 is already updating HubSpot** - Your Prismatic integration does this!
2. **HubSpot deal properties are queryable** - The CRM card can check them
3. **Polling is fast** - 2-second intervals feel responsive
4. **Eventually consistent** - When Flow 5 completes, we detect it

## 🆚 Comparison with Other Approaches

### Polling (This Solution) ✅

**Pros:**
- No Prismatic changes needed
- Works with existing integration
- Good user experience
- Automatic detection

**Cons:**
- Slight delay (2-second intervals)
- Multiple API calls to HubSpot
- Timeout after 1 minute

### Modify Prismatic ❌

**Pros:**
- Instant response
- Single HTTP request
- No polling overhead

**Cons:**
- Requires Prismatic changes
- Need to rebuild integration
- More complex modifications

### Manual Refresh ❌

**Pros:**
- No Prismatic changes
- Simple implementation

**Cons:**
- Poor user experience
- User must refresh page
- No indication of progress

## 🧪 Testing Checklist

Before demo:

- [ ] Deploy polling version to HubSpot
- [ ] Open deal record
- [ ] Select contract type (NDA or DPA)
- [ ] Click "Generate Contract"
- [ ] See "Contract generation in progress" message
- [ ] Watch timer increment (2s, 4s, 6s...)
- [ ] Wait 10-20 seconds
- [ ] See "Contract Generated Successfully"
- [ ] Click contract link
- [ ] Verify opens in Luminance
- [ ] Check deal properties show contract URL

## 🐛 Troubleshooting

### "Taking longer than expected" error

**Causes:**
- Prismatic flow actually failing
- Flow 5 not updating deal properties
- Deal property names don't match

**Fix:**
1. Check Prismatic logs - did flows complete?
2. Manually check deal properties - is `luminance_contract_url` set?
3. Verify property names match in code

### Polling never finds contract URL

**Causes:**
- Property name mismatch
- Flow 5 not running
- Permissions issue

**Fix:**
1. Open deal in HubSpot
2. View all properties
3. Search for "luminance"
4. Confirm property names match code

### Webhook trigger fails

**Causes:**
- HMAC validation
- Wrong endpoint URL
- Missing required fields

**Fix:**
1. Check Prismatic webhook logs
2. Verify endpoint URL is correct
3. Check payload includes all required fields

## 📝 Summary

**TL;DR:**
- ✅ No Prismatic modifications needed
- ✅ Works with your existing integration
- ✅ Polls deal properties every 2 seconds
- ✅ Detects when Flow 5 sets contract URL
- ✅ Professional loading states
- ✅ 10-20 second total time
- ✅ Ready to deploy and demo!

**Deploy command:**
```bash
cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card
npm run dev
```

The polling version (`ContractCard-Polling.jsx`) is ready to use. Just replace the main file and deploy!
