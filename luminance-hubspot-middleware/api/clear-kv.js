/**
 * Clear KV storage for a portal
 *
 * Usage: POST /api/clear-kv
 * Body: { "portalId": "147788687" }
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
    const { portalId } = req.body;

    if (!portalId) {
      return res.status(400).json({
        error: 'Missing portalId in request body'
      });
    }

    console.log(`[CLEAR] Clearing tokens for portal: ${portalId}`);

    const key = `hubspot:tokens:${portalId}`;

    // Delete the key
    await kv.del(key);

    console.log(`✅ Cleared tokens for portal: ${portalId}`);

    return res.status(200).json({
      success: true,
      message: `Tokens cleared for portal ${portalId}`,
      portalId: portalId,
      clearedKey: key
    });

  } catch (error) {
    console.error('Error clearing KV:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
