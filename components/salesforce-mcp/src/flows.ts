import { flow, util } from "@prismatic-io/spectral";
import zod from "zod";
import { createSalesforceClient } from "./salesforceClient";

type JsonRecord = Record<string, unknown>;

const getConfigString = (context: any, key: string): string =>
  util.types.toString(context.configVars[key] ?? "");

const getLuminanceAuth = (context: any): { baseUrl: string; clientId: string; clientSecret: string } => {
  const tokenUrl = util.types.toString(context.configVars["Luminance Token URL"] ?? "");
  const baseUrl = tokenUrl.replace("/auth/oauth2/token", "");
  const clientId = util.types.toString(context.configVars["Luminance Client ID"] ?? "");
  const clientSecret = util.types.toString(context.configVars["Luminance Client Secret"] ?? "");
  return { baseUrl, clientId, clientSecret };
};

const normalizeKey = (value?: string): string =>
  (value ?? "").trim().toLowerCase();

const extractString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
};

const extractAnnotationValue = (annotation: JsonRecord): string | undefined => {
  const direct = extractString(annotation.value) || extractString(annotation.text);
  if (direct) return direct;
  const content = annotation.content;
  if (typeof content === "string") return content.trim();
  if (content && typeof content === "object") {
    const record = content as JsonRecord;
    const candidates = [
      record.value,
      record.party,
      record.name,
      record.counterparty,
      record.text,
      record.label,
    ];
    for (const candidate of candidates) {
      const result = extractString(candidate);
      if (result) return result;
    }
  }
  return undefined;
};

const resolveCounterpartyFromAnnotations = (
  annotations: JsonRecord[],
  tagKey: string
): string | undefined => {
  const normalizedTagKey = normalizeKey(tagKey);
  for (const annotation of annotations) {
    const annotationType = (annotation.annotation_type ?? annotation.type ?? {}) as JsonRecord;
    const typeKey = extractString(annotationType.key) || extractString(annotationType.type);
    const typeName = extractString(annotationType.name) || extractString(annotationType.label);
    const annotationTypeKey = extractString(annotation.annotation_type_key);
    const candidates = [typeKey, typeName, annotationTypeKey].map(normalizeKey);
    if (normalizedTagKey && candidates.includes(normalizedTagKey)) {
      const value = extractAnnotationValue(annotation);
      if (value) return value;
    }
  }
  return undefined;
};

