# Salesforce Opportunity to Luminance Integration: Data Mapping Strategy

## Overview

This design document defines how **Salesforce Opportunity data** maps to Luminance's capabilities, enabling intelligent routing, risk scoring, and workflow automation. The integration leverages Luminance's product positioning (Draft, Negotiate, Analyze, Comply, Investigate, Collaborate + "agentic AI: from thought to action") to automatically route work, triage risk, and trigger appropriate actions.

**Scope**: This document focuses on the **Salesforce API** and which Opportunity fields provide value to Luminance.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent/Orchestrator                              │
│  (Coordinates data flow, applies business logic, makes decisions)     │
│                                                                          │
│  Responsibilities:                                                       │
│  - Fetches Opportunity data from Salesforce (via MCP or direct API)     │
│  - Transforms Salesforce data into Luminance payloads                    │
│  - Applies routing and risk scoring logic                                │
│  - Orchestrates Luminance API calls                                      │
└───────────────┬───────────────────────────────────────┬──────────────────┘
                │                                       │
                │ MCP Protocol                          │ MCP Protocol / API
                │                                       │
    ┌───────────▼──────────┐              ┌────────────▼──────────────┐
    │  Salesforce MCP      │              │  Integration MCP          │
    │  Server              │              │  Server                   │
    │                      │              │  (or Luminance API)       │
    │  Tools:              │              │                           │
    │  - get_opportunity   │              │  - Luminance Client        │
    │  - list_opportunities│              │  - API orchestration        │
    │  - get_account       │              │                           │
    └───────────┬──────────┘              └────────────┬───────────────┘
                │                                       │
                │ Salesforce API                        │ Luminance API
                │                                       │
    ┌───────────▼──────────┐              ┌────────────▼──────────────┐
    │   Salesforce API      │              │   Luminance API            │
    │   ← THIS DOCUMENT     │              │                           │
    │   FOCUS AREA          │              │   Endpoints:              │
    │                       │              │   - /api/documents/        │
    │   Objects:            │              │     aiValidationUpsert     │
    │   - Opportunity       │              │   - /api/documents/note    │
    │   - Account           │              │   - /api/documents/         │
    │   - Cases (rollups)   │              │     annotate               │
    │   - Owner             │              │   - /api/workflows/        │
    │                       │              │     connections/{id}/      │
    │   Fields:             │              │     activate               │
    │   - Id, StageName,    │              │                           │
    │     Type, Amount,     │              │                           │
    │     CloseDate, etc.   │              │                           │
    └───────────┬──────────┘              └───────────────────────────┘
                │
                │
    ╭───────────┘
    │
    │  focus of this document
    │
    └─◄───
