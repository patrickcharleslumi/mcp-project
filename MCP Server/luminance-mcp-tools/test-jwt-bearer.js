/**
 * Test JWT Bearer token creation and private key format
 */

const { createSign } = require("crypto");
const { URLSearchParams } = require('url');

// Your configuration - REPLACE WITH ACTUAL PRIVATE KEY
const config = {
  tokenUrl: "https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com/services/oauth2/token",
  consumerKey: "3MVG9HtWXcDGV.nFOt_CSw5uZtPIiTdwCwJ0f59ZIjx3SEStOP3R97tuLy5u7Ys3HR4.uF5VRyxoHENZDJ86i",
  username: "bkafumbata.e5501ac127c0@agentforce.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
REPLACE_WITH_YOUR_ACTUAL_PRIVATE_KEY_CONTENT
-----END PRIVATE KEY-----`
};

/**
 * Create a JWT Bearer token for Salesforce authentication
 */
function createJwtBearerToken(clientId, username, privateKey, tokenUrl) {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: username,
    aud: tokenUrl,
    exp: now + 300, // 5 minutes expiration
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(privateKey, "base64url");

    return `${signingInput}.${signature}`;
  } catch (error) {
    throw new Error(`JWT signing failed: ${error.message}`);
  }
}

async function testJwtBearerAuth() {
  console.log("🔍 Testing JWT Bearer Authentication...\n");

  // Step 1: Validate private key format
  console.log("📋 Private Key Analysis:");
  console.log(`   Length: ${config.privateKey.length} characters`);
  console.log(`   Starts with: ${config.privateKey.substring(0, 50)}...`);
  console.log(`   Ends with: ...${config.privateKey.substring(config.privateKey.length - 50)}`);

  // Check for common issues
  if (!config.privateKey.includes("-----BEGIN")) {
    console.log("   ❌ Missing -----BEGIN header");
    return;
  }
  if (!config.privateKey.includes("-----END")) {
    console.log("   ❌ Missing -----END footer");
    return;
  }
  if (config.privateKey.includes("REPLACE_WITH")) {
    console.log("   ❌ Placeholder text still present - replace with actual private key");
    return;
  }

  console.log("   ✅ Basic format looks correct\n");

  // Step 2: Test JWT creation
  console.log("🔧 Creating JWT Bearer Token...");
  try {
    const jwtToken = createJwtBearerToken(
      config.consumerKey,
      config.username,
      config.privateKey,
      config.tokenUrl
    );

    console.log("   ✅ JWT token created successfully!");
    console.log(`   JWT: ${jwtToken.substring(0, 100)}...\n`);

    // Step 3: Test Salesforce authentication
    console.log("🌐 Testing Salesforce Authentication...");

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
    }).toString();

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const responseText = await response.text();

    if (response.ok) {
      console.log("   ✅ SUCCESS! JWT Bearer authentication working!");
      const data = JSON.parse(responseText);
      console.log(`   Access Token: ${data.access_token.substring(0, 20)}...`);
      console.log(`   Instance URL: ${data.instance_url}`);
      console.log(`   Token Type: ${data.token_type}`);
      return true;
    } else {
      console.log(`   ❌ Authentication failed: ${response.status}`);
      console.log(`   Response: ${responseText}`);

      try {
        const errorData = JSON.parse(responseText);
        console.log("\n🔧 Error Analysis:");
        switch (errorData.error) {
          case "invalid_grant":
            console.log("   → Check if username exists and is authorized for this Connected App");
            console.log("   → Verify Consumer Key matches your Connected App");
            console.log("   → Check if certificate was uploaded correctly");
            break;
          case "invalid_client_id":
            console.log("   → Consumer Key is invalid");
            break;
          case "unsupported_grant_type":
            console.log("   → JWT Bearer flow not enabled in Connected App");
            break;
          default:
            console.log(`   → Unknown error: ${errorData.error}`);
        }
      } catch (e) {
        console.log("   → Could not parse error response");
      }
      return false;
    }

  } catch (error) {
    console.log(`   ❌ JWT creation failed: ${error.message}`);

    if (error.message.includes("DECODER routines")) {
      console.log("\n🔧 Private Key Format Issues:");
      console.log("   1. Ensure private key is in PKCS#8 format (-----BEGIN PRIVATE KEY-----)");
      console.log("   2. Not PKCS#1 format (-----BEGIN RSA PRIVATE KEY-----)");
      console.log("   3. Remove any extra spaces or line breaks");
      console.log("   4. Ensure proper line endings");
      console.log("\n   Convert PKCS#1 to PKCS#8 with:");
      console.log("   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.key -out private_pkcs8.key");
    }
    return false;
  }
}

// Instructions for updating the private key
console.log("⚠️  IMPORTANT: Replace the private key placeholder above with your actual private key!");
console.log("   The private key should be in PKCS#8 format:");
console.log("   -----BEGIN PRIVATE KEY-----");
console.log("   (your key content here)");
console.log("   -----END PRIVATE KEY-----\n");

// Run the test
testJwtBearerAuth();