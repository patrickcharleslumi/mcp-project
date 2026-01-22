# Prerequisites Setup Guide

This guide will help you verify and install all prerequisites needed to build and deploy the Luminance MCP Tools integration.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm installed (comes with Node.js)
- [ ] Prismatic CLI installed
- [ ] Prismatic account and authentication

---

## Step 1: Check if Node.js is Installed

### Check Current Installation

Open your terminal and run:

```bash
node --version
npm --version
```

**Expected output:**
- Node.js version should be `v18.x.x` or higher (e.g., `v18.17.0`, `v20.10.0`)
- npm version should be `9.x.x` or higher

### If Node.js is NOT Installed

You'll see: `command not found: node` or `command not found: npm`

**Install Node.js:**

#### Option A: Using Homebrew (Recommended for macOS)

1. **Check if Homebrew is installed:**
   ```bash
   brew --version
   ```

2. **If Homebrew is not installed, install it:**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. **Install Node.js:**
   ```bash
   brew install node
   ```

4. **Verify installation:**
   ```bash
   node --version
   npm --version
   ```

#### Option B: Using Node Version Manager (nvm) - Recommended for Multiple Versions

1. **Install nvm:**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

2. **Reload your shell:**
   ```bash
   source ~/.zshrc  # or ~/.bash_profile if using bash
   ```

3. **Install Node.js 18 (LTS):**
   ```bash
   nvm install 18
   nvm use 18
   nvm alias default 18
   ```

4. **Verify installation:**
   ```bash
   node --version
   npm --version
   ```

#### Option C: Download from Node.js Website

1. **Visit:** https://nodejs.org/
2. **Download:** LTS version (recommended)
3. **Install:** Run the installer
4. **Verify:** Open a new terminal and run:
   ```bash
   node --version
   npm --version
   ```

---

## Step 2: Verify npm is Working

After installing Node.js, npm should be available automatically.

### Test npm

```bash
npm --version
```

**Expected output:** `9.x.x` or higher

### If npm is still not found

1. **Check your PATH:**
   ```bash
   echo $PATH
   ```

2. **Add Node.js to PATH (if needed):**
   - For Homebrew: Usually automatic, but you may need to add:
     ```bash
     echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
     source ~/.zshrc
     ```
   - For nvm: Should be automatic, but reload shell:
     ```bash
     source ~/.zshrc
     ```

3. **Verify again:**
   ```bash
   which node
   which npm
   npm --version
   ```

---

## Step 3: Install Prismatic CLI

### Check if Prismatic CLI is Installed

```bash
prism --version
```

**Expected output:** Version number (e.g., `1.2.3`)

### If Prismatic CLI is NOT Installed

You'll see: `command not found: prism`

**Install Prismatic CLI globally:**

```bash
npm install -g @prismatic-io/prism
```

**Note:** The package name is `@prismatic-io/prism`, not `@prismatic-io/cli`.

**Verify installation:**
```bash
prism --version
which prism
```

### If Installation Fails

**Permission Issues:**

If you get permission errors, you may need to:

1. **Use sudo (not recommended for security):**
   ```bash
   sudo npm install -g @prismatic-io/cli
   ```

2. **Or configure npm to use a different directory (recommended):**
   ```bash
   # Create a directory for global packages
   mkdir ~/.npm-global
   
   # Configure npm to use it
   npm config set prefix '~/.npm-global'
   
   # Add to PATH
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   
   # Now install Prismatic CLI
   npm install -g @prismatic-io/prism
   ```

---

## Step 4: Authenticate with Prismatic

### Check if Already Authenticated

```bash
prism auth:status
```

**Expected output:** Shows your authentication status

### If Not Authenticated

**Login to Prismatic:**

```bash
prism auth:login
```

This will:
1. Open your browser
2. Prompt you to log in to Prismatic
3. Authorize the CLI
4. Save your credentials

**Verify authentication:**
```bash
prism auth:status
```

### If You Don't Have a Prismatic Account

1. **Sign up:** Visit https://prismatic.io/
2. **Create an account** (or use your existing one)
3. **Get access** to your organization
4. **Then run:** `prism auth:login`

---

## Step 5: Verify Everything is Ready

### Complete Verification Script

Run this in your terminal to check everything:

```bash
echo "=== Checking Prerequisites ==="
echo ""
echo "Node.js:"
node --version || echo "❌ Node.js not found"
echo ""
echo "npm:"
npm --version || echo "❌ npm not found"
echo ""
echo "Prismatic CLI:"
prism --version || echo "❌ Prismatic CLI not found"
echo ""
echo "Prismatic Auth:"
prism auth:status || echo "❌ Not authenticated"
echo ""
echo "=== Done ==="
```

**Expected output:**
```
=== Checking Prerequisites ===

Node.js:
v18.17.0

npm:
9.6.7

Prismatic CLI:
1.2.3

Prismatic Auth:
Authenticated as: your-email@example.com

=== Done ===
```

---

## Troubleshooting

### Issue: "command not found: node"

**Solution:**
- Install Node.js using one of the methods above
- Make sure to restart your terminal after installation
- Check your PATH includes Node.js directory

### Issue: "command not found: npm"

**Solution:**
- npm comes with Node.js, so reinstall Node.js
- Check that Node.js installation was successful
- Verify PATH includes npm directory

### Issue: "EACCES: permission denied" when installing Prismatic CLI

**Solution:**
- Use the npm prefix configuration method (Step 3)
- Or use `sudo` (less secure)
- Or fix npm permissions: `sudo chown -R $(whoami) ~/.npm`

### Issue: "Prismatic CLI not found" after installation

**Solution:**
- Check installation location: `npm list -g @prismatic-io/prism`
- Verify PATH includes npm global bin directory
- Reload your shell: `source ~/.zshrc`

### Issue: "Access token expired or revoked" or "404 Not Found" when installing

**Solution:**
1. **Log out of npm (if logged in):**
   ```bash
   npm logout
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Try installing again:**
   ```bash
   npm install -g @prismatic-io/prism
   ```

4. **If still having issues, check npm registry:**
   ```bash
   npm config get registry
   ```
   Should show: `https://registry.npmjs.org/`

5. **If using a different registry, reset it:**
   ```bash
   npm config set registry https://registry.npmjs.org/
   ```

### Issue: "Not authenticated" with Prismatic

**Solution:**
- Run `prism auth:login`
- Make sure you have a Prismatic account
- Verify you have access to an organization
- Check your internet connection

### Issue: Node.js version is too old

**Solution:**
- Update Node.js to version 18 or higher
- Using Homebrew: `brew upgrade node`
- Using nvm: `nvm install 20 && nvm use 20`
- Or download latest from nodejs.org

---

## Quick Start Commands

Once everything is installed, you can proceed with:

```bash
# Navigate to project
cd "/Users/patrick.charles/Documents/Paddy/MCP Server/luminance-mcp-tools"

# Install dependencies
npm install

# Build the integration
npm run build

# Import to Prismatic
npm run import
```

---

## Need Help?

- **Node.js Issues:** https://nodejs.org/en/docs/
- **npm Issues:** https://docs.npmjs.com/
- **Prismatic CLI:** https://prismatic.io/docs/cli/
- **Prismatic Support:** Check your Prismatic dashboard for support options
