# Configuring Prismatic CLI for Private Instance

## The Problem

You're using a private Prismatic instance at:
- **URL**: `https://app.luminance-production-eu-central-1.prismatic.io`

The error indicates the CLI is trying to connect to the default Prismatic cloud endpoint instead of your private instance.

## Solution: Set PRISMATIC_URL

You need to tell the Prismatic CLI to use your custom endpoint.

### Option 1: Set Environment Variable (Recommended)

**For current session:**
```bash
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
prism login
```

**For permanent setup (add to ~/.zshrc):**
```bash
echo 'export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io' >> ~/.zshrc
source ~/.zshrc
prism login
```

### Option 2: Use --endpoint Flag

```bash
prism login --endpoint https://app.luminance-production-eu-central-1.prismatic.io
```

### Option 3: Configure in Prismatic CLI Config

The CLI may also support a config file. Check:
```bash
prism config --help
```

## Verify Configuration

After setting the URL, verify it's configured:

```bash
echo $PRISMATIC_URL
```

Should show: `https://app.luminance-production-eu-central-1.prismatic.io`

## Login Process

1. **Set the endpoint:**
   ```bash
   export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
   ```

2. **Login:**
   ```bash
   prism login
   ```

3. **Verify authentication:**
   ```bash
   prism auth:status
   ```

## For Build Scripts

When running build/import commands, make sure the environment variable is set:

```bash
# Set the endpoint
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io

# Then run your commands
cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
npm install
npm run build
npm run import
```

## Update package.json Scripts (Optional)

You can also update the `import` script in `package.json` to always use your endpoint:

```json
{
  "scripts": {
    "import": "PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io npm run build && prism integrations:import"
  }
}
```

**Note:** This has already been configured in your `package.json`.

## Troubleshooting

### Issue: Still getting "not logged in" error

**Solution:**
1. Make sure `PRISMATIC_URL` is set in the same terminal session
2. Try logging out and back in:
   ```bash
   export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
   prism logout
   prism login
   ```

### Issue: "Invalid endpoint" or connection errors

**Solution:**
1. Verify the URL is correct (no trailing slash):
   - ✅ `https://app.luminance-production-eu-central-1.prismatic.io`
   - ❌ `https://app.luminance-production-eu-central-1.prismatic.io/`

2. Verify network access to the endpoint:
   ```bash
   curl https://app.luminance-production-eu-central-1.prismatic.io
   ```

### Issue: Authentication works but import fails

**Solution:**
Make sure `PRISMATIC_URL` is set when running import:
```bash
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
npm run import
```

**Note:** The `import` script in `package.json` already includes this URL, so you can just run `npm run import` without setting it manually.

## Quick Setup Script

Create a script to set everything up:

```bash
# Save this as setup-prismatic.sh
#!/bin/bash
export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io
echo "PRISMATIC_URL set to: $PRISMATIC_URL"
prism login
prism auth:status
```

Make it executable and run:
```bash
chmod +x setup-prismatic.sh
./setup-prismatic.sh
```

## Summary

- ✅ **Set PRISMATIC_URL**: `export PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io`
- ✅ **Add to ~/.zshrc**: For permanent configuration
- ✅ **Login**: `prism login` (after setting URL)
- ✅ **Verify**: `prism auth:status`
- ✅ **Import script**: Already configured in `package.json` to use this URL