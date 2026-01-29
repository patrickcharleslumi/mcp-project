# Fix: Prismatic CLI Installation Error

## The Problem

You're getting this error:
```
npm notice Access token expired or revoked. Please try logging in again.
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@prismatic-io%2fcli
```

## The Issues

1. **Wrong package name**: The package is `@prismatic-io/prism`, not `@prismatic-io/cli`
2. **npm authentication issue**: Your npm access token may be expired

## Solution

### Step 1: Fix npm Authentication

1. **Log out of npm (if you're logged in):**
   ```bash
   npm logout
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Verify npm registry is correct:**
   ```bash
   npm config get registry
   ```
   
   Should show: `https://registry.npmjs.org/`
   
   If not, reset it:
   ```bash
   npm config set registry https://registry.npmjs.org/
   ```

### Step 2: Install with Correct Package Name

**The correct command is:**

```bash
npm install -g @prismatic-io/prism
```

**NOT:**
```bash
npm install -g @prismatic-io/cli  # ❌ Wrong package name
```

### Step 3: Verify Installation

```bash
prism --version
```

You should see a version number like `1.2.3` or similar.

### Step 4: Authenticate with Prismatic

```bash
prism login
```

This will open your browser to log in to Prismatic.

## Alternative: If You Still Have Issues

If you continue to have problems, try:

1. **Install without global flag (local to project):**
   ```bash
   cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"
   npm install @prismatic-io/prism
   npx prism --version
   ```

2. **Use npx to run commands:**
   ```bash
   npx @prismatic-io/prism --version
   npx @prismatic-io/prism login
   ```

3. **Check if you need to configure npm proxy (if behind corporate firewall):**
   ```bash
   npm config list
   ```

## Quick Fix Commands

Run these in order:

```bash
# 1. Log out and clear cache
npm logout
npm cache clean --force

# 2. Verify registry
npm config set registry https://registry.npmjs.org/

# 3. Install with correct package name
npm install -g @prismatic-io/prism

# 4. Verify it works
prism --version

# 5. Login to Prismatic
prism login
```

## Summary

- ✅ **Correct package**: `@prismatic-io/prism`
- ❌ **Wrong package**: `@prismatic-io/cli`
- 🔧 **Fix auth**: `npm logout` then `npm cache clean --force`
- 📦 **Install**: `npm install -g @prismatic-io/prism`
