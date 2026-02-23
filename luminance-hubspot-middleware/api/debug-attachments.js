/**
 * Debug endpoint to diagnose attachment fetching issues
 * Call with: /api/debug-attachments?dealId=XXX&portalId=YYY
 */

const hubspot = require('@hubspot/api-client');

// Try to import KV if available
let kv = null;
try {
  kv = require('@vercel/kv').kv;
} catch (error) {
  console.warn('KV not available');
}

module.exports = async (req, res) => {
  try {
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

    const { dealId, portalId } = req.query;
    const debugInfo = {
      timestamp: new Date().toISOString(),
      request: {
        dealId,
        portalId,
        hasKV: !!kv
      },
      steps: []
    };

    if (!dealId || !portalId) {
      debugInfo.error = 'Missing required parameters: dealId, portalId';
      return res.status(400).json(debugInfo);
    }

    // Step 1: Check KV for token
    debugInfo.steps.push({ step: 1, action: 'Checking KV for access token' });
    let accessToken = null;
    let tokenData = null;

    if (kv) {
      try {
        const kvKey = `hubspot:tokens:${portalId}`;
        debugInfo.steps.push({ step: 2, action: `Looking up KV key: ${kvKey}` });

        tokenData = await kv.get(kvKey);

        if (tokenData) {
          accessToken = tokenData.accessToken;
          debugInfo.steps.push({
            step: 3,
            action: 'Token found in KV',
            tokenExists: true,
            tokenLength: accessToken ? accessToken.length : 0,
            hasRefreshToken: !!tokenData.refreshToken,
            expiresAt: tokenData.expiresAt,
            isExpired: tokenData.expiresAt ? Date.now() > tokenData.expiresAt : 'unknown'
          });
        } else {
          debugInfo.steps.push({
            step: 3,
            action: 'No token found in KV',
            tokenExists: false,
            recommendation: 'User needs to install/reinstall the app'
          });
        }
      } catch (kvError) {
        debugInfo.steps.push({
          step: 3,
          action: 'KV lookup failed',
          error: kvError.message
        });
      }
    } else {
      debugInfo.steps.push({
        step: 2,
        action: 'KV not available',
        error: 'Vercel KV module not loaded'
      });
    }

    if (!accessToken) {
      debugInfo.conclusion = 'Cannot proceed without access token';
      return res.status(200).json(debugInfo);
    }

    // Step 4: Fetch deal
    debugInfo.steps.push({ step: 4, action: `Fetching deal ${dealId}` });
    const hubspotClient = new hubspot.Client({ accessToken });

    let deal;
    try {
      deal = await hubspotClient.crm.deals.basicApi.getById(dealId, ['hs_attachment_ids', 'dealname']);
      debugInfo.steps.push({
        step: 5,
        action: 'Deal fetched successfully',
        dealName: deal.properties.dealname,
        attachmentIdsRaw: deal.properties.hs_attachment_ids
      });
    } catch (dealError) {
      debugInfo.steps.push({
        step: 5,
        action: 'Failed to fetch deal',
        error: dealError.message,
        statusCode: dealError.code
      });
      debugInfo.conclusion = 'Failed to fetch deal from HubSpot API';
      return res.status(200).json(debugInfo);
    }

    const attachmentIdsString = deal.properties.hs_attachment_ids;

    if (!attachmentIdsString) {
      debugInfo.steps.push({
        step: 6,
        action: 'No hs_attachment_ids property on deal',
        conclusion: 'Deal has no attachments or property not set'
      });
      debugInfo.conclusion = 'Deal has no attachments';
      return res.status(200).json(debugInfo);
    }

    // Step 7: Parse attachment IDs
    const attachmentIds = attachmentIdsString.split(';').filter(id => id.trim());
    debugInfo.steps.push({
      step: 6,
      action: 'Parsed attachment IDs',
      count: attachmentIds.length,
      ids: attachmentIds
    });

    // Step 8: Fetch each file
    debugInfo.steps.push({ step: 7, action: 'Fetching file metadata' });
    const fileResults = [];

    for (const fileId of attachmentIds) {
      try {
        const fileResponse = await fetch(
          `https://api.hubapi.com/files/v3/files/${fileId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          fileResults.push({
            fileId,
            success: true,
            name: fileData.name,
            extension: fileData.extension,
            size: fileData.size
          });
        } else {
          const errorBody = await fileResponse.text();
          fileResults.push({
            fileId,
            success: false,
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            errorBody: errorBody.substring(0, 200)
          });
        }
      } catch (fileErr) {
        fileResults.push({
          fileId,
          success: false,
          error: fileErr.message
        });
      }
    }

    debugInfo.steps.push({
      step: 8,
      action: 'File fetch complete',
      results: fileResults,
      successCount: fileResults.filter(r => r.success).length,
      failureCount: fileResults.filter(r => !r.success).length
    });

    // Conclusion
    const allSucceeded = fileResults.every(r => r.success);
    const allFailed = fileResults.every(r => !r.success);

    if (allSucceeded) {
      debugInfo.conclusion = '✅ All files fetched successfully';
    } else if (allFailed) {
      debugInfo.conclusion = '❌ All file fetches failed - likely missing files scope';
      debugInfo.recommendation = 'Reinstall app to grant files scope';
    } else {
      debugInfo.conclusion = '⚠️ Some files fetched, some failed';
    }

    return res.status(200).json(debugInfo);

  } catch (error) {
    return res.status(500).json({
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
};
