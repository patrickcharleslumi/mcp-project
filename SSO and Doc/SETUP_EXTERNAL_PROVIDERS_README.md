# External Provider Setup Guide

This guide explains how to programmatically set up SAML SSO and DocuSign integrations in Luminance using the `setup_external_providers.py` script.

## Required Information

### For Authentication
- **ENV_ID**: Luminance environment ID (e.g., `123456` or `luminance-demo`)
- **SECRET_KEY**: Luminance API secret key (from Mercury credentials)

### For SAML SSO Setup
- **SAML XML Metadata**: Complete SAML metadata XML file from your Identity Provider
  - Must contain: `SingleSignOnService` Location (entry point)
  - Must contain: `X509Certificate` (public certificate)
  - Optional: Entity ID, attribute mappings

### For DocuSign Setup
- **DocuSign Account ID**: 32-40 character account identifier
- **DocuSign Base URL**: 
  - Production: `account.docusign.net`
  - Demo/Testing: `account-d.docusign.net`
- **DocuSign Secret**: (Optional, can be set later via API)

## Installation

1. Ensure you have Python 3.7+ installed
2. Install required packages:
   ```bash
   pip install python-dotenv
   ```
3. Ensure the `lumpy` package is available in your Python path

## Usage

### Option 1: Command Line (Standalone)

```bash
# Set up SAML provider
python3 setup_external_providers.py \
    --env-id <ENV_ID> \
    --secret <SECRET_KEY> \
    --saml-xml /path/to/metadata.xml \
    --saml-name "My Company SSO"

# Set up DocuSign provider
python3 setup_external_providers.py \
    --env-id <ENV_ID> \
    --secret <SECRET_KEY> \
    --docusign-account-id "abc123..." \
    --docusign-base-url "account.docusign.net" \
    --docusign-secret "secret-key-here"

# Set up both at once
python3 setup_external_providers.py \
    --env-id <ENV_ID> \
    --secret <SECRET_KEY> \
    --saml-xml /path/to/metadata.xml \
    --saml-name "My Company SSO" \
    --docusign-account-id "abc123..." \
    --docusign-base-url "account.docusign.net"
```

### Option 2: Programmatic (Power Apps / Automation)

```python
from setup_external_providers import (
    setup_saml_provider,
    setup_docusign_provider,
    get_account_id
)
import lumpy.api

# Authenticate
session = lumpy.api.Session(lumpy.api.default_base_uri("your-env-id"))
session.login("your-secret-key")

# Set up SAML
saml_provider = setup_saml_provider(
    session=session,
    saml_xml=saml_xml_string,
    provider_name="Customer SSO",
    provides=['auth', 'autoprovision']
)

# Set up DocuSign
docusign_provider = setup_docusign_provider(
    session=session,
    account_id_docusign="abc123-def456-...",
    base_url="account.docusign.net",
    provider_name="Customer DocuSign",
    secret="docusign-secret-key"  # Optional
)
```

### Option 3: From Excel/Power Apps Data

If you're capturing data in Power Apps and storing in Excel, you can:

1. **Export Excel to CSV** with columns:
   - `env_id`
   - `secret_key`
   - `saml_xml` (or `saml_xml_file_path`)
   - `docusign_account_id`
   - `docusign_base_url`
   - `docusign_secret`

2. **Process CSV with script**:
```python
import pandas as pd
from setup_external_providers import setup_saml_provider, setup_docusign_provider
import lumpy.api

df = pd.read_csv('submissions.csv')

for _, row in df.iterrows():
    session = lumpy.api.Session(lumpy.api.default_base_uri(row['env_id']))
    session.login(row['secret_key'])
    
    if pd.notna(row.get('saml_xml')):
        setup_saml_provider(session, row['saml_xml'], "Customer SSO")
    
    if pd.notna(row.get('docusign_account_id')):
        setup_docusign_provider(
            session,
            row['docusign_account_id'],
            row['docusign_base_url'],
            secret=row.get('docusign_secret')
        )
```

## SAML XML Requirements

The SAML XML metadata must contain:

