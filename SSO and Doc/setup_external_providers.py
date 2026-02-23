#!/usr/bin/env python3
"""
External Provider Setup Script

This script can be used to programmatically set up:
- SAML2 SSO providers (from SAML XML metadata)
- DocuSign integrations (from Account ID and Base URL)

Can be run standalone or called programmatically from Power Apps automation.

Usage:
    python3 setup_external_providers.py --env-id <ENV_ID> --secret <SECRET> [options]

Or import and use programmatically:
    from setup_external_providers import setup_saml_provider, setup_docusign_provider
"""

import os
import sys
import json
import argparse
import xml.etree.ElementTree as ET
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse
import re

try:
    import lumpy.api
    from dotenv import load_dotenv
except ImportError:
    print("Error: Required packages not installed. Run: pip install python-dotenv")
    print("Also ensure 'lumpy' package is available in your Python path.")
    sys.exit(1)


# ============================================================================
# SAML XML PARSING
# ============================================================================

def parse_saml_xml(saml_xml: str) -> Dict[str, Optional[str]]:
    """
    Parse SAML XML metadata to extract required configuration fields.
    
    Args:
        saml_xml: SAML metadata XML as string
        
    Returns:
        Dictionary with extracted fields:
        - entry_point: SSO URL (SingleSignOnService Location)
        - public_cert: X509 certificate (from X509Certificate element)
        - entity_id: Entity ID (from EntityDescriptor entityID)
        - name_key: Optional name attribute key
        - email_key: Optional email attribute key
    """
    try:
        # Register namespaces
        namespaces = {
            'md': 'urn:oasis:names:tc:SAML:2.0:metadata',
            'ds': 'http://www.w3.org/2000/09/xmldsig#',
            'saml': 'urn:oasis:names:tc:SAML:2.0:assertion'
        }
        
        root = ET.fromstring(saml_xml)
        
        result = {
            'entry_point': None,
            'public_cert': None,
            'entity_id': None,
            'name_key': None,
            'email_key': None
        }
        
        # Extract Entity ID
        result['entity_id'] = root.get('entityID')
        
        # Find IDPSSODescriptor (Identity Provider)
        idp_descriptor = root.find('.//md:IDPSSODescriptor', namespaces)
        if idp_descriptor is None:
            # Try without namespace prefix
            idp_descriptor = root.find('.//{urn:oasis:names:tc:SAML:2.0:metadata}IDPSSODescriptor')
        
        if idp_descriptor is not None:
            # Find SingleSignOnService (entry point)
            sso_service = idp_descriptor.find('.//md:SingleSignOnService', namespaces)
            if sso_service is None:
                sso_service = idp_descriptor.find('.//{urn:oasis:names:tc:SAML:2.0:metadata}SingleSignOnService')
            
            if sso_service is not None:
                result['entry_point'] = sso_service.get('Location')
            
            # Find KeyDescriptor with signing certificate
            key_descriptor = idp_descriptor.find('.//md:KeyDescriptor[@use="signing"]', namespaces)
            if key_descriptor is None:
                # Try without use attribute
                key_descriptor = idp_descriptor.find('.//md:KeyDescriptor', namespaces)
            if key_descriptor is None:
                # Try without namespace
                key_descriptor = idp_descriptor.find('.//{urn:oasis:names:tc:SAML:2.0:metadata}KeyDescriptor')
            
            if key_descriptor is not None:
                # Find X509Certificate
                cert_elem = key_descriptor.find('.//ds:X509Certificate', namespaces)
                if cert_elem is None:
                    cert_elem = key_descriptor.find('.//{http://www.w3.org/2000/09/xmldsig#}X509Certificate')
                
                if cert_elem is not None and cert_elem.text:
                    cert_text = cert_elem.text.strip()
                    # Format as PEM if not already
                    if not cert_text.startswith('-----BEGIN'):
                        cert_text = '-----BEGIN CERTIFICATE-----\n' + cert_text + '\n-----END CERTIFICATE-----'
                    result['public_cert'] = cert_text
        
        # Try to find certificate in root if not found in IDP descriptor
        if not result['public_cert']:
            cert_elem = root.find('.//ds:X509Certificate', namespaces)
            if cert_elem is None:
                cert_elem = root.find('.//{http://www.w3.org/2000/09/xmldsig#}X509Certificate')
            if cert_elem is not None and cert_elem.text:
                cert_text = cert_elem.text.strip()
                if not cert_text.startswith('-----BEGIN'):
                    cert_text = '-----BEGIN CERTIFICATE-----\n' + cert_text + '\n-----END CERTIFICATE-----'
                result['public_cert'] = cert_text
        
        return result
        
    except ET.ParseError as e:
        raise ValueError(f"Invalid SAML XML: {e}")
    except Exception as e:
        raise ValueError(f"Error parsing SAML XML: {e}")


