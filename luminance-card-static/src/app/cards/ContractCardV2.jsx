import React, { useState, useEffect } from 'react';
import {
  hubspot,
  Button,
  Flex,
  Text,
  Select,
  LoadingSpinner,
  Alert,
  Link,
  Divider,
  Heading,
  Input,
  Tag
} from '@hubspot/ui-extensions';

// Required fields for contract generation
const REQUIRED_FIELDS = ['dealname', 'amount'];

// Field display names
const FIELD_LABELS = {
  dealname: 'Deal Name',
  amount: 'Amount',
  dealstage: 'Opportunity Stage'
};

// Helper function to format stage names
const formatStageName = (stageName) => {
  if (!stageName) return 'N/A';

  // Split on capital letters and common separators
  const words = stageName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Split consecutive capitals
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .split(' ')
    .filter(word => word.length > 0);

  // Capitalize first letter of each word
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Polling configuration
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

// Action type options
const ACTION_TYPES = [
  { value: 'generate', label: 'Generate Contract' },
  { value: 'upload', label: 'Upload for Review' }
];

// Contract template options
const CONTRACT_TEMPLATES = [
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'DPA', label: 'Data Processing Agreement (DPA)' }
];

hubspot.extend(({ context, actions }) => (
  <ContractCard context={context} actions={actions} />
));

