/**
 * List all keys in KV storage
 *
 * Usage: GET /api/list-all-keys
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
    console.log('[LIST] Scanning all keys in KV...');

    // Get all keys matching hubspot pattern
    const hubspotKeys = await kv.keys('hubspot:*');

    // Also try to get all keys (if supported)
    const allKeys = await kv.keys('*');

    // Get values for each hubspot key (sanitized)
    const keyDetails = [];
    for (const key of hubspotKeys) {
      try {
        const rawValue = await kv.get(key);
        let valueType = typeof rawValue;
        let valuePreview = '';
        let isValidJSON = false;

        if (typeof rawValue === 'string') {
          valuePreview = rawValue.substring(0, 100);
          try {
            JSON.parse(rawValue);
            isValidJSON = true;
          } catch (e) {
            isValidJSON = false;
          }
        } else if (rawValue !== null) {
          valuePreview = JSON.stringify(rawValue).substring(0, 100);
        }

        keyDetails.push({
          key: key,
          valueType: valueType,
          valuePreview: valuePreview + '...',
          isValidJSON: isValidJSON,
          exists: rawValue !== null
        });
      } catch (err) {
        keyDetails.push({
          key: key,
          error: err.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      totalHubspotKeys: hubspotKeys.length,
      totalKeys: allKeys.length,
      hubspotKeys: hubspotKeys,
      allKeys: allKeys.length > 20 ? allKeys.slice(0, 20) : allKeys,
      keyDetails: keyDetails
    });

  } catch (error) {
    console.error('Error listing keys:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
