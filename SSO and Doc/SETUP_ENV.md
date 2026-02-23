# Setting Up Your .env File

## Quick Setup

1. **Copy the template file:**
   ```bash
   cd "/Users/patrick.charles/Documents/Paddy/SSO and Doc"
   cp env.template .env
   ```

2. **Edit `.env` and update `ENV_ID`:**
   ```bash
   # Open in your editor
   nano .env
   # or
   code .env
   ```

3. **Update the ENV_ID line:**
   ```
   ENV_ID=hackerone-staging-corporate
   ```
   (Replace with your actual environment ID)

## Current Credentials (from Credentials (1).json)

The `.env` file is pre-filled with:
- **SECRET_KEY**: `0774bfbf2499f56bb1ea2a4edcacf883` (from public_api role)
- **CLIENT_ID**: `aaab0ed4f52a6c02b668f140b390499a` (for reference)

## What You Need to Update

Only **ENV_ID** needs to be set. Based on the credentials file, it looks like your environment might be:
- `hackerone-staging-corporate` (from the token in the JSON)

## Verify It Works

After creating `.env`, test it:
```bash
python3 test_docusign_setup.py
```

If you get authentication errors, double-check:
1. `.env` file exists in the same directory
2. `ENV_ID` is set correctly
3. `SECRET_KEY` matches the client_secret from your credentials
