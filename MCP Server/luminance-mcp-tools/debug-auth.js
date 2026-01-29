/**
 * Debug authentication step by step
 */

const { URLSearchParams } = require('url');

// Your current config
const config = {
  tokenUrl: "YOUR_SALESFORCE_TOKEN_URL",
  consumerKey: "YOUR_CONSUMER_KEY",
  consumerSecret: "YOUR_CONSUMER_SECRET",
  username: "YOUR_SALESFORCE_USERNAME",
  password: "YOUR_SALESFORCE_PASSWORD"
};

async function debugAuth() {
  console.log("🔍 Debugging Salesforce Authentication...");
  console.log("\n📋 Configuration Check:");
  console.log(`   Token URL: ${config.tokenUrl}`);
  console.log(`   Consumer Key: ${config.consumerKey.substring(0, 10)}...`);
  console.log(`   Consumer Secret: ${config.consumerSecret.substring(0, 10)}...`);
  console.log(`   Username: ${config.username}`);
  console.log(`   Password Length: ${config.password.length} chars`);
  console.log(`   Security Token: ${config.password.length > 20 ? 'Appears appended' : 'May be missing'}`);

  console.log("\n📡 Testing OAuth2 Request...");

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: config.consumerKey,
    client_secret: config.consumerSecret,
    username: config.username,
    password: config.password,
  }).toString();

  console.log("\n🔧 Request Details:");
  console.log(`   Method: POST`);
  console.log(`   URL: ${config.tokenUrl}`);
  console.log(`   Content-Type: application/x-www-form-urlencoded`);
  console.log(`   Body: grant_type=password&client_id=${config.consumerKey.substring(0, 10)}...&username=${config.username}&...`);

  try {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log("✅ SUCCESS! Token received:");
      console.log(`   Access Token: ${data.access_token.substring(0, 20)}...`);
      console.log(`   Instance URL: ${data.instance_url}`);
      console.log(`   Token Type: ${data.token_type}`);
    } else {
      console.log("❌ FAILED! Error response:");
      console.log(`   ${responseText}`);

      // Parse error for specific guidance
      try {
        const errorData = JSON.parse(responseText);
        console.log("\n🔧 Specific Troubleshooting:");

        switch (errorData.error) {
          case "invalid_client_id":
            console.log("   → Consumer Key is invalid or Connected App not found");
            console.log("   → Verify Consumer Key in Connected App settings");
            break;
          case "invalid_client_credentials":
            console.log("   → Consumer Secret is invalid");
            console.log("   → Verify Consumer Secret in Connected App settings");
            break;
          case "invalid_grant":
            if (errorData.error_description === "authentication failure") {
              console.log("   → Username/password/security token combination is invalid");
              console.log("   → Verify username, password, and security token");
              console.log("   → Check if user has API access enabled");
              console.log("   → Verify Connected App policies (IP restrictions, user access)");
            }
            break;
          default:
            console.log(`   → Unknown error: ${errorData.error}`);
        }
      } catch (e) {
        console.log("   → Could not parse error details");
      }
    }

  } catch (networkError) {
    console.error("❌ Network Error:");
    console.error(`   ${networkError.message}`);
  }

  console.log("\n📝 Next Steps:");
  console.log("1. If 'invalid_client_id' → Check Consumer Key in Connected App");
  console.log("2. If 'invalid_client_credentials' → Check Consumer Secret");
  console.log("3. If 'authentication failure' → Check username/password/token + user permissions");
  console.log("4. Check Connected App policies (IP restrictions, user access)");
}

debugAuth();