```

**Document Focus**: This document focuses on the **Salesforce API** (indicated by the arrow) and specifically which Opportunity fields from Salesforce provide value to Luminance.

---

## Opportunity Fields That Make Luminance Smarter

This section defines the Salesforce Opportunity fields that provide value to Luminance, organized by use case. Each section specifies:
- **Pull from Salesforce**: Which fields to retrieve from the Salesforce API
- **Send into Luminance**: How the agent transforms and sends the data
- **Why this aligns**: The business value and product alignment

---

### 1) Deal Routing and Workflow Automation (Collaborate / Draft)

**Purpose**: These fields help Luminance route the matter to the right workflow/stage, auto-assign reviewers, and enforce approvals.

#### Pull from Salesforce Opportunity

- `Id` (always)
- `StageName`
- `Type` (New / Renewal / Upsell)
- `CloseDate`
- `OwnerId` / `Owner.Name` (and team/region if you have it)
- `AccountId` / `Account.Name`
- `Region__c`, `Business_Unit__c` (or equivalents)
- "Legal required" / "Security review required" flags (if you have custom fields like `Legal_Required__c`, `Security_Review_Required__c`)

#### Send into Luminance as

**Workflow inputs / routing metadata** (so the right flow runs and assigns the right people)

**Write-back**: trigger workflow connection activation when criteria hit

**API Endpoint**: `/api/workflows/connections/{id}/activate`

**Example**:
```json
{
  "workflow_connection_id": "wf-12345",
  "inputs": {
    "stage": "Negotiation/Review",
    "deal_type": "Renewal",
    "region": "EMEA",
    "business_unit": "Enterprise",
    "assigned_owner": "john.smith@company.com",
    "close_date": "2024-03-31",
    "legal_required": true,
    "security_review_required": false
  }
}
```

#### Why This Aligns to Product

Luminance emphasizes automating workflows end-to-end and agentic execution. This data enables:
- **Automatic routing**: Stage and Type determine which workflow to activate
- **Auto-assignment**: Owner information ensures the right reviewer gets the work
- **Approval enforcement**: Legal/Security flags trigger required review workflows
- **Regional compliance**: Region and Business Unit enable location-specific workflows

---

### 2) Commercial Context for Risk Scoring (Negotiate / Analyze)

**Purpose**: This is what makes contract review commercially aware (not just "legal clause spotting"). Prioritize clauses based on deal value and urgency.

#### Pull from Salesforce Opportunity

- `Amount` (or `ACV__c` / `ARR__c`)
- `CurrencyIsoCode`
- `Discount__c` / `Total_Discount__c` (esp. if you use CPQ-derived rollups)
- `Payment_Terms__c` (if captured in SF)
- `Competitor__c` / `Procurement_Pressure__c` (if captured)

#### Send into Luminance as

**Structured insight**: `/api/documents/aiValidationUpsert` with something like:

```json
{
  "document_id": "doc-12345",
  "validations": [
    {
      "type": "commercial_context",
      "data": {
        "revenue_at_risk": 500000,
        "deal_value_band": "high",
        "discount_exception": true,
        "commercial_priority": "high"
      }
    }
  ]
}
```

**Human note**: `/api/documents/note?type=commercial_context`

Example: `"£500k ACV; renewal; discount exception requested; escalate if liability cap is > X"`

#### Why This Aligns to Product

Luminance's "analyze/negotiate" value becomes stronger when it can:
- **Prioritize clauses** based on deal value (high-value deals get deeper review)
- **Flag exceptions** (discount exceptions trigger stricter liability cap reviews)
- **Assess urgency** (procurement pressure indicates time-sensitive negotiations)
- **Contextualize risk** (revenue at risk helps prioritize which clauses matter most)

---

### 3) Time Sensitivity + Renewal Leakage Prevention (Analyze / Comply)

**Purpose**: This makes Luminance useful post-signature too (obligation/renewal tracking). Prevents revenue leakage through proactive renewal management.

#### Pull from Salesforce Opportunity

- `CloseDate`
- `Contract_Start_Date__c`, `Contract_End_Date__c` (if your Opportunity carries them)
- `Renewal_Date__c` / `Renewal_Notice_Period__c`
- `AutoRenewal__c` flag (if tracked)
- `NextStep` / `Next_Steps__c`

#### Send into Luminance as

**aiValidationUpsert**: deadlines + "renewal urgency score"

```json
{
  "document_id": "doc-12345",
  "validations": [
    {
      "type": "renewal_urgency",
      "data": {
        "renewal_date": "2024-12-31",
        "renewal_notice_period_days": 30,
        "renewal_window_closes": "2024-12-01",
        "days_until_renewal_window_closes": 45,
        "renewal_urgency_score": "high",
        "auto_renewal": false,
        "close_date": "2024-03-31"
      }
    }
  ]
}
```

**notes/annotations** that highlight "renewal window closes in 30 days"

Example note: `"Renewal window closes in 30 days (2024-12-01). Non-auto-renewal contract. Action required: Initiate renewal negotiations by 2024-11-15."`

**optionally**: workflow activation to kick off renewal playbook

Trigger renewal playbook workflow when:
- `AutoRenewal__c = false` AND
- `(Renewal_Date__c - Renewal_Notice_Period__c) - today() <= 45 days`

#### Why This Aligns to Product

Enables proactive compliance and renewal management:
- **Deadline awareness**: Luminance highlights critical renewal windows
- **Revenue protection**: Prevents renewal leakage through early intervention
- **Obligation tracking**: Post-signature contract management becomes actionable
- **Automated workflows**: Renewal playbooks trigger automatically when deadlines approach

---

### 4) Counterparty + Procurement Risk Context (Investigate / Analyze)

**Purpose**: This is where you can enrich "counterparty risk scoring". Enables intelligent risk triage and appropriate review depth based on counterparty profile.

#### Pull from Salesforce Opportunity

**From Opportunity**:
- `AccountId`

**From Account (join)**:
- `industry`
- `tier` (e.g., `Tier__c`)
- `country`
- `parent` (e.g., `ParentId`)
- `sanctions/KYC flags` (if present, e.g., `Sanctions_Flag__c`)

**Opportunity-level**:
- "non-standard terms requested" flags (e.g., `Non_Standard_Terms_Requested__c`)
- `redline count` (if tracked, e.g., `Redline_Count__c`)
- `procurement category` (e.g., `Procurement_Category__c`)

#### Send into Luminance as

**notes + validation payload** like:

```json
{
  "document_id": "doc-12345",
  "validations": [
    {
      "type": "counterparty_risk",
      "data": {
        "counterparty_tier": "enterprise",
        "region": "EMEA",
        "requires_dpa": true,
        "third_party_risk": "medium"
      }
    }
  ]
}
```

**Note example**: `"Enterprise customer in UK (EMEA). Non-standard terms requested (5 redlines). Requires DPA. Procurement category: Software. Medium third-party risk."`

#### Why This Aligns to Product

Enables intelligent risk triage:
- **Review depth**: Enterprise customers get deeper review; SMB gets streamlined process
- **Compliance requirements**: Country/region determines DPA, GDPR, and other compliance needs
- **Risk scoring**: Sanctions flags and non-standard terms trigger enhanced due diligence
- **Negotiation complexity**: Redline count indicates negotiation difficulty and required expertise

---

### 5) Case/Escalation Signals (Collaborate)

**Purpose**: If you want genuinely "actionable" insights, pipeline risk signals are gold. Converts customer health data into actionable contract language and approval requirements.

#### Pull from Salesforce Opportunity

**From Account (join)** - optional but high value:
- `Open Cases count` (e.g., `Open_Cases_Count__c` - rollup field)
- `severity for the Account` (e.g., `Severity_1_Cases__c` - rollup field)
- `SLA breach flags` (if you store them, e.g., `SLA_Breach_Flag__c`)
- "At risk" customer health flag (if you store it in SF, e.g., `At_Risk__c` or `Customer_Health__c`)

#### Send into Luminance as

**a note**: `"2 open Sev-1 cases — tighten termination/credits language; require exec approval"`

**trigger escalation workflow connection**

Example workflow activation:
```json
{
  "workflow_connection_id": "wf-escalation-123",
  "inputs": {
    "severity_1_cases": 2,
    "at_risk": true,
    "customer_health": "At Risk",
    "escalation_reason": "Multiple Sev-1 cases and at-risk customer status",
    "required_approval": "executive"
  }
}
```

Trigger escalation workflow when:
- `Severity_1_Cases__c > 0` OR
- `At_Risk__c = true` OR
- `SLA_Breach_Flag__c = true`

#### Why This Aligns to Product

Converts pipeline risk signals into actionable contract language:
- **Proactive risk management**: Customer health issues trigger protective contract language
- **Approval workflows**: High-risk customers require executive approval
- **Termination protection**: At-risk customers get tighter termination and credit language
- **Collaboration**: Legal and sales teams get aligned on deal risk

---

## Summary

These five use cases demonstrate how Salesforce Opportunity data makes Luminance smarter by:

1. **Automating workflows** - Routing and assignment based on deal characteristics
2. **Prioritizing risk** - Commercial context enables smarter clause prioritization
3. **Preventing leakage** - Renewal tracking and deadline management
4. **Enriching risk scoring** - Counterparty intelligence for appropriate review depth
5. **Enabling action** - Customer health signals trigger protective contract language

Each use case pulls specific fields from the Salesforce API and transforms them into Luminance API calls that drive intelligent automation and risk management.

---

## References

- [Luminance API Documentation](https://api.luminance.com/docs)
- [Salesforce Opportunity Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_opportunity.htm)
