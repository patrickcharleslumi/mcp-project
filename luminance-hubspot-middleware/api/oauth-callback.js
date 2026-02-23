/**
 * OAuth Callback Handler for HubSpot Marketplace App
 *
 * Exchanges authorization code for access tokens and stores them.
 */

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const { code } = req.query;

  // If no code, show error
  if (!code) {
    return res.status(400).send(errorPage('Missing authorization code. Please try installing again.'));
  }

  try {
    console.log('Exchanging authorization code for access token...');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri: 'https://luminance-hubspot-middleware.vercel.app/api/oauth-callback',
        code: code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Failed to exchange token: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Successfully obtained access token for portal:', tokens.hub_id);

    // Store tokens in Vercel KV
    const portalId = tokens.hub_id.toString();
    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      updatedAt: Date.now()
    };

    // Store object directly - Vercel KV handles serialization automatically
    await kv.set(`hubspot:tokens:${portalId}`, tokenData);
    console.log('✅ Tokens stored in KV for portal:', portalId);

    // Redirect back to HubSpot with success
    return res.redirect(`https://app.hubspot.com/contacts/${portalId}/objects/0-3/views/all/list`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).send(errorPage('Installation failed. Please try again or contact support.'));
  }
};

function errorPage(message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Installation Error - Luminance</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 3rem;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
          max-width: 500px;
        }
        h1 {
          color: #e53e3e;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Installation Error</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}