def format_certificate(cert_text: str) -> str:
    """Format certificate text as PEM if needed."""
    cert_text = cert_text.strip()
    if not cert_text.startswith('-----BEGIN'):
        # Add PEM headers if missing
        cert_text = '-----BEGIN CERTIFICATE-----\n' + cert_text + '\n-----END CERTIFICATE-----'
    return cert_text


# ============================================================================
# LUMINANCE API HELPERS
# ============================================================================

def get_account_id(session) -> Optional[int]:
    """
    Get the account_id from existing providers or return None.
    OAuth2 client credentials don't have access to /api/users/me,
    so we try to get it from existing external providers.
    """
    try:
        # Try to get from /api/users/me first (works with session-based auth)
        try:
            response = session.get('/api/users/me')
            user_data = response.json()
            account_id = user_data.get('account_id')
            if account_id:
                return account_id
        except:
            # If that fails, try to get from existing providers
            pass
        
        # Fallback: get account_id from existing external providers
        try:
            response = session.get('/api/external_providers?limit=1')
            providers = response.json()
            if providers and len(providers) > 0:
                account_id = providers[0].get('account_id')
                if account_id:
                    return account_id
        except:
            pass
        
        return None
    except Exception as e:
        return None


def get_base_uri(env_id: str) -> str:
    """Get the base URI for the Luminance environment."""
    return lumpy.api.default_base_uri(env_id)


def get_saml_callback_uri(base_uri: str) -> str:
    """Generate the SAML callback URI for this environment."""
    return f"{base_uri}/saml2/sp"


def find_provider_by_name_type(session, name: str, provider_type: str) -> Optional[int]:
    """Find an existing provider by name and type. Returns provider ID if found, None otherwise."""
    try:
        response = session.get('/api/external_providers')
        providers = response.json()
        for provider in providers:
            if provider.get('name') == name and provider.get('type') == provider_type:
                return provider.get('id')
        return None
    except Exception as e:
        print(f"Warning: Could not search for existing providers: {e}")
        return None


# ============================================================================
# PROVIDER SETUP FUNCTIONS
# ============================================================================

def setup_saml_provider(
    session,
    saml_xml: str,
    provider_name: str,
    account_id: Optional[int] = None,
    base_uri: Optional[str] = None,
    provides: list = None,
    name_key: Optional[str] = None,
    email_key: Optional[str] = None,
    provider_id: Optional[int] = None
) -> Dict:
    """
    Set up a SAML2 SSO provider.
    
    Args:
        session: Authenticated Luminance API session
        saml_xml: SAML metadata XML string
        provider_name: Name for the provider
        account_id: Account ID (will be fetched if not provided)
        base_uri: Base URI for callback (will be generated if not provided)
        provides: List of capabilities ['auth', 'autoprovision', 'claims_mapping']
        name_key: Optional SAML attribute key for user name
        email_key: Optional SAML attribute key for user email
        provider_id: Optional existing provider ID to update
        
    Returns:
        Dictionary with provider data
    """
    if provides is None:
        provides = ['auth']
    
    # Parse SAML XML
    saml_data = parse_saml_xml(saml_xml)
    
    if not saml_data['entry_point']:
        raise ValueError("Could not extract entry_point from SAML XML")
    if not saml_data['public_cert']:
        raise ValueError("Could not extract public_cert from SAML XML")
    
    # Get account_id if not provided
    if account_id is None:
        account_id = get_account_id(session)
        if account_id is None:
            raise ValueError(
                "Could not determine account_id. Please provide it explicitly:\n"
                "  setup_saml_provider(..., account_id=YOUR_ACCOUNT_ID)"
            )
    
    # Get base_uri if not provided (needed for callback URI)
    if base_uri is None:
        # Extract from session base_url
        base_uri = session.base_url.rstrip('/')
    
    # Build provider configuration
    callback_uri = get_saml_callback_uri(base_uri)
    
    provider_config = {
        'name': provider_name,
        'type': 'saml2',
        'account_id': account_id,
        'identifier': callback_uri,
        'provides': provides,
        'options': {
            'entry_point': saml_data['entry_point'],
            'public_cert': format_certificate(saml_data['public_cert']),
            'identifier_key': 'nameID'
        }
    }
    
    # Add optional fields
    if name_key:
        provider_config['options']['name_key'] = name_key
    if email_key:
        provider_config['options']['email_key'] = email_key
    elif not email_key:
        # Default to nameID if email format
        provider_config['options']['email_key'] = 'nameID'
    
    # Add host if we can extract it from entry_point
    if saml_data['entry_point']:
        try:
            parsed = urlparse(saml_data['entry_point'])
            provider_config['host'] = parsed.hostname
        except:
            pass
    
    # Find existing provider if not specified
    if not provider_id:
        provider_id = find_provider_by_name_type(session, provider_name, 'saml2')
    
    # Create or update provider
    # The collection router uses PUT with ID for upsert (create if doesn't exist, update if does)
    if provider_id:
        # Update existing provider
        response = session.put(f'/api/external_providers/{provider_id}', json=provider_config)
    else:
        # For new providers, we need to use PUT with a high temporary ID
        # The API will handle the actual ID assignment on insert
        # Using a high number that's unlikely to conflict (collection router will assign real ID)
        temp_id = 999999
        response = session.put(f'/api/external_providers/{temp_id}', json=provider_config)
    
    if response.status_code not in [200, 201]:
        raise Exception(f"Failed to create/update SAML provider: {response.status_code} - {response.text}")
    
    return response.json()


