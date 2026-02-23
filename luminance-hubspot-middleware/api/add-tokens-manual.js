/**
 * Manually add tokens to KV (for testing only)
 *
 * Usage: POST /api/add-tokens-manual
 * Body: {
 *   "portalId": "147788687",
 *   "accessToken": "your-access-token",
 *   "refreshToken": "your-refresh-token",
 *   "expiresIn": 21600
 * }
 */

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { portalId, accessToken, refreshToken, expiresIn } = req.body;

    if (!portalId || !accessToken) {
      return res.status(400).json({
        error: 'Missing required fields: portalId, accessToken'
      });
    }

    console.log(`[MANUAL] Adding tokens for portal: ${portalId}`);

    const tokenData = {
      accessToken: accessToken,
      refreshToken: refreshToken || '',
      expiresAt: Date.now() + ((expiresIn || 21600) * 1000),
      updatedAt: Date.now()
    };

    // Store object directly - Vercel KV handles serialization
    await kv.set(`hubspot:tokens:${portalId}`, tokenData);

    console.log(`✅ Tokens manually added for portal: ${portalId}`);

    return res.status(200).json({
      success: true,
      message: `Tokens added for portal ${portalId}`,
      portalId: portalId,
      key: `hubspot:tokens:${portalId}`,
      preview: {
        accessTokenPreview: accessToken.substring(0, 10) + '...',
        expiresAt: new Date(tokenData.expiresAt).toISOString()
      }
    });

  } catch (error) {
    console.error('Error adding tokens:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
