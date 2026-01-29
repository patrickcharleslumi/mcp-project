/**
 * Test script for Salesforce MCP connectivity
 * Tests the OAuth2 Username-Password flow and basic SOQL query functionality
 */

const https = require('https');
const { URLSearchParams } = require('url');

// Your Prismatic configuration
const config = {
  tokenUrl: "https://test.salesforce.com/services/oauth2/token", // Sandbox URL
  consumerKey: "YOUR_CONSUMER_KEY", // Replace with your Consumer Key
  consumerSecret: "YOUR_CONSUMER_SECRET", // Replace with your Consumer Secret
  username: "YOUR_SALESFORCE_USERNAME", // Replace with your username
  password: "YOUR_SALESFORCE_PASSWORD" // Replace with password (+ security token if required)
};

async function testSalesforceConnection() {
  console.log("🔗 Testing Salesforce OAuth2 Connection...");
  try {
    // Step 1: Test OAuth2 token request
    console.log("📡 Step 1: Requesting OAuth2 token...");

    const tokenData = new URLSearchParams({
      grant_type: "password",
      client_id: config.consumerKey,
      client_secret: config.consumerSecret,
      username: config.username,
      password: config.password,
    }).toString();

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenData,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token request failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenResult = await tokenResponse.json();
    console.log("✅ Token request successful!");
    console.log(`   Instance URL: ${tokenResult.instance_url}`);
    console.log(`   Token Type: ${tokenResult.token_type}`);
    console.log(`   Access Token: ${tokenResult.access_token.substring(0, 20)}...`);

    // Step 2: Test SOQL query capability
    console.log("\n📊 Step 2: Testing SOQL query access...");

    const testQuery = "SELECT Id, Name, StageName, CloseDate FROM Opportunity LIMIT 5";
    const queryUrl = `${tokenResult.instance_url}/services/data/v58.0/query?q=${encodeURIComponent(testQuery)}`;

    const queryResponse = await fetch(queryUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenResult.access_token}`,
        "Accept": "application/json",
      },
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      throw new Error(`SOQL query failed (${queryResponse.status}): ${errorText}`);
    }

    const queryResult = await queryResponse.json();
    console.log("✅ SOQL query successful!");
    console.log(`   Total records available: ${queryResult.totalSize}`);
    console.log(`   Records returned: ${queryResult.records.length}`);

    if (queryResult.records.length > 0) {
      console.log("📋 Sample opportunities found:");
      queryResult.records.forEach((opp, index) => {
        console.log(`   ${index + 1}. ${opp.Name} (${opp.Id}) - Stage: ${opp.StageName}`);
      });
    } else {
      console.log("⚠️  No opportunities found in your Salesforce org.");
    }

    // Step 3: Test specific fields used by MCP tool
    console.log("\n🔍 Step 3: Testing commercial context fields...");

    const commercialQuery = `SELECT
      Id, Name, StageName, CloseDate, Region__c, Business_Unit__c,
      Legal_Required__c, Security_Review_Required__c, ACV__c, ARR__c,
      Discount__c, Total_Discount__c, Payment_Terms__c, MainCompetitors__c,
      Procurement_Pressure__c, Contract_Start_Date__c, Contract_End_Date__c,
      Renewal_Date__c, Renewal_Notice_Period__c, AutoRenewal__c, NextStep__c,
      Non_Standard_Terms_Requested__c, Redline_Count__c, Procurement_Category__c,
      Open_Cases_Count__c, Max_Open_Case_Severity__c, SLA_Breach__c, Customer_Health__c
      FROM Opportunity LIMIT 1`;

    const commercialUrl = `${tokenResult.instance_url}/services/data/v58.0/query?q=${encodeURIComponent(commercialQuery)}`;

    const commercialResponse = await fetch(commercialUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenResult.access_token}`,
        "Accept": "application/json",
      },
    });

    if (!commercialResponse.ok) {
      const errorText = await commercialResponse.text();
      console.log(`⚠️  Commercial context query failed (${commercialResponse.status}): ${errorText}`);
      console.log("   This might indicate missing custom fields. The basic connection works!");
    } else {
      const commercialResult = await commercialResponse.json();
      console.log("✅ Commercial context fields accessible!");

      if (commercialResult.records.length > 0) {
        const opp = commercialResult.records[0];
        console.log(`   Test opportunity: ${opp.Name} (${opp.Id})`);
        console.log("   Custom fields detected:");

        const customFields = [
          'Region__c', 'Business_Unit__c', 'ACV__c', 'ARR__c', 'Discount__c',
          'Legal_Required__c', 'Security_Review_Required__c', 'MainCompetitors__c'
        ];

        customFields.forEach(field => {
          const value = opp[field];
          if (value !== null && value !== undefined) {
            console.log(`     ✓ ${field}: ${value}`);
          } else {
            console.log(`     - ${field}: (not set)`);
          }
        });
      }
    }

    console.log("\n🎉 Connection test completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. Update your Prismatic configuration with these credentials");
    console.log("2. Deploy the MCP integration");
    console.log("3. Test the tool with a specific Opportunity ID or Name");

    // Return sample opportunity for testing
    if (queryResult.records.length > 0) {
      const sampleOpp = queryResult.records[0];
      console.log(`\n🧪 Test the tool with this opportunity:`);
      console.log(`   ID: ${sampleOpp.Id}`);
      console.log(`   Name: "${sampleOpp.Name}"`);

      return {
        success: true,
        sampleOpportunityId: sampleOpp.Id,
        sampleOpportunityName: sampleOpp.Name,
        instanceUrl: tokenResult.instance_url
      };
    }

    return { success: true, instanceUrl: tokenResult.instance_url };

  } catch (error) {
    console.error("❌ Connection test failed:");
    console.error(`   Error: ${error.message}`);

    // Common troubleshooting tips
    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Verify your Consumer Key and Secret from the Connected App");
    console.log("2. Check if your user account has API access enabled");
    console.log("3. If using security token, append it to your password");
    console.log("4. For sandbox, use https://test.salesforce.com/services/oauth2/token");
    console.log("5. Ensure the Connected App has 'Perform requests at any time' scope");

    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testSalesforceConnection();
}

module.exports = { testSalesforceConnection };