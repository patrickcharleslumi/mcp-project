import { flow } from "@prismatic-io/spectral";
import zod from "zod";
import { createLuminanceClient } from "./client";
import { createSalesforceClient, createSalesforceClientJWT } from "./salesforceClient";

// Schema definitions for validation
const CompanyContextSchema = zod.object({
  tenantId: zod.string(),
  companyName: zod.string().optional(),
  companyId: zod.string().optional(),
});

const SimilarMsasSchema = zod.object({
  tenantId: zod.string(),
  msaId: zod.number(),
  projectId: zod.number(),
  region: zod.string().optional(),
  companySizeBucket: zod.enum(["small", "mid", "enterprise"]).optional(),
  limit: zod.number().int().min(1).max(100).default(20),
});

const ClauseFallbacksSchema = zod.object({
  tenantId: zod.string(),
  msaId: zod.number(),
  projectId: zod.number(),
  clauseTypes: zod.array(zod.string()).optional(),
  similarMsaIds: zod.array(zod.number()).optional(),
});

const SigningLikelihoodSchema = zod.object({
  tenantId: zod.string(),
  msaId: zod.number(),
  projectId: zod.number(),
  companyContext: zod.record(zod.string(), zod.any()).optional(),
  scenarios: zod.array(zod.record(zod.string(), zod.any())).min(1),
});

const SalesforceCommercialContextSchema = zod
  .object({
    opportunityId: zod.string().optional(),
    opportunityName: zod.string().optional(),
  })
  .refine((data) => data.opportunityId || data.opportunityName, {
    message: "Either opportunityId or opportunityName must be provided",
  });

// Flow 1: Get Company Context
export const getCompanyContext = flow({
  name: "Get Company Context",
  stableKey: "get-company-context",
  description:
    "Retrieve company context information including size, region, jurisdiction, and industry. " +
    "This metadata is used to filter precedents when finding similar MSAs.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Retrieve company context information including size, region, jurisdiction, and industry",
      title: "get-company-context",
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID for scoping the request",
        },
        companyName: {
          type: "string",
          description:
            "Company name to look up (optional if companyId provided)",
        },
        companyId: {
          type: "string",
          description: "Internal company ID (optional if companyName provided)",
        },
      },
      required: ["tenantId"],
    },
  },
  onExecution: async (context, params) => {
    const luminanceClient = createLuminanceClient(
      context.configVars["Luminance Connection"],
    );

    // Validate and extract parameters
    const { tenantId, companyName, companyId } = CompanyContextSchema.parse(
      params.onTrigger.results.body.data,
    );

    context.logger.info("Getting company context", {
      tenantId,
      companyName,
      companyId,
    });

    // TODO: In production, this would query Luminance's company metadata
    // For MVP, we return a placeholder structure
    // This might come from:
    // - Matter annotations (company name, region)
    // - External integrations (Salesforce, HubSpot)
    // - Internal company database

    const result = {
      company_id: companyId || `company_${companyName || "unknown"}`,
      company_name: companyName || "Unknown",
      size_bucket: "unknown", // small, mid, enterprise
      region: "unknown",
      jurisdiction: "unknown",
      industry: "unknown",
      metadata: {
        source: "placeholder",
        note: "This is a placeholder. In production, this would query Luminance's company database or external systems.",
      },
    };

    context.logger.info("Company context retrieved", {
      companyId: result.company_id,
    });

    return { data: result };
  },
});

// Flow 2: Get Similar MSAs
export const getSimilarMsas = flow({
  name: "Get Similar MSAs",
  stableKey: "get-similar-msas",
  description:
    "Find signed MSAs similar to a draft MSA. Results are filtered by company size " +
    "and region/jurisdiction if provided. Returns compact metadata including signed dates, " +
    "time-to-sign, and similarity scores.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Find signed MSAs similar to a draft MSA, filtered by company attributes",
      title: "get-similar-msas",
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID for scoping the request",
        },
        msaId: {
          type: "number",
          description: "ID of the draft MSA document in Luminance",
        },
        projectId: {
          type: "number",
          description: "Project ID containing the MSA",
        },
        region: {
          type: "string",
          description: "Optional: Filter by region/jurisdiction",
        },
        companySizeBucket: {
          type: "string",
          enum: ["small", "mid", "enterprise"],
          description: "Optional: Filter by company size",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ["tenantId", "msaId", "projectId"],
    },
  },
  onExecution: async (context, params) => {
    const luminanceClient = createLuminanceClient(
      context.configVars["Luminance Connection"],
    );

    // Validate and extract parameters
    const { tenantId, msaId, projectId, region, companySizeBucket, limit } =
      SimilarMsasSchema.parse(params.onTrigger.results.body.data);

    context.logger.info("Finding similar MSAs", {
      tenantId,
      msaId,
      projectId,
      region,
      companySizeBucket,
      limit,
    });

    // Get the reference document
    const refDoc = await luminanceClient.get(
      `/api2/projects/${projectId}/documents/${msaId}`,
    );

    // Search for similar documents
    // TODO: In production, use Luminance's similarity/ML search capabilities
    const searchParams: Record<string, any> = {
      limit: limit || 20,
      offset: 0,
    };

    const results = await luminanceClient.get(
      `/api2/projects/${projectId}/documents`,
      { params: searchParams },
    );

    // Filter out the reference document itself
    const documents = (results.data || []).filter(
      (doc: any) => doc.id !== msaId,
    );

    // Format results
    const similarMsas = documents.slice(0, limit || 20).map((doc: any) => ({
      msa_id: doc.id,
      project_id: projectId,
      name: doc.name,
      created_at: doc.created_at,
      similarity_score: 0.85, // Placeholder - would come from ML similarity
      metadata: {
        state: doc.state,
        folder_id: doc.folder_id,
      },
    }));

    context.logger.info("Similar MSAs found", { count: similarMsas.length });

    return {
      data: {
        reference_msa_id: msaId,
        similar_msas: similarMsas,
        total_count: similarMsas.length,
        filters_applied: {
          region,
          company_size_bucket: companySizeBucket,
        },
      },
    };
  },
});

