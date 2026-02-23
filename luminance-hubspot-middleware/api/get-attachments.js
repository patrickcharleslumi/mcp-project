/**
 * Get attachment details for a deal
 * READ-ONLY endpoint - just fetches file names for display
 * Does NOT touch any contract generation logic
 */

const hubspot = require('@hubspot/api-client');
const { getValidAccessToken } = require('../lib/token-manager');

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

    if (!dealId || !portalId) {
      return res.status(400).json({
        error: 'Missing required parameters: dealId, portalId'
      });
    }

    console.log(`[${portalId}] Fetching attachments for deal ${dealId}`);

    // Get valid OAuth token (will auto-refresh if expired)
    let accessToken;
    try {
      accessToken = await getValidAccessToken(portalId);
    } catch (tokenError) {
      console.error(`[${portalId}] Failed to get valid access token:`, tokenError.message);
      return res.status(200).json({
        attachments: [],
        warning: 'Authentication error. Please reinstall the app.'
      });
    }

    const hubspotClient = new hubspot.Client({ accessToken });

    // Fetch attachments by searching engagements associated with the deal
    console.log(`[${portalId}] Searching for engagements with attachments for deal ${dealId}...`);

    let attachmentIds = [];
    try {
      // Search for engagements (notes, emails, etc.) associated with this deal
      const engagementsResponse = await fetch(
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

      if (engagementsResponse.ok) {
        const engagementsData = await engagementsResponse.json();
        console.log(`[${portalId}] Found ${engagementsData.total || 0} engagements associated with deal`);

        if (engagementsData.results && engagementsData.results.length > 0) {
          // Extract file IDs from each engagement that has attachments
          const fileIdsSet = new Set();

          engagementsData.results.forEach(engagement => {
            const attachmentIdsString = engagement.properties?.hs_attachment_ids;
            if (attachmentIdsString) {
              const ids = attachmentIdsString.split(';').filter(id => id.trim());
              ids.forEach(id => fileIdsSet.add(id.trim()));
              console.log(`[${portalId}] Engagement ${engagement.id} (${engagement.properties.hs_engagement_type}) has ${ids.length} attachment(s)`);
            }
          });

          attachmentIds = Array.from(fileIdsSet);
          console.log(`[${portalId}] Total unique file IDs found: ${attachmentIds.length}`, attachmentIds);
        } else {
          console.log(`[${portalId}] No engagements with attachments found`);
        }
      } else {
        const errorText = await engagementsResponse.text();
        console.error(`[${portalId}] Engagements search failed: HTTP ${engagementsResponse.status}`);
        console.error(`[${portalId}] Error: ${errorText}`);
      }
    } catch (engagementError) {
      console.error(`[${portalId}] Error searching engagements:`, engagementError.message);
    }

    // Fallback 1: Try direct file associations
    if (attachmentIds.length === 0) {
      console.log(`[${portalId}] Trying fallback method 1: Direct file associations...`);
      try {
        const associationsResponse = await fetch(
          `https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/files`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (associationsResponse.ok) {
          const associationsData = await associationsResponse.json();
          if (associationsData.results && associationsData.results.length > 0) {
            attachmentIds = associationsData.results.map(result => result.toObjectId || result.id);
            console.log(`[${portalId}] Found ${attachmentIds.length} direct file associations`);
          }
        }
      } catch (assocError) {
        console.error(`[${portalId}] Direct associations failed:`, assocError.message);
      }
    }

    // Fallback 2: Check hs_attachment_ids property on deal
    if (attachmentIds.length === 0) {
      console.log(`[${portalId}] Trying fallback method 2: hs_attachment_ids property...`);
      try {
        const deal = await hubspotClient.crm.deals.basicApi.getById(dealId, ['hs_attachment_ids']);
        const attachmentIdsString = deal.properties.hs_attachment_ids;

        if (attachmentIdsString) {
          const propertyIds = attachmentIdsString.split(';').filter(id => id.trim());
          console.log(`[${portalId}] Found ${propertyIds.length} IDs in hs_attachment_ids property`);
          attachmentIds = propertyIds;
        }
      } catch (dealError) {
        console.error(`[${portalId}] Property fallback also failed:`, dealError.message);
      }
    }

    if (attachmentIds.length === 0) {
      console.log(`[${portalId}] No attachments found after trying all methods`);
      return res.status(200).json({ attachments: [] });
    }

    console.log(`[${portalId}] Proceeding to fetch metadata for ${attachmentIds.length} file(s)`);

    // Fetch file metadata for each attachment
    const attachments = [];
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
          console.log(`[${portalId}] ✅ Fetched file metadata for ${fileId}: ${fileData.name}`);
          attachments.push({
            id: fileId,
            name: fileData.name || `File ${fileId}`,
            extension: fileData.extension || '',
            size: fileData.size || null
          });
        } else {
          const errorBody = await fileResponse.text();
          console.error(`[${portalId}] ❌ Failed to fetch file ${fileId}: HTTP ${fileResponse.status}`);
          console.error(`[${portalId}] Error details: ${errorBody}`);

          // Check if it's a permissions issue
          if (fileResponse.status === 403) {
            console.error(`[${portalId}] ⚠️  PERMISSION DENIED - The access token may be missing the 'files' scope`);
            console.error(`[${portalId}] ⚠️  Users need to reinstall the app to grant file access permissions`);
          }

          // Still add it but with generic name
          attachments.push({
            id: fileId,
            name: `Attachment ${fileId}`,
            extension: '',
            size: null
          });
        }
      } catch (fileErr) {
        console.error(`[${portalId}] Error fetching file ${fileId}:`, fileErr);
        // Still add it but with generic name
        attachments.push({
          id: fileId,
          name: `Attachment ${fileId}`,
          extension: '',
          size: null
        });
      }
    }

    console.log(`[${portalId}] Returning ${attachments.length} attachments`);

    return res.status(200).json({ attachments });

  } catch (error) {
    console.error('Error fetching attachments:', error);
    // Return empty array on error so card doesn't break
    return res.status(200).json({ attachments: [] });
  }
};
