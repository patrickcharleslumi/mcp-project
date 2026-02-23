/**
 * Test endpoint to check Associations API directly
 */

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { dealId, portalId } = req.query;

    if (!dealId || !portalId) {
      return res.status(400).json({ error: 'Missing dealId or portalId' });
    }

    // Get token
    const tokenData = await kv.get(`hubspot:tokens:${portalId}`);
    if (!tokenData) {
      return res.status(401).json({ error: 'No token found' });
    }

    const accessToken = tokenData.accessToken;

    // Try multiple association endpoints
    const results = [];

    // Method 1: V4 Associations API - deals to files
    try {
      console.log('Trying: GET /crm/v4/objects/deals/{dealId}/associations/files');
      const resp1 = await fetch(
        `https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/files`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data1 = await resp1.json();
      results.push({
        method: 'V4 API: /crm/v4/objects/deals/{dealId}/associations/files',
        status: resp1.status,
        ok: resp1.ok,
        data: data1
      });
    } catch (e) {
      results.push({
        method: 'V4 API: /crm/v4/objects/deals/{dealId}/associations/files',
        error: e.message
      });
    }

    // Method 2: V3 Associations API
    try {
      console.log('Trying: GET /crm/v3/objects/deals/{dealId}/associations/files');
      const resp2 = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/files`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data2 = await resp2.json();
      results.push({
        method: 'V3 API: /crm/v3/objects/deals/{dealId}/associations/files',
        status: resp2.status,
        ok: resp2.ok,
        data: data2
      });
    } catch (e) {
      results.push({
        method: 'V3 API: /crm/v3/objects/deals/{dealId}/associations/files',
        error: e.message
      });
    }

    // Method 3: Engagements search
    try {
      console.log('Trying: POST /crm/v3/objects/engagements/search');
      const resp3 = await fetch(
        'https://api.hubapi.com/crm/v3/objects/engagements/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'associations.deal',
                    operator: 'EQ',
                    value: dealId
                  }
                ]
              }
            ],
            properties: ['hs_attachment_ids', 'hs_engagement_type'],
            limit: 100
          })
        }
      );
      const data3 = await resp3.json();
      results.push({
        method: 'Engagements Search API',
        status: resp3.status,
        ok: resp3.ok,
        data: data3
      });
    } catch (e) {
      results.push({
        method: 'Engagements Search API',
        error: e.message
      });
    }

    return res.status(200).json({
      dealId,
      portalId,
      results
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
