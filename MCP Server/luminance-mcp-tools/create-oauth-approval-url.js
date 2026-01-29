/**
 * Create OAuth approval URL for one-time user authorization
 */

const config = {
  consumerKey: "3MVG9HtWXcDGV.nFOt_CSw5uZtPIiTdwCwJ0f59ZIjx3SEStOP3R97tuLy5u7Ys3HR4.uF5VRyxoHENZDJ86i",
  redirectUri: "https://localhost:3000/callback", // Dummy callback
  baseUrl: "https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com"
};

function createOAuthUrl() {
  console.log("🔗 Creating OAuth Authorization URL for one-time approval...\n");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.consumerKey,
    redirect_uri: config.redirectUri,
    scope: "api refresh_token",
    state: "jwt-bearer-approval"
  });

  const authUrl = `${config.baseUrl}/services/oauth2/authorize?${params.toString()}`;

  console.log("📋 OAuth Authorization URL:");
  console.log("═".repeat(80));
  console.log(authUrl);
  console.log("═".repeat(80));

  console.log("\n📝 Instructions:");
  console.log("1. Copy the URL above");
  console.log("2. Open it in your browser");
  console.log("3. Log in as bkafumbata.e5501ac127c0@agentforce.com");
  console.log("4. Click 'Allow' to approve the Connected App");
  console.log("5. You'll get redirected to localhost:3000 (which will fail - that's OK)");
  console.log("6. After approval, JWT Bearer should work for this user");

  console.log("\n⚠️  Note: The callback will fail (localhost:3000), but the approval will be recorded.");
  console.log("   This is just to get the user to approve the Connected App once.");

  return authUrl;
}

// Create the URL
const oauthUrl = createOAuthUrl();

// Also create a simpler version
console.log("\n🔗 Alternative: Manual approval via Salesforce Setup");
console.log("1. Setup → Manage Apps → Connected Apps → Your App");
console.log("2. Install → Choose users to pre-approve");
console.log("3. Add bkafumbata.e5501ac127c0@agentforce.com to pre-approved users");