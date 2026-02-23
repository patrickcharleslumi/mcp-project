# Environment ID Guide

## How to Determine Your ENV_ID

You have two options for specifying your Luminance environment:

### Option 1: Use the Moniker (Recommended)
If you know your environment's moniker (like `paddy-integrations-corporate-internal`), use that:

```bash
ENV_ID=paddy-integrations-corporate-internal
```

The script will automatically construct: `https://paddy-integrations-corporate-internal.app.luminance.com`

### Option 2: Use the Numeric ID
If you have a 6-digit numeric ID (like `006403`), use that:

```bash
ENV_ID=006403
```

The script will construct: `https://006403.support.luminance.com`

### Option 3: Use Full URL (Advanced)
You can also provide the full URL directly:

```bash
ENV_ID=https://paddy-integrations-corporate-internal.app.luminance.com
```

## How to Find Your Environment ID

### From Your Existing Scripts
Looking at `get_luminance_token.sh`, you're using:
```
https://paddy-integrations-corporate-internal.app.luminance.com
```

So your moniker is: **`paddy-integrations-corporate-internal`**

### From Mercury
1. Log into Mercury
2. Find your environment
3. The moniker is usually visible in the URL or environment name

### From Your Credentials
Check your credentials JSON or Mercury download - the environment moniker is often in the token or metadata.

## Recommended .env Configuration

Based on your setup, use:

```bash
ENV_ID=paddy-integrations-corporate-internal
CLIENT_ID=887a3bdfc812a52a8d22cff17a25e550
SECRET_KEY=6b2fea72f6c3a91ade55633ae1f9d798
```

This will connect to: `https://paddy-integrations-corporate-internal.app.luminance.com`

## Testing

After updating your `.env` file, test the connection:

```bash
python3 test_docusign_setup.py
```

The script will show which base URI it's using during authentication.
