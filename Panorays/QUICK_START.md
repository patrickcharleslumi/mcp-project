# Quick Start Guide

## You Can't Test with Postman? No Problem!

Your Prismatic webhook is secured with HMAC validation (this is GOOD security!), which means it only accepts requests from HubSpot. Here's how to proceed:

## Step 1: Create Custom Deal Properties (5 minutes)

Before you can test, create these in HubSpot:

**Settings → Properties → Deal Properties → Create property**

1. **luminance_contract_url** (Single-line text)
2. **luminance_contract_id** (Single-line text)
3. **luminance_contract_status** (Single-line text)
4. **luminance_last_generated** (Single-line text)

## Step 2: Deploy and Test (10 minutes)

```bash
# Navigate to project
cd /Users/patrick.charles/luminance-hubspot-card

# Install HubSpot CLI (if not already installed)
npm install -g @hubspot/cli

# Authenticate with HubSpot
hs auth

# Install dependencies
npm install

# Start development (this will upload to HubSpot)
npm run dev
```

## Step 3: Test in HubSpot (5 minutes)

1. **Open Browser DevTools**: Press F12 (Cmd+Option+I on Mac)
2. **Go to Console tab**: Keep it open
3. **Navigate to a Deal** in HubSpot
4. **Find "Luminance Contracts" card** in right sidebar
5. **Select NDA or DPA**
6. **Click "Generate Contract"**
7. **Watch the Console** - you'll see detailed logs

## What You'll See in the Console

```
=== PRISMATIC REQUEST ===
[Your request payload]

=== PRISMATIC RESPONSE (PARSED JSON) ===
{
  "contractUrl": "https://...",
  "contractId": "abc123"
}

=== EXTRACTED VALUES ===
Contract URL: https://...
Contract ID: abc123
```

## If It Works (Most Likely)

✅ You'll see "Contract Generated Successfully"
✅ A link to open in Luminance
✅ Deal properties will update
✅ **Done! Turn off DEBUG_MODE and you're ready to demo**

To turn off debug mode:
1. Edit `src/app/extensions/ContractCard.jsx`
2. Change line 15: `const DEBUG_MODE = false;`
3. Save (dev server will auto-reload)

## If Contract URL Not Found

The code tries these formats automatically:
- `result.contractUrl`
- `result.url`
- `result.data.url`
- `result.data.contractUrl`
- And more...

If none work:
1. Copy the "PARSED JSON" from console
2. Share with me
3. I'll tell you the exact code change needed (usually just 1-2 lines)

## Alternative: Check Prismatic Logs

If you don't want to test through HubSpot first:

1. **Log into Prismatic** (app.prismatic.io)
2. **Find your integration**
3. **Go to Executions/Logs**
4. **Look for a recent successful execution**
5. **Find the Response/Output section**
6. **Copy the JSON response**

Then update the code if needed.

## Debug Features I Added

The updated CRM card now has:

✅ **Extensive console logging** - See every request/response
✅ **Response preview box** - See response directly in the card
✅ **Flexible extraction** - Handles 8+ different response formats
✅ **Clear error messages** - Know exactly what went wrong
✅ **Debug mode indicator** - See when debugging is active

## Common Response Formats (Already Handled!)

The code automatically handles:

**Format 1:** `{ "contractUrl": "..." }`
**Format 2:** `{ "url": "..." }`
**Format 3:** `{ "data": { "url": "..." } }`
**Format 4:** `{ "result": { "url": "..." } }`
**And more...**

So there's a good chance it will "just work"!

## Timeline

- **Create properties**: 5 minutes
- **Setup & deploy**: 10 minutes
- **Test**: 5 minutes
- **Turn off debug mode**: 1 minute
- **Total**: ~20 minutes to working integration

## Files Updated

✅ **ContractCard.jsx** - Added DEBUG_MODE with extensive logging
✅ **DETERMINE_RESPONSE_FORMAT.md** - Detailed guide for finding response format

## Next Steps

1. ✅ Create the 4 custom deal properties in HubSpot
2. ✅ Run `npm run dev` from the project directory
3. ✅ Open DevTools Console (F12)
4. ✅ Test in HubSpot Deal record
5. ✅ Check console for response format
6. ✅ If it works, turn off DEBUG_MODE
7. ✅ If not, share console output and I'll help

## Questions?

See **DETERMINE_RESPONSE_FORMAT.md** for detailed instructions on:
- Reading Prismatic logs
- Understanding response formats
- Updating extraction code
- Troubleshooting common issues

---

**You're almost there! The security validation is actually a good sign - your integration is properly secured. Just test through HubSpot and you'll see the response format.** 🚀
