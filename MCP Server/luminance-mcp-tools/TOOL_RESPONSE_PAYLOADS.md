# Tool Response Payloads

This document describes the expected response payloads for the MCP tools exposed by this integration.

## Get Salesforce Commercial Context

**Tool Name:** `get-salesforce-commercial-context`

**Response Structure:**

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

**Field Descriptions:**

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

**Note:** All fields except `opportunity_id`, `opportunity_name`, and `metadata` may be `null` if not populated in Salesforce.

---

## Estimate Signing Likelihood

**Tool Name:** `estimate-signing-likelihood`

**Response Structure:**

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

**Field Descriptions:**

- `scenario_id`: Unique identifier for the scenario (from input)
- `scenario_name`: Human-readable name for the scenario (from input)
- `signing_probability`: Predicted probability that the scenario will result in a signed contract (0.0 to 1.0, where 1.0 = 100%)
- `estimated_days_to_sign`: Estimated number of days until contract signing for this scenario
- `confidence`: Confidence level in the prediction (0.0 to 1.0, where 1.0 = 100% confident)
- `factors.company_size`: Company size bucket used in the analysis (e.g., "small", "mid", "enterprise", "unknown")
- `factors.region`: Geographic region used in the analysis
- `factors.clause_risk`: Risk level assessment of the clause combinations (e.g., "low", "medium", "high")
- `metadata.note`: Additional notes or metadata about the prediction

**Response Format:**

The response is an array of scenario results. Each element in the array corresponds to one scenario from the input `scenarios` array, maintaining the same order.

**Example Response:**

```json
{
  "data": [
    {
      "scenario_id": "scenario_1",
      "scenario_name": "Standard Terms",
      "signing_probability": 0.75,
      "estimated_days_to_sign": 14,
      "confidence": 0.65,
      "factors": {
        "company_size": "enterprise",
        "region": "US",
        "clause_risk": "medium"
      },
      "metadata": {
        "note": "Placeholder - needs trained ML model"
      }
    },
    {
      "scenario_id": "scenario_2",
      "scenario_name": "Customer-Friendly Terms",
      "signing_probability": 0.85,
      "estimated_days_to_sign": 10,
      "confidence": 0.70,
      "factors": {
        "company_size": "enterprise",
        "region": "US",
        "clause_risk": "low"
      },
      "metadata": {
        "note": "Placeholder - needs trained ML model"
      }
    }
  ]
}
```

**Note:** The current implementation returns placeholder values. In production, these would be generated by a trained ML model that analyzes clause combinations, company context, and historical signing data.
