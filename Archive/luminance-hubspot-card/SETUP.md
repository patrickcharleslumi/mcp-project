# Quick Setup Guide

This guide will walk you through setting up the Luminance HubSpot CRM Card from scratch.

## Step 1: Install Prerequisites

### Install Node.js
Download and install from: https://nodejs.org/ (version 14 or higher)

### Install HubSpot CLI
```bash
npm install -g @hubspot/cli
```

## Step 2: HubSpot Account Setup

### Create Developer Account
1. Go to https://developers.hubspot.com/
2. Sign up for a free developer account
3. Create a developer test account (sandbox)

### Create Custom Deal Properties

Navigate to: **Settings → Properties → Deal Properties → Create property**

Create these 4 properties:

#### Property 1: Contract URL
```
Label: Luminance Contract URL
Internal Name: luminance_contract_url
Type: Single-line text
Group: Deal Information
Description: URL to the generated contract in Luminance
```

#### Property 2: Contract ID
```
Label: Luminance Contract ID
Internal Name: luminance_contract_id
Type: Single-line text
Group: Deal Information
Description: Unique identifier for the Luminance contract
```

#### Property 3: Contract Status
```
Label: Luminance Contract Status
Internal Name: luminance_contract_status
Type: Single-line text
Group: Deal Information
Description: Current status of the contract (generated, pending, etc.)
```

#### Property 4: Last Generated
```
Label: Luminance Last Generated
Internal Name: luminance_last_generated
Type: Single-line text
Group: Deal Information
Description: Timestamp of last contract generation
```

## Step 3: Project Setup

### Navigate to Project Directory
```bash
cd luminance-hubspot-card
```

### Authenticate with HubSpot
```bash
hs auth
```

This will:
1. Open a browser window
2. Prompt you to log in to HubSpot
3. Authorize the CLI to access your account
4. Create a config file in your home directory

### Install Dependencies
```bash
npm install
```

## Step 4: Configure the Project

### Update App Configuration (if needed)

Edit `hsproject.json` to customize:
```json
{
  "name": "luminance-contract-generator",
  "srcDir": "src"
}
```

### Verify Extensions Configuration

Check `public/extensions.json`:
- Correct location: `"crm.record.deal.right"`
- Proper scopes: deals read/write

## Step 5: Development

### Start Development Server
```bash
npm run dev
```

This command will:
1. Build the project
2. Upload to HubSpot
3. Open your sandbox in a browser
4. Enable hot reload for development

### Test in HubSpot

1. **Create Test Deal**:
   - Go to Sales → Deals
   - Click "Create deal"
   - Fill in:
     - Deal name: "Acme Corp - Annual Contract"
     - Amount: $50,000
     - Deal stage: "Contract Sent"
   - Save the deal

2. **Open Deal Record**:
   - Click on the deal you just created
   - Look in the right sidebar

3. **Find CRM Card**:
   - You should see "Luminance Contracts" card
   - It should display deal information

4. **Test Contract Generation**:
   - Select contract type (NDA or DPA)
   - Add optional notes
   - Click "Generate Contract in Luminance"
   - Watch loading state
   - Verify success message with link

## Step 6: Verify Integration

### Check Network Requests

1. Open browser DevTools (F12)
2. Go to Network tab
3. Generate a contract
4. Look for POST request to Prismatic webhook
5. Verify payload includes all required fields:
   - `contract_type`
   - `hs_op_id`
   - `matterId`
   - `luminanceAction__c`

### Check Deal Property Updates

After successful generation:
1. Refresh the deal page
2. Click "View all properties"
3. Verify these properties are populated:
   - Luminance Contract URL
   - Luminance Contract ID
   - Luminance Contract Status
   - Luminance Last Generated

### Test Error Handling

1. Temporarily change webhook URL to invalid endpoint
2. Try to generate contract
3. Verify clear error message appears
4. Click "Try Again" button
5. Verify retry functionality works

## Step 7: Deploy to Sandbox

Once testing is complete:

```bash
npm run upload
```

This makes the card available in your sandbox without development mode.

## Step 8: Prepare Demo

### Create Demo Deal

Create a realistic deal:
```
Deal Name: Acme Corporation - Enterprise Agreement
Amount: $250,000
Stage: Negotiation
Company: Acme Corporation
Close Date: End of Q1
Priority: High
```

### Test Demo Flow

Practice the full demo 3-5 times:
1. Navigate smoothly to deal
2. Show CRM card clearly
3. Fill form confidently
4. Generate contract
5. Show success state
6. Click through to Luminance

### Record Demo

**Recording Setup**:
- Clean desktop background
- Close unnecessary apps
- Full screen browser
- Good lighting if showing face
- Test audio levels

**Recording Flow**:
1. Start recording
2. Navigate to Deals
3. Open demo deal
4. Point out CRM card in sidebar
5. Explain deal context
6. Select contract template
7. Add notes
8. Click generate
9. Show loading state
10. Show success message
11. Click contract link
12. Show contract in Luminance
13. End recording

## Troubleshooting

### "Command not found: hs"

**Solution**: Install HubSpot CLI globally
```bash
npm install -g @hubspot/cli
```

### "Authentication failed"

**Solution**: Re-authenticate
```bash
hs auth
```

### "CRM card not appearing"

**Solutions**:
1. Clear browser cache
2. Verify extensions.json configuration
3. Check that app is installed in account
4. Look for console errors in DevTools

### "Properties not loading"

**Solutions**:
1. Verify custom properties exist with exact names
2. Check property API names match code
3. Ensure app has proper scopes
4. Try re-installing the app

### "API call failing"

**Solutions**:
1. Verify Prismatic webhook URL is correct
2. Check webhook is active in Prismatic
3. Test webhook with Postman
4. Check browser console for CORS errors
5. Verify payload format matches Prismatic expectations

### "Module not found" errors

**Solution**: Reinstall dependencies
```bash
rm -rf node_modules
npm install
```

## Next Steps

After successful setup:

1. **Add More Templates**: Edit CONTRACT_TEMPLATES array
2. **Customize Branding**: Update colors and styling
3. **Enhanced Error Messages**: Add specific error codes
4. **Add Validation**: More robust form validation
5. **Status Tracking**: Show contract status badges
6. **Analytics**: Track usage and success rates

## Support Resources

- **HubSpot Developer Docs**: https://developers.hubspot.com/docs
- **HubSpot Community**: https://community.hubspot.com/
- **HubSpot CLI Docs**: https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli
- **UI Extensions Guide**: https://developers.hubspot.com/docs/platform/ui-extensions-overview

## Quick Command Reference

```bash
# Authenticate
hs auth

# Start development
npm run dev

# Upload to HubSpot
npm run upload

# Deploy to production
npm run deploy

# View logs
hs logs

# List projects
hs project list

# Create new component
hs project add

# Remove app
hs project remove
```

## Success Checklist

- [ ] HubSpot CLI installed
- [ ] HubSpot account authenticated
- [ ] Custom deal properties created
- [ ] Project dependencies installed
- [ ] Development server running
- [ ] CRM card appears in deal sidebar
- [ ] Deal properties load correctly
- [ ] Form validation works
- [ ] Contract generation succeeds
- [ ] Success message displays
- [ ] Contract link opens in Luminance
- [ ] Deal properties update
- [ ] Error handling works
- [ ] Demo recorded successfully

Congratulations! Your Luminance HubSpot integration is ready! 🎉
