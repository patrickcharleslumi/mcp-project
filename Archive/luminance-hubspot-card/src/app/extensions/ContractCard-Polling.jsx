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
  Box
} from '@hubspot/ui-extensions';

// Prismatic webhook endpoint
const PRISMATIC_WEBHOOK_URL = 'https://hooks.luminance-production-eu-central-1.prismatic.io/trigger/SW5zdGFuY2VGbG93Q29uZmlnOmZiMDBmODdiLTZhM2QtNGY0MS1iNTNhLTJiNDViYTAyYjY1NA==';

// Polling configuration
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Maximum 30 attempts (1 minute total)

// Luminance brand colors
const COLORS = {
  primary: '#3B54BC',
  lightBlue: '#81B5F2',
  iceWhite: '#F5F6FC',
  midnightBlue: '#0B0F28'
};

// Contract template options
const CONTRACT_TEMPLATES = [
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'DPA', label: 'Data Processing Agreement (DPA)' }
];

hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <ContractCard
    context={context}
    runServerlessFunction={runServerlessFunction}
    actions={actions}
  />
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
  const [formData, setFormData] = useState({
    contractType: '',
    notes: ''
  });

  // Extract deal ID from context
  const dealId = context.crm.objectId;

  // Fetch deal properties on mount
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
          'luminance_contract_status'
        ]);

        setDealData(properties);

        // Check if contract already exists
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

  // Polling effect - checks for contract URL in deal properties
  useEffect(() => {
    if (!polling) return;

    const pollForContract = async () => {
      try {
        // Fetch fresh deal properties
        const properties = await actions.fetchCrmObjectProperties([
          'luminance_contract_url',
          'luminance_contract_id',
          'luminance_contract_status'
        ]);

        // Check if contract URL has been set by Prismatic Flow 5
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

        // Increment poll attempts
        const newAttempts = pollAttempts + 1;
        setPollAttempts(newAttempts);

        setStatusMessage(
          `Waiting for contract generation to complete... (${Math.floor(newAttempts * POLL_INTERVAL_MS / 1000)}s)`
        );

        // Check if we've exceeded max attempts
        if (newAttempts >= MAX_POLL_ATTEMPTS) {
          setPolling(false);
          setLoading(false);
          setError(
            'Contract generation is taking longer than expected. ' +
            'Please refresh the page in a few moments to see the contract link.'
          );
          setPollAttempts(0);
          setStatusMessage('');
          return;
        }

      } catch (err) {
        console.error('Error polling for contract:', err);
        // Don't fail completely, just log and continue polling
      }
    };

    // Set up polling interval
    const pollTimer = setTimeout(pollForContract, POLL_INTERVAL_MS);

    // Cleanup
    return () => clearTimeout(pollTimer);
  }, [polling, pollAttempts, actions]);

  // Handle form field changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  // Validate form before submission
  const validateForm = () => {
    if (!formData.contractType) {
      setError('Please select a contract type');
      return false;
    }
    return true;
  };

  // Handle contract generation
  const handleGenerateContract = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setPollAttempts(0);

    try {
      // Prepare payload for Prismatic
      const payload = {
        luminanceAction__c: 'generate_contract',
        contract_type: formData.contractType,
        hs_op_id: dealData?.hs_object_id || dealId,
        matterId: '', // Empty for new matter
        upload: formData.notes || '', // Notes go in upload field
        signature: `HubSpot-${Date.now()}`,
        request_origin: 'HubSpot CRM Card',
        // Additional context
        dealName: dealData?.dealname,
        dealAmount: dealData?.amount,
        dealStage: dealData?.dealstage
      };

      console.log('🚀 Triggering Prismatic webhook...');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      // Call Prismatic webhook (this triggers the flow but doesn't wait for contract URL)
      const response = await fetch(PRISMATIC_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Prismatic response:', result);

      // Webhook triggered successfully
      // Now start polling for the contract URL that Flow 5 will set
      console.log('✅ Contract generation triggered');
      console.log('⏳ Polling for contract URL in deal properties...');

      setStatusMessage('Contract generation in progress...');
      setPolling(true); // Start polling

    } catch (err) {
      console.error('Error triggering contract generation:', err);
      setError(err.message || 'Failed to trigger contract generation. Please try again.');
      setLoading(false);
      setPolling(false);
    }
  };

  // Handle retry after error
  const handleRetry = () => {
    setError(null);
    setSuccess(false);
    setPollAttempts(0);
    setStatusMessage('');
    handleGenerateContract();
  };

  // Loading state
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
      {/* Header with Luminance branding */}
      <Flex direction="column" gap="small">
        <Heading level={3}>Luminance Contracts</Heading>
        <Text variant="microcopy">Generate contracts directly from HubSpot</Text>
      </Flex>

      <Divider />

      {/* Deal Information Display */}
      <Flex direction="column" gap="small">
        <Text format={{ fontWeight: 'bold' }}>Deal Information</Text>
        <Flex direction="column" gap="extraSmall">
          <Flex justify="between">
            <Text variant="microcopy">Opportunity:</Text>
            <Text variant="microcopy" format={{ fontWeight: 'demibold' }}>
              {dealData?.dealname || 'N/A'}
            </Text>
          </Flex>
          <Flex justify="between">
            <Text variant="microcopy">Amount:</Text>
            <Text variant="microcopy" format={{ fontWeight: 'demibold' }}>
              {dealData?.amount ? `$${parseFloat(dealData.amount).toLocaleString()}` : 'N/A'}
            </Text>
          </Flex>
          <Flex justify="between">
            <Text variant="microcopy">Stage:</Text>
            <Text variant="microcopy" format={{ fontWeight: 'demibold' }}>
              {dealData?.dealstage || 'N/A'}
            </Text>
          </Flex>
          <Flex justify="between">
            <Text variant="microcopy">Record ID:</Text>
            <Text variant="microcopy" format={{ fontWeight: 'demibold' }}>
              {dealData?.hs_object_id || dealId}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      <Divider />

      {/* Success State */}
      {success && contractUrl && (
        <Alert title="Contract Generated Successfully" variant="success">
          <Flex direction="column" gap="small">
            <Text>Your contract has been generated in Luminance.</Text>
            <Link href={contractUrl} target="_blank">
              Open Contract in Luminance
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

      {/* Loading/Polling State */}
      {(loading || polling) && (
        <Alert title="Generating Contract" variant="info">
          <Flex direction="column" gap="small" align="center">
            <LoadingSpinner size="sm" />
            <Text>{statusMessage || 'Initializing contract generation...'}</Text>
            <Text variant="microcopy">
              This typically takes 10-20 seconds. Please don't close this page.
            </Text>
          </Flex>
        </Alert>
      )}

      {/* Form Section - Only show if no success yet and not loading */}
      {!success && !loading && !polling && (
        <Flex direction="column" gap="medium">
          <Flex direction="column" gap="small">
            <Text format={{ fontWeight: 'bold' }}>Contract Generation</Text>

            {/* Contract Type Selector */}
            <Select
              label="Contract Type"
              name="contractType"
              required={true}
              options={CONTRACT_TEMPLATES}
              value={formData.contractType}
              onChange={(value) => handleInputChange('contractType', value)}
              placeholder="Select a contract type"
            />

            {/* Notes/Instructions */}
            <Flex direction="column" gap="extraSmall">
              <Text variant="microcopy">Additional Notes (Optional)</Text>
              <Input
                name="notes"
                value={formData.notes}
                onChange={(value) => handleInputChange('notes', value)}
                placeholder="Enter any special instructions..."
              />
            </Flex>
          </Flex>

          {/* Generate Button */}
          <Button
            type="submit"
            onClick={handleGenerateContract}
            disabled={!formData.contractType}
            variant="primary"
          >
            Generate Contract in Luminance
          </Button>
        </Flex>
      )}

      {/* Reset Form Option (when contract exists) */}
      {success && (
        <Button
          onClick={() => {
            setSuccess(false);
            setContractUrl(null);
            setFormData({ contractType: '', notes: '' });
          }}
          variant="secondary"
          size="small"
        >
          Generate Another Contract
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

// Simple Input component
const Input = ({ name, value, onChange, placeholder, disabled }) => {
  return (
    <Box>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px',
          fontSize: '14px',
          borderRadius: '4px',
          border: '1px solid #cbd6e2',
          fontFamily: 'inherit',
          resize: 'vertical'
        }}
      />
    </Box>
  );
};