def setup_docusign_provider(
    session,
    account_id_docusign: str,
    base_url: str,
    provider_name: str = "DocuSign Integration",
    account_id: Optional[int] = None,
    integration_key: Optional[str] = None,
    secret: Optional[str] = None,
    provider_id: Optional[int] = None,
    environment: str = 'production'  # 'production', 'testing', or 'development'
) -> Dict:
    """
    Set up a DocuSign provider.
    
    Args:
        session: Authenticated Luminance API session
        account_id_docusign: DocuSign Account ID (32-40 chars)
        base_url: DocuSign base URL (e.g., 'account.docusign.net' or 'account-d.docusign.net')
        provider_name: Name for the provider
        account_id: Luminance account ID (will be fetched if not provided)
        integration_key: DocuSign Integration Key (required for development, auto-set for prod/testing)
        secret: DocuSign secret (will need to be set separately via updateSecret endpoint)
        provider_id: Optional existing provider ID to update
        
    Returns:
        Dictionary with provider data
    """
    # Get account_id if not provided
    if account_id is None:
        account_id = get_account_id(session)
        if account_id is None:
            # Don't fail immediately - try without it, API might accept it or give helpful error
            print("   ⚠️  Warning: Could not determine account_id automatically.")
            print("   Attempting to create provider anyway...")
            print("   (If it fails, you'll need to provide account_id manually)")
    
    # Determine host and identifier based on environment
    if 'account-d.docusign.net' in base_url or 'demo' in base_url.lower():
        host = 'account-d.docusign.net'
        if environment == 'testing':
            identifier = '0f1754c4-b1b2-4817-9bcf-5908fa28d326'  # Testing
        else:
            identifier = integration_key or '0f1754c4-b1b2-4817-9bcf-5908fa28d326'
    else:
        host = 'account.docusign.net'
        if environment == 'production':
            identifier = '824ad6b0-de12-4d65-a008-0f945cc9549c'  # Production (masked)
        elif environment == 'development':
            if not integration_key:
                raise ValueError("integration_key is required for development environment")
            identifier = integration_key
        else:
            identifier = integration_key or '824ad6b0-de12-4d65-a008-0f945cc9549c'
    
    # Build provider configuration
    provider_config = {
        'name': provider_name,
        'type': 'docusign',
        'host': host,
        'identifier': identifier,
        'provides': ['report'],
        'options': {
            'account_id': account_id_docusign
        },
        'state': 'pending'  # DocuSign requires support intervention
    }
    
    # Add account_id only if we have it (required by API)
    if account_id:
        provider_config['account_id'] = account_id
    else:
        print("   ⚠️  Warning: No account_id available - API will likely reject this request")
        print("   The API requires account_id. You'll need to provide it manually.")
    
    # Find existing provider if not specified
    if not provider_id:
        provider_id = find_provider_by_name_type(session, provider_name, 'docusign')
    
    # Create or update provider
    if provider_id:
        response = session.put(f'/api/external_providers/{provider_id}', json=provider_config)
    else:
        # Use a high temp ID for new providers
        temp_id = 999998
        response = session.put(f'/api/external_providers/{temp_id}', json=provider_config)
    
    if response.status_code not in [200, 201]:
        error_msg = f"Failed to create/update DocuSign provider: {response.status_code}"
        try:
            error_data = response.json()
            if isinstance(error_data, dict):
                error_msg += f"\n   Error: {error_data}"
                if 'message' in error_data:
                    error_msg += f"\n   Message: {error_data['message']}"
            else:
                error_msg += f": {error_data}"
        except:
            error_msg += f"\n   Response: {response.text[:500]}"
        
        # If it's a 401/403 and we don't have account_id, provide helpful message
        if response.status_code in [401, 403] and not account_id:
            error_msg += "\n\n   💡 This might be because:"
            error_msg += "\n   1. OAuth2 tokens don't work with /api endpoints"
            error_msg += "\n   2. You need to provide account_id manually"
            error_msg += "\n   3. Or use session-based auth instead (see AUTHENTICATION_OPTIONS.md)"
        
        raise Exception(error_msg)
    
    provider_data = response.json()
    
    # Update secret if provided
    if secret and 'id' in provider_data:
        update_secret(session, provider_data['id'], secret)
    
    return provider_data


