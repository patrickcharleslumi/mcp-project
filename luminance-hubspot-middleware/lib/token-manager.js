/**
 * Token Manager - Handles OAuth token refresh
 */

const { kv } = require('@vercel/kv');

/**
 * Get a valid access token, refreshing if necessary
 * @param {string} portalId - HubSpot portal ID
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(portalId) {
  const kvKey = `hubspot:tokens:${portalId}`;
  const tokenData = await kv.get(kvKey);

  if (!tokenData) {
    throw new Error('No token found. User needs to install the app.');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const expiresAt = tokenData.expiresAt || 0;
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (now + bufferTime < expiresAt) {
    // Token is still valid
    console.log(`[${portalId}] Using existing access token (expires in ${Math.floor((expiresAt - now) / 1000 / 60)} minutes)`);
    return tokenData.accessToken;
  }

  // Token expired or about to expire - refresh it
  console.log(`[${portalId}] Access token expired or expiring soon, refreshing...`);

  if (!tokenData.refreshToken) {
    throw new Error('No refresh token available. User needs to reinstall the app.');
  }

  try {
    const refreshResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        refresh_token: tokenData.refreshToken
      })
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error(`[${portalId}] Token refresh failed:`, errorText);
      throw new Error(`Failed to refresh token: ${refreshResponse.status}`);
    }

    const newTokens = await refreshResponse.json();
    console.log(`[${portalId}] ✅ Successfully refreshed access token`);

    // Update stored tokens
    const updatedTokenData = {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: Date.now() + (newTokens.expires_in * 1000),
      updatedAt: Date.now()
    };

    await kv.set(kvKey, updatedTokenData);
    console.log(`[${portalId}] ✅ Updated tokens in KV store`);

    return updatedTokenData.accessToken;
  } catch (error) {
    console.error(`[${portalId}] Error refreshing token:`, error.message);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

module.exports = { getValidAccessToken };
