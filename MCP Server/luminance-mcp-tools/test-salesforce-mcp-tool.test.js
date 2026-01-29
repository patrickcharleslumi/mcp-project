/**
 * Test for the Salesforce Commercial Context MCP tool
 * Uses Prismatic's invokeFlow testing framework
 */

const { invokeFlow } = require("@prismatic-io/spectral/dist/testing");
const { getSalesforceCommercialContext } = require("./src/flows");

describe("Salesforce Commercial Context MCP Tool", () => {

  // Test configuration - replace with your actual Salesforce credentials
  const salesforceConfig = {
    "Salesforce Token URL": "https://login.salesforce.com/services/oauth2/token", // or sandbox URL
    "Salesforce Consumer Key": "YOUR_CONSUMER_KEY",
    "Salesforce Consumer Secret": "YOUR_CONSUMER_SECRET",
    "Salesforce Username": "YOUR_USERNAME",
    "Salesforce Password": "YOUR_PASSWORD" // append security token if required
  };

  test("Test Salesforce connection and tool with Opportunity ID", async () => {
    // You'll need to replace this with an actual Opportunity ID from your Salesforce org
    const testOpportunityId = "006XXXXXXXXXXXXXXX";

    const { result } = await invokeFlow(getSalesforceCommercialContext, {
      configVars: salesforceConfig,
      payload: {
        body: {
          data: {
            opportunityId: testOpportunityId
          },
        },
      },
    });

    const data = result?.data;

    // Validate the response structure
    expect(data).toBeDefined();
    expect(data.opportunity_id).toBe(testOpportunityId);
    expect(data.opportunity_name).toBeDefined();
    expect(data.deal_stage).toBeDefined();
    expect(data.deal_stage.stage_name).toBeDefined();
    expect(data.organization).toBeDefined();
    expect(data.financial_metrics).toBeDefined();
    expect(data.legal_and_security).toBeDefined();
    expect(data.competitive_landscape).toBeDefined();
    expect(data.contract_dates).toBeDefined();
    expect(data.renewal_information).toBeDefined();
    expect(data.customer_health).toBeDefined();
    expect(data.metadata).toBeDefined();
    expect(data.metadata.source).toBe("salesforce");

    console.log("✅ Salesforce tool test successful!");
    console.log(`   Opportunity: ${data.opportunity_name} (${data.opportunity_id})`);
    console.log(`   Stage: ${data.deal_stage.stage_name}`);
    console.log(`   Retrieved at: ${data.metadata.retrieved_at}`);
  }, 30000); // 30 second timeout for API calls

  test("Test Salesforce connection and tool with Opportunity Name", async () => {
    // Replace with an actual opportunity name from your Salesforce org
    const testOpportunityName = "Test Opportunity Name";

    const { result } = await invokeFlow(getSalesforceCommercialContext, {
      configVars: salesforceConfig,
      payload: {
        body: {
          data: {
            opportunityName: testOpportunityName
          },
        },
      },
    });

    const data = result?.data;

    expect(data).toBeDefined();
    expect(data.opportunity_name).toBe(testOpportunityName);
    expect(data.opportunity_id).toBeDefined();
    expect(data.metadata.source).toBe("salesforce");

    console.log("✅ Salesforce tool test by name successful!");
    console.log(`   Found: ${data.opportunity_name} (${data.opportunity_id})`);
  }, 30000);

  test("Test error handling for invalid Opportunity ID", async () => {
    const invalidOpportunityId = "INVALID_ID";

    await expect(
      invokeFlow(getSalesforceCommercialContext, {
        configVars: salesforceConfig,
        payload: {
          body: {
            data: {
              opportunityId: invalidOpportunityId
            },
          },
        },
      })
    ).rejects.toThrow("Invalid Salesforce Opportunity ID format");
  });

  test("Test error handling for missing parameters", async () => {
    await expect(
      invokeFlow(getSalesforceCommercialContext, {
        configVars: salesforceConfig,
        payload: {
          body: {
            data: {
              // No parameters provided
            },
          },
        },
      })
    ).rejects.toThrow("Either opportunityId or opportunityName must be provided");
  });

  test("Test error handling for missing Salesforce config", async () => {
    const incompleteConfig = {
      "Salesforce Token URL": "https://login.salesforce.com/services/oauth2/token",
      // Missing other required fields
    };

    await expect(
      invokeFlow(getSalesforceCommercialContext, {
        configVars: incompleteConfig,
        payload: {
          body: {
            data: {
              opportunityId: "006XXXXXXXXXXXXXXX"
            },
          },
        },
      })
    ).rejects.toThrow("Salesforce connection incomplete");
  });

});

/**
 * Manual test runner - use this if you want to test outside of Jest
 */
async function manualTest() {
  console.log("🧪 Running manual Salesforce MCP tool test...");

  try {
    // Update these values with your actual data
    const config = {
      "Salesforce Token URL": "https://login.salesforce.com/services/oauth2/token",
      "Salesforce Consumer Key": "YOUR_CONSUMER_KEY",
      "Salesforce Consumer Secret": "YOUR_CONSUMER_SECRET",
      "Salesforce Username": "YOUR_USERNAME",
      "Salesforce Password": "YOUR_PASSWORD"
    };

    const testOpportunityId = "006XXXXXXXXXXXXXXX"; // Replace with real ID

    const { result } = await invokeFlow(getSalesforceCommercialContext, {
      configVars: config,
      payload: {
        body: {
          data: {
            opportunityId: testOpportunityId
          },
        },
      },
    });

    console.log("✅ Tool test successful!");
    console.log("Response data:", JSON.stringify(result.data, null, 2));

  } catch (error) {
    console.error("❌ Tool test failed:");
    console.error(error.message);
  }
}

// Uncomment to run manual test
// manualTest();

module.exports = {
  salesforceConfig,
  manualTest
};