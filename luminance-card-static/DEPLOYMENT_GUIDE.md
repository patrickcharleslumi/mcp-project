# Luminance HubSpot Integration - Deployment Guide

## Overview

This guide walks through deploying the Luminance HubSpot integration as a marketplace app with external middleware.

## Architecture

```
Customer HubSpot → Middleware (Vercel) → HubSpot API (update deal) → Workflow → Prismatic
     CRM Card          OAuth Auth             Deal Properties          Webhook
```

---

## Part 1: Deploy Middleware to Vercel

### Prerequisites
- Vercel account (sign up at https://vercel.com - free tier works)
- Node.js installed locally (for testing)

### Steps

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to middleware directory:**
   ```bash
   cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-middleware
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Login to Vercel:**
   ```bash
   vercel login
   ```
   - Follow the browser authentication flow

5. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```
   - Vercel will ask: "Set up and deploy?" → Yes
   - Project name → Accept default or enter custom name
   - Wait for deployment (~30 seconds)

6. **Note your deployment URL:**
   - Example: `https://luminance-hubspot-middleware.vercel.app`
   - **Your API endpoint:** `https://YOUR-DOMAIN.vercel.app/api/trigger`

7. **Test the endpoint:**
   ```bash
   curl https://YOUR-DOMAIN.vercel.app/api/trigger
   ```
   - Should return: Method not allowed (expected, since it requires POST)

---

## Part 2: Update HubSpot App Configuration

### Update URLs in Code

1. **Update app-hsmeta.json:**
   ```bash
   cd /Users/patrick.charles/Documents/Paddy/luminance-card-static
   ```

   Edit `src/app/app-hsmeta.json`:
   - Replace `https://YOUR-APP-NAME.vercel.app` with your actual Vercel URL
   - In `permittedUrls.fetch` array

2. **Update ContractCardV2.jsx:**

   Edit `src/app/cards/ContractCardV2.jsx`:
   - Replace `https://YOUR-APP-NAME.vercel.app/api/trigger` in the `MIDDLEWARE_URL` constant
   - With your actual Vercel URL

3. **Update Settings.jsx:**

   Edit `src/app/settings/Settings.jsx`:
   - Replace `https://YOUR-APP-NAME.vercel.app/api/trigger` in the default settings
   - With your actual Vercel URL

---

## Part 3: Upload HubSpot App

1. **Navigate to project:**
   ```bash
   cd /Users/patrick.charles/Documents/Paddy/luminance-card-static
   ```

2. **Upload to HubSpot:**
   ```bash
   hs project upload
   ```

3. **Verify build succeeded:**
   - Check the build URL provided in the output
   - All components should build successfully

---

## Part 4: Create Unlisted Marketplace Listing

### In HubSpot

1. **Go to:** https://app.hubspot.com/l/integrations-settings/
2. **Navigate to:** App Marketplace → Your Apps
3. **Find:** luminance-card-static
4. **Click:** "Create Marketplace Listing"

### Fill Out Listing (Minimum Required)

**Basic Info:**
- App Name: "Luminance Contracts"
- Tagline: "Generate legal contracts in Luminance directly from HubSpot"
- Category: "Productivity"
- Subcategory: "Documents & Contracts"

**Description:**
```
Streamline your contract generation workflow by connecting HubSpot Deals to Luminance's AI-powered contract management platform.

Features:
• Generate new contracts directly from Deal records
• Upload existing contracts for review
• Automatic deal property updates with contract status
• Support for NDA, DPA, and custom contract types
```

**Visibility:**
- Select: "Unlisted" (not searchable in marketplace)
- This allows you to test with specific customers via direct link

**Save Draft**

---

## Part 5: Test Installation

### Install in Your Test Portal

1. **Get install link:**
   - In app listing, click "Get Install Link"
   - Copy the URL

2. **Open in browser:**
   - Go to the install link
   - Click "Install"
   - Grant OAuth permissions

3. **Test the card:**
   - Go to any Deal record
   - Open right sidebar
   - Find "Luminance Contracts" card
   - Try generating a contract

### What Should Happen

1. ✅ Card calls middleware at your Vercel URL
2. ✅ Middleware updates deal properties using OAuth token
3. ✅ HubSpot workflow detects property change
4. ✅ Workflow calls Prismatic webhook
5. ✅ Prismatic generates contract
6. ✅ Contract URL appears in card

---

## Part 6: Configure Customer Workflows

Each customer who installs needs to:

1. **Create custom deal properties** (if not already created):
   - `luminance_trigger_action` (Single-line text)
   - `luminance_contract_type` (Single-line text)
   - `luminance_notes` (Multi-line text)
   - `luminance_attachment_id` (Single-line text)
   - `luminance_trigger_timestamp` (Single-line text)

2. **Create workflow:**
   - Type: Deal-based
   - Trigger: Property value changed → `luminance_trigger_timestamp`
   - Action: Send webhook (POST) to their Prismatic URL
   - Webhook body: Map deal properties to Prismatic payload

3. **Configure settings:**
   - Open app settings in HubSpot
   - Enter their Prismatic webhook URL
   - Save

---

## Troubleshooting

### Middleware Not Receiving Requests

**Check:**
- Vercel deployment logs: https://vercel.com/dashboard
- HubSpot console for errors
- `permittedUrls.fetch` includes your Vercel URL
- App was uploaded after updating URLs

### OAuth Errors

**Check:**
- App auth type is `oauth` not `static`
- App distribution is `marketplace`
- Customer granted all required scopes
- Access token is being fetched: `actions.fetchAccessToken()`

### Deal Properties Not Updating

**Check:**
- Middleware logs in Vercel dashboard
- Customer has required scopes: `crm.objects.deals.write`
- Deal ID is correct
- Access token is valid

### Workflow Not Triggering

**Check:**
- Custom properties exist in customer's portal
- Workflow is turned ON
- Workflow trigger is configured correctly
- Deal properties are actually being updated (check deal record)

---

## Monitoring & Logs

### Vercel Logs
```bash
vercel logs YOUR-PROJECT-NAME --follow
```

Or visit: https://vercel.com/dashboard → Your Project → Logs

### HubSpot Logs
- Browser console in CRM
- Workflow execution history
- App activity logs

---

## Next Steps

### For Private Beta
- ✅ Share install link with 1-2 pilot customers
- ✅ Help them configure workflows
- ✅ Gather feedback
- ✅ Iterate on UX

### For Public Marketplace
- Complete app listing (screenshots, video, docs)
- Submit for HubSpot review
- Respond to feedback
- Public launch (4-8 weeks)

---

## Cost Estimates

### Vercel Free Tier
- 100K function invocations/month
- Supports ~500-1000 daily active users
- **When to upgrade:** $20/month Pro tier at scale

### Development Time
- ✅ Middleware: Complete
- ✅ OAuth conversion: Complete
- ✅ Settings page: Complete
- 🔄 Testing: 1-2 days
- 🔄 Marketplace listing: 2-3 days
- 🔄 Review process: 4-6 weeks (HubSpot's timeline)

---

## Support

For issues:
1. Check Vercel logs
2. Check HubSpot console
3. Review this guide
4. Contact integration support team