def update_secret(session, provider_id: int, secret: str) -> bool:
    """Update the secret for an external provider."""
    try:
        response = session.post(
            f'/api/external_providers/{provider_id}/updateSecret',
            json={'secret': secret}
        )
        if response.status_code == 200:
            return True
        else:
            raise Exception(f"Failed to update secret: {response.status_code} - {response.text}")
    except Exception as e:
        raise Exception(f"Error updating secret: {e}")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Set up external providers in Luminance')
    parser.add_argument('--env-id', help='Luminance environment ID', required=True)
    parser.add_argument('--secret', help='Luminance API secret key', required=True)
    
    # SAML options
    parser.add_argument('--saml-xml', help='SAML XML metadata file or string')
    parser.add_argument('--saml-name', help='Name for SAML provider', default='SAML SSO')
    parser.add_argument('--saml-provides', nargs='+', choices=['auth', 'autoprovision', 'claims_mapping'],
                       default=['auth'], help='SAML provider capabilities')
    
    # DocuSign options
    parser.add_argument('--docusign-account-id', help='DocuSign Account ID')
    parser.add_argument('--docusign-base-url', help='DocuSign Base URL (e.g., account.docusign.net)')
    parser.add_argument('--docusign-name', help='Name for DocuSign provider', default='DocuSign Integration')
    parser.add_argument('--docusign-secret', help='DocuSign secret (optional, can be set later)')
    parser.add_argument('--docusign-env', choices=['production', 'testing', 'development'],
                       default='production', help='DocuSign environment')
    
    args = parser.parse_args()
    
    # Authenticate
    print("Authenticating...")
    base_uri = lumpy.api.default_base_uri(args.env_id)
    session = lumpy.api.Session(base_uri)
    session.login(args.secret)
    print("Authentication successful!")
    
    results = {}
    
    # Set up SAML if provided
    if args.saml_xml:
        print("\nSetting up SAML provider...")
        try:
            # Check if it's a file path or XML string
            if os.path.isfile(args.saml_xml):
                with open(args.saml_xml, 'r') as f:
                    saml_xml = f.read()
            else:
                saml_xml = args.saml_xml
            
            saml_provider = setup_saml_provider(
                session=session,
                saml_xml=saml_xml,
                provider_name=args.saml_name,
                provides=args.saml_provides,
                base_uri=base_uri
            )
            results['saml'] = saml_provider
            print(f"✅ SAML provider created/updated: ID {saml_provider.get('id')}")
        except Exception as e:
            print(f"❌ Failed to set up SAML provider: {e}")
            results['saml'] = {'error': str(e)}
    
    # Set up DocuSign if provided
    if args.docusign_account_id and args.docusign_base_url:
        print("\nSetting up DocuSign provider...")
        try:
            docusign_provider = setup_docusign_provider(
                session=session,
                account_id_docusign=args.docusign_account_id,
                base_url=args.docusign_base_url,
                provider_name=args.docusign_name,
                secret=args.docusign_secret,
                environment=args.docusign_env
            )
            results['docusign'] = docusign_provider
            print(f"✅ DocuSign provider created/updated: ID {docusign_provider.get('id')}")
            if args.docusign_secret:
                print("✅ Secret updated")
            else:
                print("⚠️  Secret not provided - provider will be in 'pending' state until secret is set")
        except Exception as e:
            print(f"❌ Failed to set up DocuSign provider: {e}")
            results['docusign'] = {'error': str(e)}
    
    # Output results
    print("\n" + "="*50)
    print("RESULTS:")
    print("="*50)
    print(json.dumps(results, indent=2))
    
    return results


if __name__ == "__main__":
    main()
