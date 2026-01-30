#!/bin/bash
# Prismatic publish script - ensures correct Node version

# Use fnm if available, otherwise try nvm
if command -v fnm &> /dev/null; then
    eval "$(fnm env)"
    fnm use 20 2>/dev/null || fnm install 20 && fnm use 20
elif command -v nvm &> /dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm use 20 2>/dev/null || nvm install 20 && nvm use 20
fi

echo "Using Node $(node --version)"

cd "$(dirname "$0")"

# Check if logged in
if ! prism me &>/dev/null; then
    echo "Not logged in. Opening browser for authentication..."
    prism login
fi

echo "Building component..."
npm run build

echo "Publishing component..."
prism components:publish --confirm

echo "Done! Update the instance in Prismatic dashboard to use the new version."
