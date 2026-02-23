# Luminance HubSpot CRM Card Integration

Professional HubSpot CRM card that enables sales teams to generate contracts in Luminance directly from Deal records.

## Features

- **Seamless Integration**: Generate contracts with one click from any Deal record
- **Real-time Status**: See contract generation status with professional loading states
- **Deal Context**: Automatically pulls deal information (name, amount, stage, ID)
- **Contract Templates**: Support for NDA and DPA contract types
- **Success Tracking**: Stores contract URLs in deal properties for easy access
- **Error Handling**: Clear error messages with retry functionality
- **Luminance Branding**: Professional UI matching Luminance brand guidelines

## Architecture

```
HubSpot Deal Page → CRM Card → Prismatic Integration → Luminance API
                        ↓
                 Real-time Updates
```

## Prerequisites

1. **HubSpot Developer Account**: [Sign up here](https://developers.hubspot.com/)
2. **HubSpot CLI**: Install globally with `npm install -g @hubspot/cli`
3. **Node.js**: Version 14 or higher
4. **Prismatic Integration**: Webhook URL configured and active

## Project Structure

```
luminance-hubspot-card/
├── src/
│   └── app/
│       └── extensions/
│           └── ContractCard.jsx       # Main CRM card component
├── public/
│   ├── extensions.json                # CRM card configuration
│   └── luminance-logo.png             # Luminance branding
├── hsproject.json                     # HubSpot project config
├── package.json                       # Dependencies
└── README.md                          # This file
```

## Setup Instructions

### 1. Install HubSpot CLI

```bash
npm install -g @hubspot/cli
```

### 2. Authenticate with HubSpot

```bash
cd luminance-hubspot-card
hs auth
```

Follow the prompts to authenticate with your HubSpot developer account.

### 3. Configure Custom Deal Properties

Before deploying, create these custom properties in your HubSpot account:

**Property 1: Contract URL**
- **Internal Name**: `luminance_contract_url`
- **Label**: "Luminance Contract URL"
- **Type**: Single-line text
- **Field Type**: Text

**Property 2: Contract ID**
- **Internal Name**: `luminance_contract_id`
- **Label**: "Luminance Contract ID"
- **Type**: Single-line text
- **Field Type**: Text

**Property 3: Contract Status**
- **Internal Name**: `luminance_contract_status`
- **Label**: "Luminance Contract Status"
- **Type**: Single-line text
- **Field Type**: Text

**Property 4: Last Generated**
- **Internal Name**: `luminance_last_generated`
- **Label**: "Luminance Last Generated"
- **Type**: Single-line text
- **Field Type**: Text

**To create these properties:**
1. Go to Settings → Properties → Deal Properties
2. Click "Create property"
3. Fill in the details for each property above
4. Save each property

### 4. Install Dependencies

```bash
npm install
```

## Development

### Start Local Development Server

```bash
npm run dev
```

This will:
- Start a local development server with hot reload
- Open your HubSpot sandbox in the browser
- Navigate to any Deal record to see the CRM card in the right sidebar

### Testing the Integration

1. **Create Test Deal**: Create a test Deal in your sandbox with realistic data
2. **Open Deal Record**: Navigate to the Deal page
3. **Locate CRM Card**: Find "Luminance Contracts" card in right sidebar
4. **Test Form**:
   - Select a contract type (NDA or DPA)
   - Add optional notes
   - Click "Generate Contract in Luminance"
5. **Verify Success**: Check that contract link appears and deal properties update

### Development Tips

- **Hot Reload**: Code changes auto-refresh in the browser
- **Console Logs**: Check browser DevTools for debugging
- **Network Tab**: Monitor API calls to Prismatic webhook
- **Deal Properties**: Verify properties update correctly after generation

## Deployment

### Deploy to HubSpot Sandbox

```bash
npm run upload
```

### Deploy to Production

```bash
npm run deploy
```

**Important**: Test thoroughly in sandbox before deploying to production!

## Configuration

### Prismatic Webhook URL

The webhook URL is configured in `ContractCard.jsx`:

```javascript
const PRISMATIC_WEBHOOK_URL = 'https://hooks.luminance-production-eu-central-1.prismatic.io/trigger/...';
```

### Contract Templates

Templates are defined in `ContractCard.jsx`:

```javascript
const CONTRACT_TEMPLATES = [
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'DPA', label: 'Data Processing Agreement (DPA)' }
];
```

To add more templates, simply add entries to this array.

### Luminance Branding

Brand colors are defined in `ContractCard.jsx`:

```javascript
const COLORS = {
  primary: '#3B54BC',      // Purple
  lightBlue: '#81B5F2',    // Light Blue
  iceWhite: '#F5F6FC',     // Ice White
  midnightBlue: '#0B0F28'  // Midnight Blue
};
```

## API Integration

### Request Payload

The CRM card sends this payload to Prismatic:

```json
{
  "luminanceAction__c": "generate_contract",
  "contract_type": "NDA",
  "hs_op_id": "12345678",
  "matterId": "Acme Corp Deal",
  "upload": "Optional notes here",
  "signature": "HubSpot-1234567890",
  "request_origin": "HubSpot CRM Card",
  "dealName": "Acme Corp Deal",
  "dealAmount": "50000",
  "dealStage": "Contract Sent"
}
```

### Expected Response Format

The CRM card expects Prismatic to return:

```json
{
  "contractUrl": "https://luminance.com/contract/abc123",
  "contractId": "abc123",
  "status": "success"
}
```

**Note**: If your Prismatic integration returns different field names, update the response parsing in `ContractCard.jsx`:

```javascript
const generatedContractUrl = result.contractUrl || result.url || result.data?.url;
const contractId = result.contractId || result.id || result.data?.id;
```

## Troubleshooting

### CRM Card Not Appearing

1. **Check Configuration**: Verify `extensions.json` has correct location
2. **Verify Scopes**: Ensure deal read/write scopes are granted
3. **Reinstall App**: Try removing and reinstalling the app
4. **Check Console**: Look for errors in browser DevTools

### Deal Properties Not Loading

1. **Verify Property Names**: Check that custom properties exist with exact names
2. **Check Permissions**: Ensure app has proper scopes
3. **Test API**: Use HubSpot API tester to verify property access

### API Call Failing

1. **Verify Webhook URL**: Confirm Prismatic webhook URL is correct
2. **Check CORS**: Ensure Prismatic allows requests from HubSpot domain
3. **Test Webhook**: Use Postman to test webhook directly
4. **Check Payload**: Verify payload format matches Prismatic expectations

### Loading State Stuck

1. **Check Network Tab**: See if API call completed
2. **Verify Response**: Check that Prismatic returned expected format
3. **Handle Timeouts**: Add timeout handling if needed

## Demo Preparation

### Pre-Demo Checklist

- [ ] Prismatic integration tested and working
- [ ] Clean demo Deal created with realistic data
- [ ] Test full flow 3+ times successfully
- [ ] Browser cache cleared
- [ ] Desktop clean, full screen ready
- [ ] Screen recording software tested
- [ ] Talking points prepared
- [ ] Contract templates ready in Luminance

### Demo Script

1. "Here we have a deal for [Company Name] in our HubSpot CRM"
2. Scroll to right sidebar → "Notice our Luminance contract card"
3. "It automatically pulls in the key deal information"
4. Select contract template → "We select the appropriate template"
5. "I can add any additional notes or instructions"
6. Click "Generate Contract" → "One click to generate"
7. Show loading state → "The integration works in real-time"
8. Success! → "Contract generated successfully"
9. Click link → "Opens directly in Luminance"
10. Show generated contract → "Fully populated with deal data"

## Future Enhancements

**Short-term:**
- Add more contract templates
- Enhanced error messages with specific codes
- Progress indicators for multi-step generation
- Contract status badges
- Last generated timestamp display

**Production-ready:**
- OAuth for Luminance (secure credential management)
- HubSpot marketplace listing (public app)
- Multi-object support (Contacts, Companies)
- Bi-directional sync (Luminance → HubSpot updates)
- Contract status tracking with webhooks
- Document storage integration
- Audit logging and analytics
- User permissions and roles
- Bulk contract generation
- Template customization UI

## Support

For issues or questions:
- **HubSpot Developer Docs**: https://developers.hubspot.com/docs/platform
- **HubSpot Community**: https://community.hubspot.com/
- **Prismatic Support**: Contact your Prismatic account manager

## License

MIT License - See LICENSE file for details

## Credits

Built with ❤️ by Luminance
Powered by HubSpot UI Extensions and Prismatic
