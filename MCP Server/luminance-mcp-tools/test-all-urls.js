/**
 * Test all possible Salesforce token URLs to find the working one
 */

const { URLSearchParams } = require('url');

const config = {
  consumerKey: "YOUR_CONSUMER_KEY",
  consumerSecret: "YOUR_CONSUMER_SECRET",
  username: "YOUR_SALESFORCE_USERNAME",
  password: "YOUR_SALESFORCE_PASSWORD"
};

const urlsToTest = [
  "https://login.salesforce.com/services/oauth2/token",
  "https://test.salesforce.com/services/oauth2/token",
  "https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com/services/oauth2/token"
];

async function testAllUrls() {
  console.log("🧪 Testing All Salesforce Token URLs...\n");

  for (let i = 0; i < urlsToTest.length; i++) {
    const tokenUrl = urlsToTest[i];
    console.log(`🔗 Test ${i + 1}: ${tokenUrl}`);

    try {
      const body = new URLSearchParams({
        grant_type: "password",
        client_id: config.consumerKey,
        client_secret: config.consumerSecret,
        username: config.username,
        password: config.password,
      }).toString();

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const responseText = await response.text();

      if (response.ok) {
        console.log("   ✅ SUCCESS!");
        const data = JSON.parse(responseText);
        console.log(`   Access Token: ${data.access_token.substring(0, 20)}...`);
        console.log(`   Instance URL: ${data.instance_url}`);
        console.log(`   🎉 This URL works! Use this in Prismatic.`);

        // Test a simple SOQL query to confirm full functionality
        console.log("\n📊 Testing SOQL query...");
        const testQuery = "SELECT Id, Name FROM Opportunity LIMIT 1";
        const queryUrl = `${data.instance_url}/services/data/v58.0/query?q=${encodeURIComponent(testQuery)}`;

        const queryResponse = await fetch(queryUrl, {
          headers: {
            "Authorization": `Bearer ${data.access_token}`,
            "Accept": "application/json",
          },
        });

        if (queryResponse.ok) {
          const queryResult = await queryResponse.json();
          console.log("   ✅ SOQL query successful!");
          console.log(`   Records found: ${queryResult.totalSize}`);
          if (queryResult.records.length > 0) {
            console.log(`   Sample: ${queryResult.records[0].Name} (${queryResult.records[0].Id})`);
          }
        } else {
          console.log("   ⚠️ Token works but SOQL query failed");
        }

        return tokenUrl; // Return the working URL
      } else {
        console.log(`   ❌ Failed: ${response.status}`);
        try {
          const errorData = JSON.parse(responseText);
          console.log(`   Error: ${errorData.error} - ${errorData.error_description}`);
        } catch (e) {
          console.log(`   Raw error: ${responseText}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Network error: ${error.message}`);
    }

    console.log(); // Empty line between tests
  }

  console.log("❌ No working URL found. All authentication attempts failed.");
  return null;
}

testAllUrls();