import { flow } from "@prismatic-io/spectral";
import zod from "zod";
import { createSalesforceClient } from "./salesforceClient";

// Schema definition for Salesforce commercial context validation
const SalesforceCommercialContextSchema = zod
  .object({
    opportunityId: zod.string().optional(),
    opportunityName: zod.string().optional(),
  })
  .refine((data) => data.opportunityId || data.opportunityName, {
    message: "Either opportunityId or opportunityName must be provided",
  });

export const getSalesforceCommercialContext = flow({
  name: "Get Salesforce Commercial Context",
  stableKey: "get-salesforce-commercial-context",
  description:
    "Retrieve comprehensive commercial context from Salesforce Opportunity records. " +
    "Returns deal stage, financial metrics, contract terms, renewal information, " +
    "procurement details, customer health, and legal/security requirements.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Retrieve comprehensive commercial context from Salesforce Opportunity records",
      title: "get-salesforce-commercial-context",
      type: "object",
      properties: {
        opportunityId: {
          type: "string",
          description:
            "Salesforce Opportunity ID (e.g., 006XXXXXXXXXXXXXXX). Optional if opportunityName provided.",
        },
        opportunityName: {
          type: "string",
          description:
            "Opportunity Name to search for. Optional if opportunityId provided.",
        },
      },
      required: [],
    },
  },
  onExecution: async (context, params) => {
    const salesforceClient = await createSalesforceClient(context);

    // Validate and extract parameters
    const { opportunityId, opportunityName } =
      SalesforceCommercialContextSchema.parse(
        params.onTrigger.results.body.data,
      );

    context.logger.info("Getting Salesforce commercial context", {
      opportunityId,
      opportunityName,
    });

    let opportunity: any;

    // Helper function to escape SOQL strings (single quotes must be doubled)
    const escapeSoqlString = (str: string): string => {
      return str.replace(/'/g, "''");
    };

    if (opportunityId) {
      // Validate Salesforce ID format (15 or 18 characters, alphanumeric)
      if (!/^[a-zA-Z0-9]{15,18}$/.test(opportunityId)) {
        throw new Error(
          `Invalid Salesforce Opportunity ID format: ${opportunityId}`,
        );
      }

      // Query by ID - Salesforce IDs are safe to use directly
      const soqlQuery = `SELECT
        Id, Name, StageName, CloseDate, Region__c, Business_Unit__c,
        Legal_Required__c, Security_Review_Required__c, ACV__c, ARR__c,
        Discount__c, Total_Discount__c, Payment_Terms__c, MainCompetitors__c,
        Procurement_Pressure__c, Contract_Start_Date__c, Contract_End_Date__c,
        Renewal_Date__c, Renewal_Notice_Period__c, AutoRenewal__c, NextStep__c,
        Non_Standard_Terms_Requested__c, Redline_Count__c, Procurement_Category__c,
        Open_Cases_Count__c, Max_Open_Case_Severity__c, SLA_Breach__c, Customer_Health__c
        FROM Opportunity
        WHERE Id = '${opportunityId}'
        LIMIT 1`;

      const queryResult = await salesforceClient.get(
        "/services/data/v58.0/query",
        {
          params: { q: soqlQuery },
        },
      );

      if (!queryResult.data.records || queryResult.data.records.length === 0) {
        throw new Error(`Opportunity with ID ${opportunityId} not found`);
      }

      opportunity = queryResult.data.records[0];
    } else if (opportunityName) {
      // Query by name - escape single quotes for SOQL
      const escapedName = escapeSoqlString(opportunityName);
      const soqlQuery = `SELECT
        Id, Name, StageName, CloseDate, Region__c, Business_Unit__c,
        Legal_Required__c, Security_Review_Required__c, ACV__c, ARR__c,
        Discount__c, Total_Discount__c, Payment_Terms__c, MainCompetitors__c,
        Procurement_Pressure__c, Contract_Start_Date__c, Contract_End_Date__c,
        Renewal_Date__c, Renewal_Notice_Period__c, AutoRenewal__c, NextStep__c,
        Non_Standard_Terms_Requested__c, Redline_Count__c, Procurement_Category__c,
        Open_Cases_Count__c, Max_Open_Case_Severity__c, SLA_Breach__c, Customer_Health__c
        FROM Opportunity
        WHERE Name = '${escapedName}'
        LIMIT 1`;

      const queryResult = await salesforceClient.get(
        "/services/data/v58.0/query",
        {
          params: { q: soqlQuery },
        },
      );

      if (!queryResult.data.records || queryResult.data.records.length === 0) {
        throw new Error(`Opportunity with name "${opportunityName}" not found`);
      }

      opportunity = queryResult.data.records[0];
    } else {
      throw new Error(
        "Either opportunityId or opportunityName must be provided",
      );
    }

    // Format the response with all commercial context fields
    const result = {
      opportunity_id: opportunity.Id,
      opportunity_name: opportunity.Name,
      deal_stage: {
        stage_name: opportunity.StageName,
        close_date: opportunity.CloseDate,
      },
      organization: {
        region: opportunity.Region__c,
        business_unit: opportunity.Business_Unit__c,
      },
      financial_metrics: {
        acv: opportunity.ACV__c,
        arr: opportunity.ARR__c,
        discount: opportunity.Discount__c,
        total_discount: opportunity.Total_Discount__c,
        payment_terms: opportunity.Payment_Terms__c,
      },
      legal_and_security: {
        legal_required: opportunity.Legal_Required__c,
        security_review_required: opportunity.Security_Review_Required__c,
        non_standard_terms_requested:
          opportunity.Non_Standard_Terms_Requested__c,
        redline_count: opportunity.Redline_Count__c,
      },
      competitive_landscape: {
        main_competitors: opportunity.MainCompetitors__c,
        procurement_pressure: opportunity.Procurement_Pressure__c,
        procurement_category: opportunity.Procurement_Category__c,
      },
      contract_dates: {
        contract_start_date: opportunity.Contract_Start_Date__c,
        contract_end_date: opportunity.Contract_End_Date__c,
      },
      renewal_information: {
        renewal_date: opportunity.Renewal_Date__c,
        renewal_notice_period: opportunity.Renewal_Notice_Period__c,
        auto_renewal: opportunity.AutoRenewal__c,
      },
      next_steps: {
        next_step: opportunity.NextStep__c,
      },
      customer_health: {
        open_cases_count: opportunity.Open_Cases_Count__c,
        max_open_case_severity: opportunity.Max_Open_Case_Severity__c,
        sla_breach: opportunity.SLA_Breach__c,
        customer_health: opportunity.Customer_Health__c,
      },
      metadata: {
        retrieved_at: new Date().toISOString(),
        source: "salesforce",
      },
    };

    context.logger.info("Salesforce commercial context retrieved", {
      opportunityId: result.opportunity_id,
      opportunityName: result.opportunity_name,
    });

    return { data: result };
  },
});

// Export only the Salesforce commercial context flow
export default [getSalesforceCommercialContext];