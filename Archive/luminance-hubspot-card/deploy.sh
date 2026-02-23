#!/bin/bash

echo "🚀 Deploying Luminance HubSpot CRM Card (Polling Version)"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the project root directory:"
    echo "cd /Users/patrick.charles/Documents/Paddy/luminance-hubspot-card"
    exit 1
fi

# Check if extensions directory exists
if [ ! -d "src/app/extensions" ]; then
    echo "❌ Error: src/app/extensions directory not found"
    exit 1
fi

cd src/app/extensions

# Backup current ContractCard.jsx if it exists
if [ -f "ContractCard.jsx" ]; then
    echo "📦 Backing up current ContractCard.jsx..."
    mv ContractCard.jsx ContractCard-Debug.jsx.backup
    echo "   ✅ Backed up to ContractCard-Debug.jsx.backup"
fi

# Check if polling version exists
if [ ! -f "ContractCard-Polling.jsx" ]; then
    echo "❌ Error: ContractCard-Polling.jsx not found"
    echo "The polling version file is missing from src/app/extensions/"
    exit 1
fi

# Use the polling version
echo "🔄 Activating polling version..."
cp ContractCard-Polling.jsx ContractCard.jsx
echo "   ✅ ContractCard-Polling.jsx → ContractCard.jsx"

cd ../../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Open a Deal in HubSpot"
echo "3. Look for 'Luminance Contracts' card in right sidebar"
echo "4. Test contract generation!"
echo ""
echo "📚 Need help? Read START_HERE.md"