const fetchLuminanceToken = async (
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> => {
  const tokenUrl = new URL("/auth/oauth2/token", baseUrl).toString();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Luminance token request failed (${response.status}): ${text}`);
  }
  const payload = (await response.json()) as JsonRecord;
  const token = extractString(payload.access_token);
  if (!token) {
    throw new Error("Luminance token response missing access_token.");
  }
  return token;
};

const fetchMatterAnnotations = async (
  baseUrl: string,
  token: string,
  divisionId: string,
  matterId: string
): Promise<JsonRecord[]> => {
  const path = `/api2/projects/${divisionId}/matters/${matterId}/annotations`;
  const url = new URL(path, baseUrl).toString();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Luminance annotations request failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? (payload as JsonRecord[]) : [];
};

// Schema definition for Salesforce commercial context validation
const SalesforceCommercialContextSchema = zod
  .object({
    opportunityId: zod.string().optional(),
    opportunityName: zod.string().optional(),
    matterId: zod.union([zod.string(), zod.number()]).optional(),
  })
  .refine((data) => data.opportunityId || data.opportunityName || data.matterId, {
    message: "Either opportunityId, opportunityName, or matterId must be provided",
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
        matterId: {
          type: "string",
          description:
            "Luminance matter ID. When provided, the integration resolves the counterparty name from Luminance tags.",
        },
      },
      required: [],
    },
  },
  onExecution: async (context, params) => {
    let salesforceClient;
    try {
      salesforceClient = await createSalesforceClient(context);
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : String(authError);
      context.logger.error("Salesforce authentication failed", { error: msg });
      throw new Error(`Salesforce auth failed: ${msg}`);
    }

    // Validate and extract parameters
    const { opportunityId, opportunityName, matterId } =
      SalesforceCommercialContextSchema.parse(
        params.onTrigger.results.body.data,
      );

    let resolvedOpportunityName = opportunityName;
    const resolvedMatterId = matterId ? String(matterId) : "";

    if (!opportunityId && resolvedMatterId) {
      const { baseUrl: luminanceBaseUrl, clientId: luminanceClientId, clientSecret: luminanceClientSecret } =
        getLuminanceAuth(context);
      const luminanceDivisionId = getConfigString(context, "Luminance Division");
      if (!luminanceBaseUrl || !luminanceClientId || !luminanceClientSecret) {
        throw new Error("Luminance credentials missing for matterId lookup.");
      }
      if (!luminanceDivisionId) {
        throw new Error("Luminance Division is required for matterId lookup.");
      }

      const tagKey = getConfigString(context, "Counterparty Name Tag");
      if (!tagKey) {
        throw new Error("Counterparty tag key missing. Configure the tag picker.");
      }

      const token = await fetchLuminanceToken(
        luminanceBaseUrl,
        luminanceClientId,
        luminanceClientSecret
      );
      const annotations = await fetchMatterAnnotations(
        luminanceBaseUrl,
        token,
        luminanceDivisionId,
        resolvedMatterId
      );
      resolvedOpportunityName = resolveCounterpartyFromAnnotations(annotations, tagKey);
      if (!resolvedOpportunityName) {
        throw new Error(`Counterparty tag "${tagKey}" not found on matter ${resolvedMatterId}.`);
      }
    }

    context.logger.info("Getting Salesforce commercial context", {
      opportunityId,
      opportunityName: resolvedOpportunityName,
      matterId: resolvedMatterId || undefined,
    });

    let opportunity: any;

    // Helper function to escape SOQL strings (single quotes must be doubled)
    const escapeSoqlString = (str: string): string => {
      return str.replace(/'/g, "''");
    };

    // Extended Opportunity query with Account relationship
    const opportunityFields = `
      Id, Name, StageName, CloseDate, Amount, Probability, NextStep, Type,
      LeadSource, ForecastCategory, ForecastCategoryName, IsClosed, IsWon,
      ExpectedRevenue, TotalOpportunityQuantity, Description, CreatedDate, LastModifiedDate,
      AccountId, Account.Id, Account.Name, Account.Type, Account.Industry, Account.Website,
      Account.Phone, Account.BillingCity, Account.BillingState, Account.BillingCountry,
      Account.AnnualRevenue, Account.NumberOfEmployees, Account.Description,
      Account.Rating, Account.CreatedDate
    `.trim().replace(/\s+/g, ' ');

    if (opportunityId) {
      // Validate Salesforce ID format (15 or 18 characters, alphanumeric)
      if (!/^[a-zA-Z0-9]{15,18}$/.test(opportunityId)) {
        throw new Error(
          `Invalid Salesforce Opportunity ID format: ${opportunityId}`,
        );
      }

      const soqlQuery = `SELECT ${opportunityFields} FROM Opportunity WHERE Id = '${opportunityId}' LIMIT 1`;

      context.logger.info("Executing SOQL query by ID", { query: soqlQuery });

      let queryResult;
      try {
        queryResult = await salesforceClient.get(
          "/services/data/v58.0/query",
          {
            params: { q: soqlQuery },
          },
        );
      } catch (queryError: any) {
        const errorMsg = queryError?.response?.data?.message || queryError?.message || String(queryError);
        const errorBody = JSON.stringify(queryError?.response?.data || {});
        context.logger.error("Salesforce SOQL query failed", { error: errorMsg, body: errorBody, query: soqlQuery });
        throw new Error(`Salesforce query failed: ${errorMsg}`);
      }

      if (!queryResult.data.records || queryResult.data.records.length === 0) {
        throw new Error(`Opportunity with ID ${opportunityId} not found`);
      }

      opportunity = queryResult.data.records[0];
    } else if (resolvedOpportunityName) {
      const escapedName = escapeSoqlString(resolvedOpportunityName);
      
      // First, try to find an Opportunity
      const soqlQuery = `SELECT ${opportunityFields} FROM Opportunity WHERE Name LIKE '%${escapedName}%' ORDER BY CloseDate DESC LIMIT 1`;
      context.logger.info("Executing Opportunity SOQL query", { query: soqlQuery });

      let queryResult;
      try {
        queryResult = await salesforceClient.get(
          "/services/data/v58.0/query",
          { params: { q: soqlQuery } },
        );
      } catch (queryError: any) {
        const errorMsg = queryError?.response?.data?.message || queryError?.message || String(queryError);
        context.logger.warn("Opportunity query failed, trying Account search", { error: errorMsg });
        queryResult = { data: { records: [] } };
      }

      if (queryResult.data.records && queryResult.data.records.length > 0) {
        opportunity = queryResult.data.records[0];
      } else {
        // Fallback: Search for Account by name
        context.logger.info("No Opportunity found, searching Accounts", { name: resolvedOpportunityName });
        
        const accountFields = `
          Id, Name, Type, Industry, Website, Phone, 
          BillingCity, BillingState, BillingCountry,
          AnnualRevenue, NumberOfEmployees, Description, Rating, CreatedDate
        `.trim().replace(/\s+/g, ' ');
        
        const accountQuery = `SELECT ${accountFields} FROM Account WHERE Name LIKE '%${escapedName}%' LIMIT 1`;
        
        let accountResult;
        try {
          accountResult = await salesforceClient.get(
            "/services/data/v58.0/query",
            { params: { q: accountQuery } },
          );
        } catch (accountError: any) {
          const errorMsg = accountError?.response?.data?.message || accountError?.message || String(accountError);
          throw new Error(`No Opportunity or Account found for "${resolvedOpportunityName}". Error: ${errorMsg}`);
        }
        
        if (!accountResult.data.records || accountResult.data.records.length === 0) {
          throw new Error(`No Opportunity or Account found for "${resolvedOpportunityName}"`);
        }
        
        const account = accountResult.data.records[0];
        context.logger.info("Found Account", { accountId: account.Id, name: account.Name });
        
        // Check if this Account has any Opportunities
        const accOppsQuery = `SELECT ${opportunityFields} FROM Opportunity WHERE AccountId = '${account.Id}' ORDER BY CloseDate DESC LIMIT 1`;
        try {
          const accOppsResult = await salesforceClient.get(
            "/services/data/v58.0/query",
            { params: { q: accOppsQuery } },
          );
          if (accOppsResult.data.records && accOppsResult.data.records.length > 0) {
            opportunity = accOppsResult.data.records[0];
          } else {
            // No Opportunity - create a synthetic one from Account data
            opportunity = {
              Id: null,
              Name: `${account.Name} (Account Only)`,
              StageName: "No Opportunity",
              CloseDate: null,
              Amount: null,
              Probability: null,
              IsClosed: false,
              IsWon: false,
              AccountId: account.Id,
              Account: account,
            };
          }
        } catch {
          // No Opportunities for this Account - create synthetic record
          opportunity = {
            Id: null,
            Name: `${account.Name} (Account Only)`,
            StageName: "No Opportunity",
            CloseDate: null,
            Amount: null,
            Probability: null,
            IsClosed: false,
            IsWon: false,
            AccountId: account.Id,
            Account: account,
          };
        }
      }
    } else {
      throw new Error(
        "Either opportunityId, opportunityName, or matterId must be provided",
      );
    }

    // Query for Contracts associated with the Account
    let contracts: any[] = [];
    if (opportunity.AccountId) {
      const contractFields = `
        Id, ContractNumber, Status, StartDate, EndDate, ContractTerm,
        BillingCity, BillingState, BillingCountry, Description, CreatedDate
      `.trim().replace(/\s+/g, ' ');
      const contractQuery = `SELECT ${contractFields} FROM Contract WHERE AccountId = '${opportunity.AccountId}' ORDER BY StartDate DESC LIMIT 5`;
      
      try {
        const contractResult = await salesforceClient.get(
          "/services/data/v58.0/query",
          { params: { q: contractQuery } },
        );
        contracts = contractResult.data.records || [];
        context.logger.info("Retrieved contracts", { count: contracts.length });
      } catch (contractError: any) {
        context.logger.warn("Failed to query contracts", { error: contractError?.message });
      }
    }

    // Query for Cases (support tickets) associated with the Account
    let cases: any[] = [];
    if (opportunity.AccountId) {
      const caseQuery = `SELECT Id, CaseNumber, Subject, Status, Priority, Type, CreatedDate FROM Case WHERE AccountId = '${opportunity.AccountId}' AND IsClosed = false ORDER BY CreatedDate DESC LIMIT 10`;
      
      try {
        const caseResult = await salesforceClient.get(
          "/services/data/v58.0/query",
          { params: { q: caseQuery } },
        );
        cases = caseResult.data.records || [];
        context.logger.info("Retrieved open cases", { count: cases.length });
      } catch (caseError: any) {
        context.logger.warn("Failed to query cases", { error: caseError?.message });
      }
    }

    // Extract Account data from the relationship
    const account = opportunity.Account || {};

    // Determine customer health based on cases
    let customerHealth = "Green";
    let maxCaseSeverity = "None";
    if (cases.length > 0) {
      const priorities = cases.map((c: any) => c.Priority?.toLowerCase());
      if (priorities.includes("high") || priorities.includes("critical")) {
        customerHealth = "Red";
        maxCaseSeverity = "High";
      } else if (priorities.includes("medium")) {
        customerHealth = "Yellow";
        maxCaseSeverity = "Medium";
      } else {
        maxCaseSeverity = "Low";
      }
    }

    // Format the response with enriched data
    const result = {
      opportunity_id: opportunity.Id,
      opportunity_name: opportunity.Name,
      deal_stage: {
        stage_name: opportunity.StageName,
        close_date: opportunity.CloseDate,
        forecast_category: opportunity.ForecastCategoryName || opportunity.ForecastCategory,
        is_closed: opportunity.IsClosed,
        is_won: opportunity.IsWon,
      },
      organization: {
        region: account.BillingCountry || account.BillingState,
        business_unit: account.Industry,
      },
      account: {
        id: account.Id,
        name: account.Name,
        type: account.Type,
        industry: account.Industry,
        website: account.Website,
        phone: account.Phone,
        billing_location: [account.BillingCity, account.BillingState, account.BillingCountry].filter(Boolean).join(", "),
        annual_revenue: account.AnnualRevenue,
        number_of_employees: account.NumberOfEmployees,
        rating: account.Rating,
        description: account.Description,
      },
      financial_metrics: {
        acv: opportunity.Amount,
        arr: opportunity.Amount,
        expected_revenue: opportunity.ExpectedRevenue,
        discount: null,
        total_discount: null,
        payment_terms: null,
      },
      legal_and_security: {
        legal_required: null,
        security_review_required: null,
        non_standard_terms_requested: null,
        redline_count: null,
      },
      competitive_landscape: {
        main_competitors: null,
        procurement_pressure: null,
        procurement_category: null,
        lead_source: opportunity.LeadSource,
        opportunity_type: opportunity.Type,
      },
      contract_dates: {
        contract_start_date: contracts[0]?.StartDate || null,
        contract_end_date: contracts[0]?.EndDate || null,
      },
      contracts: contracts.map((c: any) => ({
        id: c.Id,
        contract_number: c.ContractNumber,
        status: c.Status,
        start_date: c.StartDate,
        end_date: c.EndDate,
        term_months: c.ContractTerm,
        billing_location: [c.BillingCity, c.BillingState, c.BillingCountry].filter(Boolean).join(", "),
      })),
      renewal_information: {
        renewal_date: contracts[0]?.EndDate || null,
        renewal_notice_period: null,
        auto_renewal: null,
        contract_term_months: contracts[0]?.ContractTerm,
      },
      next_steps: {
        next_step: opportunity.NextStep,
        description: opportunity.Description,
      },
      customer_health: {
        open_cases_count: cases.length,
        max_open_case_severity: maxCaseSeverity,
        sla_breach: false,
        customer_health: customerHealth,
      },
      open_cases: cases.map((c: any) => ({
        id: c.Id,
        case_number: c.CaseNumber,
        subject: c.Subject,
        status: c.Status,
        priority: c.Priority,
        type: c.Type,
        created_date: c.CreatedDate,
      })),
      metadata: {
        retrieved_at: new Date().toISOString(),
        source: "salesforce",
        probability: opportunity.Probability,
        created_date: opportunity.CreatedDate,
        last_modified_date: opportunity.LastModifiedDate,
      },
    };

    context.logger.info("Salesforce commercial context retrieved", {
      opportunityId: result.opportunity_id,
      opportunityName: result.opportunity_name,
    });

    return { data: result };
  },
});

// Schema definition for Signing Likelihood validation
const SigningLikelihoodSchema = zod
  .object({
    opportunityId: zod.string().optional(),
    opportunityName: zod.string().optional(),
    matterId: zod.union([zod.string(), zod.number()]).optional(),
  })
  .refine((data) => data.opportunityId || data.opportunityName || data.matterId, {
    message: "Either opportunityId, opportunityName, or matterId must be provided",
  });

export const getSigningLikelihood = flow({
  name: "Get Signing Likelihood",
  stableKey: "get-signing-likelihood",
  description:
    "Estimate the likelihood of a deal being signed based on Salesforce opportunity data. " +
    "Returns a probability score, risk factors, and recommendations to improve signing chances.",
  isAgentFlow: true,
  isSynchronous: true,
  schemas: {
    invoke: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment:
        "Estimate signing likelihood based on Salesforce opportunity and account data",
      title: "get-signing-likelihood",
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
        matterId: {
          type: "string",
          description:
            "Luminance matter ID. When provided, the integration resolves the counterparty name from Luminance tags.",
        },
      },
      required: [],
    },
  },
  onExecution: async (context, params) => {
    let salesforceClient;
    try {
      salesforceClient = await createSalesforceClient(context);
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : String(authError);
      context.logger.error("Salesforce authentication failed", { error: msg });
      throw new Error(`Salesforce auth failed: ${msg}`);
    }

    const { opportunityId, opportunityName, matterId } =
      SigningLikelihoodSchema.parse(params.onTrigger.results.body.data);

    let resolvedOpportunityName = opportunityName;
    const resolvedMatterId = matterId ? String(matterId) : "";

    // Same Luminance lookup logic as commercial context
    if (!opportunityId && resolvedMatterId) {
      const { baseUrl: luminanceBaseUrl, clientId: luminanceClientId, clientSecret: luminanceClientSecret } =
        getLuminanceAuth(context);
      const luminanceDivisionId = getConfigString(context, "Luminance Division");
      if (!luminanceBaseUrl || !luminanceClientId || !luminanceClientSecret) {
        throw new Error("Luminance credentials missing for matterId lookup.");
      }
      if (!luminanceDivisionId) {
        throw new Error("Luminance Division is required for matterId lookup.");
      }

      const tagKey = getConfigString(context, "Counterparty Name Tag");
      if (!tagKey) {
        throw new Error("Counterparty tag key missing. Configure the tag picker.");
      }

      const token = await fetchLuminanceToken(
        luminanceBaseUrl,
        luminanceClientId,
        luminanceClientSecret
      );
      const annotations = await fetchMatterAnnotations(
        luminanceBaseUrl,
        token,
        luminanceDivisionId,
        resolvedMatterId
      );
      resolvedOpportunityName = resolveCounterpartyFromAnnotations(annotations, tagKey);
      if (!resolvedOpportunityName) {
        throw new Error(`Counterparty tag "${tagKey}" not found on matter ${resolvedMatterId}.`);
      }
    }

    context.logger.info("Getting signing likelihood", {
      opportunityId,
      opportunityName: resolvedOpportunityName,
      matterId: resolvedMatterId || undefined,
    });

    const escapeSoqlString = (str: string): string => str.replace(/'/g, "''");

    // Query opportunity with key fields for likelihood assessment
    const likelihoodFields = `
      Id, Name, StageName, CloseDate, Amount, Probability, NextStep, Type,
      ForecastCategory, ForecastCategoryName, IsClosed, IsWon, ExpectedRevenue,
      AccountId, Account.Name, Account.Type, Account.Industry, Account.Rating,
      Account.AnnualRevenue, CreatedDate, LastModifiedDate
    `.trim().replace(/\s+/g, ' ');

    let opportunity: any;

    if (opportunityId) {
      if (!/^[a-zA-Z0-9]{15,18}$/.test(opportunityId)) {
        throw new Error(`Invalid Salesforce Opportunity ID format: ${opportunityId}`);
      }
      const soqlQuery = `SELECT ${likelihoodFields} FROM Opportunity WHERE Id = '${opportunityId}' LIMIT 1`;
      const queryResult = await salesforceClient.get("/services/data/v58.0/query", { params: { q: soqlQuery } });
      if (!queryResult.data.records?.length) {
        throw new Error(`Opportunity with ID ${opportunityId} not found`);
      }
      opportunity = queryResult.data.records[0];
    } else if (resolvedOpportunityName) {
      const escapedName = escapeSoqlString(resolvedOpportunityName);
      const soqlQuery = `SELECT ${likelihoodFields} FROM Opportunity WHERE Name LIKE '%${escapedName}%' ORDER BY CloseDate DESC LIMIT 1`;
      const queryResult = await salesforceClient.get("/services/data/v58.0/query", { params: { q: soqlQuery } });
      if (!queryResult.data.records?.length) {
        throw new Error(`Opportunity with name "${resolvedOpportunityName}" not found`);
      }
      opportunity = queryResult.data.records[0];
    } else {
      throw new Error("Either opportunityId, opportunityName, or matterId must be provided");
    }

    // Count open cases for the account
    let openCasesCount = 0;
    if (opportunity.AccountId) {
      try {
        const caseQuery = `SELECT COUNT(Id) cnt FROM Case WHERE AccountId = '${opportunity.AccountId}' AND IsClosed = false`;
        const caseResult = await salesforceClient.get("/services/data/v58.0/query", { params: { q: caseQuery } });
        openCasesCount = caseResult.data.records?.[0]?.cnt || 0;
      } catch (e) {
        context.logger.warn("Failed to count cases", { error: (e as Error).message });
      }
    }

    // Calculate signing likelihood score
    const account = opportunity.Account || {};
    let baseScore = opportunity.Probability || 50;
    const riskFactors: string[] = [];
    const positiveFactors: string[] = [];
    const recommendations: string[] = [];

    // Stage-based adjustments
    const stageLower = (opportunity.StageName || "").toLowerCase();
    if (stageLower.includes("closed won")) {
      baseScore = 100;
      positiveFactors.push("Deal already closed and won");
    } else if (stageLower.includes("closed")) {
      baseScore = 0;
      riskFactors.push("Deal is closed (lost or other)");
    } else if (stageLower.includes("negotiation") || stageLower.includes("contract")) {
      baseScore = Math.max(baseScore, 70);
      positiveFactors.push("Deal in advanced negotiation/contract stage");
    } else if (stageLower.includes("proposal") || stageLower.includes("quote")) {
      positiveFactors.push("Proposal/quote stage - active engagement");
    } else if (stageLower.includes("qualification") || stageLower.includes("discovery")) {
      riskFactors.push("Still in early qualification stage");
      recommendations.push("Accelerate discovery to understand requirements");
    }

    // Forecast category adjustments
    const forecast = (opportunity.ForecastCategoryName || opportunity.ForecastCategory || "").toLowerCase();
    if (forecast.includes("commit")) {
      baseScore = Math.min(baseScore + 15, 95);
      positiveFactors.push("Forecast: Committed deal");
    } else if (forecast.includes("best case")) {
      baseScore = Math.min(baseScore + 5, 90);
      positiveFactors.push("Forecast: Best case scenario");
    } else if (forecast.includes("pipeline")) {
      riskFactors.push("Still in pipeline, not yet committed");
    }

    // Account quality adjustments
    if (account.Rating === "Hot") {
      baseScore = Math.min(baseScore + 10, 95);
      positiveFactors.push("Account rated as Hot");
    } else if (account.Rating === "Cold") {
      baseScore = Math.max(baseScore - 10, 10);
      riskFactors.push("Account rated as Cold");
      recommendations.push("Re-engage stakeholders and validate interest");
    }

    // Revenue/size adjustments
    if (account.AnnualRevenue && account.AnnualRevenue > 10000000) {
      positiveFactors.push("Enterprise account (>$10M annual revenue)");
    }

    // Close date proximity
    const closeDate = opportunity.CloseDate ? new Date(opportunity.CloseDate) : null;
    const today = new Date();
    if (closeDate) {
      const daysUntilClose = Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilClose < 0) {
        riskFactors.push(`Close date overdue by ${Math.abs(daysUntilClose)} days`);
        recommendations.push("Update close date to reflect current timeline");
        baseScore = Math.max(baseScore - 15, 10);
      } else if (daysUntilClose <= 7) {
        positiveFactors.push("Close date within 7 days");
      } else if (daysUntilClose <= 30) {
        positiveFactors.push("Close date within 30 days");
      } else if (daysUntilClose > 90) {
        riskFactors.push("Close date more than 90 days out");
      }
    }

    // Open cases impact
    if (openCasesCount > 5) {
      riskFactors.push(`${openCasesCount} open support cases - potential customer satisfaction issues`);
      recommendations.push("Address open support tickets to improve relationship");
      baseScore = Math.max(baseScore - 10, 10);
    } else if (openCasesCount > 0) {
      riskFactors.push(`${openCasesCount} open support case(s)`);
    }

    // Next step presence
    if (!opportunity.NextStep) {
      riskFactors.push("No next step defined");
      recommendations.push("Define clear next steps to maintain momentum");
    } else {
      positiveFactors.push("Clear next steps defined");
    }

    // Clamp final score
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

    // Determine confidence level
    let confidence: "low" | "medium" | "high" = "medium";
    if (riskFactors.length === 0 && positiveFactors.length >= 3) {
      confidence = "high";
    } else if (riskFactors.length > 3) {
      confidence = "low";
    }

    // Generate overall assessment
    let assessment: string;
    if (finalScore >= 80) {
      assessment = "High likelihood of signing. Deal is progressing well with strong positive indicators.";
    } else if (finalScore >= 60) {
      assessment = "Moderate likelihood of signing. Some positive indicators but attention needed on risk factors.";
    } else if (finalScore >= 40) {
      assessment = "Uncertain outcome. Multiple risk factors present - recommend focused attention on this deal.";
    } else {
      assessment = "Low likelihood of signing without intervention. Significant blockers need to be addressed.";
    }

    const result = {
      opportunity_id: opportunity.Id,
      opportunity_name: opportunity.Name,
      signing_likelihood: {
        score: finalScore,
        confidence,
        assessment,
        salesforce_probability: opportunity.Probability,
      },
      positive_factors: positiveFactors,
      risk_factors: riskFactors,
      recommendations: recommendations.length > 0 ? recommendations : ["Continue current engagement strategy"],
      deal_context: {
        stage: opportunity.StageName,
        forecast_category: opportunity.ForecastCategoryName || opportunity.ForecastCategory,
        close_date: opportunity.CloseDate,
        amount: opportunity.Amount,
        expected_revenue: opportunity.ExpectedRevenue,
        next_step: opportunity.NextStep,
        account_name: account.Name,
        account_industry: account.Industry,
        account_rating: account.Rating,
        open_cases_count: openCasesCount,
      },
      metadata: {
        retrieved_at: new Date().toISOString(),
        source: "salesforce",
        model_version: "1.0",
      },
    };

    context.logger.info("Signing likelihood calculated", {
      opportunityId: result.opportunity_id,
      score: result.signing_likelihood.score,
      confidence: result.signing_likelihood.confidence,
    });

    return { data: result };
  },
});

// Export both flows
export default [getSalesforceCommercialContext, getSigningLikelihood];