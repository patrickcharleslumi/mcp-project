/**
 * Debug endpoint to check KV storage
 *
 * Usage: GET /api/debug-kv?portalId=147788687
 */

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { portalId } = req.query;

    if (!portalId) {
      return res.status(400).json({
        error: 'Missing portalId query parameter',
        usage: '/api/debug-kv?portalId=YOUR_PORTAL_ID'
      });
    }

    console.log(`[DEBUG] Looking up tokens for portal: ${portalId}`);

    // Check if KV is available
    if (!kv) {
      return res.status(500).json({
        error: 'KV not initialized',
        kvAvailable: false
      });
    }

    // Try to get the tokens
    const key = `hubspot:tokens:${portalId}`;
    const tokenData = await kv.get(key);

    if (!tokenData) {
      // List all keys to see what's actually in KV
      let allKeys = [];
      try {
        // Try to scan for all hubspot keys
        const keys = await kv.keys('hubspot:*');
        allKeys = keys || [];
      } catch (scanError) {
        console.error('Could not scan keys:', scanError);
      }

      return res.status(404).json({
        error: 'No tokens found for this portal',
        portalId: portalId,
        lookupKey: key,
        availableKeys: allKeys,
        kvAvailable: true
      });
    }

    // Sanitize the token data (don't expose full tokens)
    const sanitized = {
      hasAccessToken: !!tokenData.accessToken,
      accessTokenPreview: tokenData.accessToken ?
        `${tokenData.accessToken.substring(0, 10)}...` : null,
      hasRefreshToken: !!tokenData.refreshToken,
      refreshTokenPreview: tokenData.refreshToken ?
        `${tokenData.refreshToken.substring(0, 10)}...` : null,
      expiresAt: tokenData.expiresAt,
      expiresAtDate: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
      isExpired: tokenData.expiresAt ? Date.now() > tokenData.expiresAt : 'unknown',
      updatedAt: tokenData.updatedAt,
      updatedAtDate: tokenData.updatedAt ? new Date(tokenData.updatedAt).toISOString() : null
    };

    return res.status(200).json({
      success: true,
      portalId: portalId,
      lookupKey: key,
      tokenData: sanitized,
      kvAvailable: true
    });

  } catch (error) {
    console.error('Error checking KV:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
