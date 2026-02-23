const hubspot = require('@hubspot/api-client');

// Replace with your private app token or OAuth access token for the test portal
const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE';

const hubspotClient = new hubspot.Client({ accessToken: ACCESS_TOKEN });

const properties = [
  {
    name: 'luminance_trigger_action',
    label: 'Luminance Trigger Action',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    options: [
      { label: 'Generate', value: 'generate' },
      { label: 'Upload', value: 'upload' }
    ]
  },
  {
    name: 'luminance_contract_type',
    label: 'Luminance Contract Type',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    options: [
      { label: 'NDA', value: 'NDA' },
      { label: 'DPA', value: 'DPA' }
    ]
  },
  {
    name: 'luminance_trigger_timestamp',
    label: 'Luminance Trigger Timestamp',
    type: 'string',
    fieldType: 'text',
    groupName: 'dealinformation'
  },
  {
    name: 'luminance_notes',
    label: 'Luminance Notes',
    type: 'string',
    fieldType: 'textarea',
    groupName: 'dealinformation'
  },
  {
    name: 'luminance_attachment_id',
    label: 'Luminance Attachment ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'dealinformation'
  },
  {
    name: 'luminance_contract_url',
    label: 'Luminance Contract URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'dealinformation'
  },
  {
    name: 'luminance_contract_id',
    label: 'Luminance Contract ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'dealinformation'
  },
  {
    name: 'luminance_contract_status',
    label: 'Luminance Contract Status',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Generated', value: 'generated' },
      { label: 'Uploaded', value: 'uploaded' },
      { label: 'Error', value: 'error' }
    ]
  }
];

async function createProperties() {
  console.log('Creating Luminance custom properties...\n');

  for (const property of properties) {
    try {
      const result = await hubspotClient.crm.properties.coreApi.create('deals', property);
      console.log(`✅ Created: ${property.name}`);
    } catch (error) {
      if (error.code === 409) {
        console.log(`⚠️  Already exists: ${property.name}`);
      } else {
        console.error(`❌ Failed to create ${property.name}:`, error.message);
      }
    }
  }

  console.log('\n✨ Done!');
}

createProperties().catch(console.error);
