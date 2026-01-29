## Salesforce MCP Integration

**Code stub:** `components/salesforce-mcp/salesforce_mcp_client.py`  
**Prismatic notes:** `components/agentic-layer/prismatic/PRISMATIC_DEPLOYMENT.md`

This component documents the Salesforce MCP integration surface and how it
plugs into the agentic layer.

## Tool: Get Salesforce Commercial Context

**Tool name:** `get-salesforce-commercial-context`

**Response structure:**

```json
{
  "data": {
    "opportunity_id": "string",
    "opportunity_name": "string",
    "deal_stage": {
      "stage_name": "string",
      "close_date": "string (ISO date format)"
    },
    "organization": {
      "region": "string | null",
      "business_unit": "string | null"
    },
    "financial_metrics": {
      "acv": "number | null",
      "arr": "number | null",
      "discount": "number | null",
      "total_discount": "number | null",
      "payment_terms": "string | null"
    },
    "legal_and_security": {
      "legal_required": "boolean | null",
      "security_review_required": "boolean | null",
      "non_standard_terms_requested": "boolean | null",
      "redline_count": "number | null"
    },
    "competitive_landscape": {
      "main_competitors": "string | null",
      "procurement_pressure": "string | null",
      "procurement_category": "string | null"
    },
    "contract_dates": {
      "contract_start_date": "string (ISO date format) | null",
      "contract_end_date": "string (ISO date format) | null"
    },
    "renewal_information": {
      "renewal_date": "string (ISO date format) | null",
      "renewal_notice_period": "string | null",
      "auto_renewal": "boolean | null"
    },
    "next_steps": {
      "next_step": "string | null"
    },
    "customer_health": {
      "open_cases_count": "number | null",
      "max_open_case_severity": "string | null",
      "sla_breach": "boolean | null",
      "customer_health": "string | null"
    },
    "metadata": {
      "retrieved_at": "string (ISO 8601 timestamp)",
      "source": "salesforce"
    }
  }
}
```

**Field descriptions:**

- `opportunity_id`: Salesforce Opportunity ID (15 or 18 character alphanumeric)
- `opportunity_name`: Name of the Salesforce Opportunity
- `deal_stage.stage_name`: Current stage of the opportunity (e.g., "Prospecting", "Negotiation", "Closed Won")
- `deal_stage.close_date`: Expected close date for the opportunity
- `organization.region`: Geographic region of the opportunity
- `organization.business_unit`: Business unit associated with the opportunity
- `financial_metrics.acv`: Annual Contract Value
- `financial_metrics.arr`: Annual Recurring Revenue
- `financial_metrics.discount`: Discount percentage applied
- `financial_metrics.total_discount`: Total discount amount
- `financial_metrics.payment_terms`: Payment terms for the contract
- `legal_and_security.legal_required`: Whether legal review is required
- `legal_and_security.security_review_required`: Whether security review is required
- `legal_and_security.non_standard_terms_requested`: Whether non-standard terms have been requested
- `legal_and_security.redline_count`: Number of redlines on the contract
- `competitive_landscape.main_competitors`: Main competitors for this opportunity
- `competitive_landscape.procurement_pressure`: Level of procurement pressure
- `competitive_landscape.procurement_category`: Category of procurement
- `contract_dates.contract_start_date`: Start date of the contract
- `contract_dates.contract_end_date`: End date of the contract
- `renewal_information.renewal_date`: Date when renewal is expected
- `renewal_information.renewal_notice_period`: Notice period required for renewal
- `renewal_information.auto_renewal`: Whether the contract auto-renews
- `next_steps.next_step`: Next step in the sales process
- `customer_health.open_cases_count`: Number of open support cases
- `customer_health.max_open_case_severity`: Maximum severity of open cases
- `customer_health.sla_breach`: Whether there have been SLA breaches
- `customer_health.customer_health`: Overall customer health score/status
- `metadata.retrieved_at`: ISO 8601 timestamp when the data was retrieved
- `metadata.source`: Always "salesforce" for this tool

**Notes:**

- All fields except `opportunity_id`, `opportunity_name`, and `metadata` may be `null` if not populated in Salesforce.

**Endpoint placeholder:**

- `SALESFORCE_MCP_COMMERCIAL_CONTEXT_PATH` (default `/tools/get-salesforce-commercial-context`)

**Live endpoint (EU Central):**

- `https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOjE2MWQ2OGRlLWZkZDEtNDZiNC1hZmE2LTE5ZmI3MzUzMTVmMg==`

## Tool: Estimate Signing Likelihood

**Tool name:** `estimate-signing-likelihood`

**Response structure:**

```json
{
  "data": [
    {
      "scenario_id": "string",
      "scenario_name": "string",
      "signing_probability": "number (0.0 - 1.0)",
      "estimated_days_to_sign": "number",
      "confidence": "number (0.0 - 1.0)",
      "factors": {
        "company_size": "string",
        "region": "string",
        "clause_risk": "string"
      },
      "metadata": {
        "note": "string"
      }
    }
  ]
}
```

**Field descriptions:**

- `scenario_id`: Unique identifier for the scenario (from input)
- `scenario_name`: Human-readable name for the scenario (from input)
- `signing_probability`: Predicted probability that the scenario will result in a signed contract (0.0 to 1.0, where 1.0 = 100%)
- `estimated_days_to_sign`: Estimated number of days until contract signing for this scenario
- `confidence`: Confidence level in the prediction (0.0 to 1.0, where 1.0 = 100% confident)
- `factors.company_size`: Company size bucket used in the analysis (e.g., "small", "mid", "enterprise", "unknown")
- `factors.region`: Geographic region used in the analysis
- `factors.clause_risk`: Risk level assessment of the clause combinations (e.g., "low", "medium", "high")
- `metadata.note`: Additional notes or metadata about the prediction

**Response format:**

- The response is an array of scenario results.
- Each element in the array corresponds to one scenario from the input `scenarios` array, maintaining the same order.

**Endpoint placeholder:**

- `SALESFORCE_MCP_SIGNING_LIKELIHOOD_PATH` (default `/tools/estimate-signing-likelihood`)

**Live endpoint (EU Central):**

- `https://hooks.eu-central-1.integrations.luminance.com/trigger/SW5zdGFuY2VGbG93Q29uZmlnOjgxMGJiMzhmLWEyM2EtNGFiZS05M2NmLTcwN2VkOWJjZjViNA==`