1. **EntityDescriptor** with `entityID` attribute
2. **IDPSSODescriptor** element
3. **SingleSignOnService** with `Location` attribute (the SSO entry point)
4. **KeyDescriptor** with `X509Certificate` (the public certificate)

Example minimal structure:
```xml
<?xml version="1.0"?>
<EntityDescriptor entityID="https://idp.example.com/entity">
  <IDPSSODescriptor>
    <SingleSignOnService 
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="https://idp.example.com/sso"/>
    <KeyDescriptor use="signing">
      <KeyInfo>
        <X509Data>
          <X509Certificate>MIIDXTCCAkWgAwIBAgIJAK...</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
  </IDPSSODescriptor>
</EntityDescriptor>
```

## DocuSign Environment Types

- **production**: Uses production DocuSign account (`account.docusign.net`)
  - Integration Key: Auto-set to production key
- **testing**: Uses testing account (`account-d.docusign.net`)
  - Integration Key: Auto-set to testing key
- **development**: Requires custom integration key
  - You must provide `integration_key` parameter

## Important Notes

### SAML Provider
- The callback URI is automatically generated as: `{base_uri}/saml2/sp`
- The identifier is set to the callback URI
- Default `email_key` is `nameID` if not specified
- Provider will be active immediately after creation

### DocuSign Provider
- **Requires Support Intervention**: DocuSign providers are set to `state: 'pending'` initially
- An email is automatically sent to Luminance support when created
- The provider won't be active until support completes the setup
- You can set the secret later using the `updateSecret` endpoint

### Account ID
- The script automatically retrieves `account_id` from your user session
- No need to provide it manually unless you're working with a specific account

## Error Handling

The script will:
- ✅ Validate SAML XML structure
- ✅ Extract required fields from SAML metadata
- ✅ Handle missing or invalid certificates
- ✅ Provide clear error messages

Common errors:
- `Invalid SAML XML`: XML is malformed or missing required elements
- `Could not extract entry_point`: No SingleSignOnService found
- `Could not extract public_cert`: No X509Certificate found
- `Failed to create/update provider`: API error (check permissions, network)

## Testing

Test with a sample SAML XML first:
```bash
python3 setup_external_providers.py \
    --env-id <ENV_ID> \
    --secret <SECRET_KEY> \
    --saml-xml "<?xml version='1.0'?><EntityDescriptor>...</EntityDescriptor>" \
    --saml-name "Test SSO"
```

Verify the provider was created:
```bash
python3 external_provider_config.py  # Lists all providers
```

## Integration with Power Apps

If you're using Power Apps to collect this data:

1. **Store data in Excel/SharePoint** with columns:
   - Environment ID
   - Secret Key (securely stored)
   - SAML XML (as text or file path)
   - DocuSign Account ID
   - DocuSign Base URL

2. **Use Power Automate** to:
   - Trigger on new row in Excel
   - Call Azure Function or HTTP endpoint
   - Pass data to Python script or API

3. **Or use Power Apps** to:
   - Call Azure Function directly
   - Pass form data as JSON
   - Function runs the setup script

## Security Considerations

- ⚠️ **Never commit secrets to version control**
- ⚠️ **Store SECRET_KEY securely** (use environment variables or secure vault)
- ⚠️ **Validate SAML XML** before processing (prevent XML injection)
- ⚠️ **Use HTTPS** for all API calls
- ⚠️ **Rotate secrets regularly**

## Troubleshooting

### "Could not retrieve account_id"
- Ensure your API secret has proper permissions
- Check that you're authenticated correctly

### "Failed to create/update provider"
- Verify you have admin account role
- Check network connectivity
- Review API response for specific error

### "Provider created but not active"
- DocuSign providers require support intervention
- Check provider state: `GET /api/external_providers/{id}`
- Contact Luminance support if needed

## Next Steps

After setting up providers:
1. **Test SAML SSO**: Try logging in via SSO
2. **Verify DocuSign**: Check provider state and test integration
3. **Monitor**: Check provider status regularly
4. **Update secrets**: Rotate secrets as needed using `updateSecret` endpoint