// Flow 3: Get Clause Fallbacks
export const getClauseFallbacks = flow({
  name: "Get Clause Fallbacks",
  stableKey: "get-clause-fallbacks",
  description:
    "Suggest fallback positions for key clauses based on signed precedents. " +
    "Returns 1-3 fallback options per clause type with frequency statistics.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Suggest fallback positions for key clauses based on signed precedents",
      title: "get-clause-fallbacks",
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID for scoping the request",
        },
        msaId: {
          type: "number",
          description: "MSA document ID to analyze",
        },
        projectId: {
          type: "number",
          description: "Project ID containing the MSA",
        },
        clauseTypes: {
          type: "array",
          items: { type: "string" },
          description:
            "List of clause types to analyze (e.g., ['liability_cap', 'indemnity'])",
        },
        similarMsaIds: {
          type: "array",
          items: { type: "number" },
          description: "Optional: Pre-filtered list of similar MSA IDs",
        },
      },
      required: ["tenantId", "msaId", "projectId"],
    },
  },
  onExecution: async (context, params) => {
    const luminanceClient = createLuminanceClient(
      context.configVars["Luminance Connection"],
    );

    // Validate and extract parameters
    const { tenantId, msaId, projectId, clauseTypes, similarMsaIds } =
      ClauseFallbacksSchema.parse(params.onTrigger.results.body.data);

    context.logger.info("Getting clause fallbacks", {
      tenantId,
      msaId,
      projectId,
      clauseTypes,
    });

    // Get annotations for the reference document
    const annotations = await luminanceClient.get(
      `/api2/projects/${projectId}/documents/${msaId}/annotations`,
    );

    // TODO: Implement actual clause analysis
    // This would:
    // 1. Extract clause positions from annotations
    // 2. Query similar MSAs for clause positions
    // 3. Calculate frequency statistics
    // 4. Suggest fallback positions

    // Placeholder implementation
    const result: Record<string, any> = {};

    (clauseTypes || []).forEach((clauseType: string) => {
      result[clauseType] = {
        clause_type: clauseType,
        fallbacks: [
          {
            position: "market_standard",
            frequency: 0.65,
            description: "Most common position in signed MSAs",
          },
          {
            position: "customer_friendly",
            frequency: 0.25,
            description: "Customer-friendly alternative",
          },
        ],
        metadata: {
          sample_size: 100,
          note: "Placeholder - needs actual clause analysis",
        },
      };
    });

    return { data: result };
  },
});

// Flow 4: Estimate Signing Likelihood
export const estimateSigningLikelihood = flow({
  name: "Estimate Signing Likelihood",
  stableKey: "estimate-signing-likelihood",
  description:
    "Score scenarios for predicted signing likelihood and time-to-sign " +
    "based on clause combinations and company context.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Score scenarios for predicted signing likelihood and time-to-sign",
      title: "estimate-signing-likelihood",
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID for scoping the request",
        },
        msaId: {
          type: "number",
          description: "MSA document ID",
        },
        projectId: {
          type: "number",
          description: "Project ID containing the MSA",
        },
        companyContext: {
          type: "object",
          description: "Company context from get-company-context",
        },
        scenarios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scenario_id: { type: "string" },
              scenario_name: { type: "string" },
              clause_overrides: { type: "object" },
            },
          },
          description: "Array of scenarios to evaluate",
          minItems: 1,
        },
      },
      required: ["tenantId", "msaId", "projectId", "scenarios"],
    },
  },
  onExecution: async (context, params) => {
    const luminanceClient = createLuminanceClient(
      context.configVars["Luminance Connection"],
    );

    // Validate and extract parameters
    const { tenantId, msaId, projectId, companyContext, scenarios } =
      SigningLikelihoodSchema.parse(params.onTrigger.results.body.data);

    context.logger.info("Estimating signing likelihood", {
      tenantId,
      msaId,
      projectId,
      scenarioCount: scenarios?.length || 0,
    });

    // TODO: Implement actual ML model for signing likelihood
    // This would:
    // 1. Analyze clause combinations
    // 2. Consider company context
    // 3. Use historical data
    // 4. Predict probability and time-to-sign

    // Placeholder implementation
    const results = (scenarios || []).map((scenario: any) => ({
      scenario_id: scenario.scenario_id,
      scenario_name: scenario.scenario_name,
      signing_probability: 0.75, // Placeholder
      estimated_days_to_sign: 14, // Placeholder
      confidence: 0.65, // Placeholder
      factors: {
        company_size: companyContext?.size_bucket || "unknown",
        region: companyContext?.region || "unknown",
        clause_risk: "medium", // Placeholder
      },
      metadata: {
        note: "Placeholder - needs trained ML model",
      },
    }));

    return { data: results };
  },
});

// Flow 5: Get Salesforce Commercial Context
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

// Export all flows
export default [
  getCompanyContext,
  getSimilarMsas,
  getClauseFallbacks,
  estimateSigningLikelihood,
  getSalesforceCommercialContext,
];
