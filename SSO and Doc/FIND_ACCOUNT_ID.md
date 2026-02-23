# Finding Your Account ID

If you're getting errors about `account_id`, you need to find your Luminance account ID.

## Method 1: From Existing External Providers (Easiest)

If you already have any external providers configured, the script will automatically extract the account_id from them.

## Method 2: From the API (If you have session-based auth)

If you're using session-based authentication (not OAuth2), you can get it from:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://paddy-integrations-corporate-internal.app.luminance.com/api/users/me
```

Look for `"account_id"` in the response.

## Method 3: From the Database (If you have access)

Query the database:
```sql
SELECT id, name FROM accounts WHERE ...;
```

## Method 4: Provide It Manually

You can provide the account_id directly when calling the setup functions:

```python
setup_docusign_provider(
    session=session,
    account_id_docusign="633b43f4-367a-44cb-b843-6152672eee22",
    base_url="demo.docusign.net",
    account_id=123  # Your Luminance account ID
)
```

## Method 5: Check Existing Providers

The script will try to get account_id from existing providers automatically. If you have any external providers already configured, run:

```python
response = session.get('/api/external_providers')
providers = response.json()
if providers:
    print(f"Account ID: {providers[0]['account_id']}")
```
