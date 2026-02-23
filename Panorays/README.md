# Luminance HubSpot Middleware

Serverless middleware for the Luminance HubSpot integration.

## Purpose

This middleware bridges the HubSpot CRM card and HubSpot workflows:
1. Receives requests from HubSpot CRM card
2. Updates deal properties using customer's OAuth token
3. Triggers HubSpot workflow
4. Workflow calls Prismatic to generate/upload contracts

## Deployment to Vercel

### Prerequisites
- Vercel account (free tier works)
- Vercel CLI installed: `npm install -g vercel`

### Steps

1. **Navigate to directory:**
   ```bash
   cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-middleware
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Login to Vercel:**
   ```bash
   vercel login
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

5. **Note your deployment URL:**
   - Example: `https://luminance-hubspot-middleware.vercel.app`
   - Your endpoint will be: `https://your-app.vercel.app/api/trigger`

### After Deployment

1. Copy your middleware URL
2. Update HubSpot app configuration with this URL
3. Add URL to `permittedUrls.fetch` in app-hsmeta.json

## API Endpoint

### POST /api/trigger

**Request Body:**
```json
{
  "dealId": "123456",
  "action": "generate",
  "contractType": "NDA",
  "notes": "Optional notes",
  "attachmentId": "789012",
  "accessToken": "oauth_token_from_hubspot",
  "portalId": "147788687"
}
```

**Response:**
```json
{
  "success": true,
  "dealId": "123456",
  "action": "generate",
  "message": "Deal properties updated, workflow should trigger"
}
```

## Local Development

```bash
npm run dev
```

Runs on http://localhost:3000

## Environment Variables

None required - uses OAuth tokens passed in requests.

## Monitoring

View logs in Vercel dashboard:
- https://vercel.com/dashboard
- Select your project
- Click "Logs" tab