const ContractCard = ({ context, actions }) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [contractUrl, setContractUrl] = useState(null);
  const [dealData, setDealData] = useState(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [attachments, setAttachments] = useState([]);

  const [formData, setFormData] = useState({
    actionType: '',
    contractType: '',
    notes: ''
  });

  const dealId = context.crm.objectId;
  const portalId = context.portal.id;

  // Fetch deal properties and attachments on mount
  useEffect(() => {
    const fetchDealData = async () => {
      try {
        const properties = await actions.fetchCrmObjectProperties([
          'dealname',
          'amount',
          'dealstage',
          'hs_object_id',
          'luminance_contract_url',
          'luminance_contract_id',
          'luminance_contract_status',
          'hs_attachment_ids'
        ]);

        setDealData(properties);

        // Fetch attachment details with file names (READ-ONLY, doesn't affect generation)
        try {
          console.log('📎 Fetching attachment details...');
          console.log(`   Deal ID: ${dealId}, Portal ID: ${portalId}`);

          const attachmentResponse = await hubspot.fetch(
            `https://luminance-hubspot-middleware.vercel.app/api/get-attachments?dealId=${dealId}&portalId=${portalId}`,
            { method: 'GET' }
          );

          if (attachmentResponse.ok) {
            const attachmentData = await attachmentResponse.json();
            console.log('✅ Attachments received:', attachmentData.attachments);

            if (attachmentData.warning) {
              console.warn('⚠️  Warning from API:', attachmentData.warning);
            }

            if (attachmentData.attachments && attachmentData.attachments.length > 0) {
              console.log(`📎 Found ${attachmentData.attachments.length} attachments:`);
              attachmentData.attachments.forEach(att => {
                console.log(`   - ${att.name} (ID: ${att.id})`);
              });
            } else {
              console.warn('⚠️  No attachments returned from API');
              console.warn('   Possible causes:');
              console.warn('   1. No files attached to the deal in HubSpot');
              console.warn('   2. Missing OAuth permissions (files scope)');
              console.warn('   3. Authentication token not found or expired');
            }

            setAttachments(attachmentData.attachments || []);
          } else {
            console.error('❌ Failed to fetch attachments:', attachmentResponse.status, attachmentResponse.statusText);
            setAttachments([]);
          }
        } catch (attachmentErr) {
          console.error('❌ Error fetching attachments:', attachmentErr);
          console.error('   This may indicate a network issue or middleware problem');
          setAttachments([]);
        }

        if (properties.luminance_contract_url) {
          setContractUrl(properties.luminance_contract_url);
          setSuccess(true);
        }
      } catch (err) {
        console.error('Error fetching deal data:', err);
        setError('Failed to load deal information');
      }
    };

    fetchDealData();
  }, [dealId, actions]);

  // Polling effect
  useEffect(() => {
    if (!polling) return;

    const pollForContract = async () => {
      try {
        const properties = await actions.fetchCrmObjectProperties([
          'luminance_contract_url',
          'luminance_contract_id',
          'luminance_contract_status'
        ]);

        if (properties.luminance_contract_url) {
          console.log('✅ Contract URL found:', properties.luminance_contract_url);
          setContractUrl(properties.luminance_contract_url);
          setSuccess(true);
          setPolling(false);
          setLoading(false);
          setPollAttempts(0);
          setStatusMessage('');
          return;
        }

        const newAttempts = pollAttempts + 1;
        setPollAttempts(newAttempts);
        setStatusMessage(
          `Waiting for contract processing to complete... (${Math.floor(newAttempts * POLL_INTERVAL_MS / 1000)}s)`
        );

        if (newAttempts >= MAX_POLL_ATTEMPTS) {
          setPolling(false);
          setLoading(false);
          setError(
            `Contract processing is taking longer than expected. Please refresh the page in a few moments.`
          );
          setPollAttempts(0);
          setStatusMessage('');
          return;
        }
      } catch (err) {
        console.error('Error polling for contract:', err);
      }
    };

    const pollTimer = setTimeout(pollForContract, POLL_INTERVAL_MS);
    return () => clearTimeout(pollTimer);
  }, [polling, pollAttempts, actions]);

  // Validate required fields
  const validateRequiredFields = () => {
    const missing = [];

    REQUIRED_FIELDS.forEach(field => {
      const value = dealData?.[field];
      if (!value || value === '' || value === null) {
        missing.push(FIELD_LABELS[field] || field);
      }
    });

    if (missing.length > 0) {
      setMissingFields(missing);
      setError(`Missing required fields: ${missing.join(', ')}. Please update the deal properties before continuing.`);
      return false;
    }
    setMissingFields([]);
    return true;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
    if (missingFields.length > 0) setMissingFields([]);
  };

  const validateForm = () => {
    if (!formData.actionType) {
      setError('Please select an action (Generate or Upload)');
      return false;
    }
    if (!formData.contractType) {
      setError('Please select a contract type');
      return false;
    }
    if (formData.actionType === 'upload' && !selectedFile) {
      setError('Please select a file attachment to upload');
      return false;
    }
    if (formData.actionType === 'upload' && attachments.length === 0) {
      setError('No attachments found. Please attach a file to the Deal first.');
      return false;
    }
    return true;
  };

  // Handle submit button click
  const handleSubmit = () => {
    if (!validateForm()) return;

    // Check required fields first
    if (!validateRequiredFields()) {
      return;
    }

    // Execute based on action type
    if (formData.actionType === 'generate') {
      executeGenerate();
    } else {
      executeUpload();
    }
  };

  // Execute contract generation - Call Prismatic directly
  const executeGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setPollAttempts(0);

    try {
      console.log('🚀 Calling middleware to update deal properties...');
      console.log('Deal ID:', dealId);
      console.log('Portal ID:', portalId);
      console.log('Contract Type:', formData.contractType);
      console.log('Action:', 'generate');

      // Prepare payload for middleware (format it expects)
      const payload = {
        dealId: dealId,
        action: 'generate',
        contractType: formData.contractType,
        notes: formData.notes || '',
        attachmentId: '',
        portalId: portalId
      };

      console.log('📤 Sending payload to middleware:', JSON.stringify(payload, null, 2));

      // Call middleware to update deal properties (which triggers workflow)
      const middlewareUrl = 'https://luminance-hubspot-middleware.vercel.app/api/trigger';

      const response = await hubspot.fetch(middlewareUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Enhanced logging to determine where 400 originates
      console.log('📊 Response Details:');
      console.log('  Status:', response.status);
      console.log('  Status Text:', response.statusText);
      console.log('  OK:', response.ok);
      console.log('  Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('❌ Request failed with status:', response.status);

        // Try to get response body
        let errorMessage = `Middleware request failed: ${response.status} ${response.statusText}`;
        let responseBody = '';

        try {
          const errorData = await response.json();
          responseBody = JSON.stringify(errorData, null, 2);
          console.error('❌ Error Response (JSON):', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            responseBody = errorText;
            console.error('❌ Error Response (text):', errorText);
            console.error('❌ Response body length:', errorText.length);
            console.error('❌ Response body is empty:', errorText.length === 0);
            errorMessage = errorText || errorMessage;
          } catch (e2) {
            console.error('❌ Could not read response body at all:', e2);
          }
        }

        console.error('Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Middleware response:', result);

      console.log('⏳ Deal properties updated. Waiting for workflow to trigger and Luminance to process...');
      setStatusMessage('Deal properties updated. Waiting for workflow and Luminance to process...');
      setPolling(true); // Start polling

    } catch (err) {
      console.error('Error calling middleware:', err);
      setError(err.message || 'Failed to update deal properties. Please try again.');
      setLoading(false);
      setPolling(false);
    }
  };

  // Execute contract upload - Call middleware to update properties
  const executeUpload = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setPollAttempts(0);

    try {
      const hasExistingContract = Boolean(dealData?.luminance_contract_id);

      console.log('📤 Calling middleware to update deal properties...');
      console.log('Flow:', hasExistingContract ? '2c (Existing Matter)' : '2b (New Matter with Upload)');
      console.log('Deal ID:', dealId);
      console.log('Portal ID:', portalId);
      console.log('Contract Type:', formData.contractType);
      console.log('Attachment ID:', selectedFile);

      // Prepare payload for middleware (format it expects)
      const payload = {
        dealId: dealId,
        action: 'upload',
        contractType: formData.contractType,
        notes: '',
        attachmentId: selectedFile,
        portalId: portalId
      };

      console.log('📤 Sending payload to middleware:', JSON.stringify(payload, null, 2));

      // Call middleware to update deal properties (which triggers workflow)
      const middlewareUrl = 'https://luminance-hubspot-middleware.vercel.app/api/trigger';

      const response = await hubspot.fetch(middlewareUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Enhanced logging to determine where 400 originates
      console.log('📊 Response Details:');
      console.log('  Status:', response.status);
      console.log('  Status Text:', response.statusText);
      console.log('  OK:', response.ok);
      console.log('  Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('❌ Request failed with status:', response.status);

        // Try to get response body
        let errorMessage = `Middleware request failed: ${response.status} ${response.statusText}`;
        let responseBody = '';

        try {
          const errorData = await response.json();
          responseBody = JSON.stringify(errorData, null, 2);
          console.error('❌ Error Response (JSON):', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            responseBody = errorText;
            console.error('❌ Error Response (text):', errorText);
            console.error('❌ Response body length:', errorText.length);
            console.error('❌ Response body is empty:', errorText.length === 0);
            errorMessage = errorText || errorMessage;
          } catch (e2) {
            console.error('❌ Could not read response body at all:', e2);
          }
        }

        console.error('Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Middleware response:', result);

      console.log('⏳ Deal properties updated. Waiting for workflow to trigger and Luminance to process...');
      setStatusMessage('Deal properties updated. Waiting for workflow and Luminance to process...');
      setPolling(true); // Start polling

    } catch (err) {
      console.error('Error calling middleware:', err);
      setError(err.message || 'Failed to upload contract. Please try again.');
      setLoading(false);
      setPolling(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setSuccess(false);
    setPollAttempts(0);
    setStatusMessage('');
    setMissingFields([]);
    handleSubmit();
  };

  if (!dealData && !error) {
    return (
      <Flex direction="column" align="center" gap="medium">
        <LoadingSpinner />
        <Text>Loading deal information...</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="medium">
      {/* Header */}
      <Flex direction="column" gap="extraSmall">
        <Heading level={3}>Luminance Contracts</Heading>
        <Text variant="microcopy">Generate or upload contracts</Text>
      </Flex>

      {/* Deal Information */}
      <Flex direction="column" gap="small">
        <Text format={{ fontWeight: 'bold' }}>Deal Information</Text>
        <Flex direction="column" gap="extraSmall">
          {['dealname', 'amount', 'dealstage'].map(field => (
            <Flex key={field} direction="column" gap="flush">
              <Flex direction="row" justify="between" align="center">
                <Text variant="microcopy">{FIELD_LABELS[field] || field}:</Text>
                {REQUIRED_FIELDS.includes(field) && !dealData?.[field] && (
                  <Tag variant="error">Required</Tag>
                )}
              </Flex>
              <Text variant="microcopy" format={{ fontWeight: 'demibold' }}>
                {field === 'amount' && dealData?.[field]
                  ? `$${parseFloat(dealData[field]).toLocaleString()}`
                  : field === 'dealstage' && dealData?.[field]
                  ? formatStageName(dealData[field])
                  : dealData?.[field] || 'N/A'}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>

      <Divider />

      {/* Success State */}
      {success && contractUrl && (
        <Alert title="Success!" variant="success">
          <Flex direction="column" gap="small">
            <Text>Your contract has been {formData.actionType === 'upload' ? 'uploaded to' : 'generated in'} Luminance.</Text>
            <Link href={contractUrl} target="_blank">
              Download Luminance Contract
            </Link>
          </Flex>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert title="Error" variant="error">
          <Flex direction="column" gap="small">
            <Text>{error}</Text>
            <Button onClick={handleRetry} variant="secondary" size="small">
              Try Again
            </Button>
          </Flex>
        </Alert>
      )}

      {/* Loading State */}
      {(loading || polling) && (
        <Alert title="Processing Contract" variant="info">
          <Flex direction="column" gap="small" align="center">
            <LoadingSpinner size="sm" />
            <Text>{statusMessage || 'Initializing...'}</Text>
            <Text variant="microcopy">
              This typically takes 10-20 seconds. Please don't close this page.
            </Text>
          </Flex>
        </Alert>
      )}

      {/* Main Form */}
      {!success && !loading && !polling && (
        <Flex direction="column" gap="medium">
          {/* Action Type Dropdown */}
          <Select
            label="Action"
            name="actionType"
            required={true}
            options={ACTION_TYPES}
            value={formData.actionType}
            onChange={(value) => handleInputChange('actionType', value)}
            placeholder="Select action type"
          />

          {/* Contract Type Dropdown */}
          <Select
            label="Contract Type"
            name="contractType"
            required={true}
            options={CONTRACT_TEMPLATES}
            value={formData.contractType}
            onChange={(value) => handleInputChange('contractType', value)}
            placeholder="Select contract type"
          />

          {/* Generate Mode - Notes */}
          {formData.actionType === 'generate' && (
            <Flex direction="column" gap="extraSmall">
              <Text variant="microcopy">Additional Notes (Optional)</Text>
              <Input
                name="notes"
                value={formData.notes}
                onChange={(value) => handleInputChange('notes', value)}
                placeholder="Enter any special instructions..."
              />
            </Flex>
          )}

          {/* Upload Mode - Select from Attachments */}
          {formData.actionType === 'upload' && (
            <Flex direction="column" gap="small">
              {attachments.length > 0 ? (
                <>
                  <Select
                    label="Select Contract File"
                    name="attachment"
                    required={true}
                    options={attachments.map(att => ({ value: att.id, label: att.name }))}
                    value={selectedFile}
                    onChange={(value) => {
                      setSelectedFile(value);
                      if (error) setError(null);
                    }}
                    placeholder="Select an attachment"
                  />
                  {dealData?.luminance_contract_id && (
                    <Alert title="Existing Contract Detected" variant="warning">
                      <Text variant="microcopy">
                        This deal already has a contract. Upload will add to existing matter (Flow 2c).
                      </Text>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert title="No Attachments Found" variant="warning">
                  <Flex direction="column" gap="small">
                    <Text variant="microcopy">
                      Please attach a contract file to this Deal first.
                    </Text>
                    <Text variant="microcopy">
                      Go to the Deal's "Attachments" section and upload your contract document.
                    </Text>
                  </Flex>
                </Alert>
              )}
            </Flex>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={
              !formData.actionType ||
              !formData.contractType ||
              (formData.actionType === 'upload' && (!selectedFile || attachments.length === 0))
            }
            variant="primary"
          >
            {formData.actionType === 'upload' ? 'Upload Contract to Luminance' : 'Generate Contract in Luminance'}
          </Button>
        </Flex>
      )}

      {/* Reset Option */}
      {success && (
        <Button
          onClick={() => {
            setSuccess(false);
            setContractUrl(null);
            setFormData({ actionType: '', contractType: '', notes: '' });
            setSelectedFile(null);
          }}
          variant="secondary"
          size="small"
        >
          Process Another Contract
        </Button>
      )}

      <Divider />

      {/* Footer */}
      <Flex justify="center">
        <Text variant="microcopy" inline>
          Powered by{' '}
          <Link href="https://www.luminance.com" target="_blank">
            Luminance
          </Link>
        </Text>
      </Flex>
    </Flex>
  );
};
