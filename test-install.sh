#!/bin/bash
echo "Testing token storage after installation..."
curl "https://luminance-hubspot-middleware.vercel.app/api/debug-kv?portalId=147788687" | jq .
