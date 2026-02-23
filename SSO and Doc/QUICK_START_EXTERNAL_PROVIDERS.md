# Quick Start: Setting Up External Providers

## What You Need

### Required for All Setups
- **ENV_ID**: Your Luminance environment ID (e.g., `123456` or `luminance-demo`)
- **SECRET_KEY**: Your Luminance API secret (from Mercury credentials)

### For SAML SSO
- **SAML XML Metadata**: Complete XML file from your Identity Provider

### For DocuSign
- **DocuSign Account ID**: 32-40 character identifier
- **DocuSign Base URL**: `account.docusign.net` (prod) or `account-d.docusign.net` (demo)
- **DocuSign Secret**: (Optional - can be set later)

## Quick Examples

### 1. Set up SAML from XML file
```bash
python3 setup_external_providers.py \
    --env-id your-env-id \
    --secret your-secret-key \
    --saml-xml /path/to/metadata.xml \
    --saml-name "Customer Company SSO"
```

### 2. Set up DocuSign
```bash
python3 setup_external_providers.py \
    --env-id your-env-id \
    --secret your-secret-key \
    --docusign-account-id "abc123-def456-ghi789" \
    --docusign-base-url "account.docusign.net" \
    --docusign-secret "your-secret"
```

### 3. Set up both at once
```bash
python3 setup_external_providers.py \
    --env-id your-env-id \
    --secret your-secret-key \
    --saml-xml metadata.xml \
    --saml-name "Customer SSO" \
    --docusign-account-id "abc123..." \
    --docusign-base-url "account.docusign.net"
```

## From Power Apps / Excel

If you're collecting data in Power Apps:

1. **Store in Excel/SharePoint** with these columns:
   - `env_id`
   - `secret_key` 
   - `saml_xml` (or file path)
   - `docusign_account_id`
   - `docusign_base_url`
   - `docusign_secret`

2. **Process with Python**:
```python
import pandas as pd
from setup_external_providers import setup_saml_provider, setup_docusign_provider
import lumpy.api

# Read from Excel
df = pd.read_excel('powerapps_submissions.xlsx')

for _, row in df.iterrows():
    # Authenticate
    session = lumpy.api.Session(lumpy.api.default_base_uri(row['env_id']))
    session.login(row['secret_key'])
    
    # Set up SAML if provided
    if pd.notna(row.get('saml_xml')):
        setup_saml_provider(
            session, 
            row['saml_xml'], 
            f"{row.get('company_name', 'Customer')} SSO"
        )
    
    # Set up DocuSign if provided
    if pd.notna(row.get('docusign_account_id')):
        setup_docusign_provider(
            session,
            row['docusign_account_id'],
            row['docusign_base_url'],
            secret=row.get('docusign_secret')
        )
```

## Programmatic Usage (Power Automate / Azure Function)

```python
from setup_external_providers import setup_saml_provider, setup_docusign_provider
import lumpy.api
import json

def main(req):
    data = req.get_json()
    
    # Authenticate
    session = lumpy.api.Session(lumpy.api.default_base_uri(data['env_id']))
    session.login(data['secret_key'])
    
    results = {}
    
    # Set up SAML
    if data.get('saml_xml'):
        results['saml'] = setup_saml_provider(
            session,
            data['saml_xml'],
            data.get('saml_name', 'Customer SSO')
        )
    
    # Set up DocuSign
    if data.get('docusign_account_id'):
        results['docusign'] = setup_docusign_provider(
            session,
            data['docusign_account_id'],
            data['docusign_base_url'],
            secret=data.get('docusign_secret')
        )
    
    return json.dumps(results)
```

## Important Notes

1. **Account ID is auto-retrieved** - No need to provide it manually
2. **SAML callback URI is auto-generated** - Format: `{base_uri}/saml2/sp`
3. **DocuSign requires support** - Provider will be in 'pending' state until support completes setup
4. **Secrets can be set later** - Use `updateSecret` endpoint if needed

## Troubleshooting

- **"Invalid SAML XML"**: Check that XML contains `SingleSignOnService` and `X509Certificate`
- **"Failed to create provider"**: Check API permissions and network connectivity
- **"Provider in pending state"**: Normal for DocuSign - support will activate it

See `SETUP_EXTERNAL_PROVIDERS_README.md` for full documentation.
