import { flow, util } from "@prismatic-io/spectral";
import zod from "zod";
import { createSalesforceClient } from "./salesforceClient";

type JsonRecord = Record<string, unknown>;

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

    if (opportunityId) {
      // Validate Salesforce ID format (15 or 18 characters, alphanumeric)
      if (!/^[a-zA-Z0-9]{15,18}$/.test(opportunityId)) {
        throw new Error(
          `Invalid Salesforce Opportunity ID format: ${opportunityId}`,
        );
      }

      // Query by ID - use only standard Salesforce fields
      const soqlQuery = `SELECT
        Id, Name, StageName, CloseDate, Amount, Probability, NextStep
        FROM Opportunity
        WHERE Id = '${opportunityId}'
        LIMIT 1`;

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
      // Query by name - escape single quotes for SOQL and use LIKE for partial match
      const escapedName = escapeSoqlString(resolvedOpportunityName);
      // Use only standard Salesforce fields to avoid 400 errors from missing custom fields
      const soqlQuery = `SELECT
        Id, Name, StageName, CloseDate, Amount, Probability, NextStep
        FROM Opportunity
        WHERE Name LIKE '%${escapedName}%'
        ORDER BY CloseDate DESC
        LIMIT 1`;

      context.logger.info("Executing SOQL query", { query: soqlQuery });

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
        throw new Error(`Salesforce query failed: ${errorMsg}. Query: ${soqlQuery}`);
      }

      if (!queryResult.data.records || queryResult.data.records.length === 0) {
        throw new Error(`Opportunity with name "${resolvedOpportunityName}" not found`);
      }

      opportunity = queryResult.data.records[0];
    } else {
      throw new Error(
        "Either opportunityId, opportunityName, or matterId must be provided",
      );
    }

    // Format the response with standard Salesforce fields
    const result = {
      opportunity_id: opportunity.Id,
      opportunity_name: opportunity.Name,
      deal_stage: {
        stage_name: opportunity.StageName,
        close_date: opportunity.CloseDate,
      },
      organization: {
        region: null,
        business_unit: null,
      },
      financial_metrics: {
        acv: opportunity.Amount,
        arr: opportunity.Amount,
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
      },
      contract_dates: {
        contract_start_date: null,
        contract_end_date: null,
      },
      renewal_information: {
        renewal_date: null,
        renewal_notice_period: null,
        auto_renewal: null,
      },
      next_steps: {
        next_step: opportunity.NextStep,
      },
      customer_health: {
        open_cases_count: null,
        max_open_case_severity: null,
        sla_breach: null,
        customer_health: null,
      },
      metadata: {
        retrieved_at: new Date().toISOString(),
        source: "salesforce",
        probability: opportunity.Probability,
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