# Prismatic CLI Import Issue - Workaround

## Problem

The Prismatic CLI is failing with `Error: File is not defined` when trying to import the integration. This appears to be a bug in the Prismatic CLI itself, not in our code.

## Workaround Options

### Option 1: Import via Prismatic UI (Recommended)

1. **Build the integration:**
   ```bash
   npm run build
   ```

2. **Upload via Prismatic UI:**
   - Go to your Prismatic instance: https://app.luminance-production-eu-central-1.prismatic.io
   - Navigate to **Integrations**
   - Click **Create Integration** or **Import Integration**
   - Upload the `dist/` folder or zip it and upload
   - The integration should import successfully

### Option 2: Update Prismatic CLI

Try updating to the latest version of the Prismatic CLI:

```bash
npm i -g @prismatic-io/prism@latest
```

**Note**: The correct package name is `@prismatic-io/prism`, not `@prismatic-io/cli`.

Then try importing again:
```bash
npm run import
```

**However**, this may not fix the issue as it appears to be a bug in the CLI itself.

### Option 3: Contact Prismatic Support

If the above don't work, this is a bug in the Prismatic CLI that needs to be reported:

- **Error**: `Error: File is not defined`
- **Context**: Happening during `prism integrations:import` for a code-native integration
- **Prismatic CLI Version**: `@prismatic-io/prism/9.1.1`
- **Environment**: macOS, Node.js v18.20.8

## What's Working

✅ **Build succeeds** - The integration builds correctly  
✅ **Code is valid** - All TypeScript compiles without errors  
✅ **Integration structure is correct** - Follows Prismatic patterns  

## What's Not Working

❌ **CLI import fails** - The Prismatic CLI crashes with "File is not defined" error

## Next Steps

Once the integration is imported (via UI or after CLI fix):

1. ✅ Configure the **Luminance Connection** in your instance
2. ✅ Configure the **Salesforce Connection** in your instance (OAuth2)
3. ✅ Test the new **Get Salesforce Commercial Context** flow
4. ✅ Verify all 5 flows are available as MCP tools

The integration code itself is correct - this is purely a CLI tooling issue.
