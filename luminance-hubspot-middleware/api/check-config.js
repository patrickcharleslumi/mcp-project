/**
 * Check middleware configuration
 *
 * Usage: GET /api/check-config
 */

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
    // Check what environment variables are set
    const config = {
      hasClientId: !!process.env.HUBSPOT_CLIENT_ID,
      clientIdPreview: process.env.HUBSPOT_CLIENT_ID
        ? `${process.env.HUBSPOT_CLIENT_ID.substring(0, 8)}...`
        : null,
      hasClientSecret: !!process.env.HUBSPOT_CLIENT_SECRET,
      clientSecretPreview: process.env.HUBSPOT_CLIENT_SECRET
        ? `${process.env.HUBSPOT_CLIENT_SECRET.substring(0, 8)}...`
        : null,
      hasKvUrl: !!process.env.KV_REST_API_URL,
      kvUrlPreview: process.env.KV_REST_API_URL
        ? `${process.env.KV_REST_API_URL.substring(0, 30)}...`
        : null,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
      nodeVersion: process.version,
      environment: process.env.VERCEL_ENV || 'unknown'
    };

    // Try to import KV
    let kvAvailable = false;
    try {
      const { kv } = require('@vercel/kv');
      kvAvailable = !!kv;
    } catch (err) {
      kvAvailable = false;
    }

    const status = {
      allConfigured: config.hasClientId && config.hasClientSecret && config.hasKvUrl && config.hasKvToken,
      readyForOAuth: config.hasClientId && config.hasClientSecret,
      kvAvailable: kvAvailable
    };

    return res.status(200).json({
      success: true,
      status: status,
      config: config,
      message: status.allConfigured
        ? '✅ All configuration is set up correctly'
        : '⚠️ Some configuration is missing'
    });

  } catch (error) {
    console.error('Error checking config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
