# Panorays-Luminance Integration Plan for USSA

## Executive Summary

This document outlines the integration plan between Panorays (risk and compliance tool) and Luminance (contract management platform) for USSA. The integration will enable bi-directional data synchronization, automated contract generation using risk data, and risk-based workflow automation.

## Table of Contents

1. [Use Cases](#use-cases)
2. [Integration Architecture](#integration-architecture)
3. [API Mapping](#api-mapping)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Implementation Options](#implementation-options)
6. [Technical Specifications](#technical-specifications)
7. [Data Synchronization Strategy](#data-synchronization-strategy)
8. [Risk-Based Workflow Triggers](#risk-based-workflow-triggers)
9. [Security Considerations](#security-considerations)
10. [Implementation Phases](#implementation-phases)

---

## Use Cases

### Use Case 1: Contract Generation with Panorays Risk Data

**Description:** Trigger contract generation in Luminance using risk and compliance information from Panorays to populate contract fields.

**Flow:**
1. User initiates contract creation workflow in Luminance (or via external trigger)
2. System identifies supplier/vendor from contract metadata
3. Integration queries Panorays API for supplier risk data:
   - Supplier profile information
   - Business impact score
   - Risk assessment scores
   - Compliance status
   - Questionnaire responses
   - Business information
4. Risk data is mapped to Luminance matter annotations and contract fields
5. Contract template is populated with risk-aware clauses
6. Matter is created in Luminance with populated annotations

**Detailed Flow (Component Approach):**
```
Trigger: User creates matter in Luminance OR External webhook
  ↓
Step 1: Extract Supplier Name
  - From: Matter name, form input, or annotation
  - Output: supplierName (string)
  ↓
Step 2: Panorays - Search Suppliers
  - Action: SearchSuppliers
  - Input: names=[supplierName]
  - Output: suppliers[] (array of matching suppliers)
  ↓
Step 3: Data Transform - Select Best Match
  - If multiple matches: Use asset/domain matching or prompt user
  - Output: selectedSupplierId (string)
  ↓
Step 4: Panorays - Get Supplier Risk Data (Composite)
  - Action: GetSupplierRiskData (or multiple calls)
  - Calls:
    * GET /v2/suppliers/{id}
    * GET /v2/suppliers/{id}/business_snapshot
    * GET /v2/suppliers/{id}/questionnaires
  - Output: riskData (object)
  ↓
Step 5: Data Transform - Map to Luminance Format
  - Action: MapPanoraysToLuminance
  - Transformations:
    * riskData.combined_score → annotation.risk_score
    * riskData.business_impact → annotation.business_impact
    * riskData.latest_assessment_date → annotation.assessment_date
    * riskData.questionnaires[] → annotation.questionnaire_scores[]
    * riskData.business_information[] → annotation.business_info[]
  - Output: annotations[] (array for Luminance)
  ↓
Step 6: Luminance - Create Matter with Annotations
  - Action: Create a New Matter
  - Input:
    * name: "{supplierName} - {contractType}"
    * required_matter_annotations: annotations[]
    * workflow_id: (optional)
  - Output: matter (with risk data attached)
```

**Detailed Flow (Raw API Approach):**
```
Trigger: User creates matter in Luminance OR External webhook
  ↓
Step 1: Extract Supplier Name
  - From: Matter name, form input, or annotation
  ↓
Step 2: HTTP Request - Search Panorays
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers
  - Query: ?names={supplierName}
  - Headers: Authorization: Bearer {token}
  ↓
Step 3: Data Transform - Extract Supplier ID
  - Parse JSON response
  - Select first match or best match
  ↓
Step 4: HTTP Request - Get Supplier Details
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}
  - Headers: Authorization: Bearer {token}
  ↓
Step 5: HTTP Request - Get Business Snapshot
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}/business_snapshot
  - Headers: Authorization: Bearer {token}
  ↓
Step 6: Data Transform - Map to Luminance Format
  - Combine responses from Steps 4 & 5
  - Transform to Luminance annotation format
  - Build required_matter_annotations array
  ↓
Step 7: Luminance Action - Create Matter
  - Action: Create a New Matter
  - Body: { name, required_matter_annotations: [...] }
```

**Key Panorays API Endpoints:**
- `GET /v2/suppliers` - Search suppliers by name, asset, tags
- `GET /v2/suppliers/{supplierId}` - Get supplier details
- `GET /v2/suppliers/{supplierId}/business_snapshot` - Get business snapshot
- `GET /v2/suppliers/{supplierId}/questionnaires` - Get questionnaire data
- `GET /v2/suppliers/{supplierId}/tests` - Get test results

**Key Luminance API Endpoints:**
- `POST /api2/projects/{project_id}/matters/create` - Create matter with annotations
- `POST /api2/projects/{project_id}/matters/{matter_id}/annotations` - Add risk data as annotations

**Data Mapping Example:**
```typescript
// Panorays Response
{
  "id": "supplier-123",
  "name": "JLB Credit",
  "business_impact": 4,
  "combined_score": 75,
  "latest_assessment_date": "2024-01-15T10:00:00Z",
  "questionnaires": [
    {
      "questionnaire_score": 80,
      "questionnaire_type": "external"
    }
  ]
}

// Transformed to Luminance Annotations
{
  "required_matter_annotations": [
    {
      "annotation_type_id": 10, // Risk Score annotation type
      "content": {
        "risk_score": 75,
        "assessment_date": "2024-01-15",
        "questionnaire_score": 80,
        "business_impact": 4
      }
    }
  ]
}
```

### Use Case 2: Upload Third-Party Paper with Risk Review

**Description:** Upload third-party contracts from Workday into Luminance and automatically attach Panorays risk review data.

**Flow:**
1. Third-party contract document is uploaded to Luminance (via Workday integration or manual upload)
2. System extracts supplier/vendor information from document metadata or annotations
3. Integration queries Panorays for supplier risk assessment:
   - Supplier risk profile
   - Latest assessment date
   - Combined risk score
   - Questionnaire scores
   - Remediation tasks (if any)
4. Risk review data is attached to the document as:
   - Matter annotations
   - Document notes
   - Custom annotation sources
5. Risk score triggers appropriate workflow assignment or notification

**Detailed Flow (Component Approach):**
```
Trigger: Document uploaded to Luminance (from Workday or manual)
  ↓
Step 1: Extract Supplier Information
  - From: Document metadata, filename, or OCR extraction
  - Output: supplierName, supplierDomain (optional)
  ↓
Step 2: Panorays - Search Suppliers
  - Action: SearchSuppliers
  - Input: names=[supplierName], assets=[supplierDomain] (if available)
  - Output: suppliers[] (array of matching suppliers)
  ↓
Step 3: Data Transform - Select Best Match
  - If multiple matches: Use asset/domain matching
  - If no match: Flag for manual review or create supplier
  - Output: selectedSupplierId (string) or null
  ↓
Step 4: Conditional - Supplier Found?
  ├─ Yes → Continue to Step 5
  └─ No → Step 4a: Create Supplier in Panorays (optional)
           OR Step 4b: Flag document for manual review
  ↓
Step 5: Panorays - Get Comprehensive Risk Data
  - Action: GetSupplierRiskData
  - Includes:
    * Supplier profile
    * Business snapshot
    * Questionnaires
    * Test results
    * Remediation tasks (if available)
  - Output: riskData (object)
  ↓
Step 6: Data Transform - Map Risk Data
  - Action: MapPanoraysToLuminance
  - Transform risk data to Luminance annotation format
  - Output: annotations[] (array)
  ↓
Step 7: Luminance - Attach Risk Data to Matter
  - Action: Add Matter Info to an existing Matter
  - Input:
    * matter_id: (from uploaded document)
    * annotations: annotations[]
  - Output: annotations created
  ↓
Step 8: Conditional - Risk Threshold Check
  - Evaluate: riskData.combined_score > threshold
  ├─ High Risk → Step 8a: Trigger High-Risk Workflow
  │                - Create review task
  │                - Assign to legal/risk team
  │                - Send notification
  └─ Low/Medium Risk → Step 8b: Continue normal workflow
```

**Detailed Flow (Raw API Approach):**
```
Trigger: Document uploaded to Luminance
  ↓
Step 1: Extract Supplier Information
  - Parse document metadata or filename
  ↓
Step 2: HTTP Request - Search Panorays
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers
  - Query: ?names={supplierName}&assets={domain}
  - Headers: Authorization: Bearer {token}
  ↓
Step 3: Data Transform - Extract Supplier ID
  - Parse JSON response
  - Select best match
  ↓
Step 4: HTTP Request - Get Supplier Details
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}
  - Headers: Authorization: Bearer {token}
  ↓
Step 5: HTTP Request - Get Questionnaires
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}/questionnaires
  - Headers: Authorization: Bearer {token}
  ↓
Step 6: HTTP Request - Get Tests
  - Method: GET
  - URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}/tests
  - Headers: Authorization: Bearer {token}
  ↓
Step 7: Data Transform - Combine and Map
  - Merge all responses
  - Transform to Luminance annotation format
  ↓
Step 8: Luminance Action - Add Annotations
  - Action: Add Matter Info to an existing Matter
  - Body: { annotations: [...] }
  ↓
Step 9: Conditional - Check Risk Score
  - If combined_score > 70: Trigger high-risk workflow
```

**Key Panorays API Endpoints:**
- `GET /v2/suppliers` - Search suppliers by name/asset
- `GET /v2/suppliers/{supplierId}` - Get full supplier profile
- `GET /v2/suppliers/{supplierId}/business_snapshot` - Get business snapshot
- `GET /v2/suppliers/{supplierId}/questionnaires` - Get questionnaire data
- `GET /v2/suppliers/{supplierId}/tests` - Get test results
- `GET /v2/suppliers/{supplierId}/remediation` - Get remediation tasks (if available)

**Key Luminance API Endpoints:**
- `POST /api2/projects/{project_id}/folders/{folder_id}/upload` - Upload document
- `POST /api2/projects/{project_id}/matters/{matter_id}/annotations` - Add risk annotations
- `POST /api2/projects/{project_id}/documents/{document_id}/notes` - Add risk review notes
- `POST /api2/projects/{project_id}/tasks/{task_id}/reviews` - Create review task

**Supplier Extraction Strategies:**
1. **From Document Metadata:**
   - Workday integration may include supplier name in metadata
   - Extract from custom fields or tags

2. **From Filename:**
   - Parse filename pattern: `{SupplierName}_Contract_{Date}.pdf`
   - Use regex to extract supplier name

3. **From Document OCR (Future Enhancement):**
   - Use Luminance OCR capabilities to extract party names
   - Match against Panorays supplier list

4. **From Matter Annotations:**
   - If matter already exists, check for supplier annotation
   - Use existing `info.supplier_id` field

### Use Case 3: Bi-Directional Synchronization

**Description:** Maintain synchronized supplier data between Panorays and Luminance.

**Panorays → Luminance:**
- Supplier risk score changes trigger updates to Luminance matters
- New risk findings create annotations in related contracts
- Questionnaire completion updates contract metadata
- Remediation task creation triggers workflow notifications

**Luminance → Panorays:**
- New supplier creation in Luminance creates/updates supplier in Panorays
- Contract metadata (business impact, relationship type) syncs to Panorays
- Contract status changes update Panorays supplier tags or custom factors

**Key Panorays API Endpoints:**
- `POST /v2/suppliers` - Create supplier
- `PUT /v2/suppliers/{supplierId}` - Update supplier
- `POST /v2/suppliers/{supplierId}/custom-factors` - Add custom factors
- `POST /v2/tags` - Create/update tags

**Key Luminance API Endpoints:**
- `GET /api2/projects/{project_id}/matters` - List matters
- `GET /api2/projects/{project_id}/matters/{matter_id}/events` - Get matter events
- `PATCH /api2/projects/{project_id}/matters/{matter_id}` - Update matter

### Use Case 4: Risk-Based Workflow Triggers

**Description:** Use Panorays risk data to automatically trigger workflows and notifications in Luminance.

**Triggers:**
- High-risk supplier detected → Escalate to legal team workflow
- Risk score threshold breach → Create review task
- New remediation task in Panorays → Create corresponding task in Luminance
- Questionnaire submission → Update contract review status
- Risk score improvement → Close related review tasks

**Key Panorays API Endpoints:**
- Webhook subscriptions for real-time events
- `GET /v2/suppliers/{supplierId}/remediation` - Get remediation tasks
- `GET /v2/activity` - Get activity feed

**Key Luminance API Endpoints:**
- `POST /api2/projects/{project_id}/workflows` - Trigger workflows
- `POST /api2/projects/{project_id}/tasks/{task_id}/reviews` - Create review tasks
- `POST /api2/projects/{project_id}/matters/{matter_id}/events` - Track events

---

## Integration Architecture

### High-Level Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Workday   │────────▶│   Prismatic  │────────▶│  Luminance  │
│  (Source)  │         │  Integration │         │   (Target)  │
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               │
                               ▼
                        ┌──────────────┐
                        │   Panorays   │
                        │  (Risk Data) │
                        └──────────────┘
```

### Component Architecture

**Option A: Prismatic Component (Recommended)**
- Custom Panorays component built in Prismatic
- Reusable actions for all Panorays API operations
- Type-safe TypeScript implementation
- Consistent with existing Luminance component pattern

**Option B: Raw API Requests**
- Direct HTTP requests in Prismatic flows
- Suitable for simple, one-off integrations
- Less maintainable for complex operations

---

## API Mapping

### Panorays Supplier Data → Luminance Matter Annotations

| Panorays Field | Luminance Target | Annotation Type | Notes |
|----------------|------------------|-----------------|-------|
| `supplier.id` | Matter `info.supplier_id` | Custom field | Link to Panorays supplier |
| `supplier.name` | Matter `name` or annotation | Text | Supplier name |
| `supplier.business_impact` | Matter annotation | Number (1-5) | Business impact score |
| `supplier.combined_score` | Matter annotation | Number | Overall risk score |
| `supplier.evaluation_type` | Matter annotation | Text | Evaluation type |
| `supplier.latest_assessment_date` | Matter annotation | Date | Last assessment |
| `questionnaires[].questionnaire_score` | Matter annotation | Number | Questionnaire scores |
| `questionnaires[].questionnaire_type` | Matter annotation | Text | Internal/external/both |
| `business_information[]` | Matter annotations | Object array | Business info Q&A |
| `contacts[]` | Matter annotations | Object array | POC information |
| `tags[]` | Matter `info.tags` | String array | Supplier tags |
| `relationships[]` | Matter annotation | String array | Relationship types |

### Luminance Matter Data → Panorays Supplier

| Luminance Field | Panorays Target | API Endpoint | Notes |
|-----------------|-----------------|--------------|-------|
| Matter `name` | `supplier.name` | `PUT /v2/suppliers/{id}` | Supplier name |
| Matter `info.business_impact` | `supplier.business_impact` | `PUT /v2/suppliers/{id}` | 1-5 scale |
| Matter `info.supplier_type` | `supplier.evaluation_type` | `PUT /v2/suppliers/{id}` | Evaluation type |
| Matter `info.tags` | `supplier.tags` | `POST /v2/tags` | Create/update tags |
| Matter `state` | Custom factor | `POST /v2/suppliers/{id}/custom-factors` | Contract status |
| Matter `info.relationship_type` | `supplier.relationships` | `PUT /v2/suppliers/{id}` | Relationship array |

---

## Data Flow Diagrams

### Contract Generation Flow

```
┌──────────┐
│  Trigger │ (User action or workflow)
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ Extract Supplier│ (From matter metadata or form)
│   Information   │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Query Panorays │ GET /v2/suppliers?names={supplierName}
│  for Supplier   │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Get Risk Data   │ GET /v2/suppliers/{id}
│                 │ GET /v2/suppliers/{id}/business_snapshot
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Map Risk Data   │ Transform Panorays data to Luminance format
│  to Annotations │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Create Matter   │ POST /api2/projects/{id}/matters/create
│  with Annotations│
└─────────────────┘
```

### Document Upload with Risk Review Flow

```
┌──────────┐
│ Document │ (Uploaded from Workday or manually)
│  Upload  │
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ Extract Supplier│ (From document metadata, OCR, or annotations)
│   from Document │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Search Panorays │ GET /v2/suppliers?names={name}&assets={asset}
│  for Supplier   │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Get Risk Review │ GET /v2/suppliers/{id}
│                 │ GET /v2/suppliers/{id}/questionnaires
│                 │ GET /v2/suppliers/{id}/tests
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Attach Risk Data│ POST /api2/projects/{id}/matters/{id}/annotations
│  to Document    │ POST /api2/projects/{id}/documents/{id}/notes
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Trigger Workflow│ (If risk score exceeds threshold)
│  if High Risk   │
└─────────────────┘
```

### Bi-Directional Sync Flow

**Panorays → Luminance Sync:**

```
┌─────────────────┐
│  Panorays Event │ (Webhook or polling)
│  (Risk Change)  │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Webhook Trigger │ (Component: panoraysWebhookTrigger)
│  or Polling    │ Validates HMAC signature
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Extract Event   │ Parse webhook payload
│  Data           │ - supplier_id
│                 │ - event_type (risk_score_changed, questionnaire_completed, etc.)
│                 │ - updated_fields
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Find Related    │ Luminance Action: Search Matters
│  Luminance      │ Query: info.supplier_id = {panorays_supplier_id}
│   Matters       │ OR: Search by supplier name in matter name/annotations
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Get Updated     │ Panorays Action: GetSupplierRiskData
│  Risk Data      │ Fetch latest risk information
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Update Matter   │ Luminance Actions:
│  Annotations    │ - PATCH /api2/projects/{id}/matters/{id}
│                 │ - POST /api2/projects/{id}/matters/{id}/annotations
│                 │ Update risk scores, assessment dates, questionnaire data
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Check Threshold │ Evaluate risk score against configured thresholds
│  & Trigger      │
│  Workflow       │
└─────────────────┘
     │
     ├─ High Risk → Trigger High-Risk Workflow
     └─ Normal → Continue
```

**Luminance → Panorays Sync:**

```
┌─────────────────┐
│ Luminance Event │ (Matter created/updated)
│  (Webhook or    │ Triggered by:
│   Polling)      │ - Matter creation
│                 │ - Matter annotation updates
│                 │ - Matter state changes
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Extract Supplier│ From matter:
│  Information    │ - name (extract supplier name)
│                 │ - info.supplier_id (if exists)
│                 │ - info.business_impact
│                 │ - info.tags
│                 │ - state
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Search Panorays │ Panorays Action: SearchSuppliers
│  for Supplier   │ Query by: name, asset (if available)
└────┬────────────┘
     │
     ├─ Found ──▶ Update Supplier
     │            Panorays Action: UpdateSupplier
     │            - Update business_impact
     │            - Update tags (via POST /v2/tags)
     │            - Update custom factors (contract status)
     │
     └─ Not Found ──▶ Create Supplier (Optional)
                      Panorays Action: CreateSupplier
                      - name: extracted from matter
                      - business_impact: from matter info
                      - evaluation_type: from matter metadata
                      - tags: from matter tags
```

**Implementation Details:**

**Webhook Setup (Component Approach):**
1. **Subscribe to Panorays Webhooks:**
   ```typescript
   // Use Panorays component action
   SubscribeToWebhooks({
     connection: panoraysConnection,
     webhookUrl: "https://your-prismatic-instance.com/webhooks/panorays",
     events: [
       "supplier.updated",
       "supplier.risk_score_changed",
       "questionnaire.completed",
       "remediation_task.created"
     ]
   })
   ```

2. **Webhook Trigger in Prismatic:**
   - Use `panoraysWebhookTrigger` from component
   - Validates HMAC signature automatically
   - Returns webhook payload for processing

3. **Process Webhook Events:**
   - Flow triggered by webhook
   - Extract supplier_id and event_type
   - Find related Luminance matters
   - Update matter annotations

**Polling Setup (Fallback):**
- Scheduled flow runs every 15-60 minutes
- Queries Panorays for suppliers with recent updates
- Uses `latest_assessment_date` to filter
- Compares with last sync timestamp
- Updates only changed suppliers

**Conflict Resolution:**
- **Risk Data:** Panorays is source of truth → Always sync to Luminance
- **Contract Status:** Luminance is source of truth → Sync to Panorays as custom factors
- **Business Impact:** Bidirectional, but Panorays preferred
- **Supplier Name:** Luminance takes precedence (contract context)

---

## Implementation Options

### Decision Criteria

**Choose Component (Option A) if:**
- ✅ Multiple use cases requiring Panorays integration
- ✅ Need for reusable actions across different flows
- ✅ Complex data transformations required
- ✅ Want type safety and better error handling
- ✅ Need data sources (picklists) for supplier/tag selection
- ✅ Planning to use webhooks for real-time sync
- ✅ Long-term maintenance and scalability are priorities

**Choose Raw API (Option B) if:**
- ✅ Single, simple use case (1-2 API calls)
- ✅ Proof of concept or prototype
- ✅ One-off integration with no future expansion
- ✅ Time constraints require immediate implementation
- ✅ Simple GET requests with minimal transformation

**Recommendation:** Given the complexity of the use cases (contract generation, document upload with risk review, bi-directional sync, and workflow triggers), **Option A (Component)** is strongly recommended. This aligns with the existing Luminance component pattern and provides better long-term maintainability.

---

### Option A: Prismatic Component (Recommended)

**Pros:**
- Reusable across multiple integrations and flows
- Type-safe TypeScript implementation
- Consistent with existing Luminance component pattern
- Easier to maintain, test, and debug
- Better error handling and logging
- Supports complex data transformations
- Can include data sources for picklists (suppliers, tags, templates)
- Centralized authentication management
- Version control and component versioning
- Can be shared across Prismatic instances

**Cons:**
- More initial development time (estimated 2-3 days for core actions)
- Requires component publishing workflow
- Need to manage component versions

**Component Structure:**
```
panorays-component/
├── src/
│   ├── actions/
│   │   ├── suppliers.ts       # Supplier CRUD operations
│   │   │   - GetSupplier
│   │   │   - SearchSuppliers
│   │   │   - CreateSupplier
│   │   │   - UpdateSupplier
│   │   │   - DeleteSupplier
│   │   ├── questionnaires.ts  # Questionnaire operations
│   │   │   - GetSupplierQuestionnaires
│   │   │   - GetQuestionnaire
│   │   │   - SendQuestionnaire
│   │   ├── riskInsights.ts    # Risk data retrieval
│   │   │   - GetSupplierRiskData (composite action)
│   │   │   - GetBusinessSnapshot
│   │   │   - GetRiskInsights
│   │   ├── businessInfo.ts    # Business information
│   │   │   - GetBusinessInformation
│   │   │   - UpdateBusinessInformation
│   │   ├── tags.ts            # Tag management
│   │   │   - GetTags
│   │   │   - CreateTag
│   │   │   - UpdateTag
│   │   │   - DeleteTag
│   │   ├── webhooks.ts        # Webhook subscription management
│   │   │   - SubscribeToWebhooks
│   │   │   - UnsubscribeFromWebhooks
│   │   │   - ListSubscriptions
│   │   ├── dataMapping.ts     # Data transformation utilities
│   │   │   - MapPanoraysToLuminance
│   │   │   - MapLuminanceToPanorays
│   │   │   - TransformRiskData
│   │   └── index.ts
│   ├── client.ts              # HTTP client with auth
│   ├── connections.ts         # Bearer token connection
│   ├── dataSources.ts         # Picklists for suppliers, tags, etc.
│   ├── triggers.ts           # Webhook triggers for Panorays events
│   ├── utils.ts              # Utility functions
│   └── index.ts
├── assets/
│   └── icon.png
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

**Example Action Implementation:**
```typescript
// src/actions/suppliers.ts
import { action, input, util } from "@prismatic-io/spectral";
import { createClient } from "../client";

export const getSupplier = action({
  display: {
    label: "Get Supplier",
    description: "Retrieve a supplier by ID from Panorays",
  },
  perform: async (context, { connection, supplierId, fields }) => {
    const client = createClient(connection);
    const params = fields ? { fields: fields.join(",") } : {};
    const { data } = await client.get(`/v2/suppliers/${supplierId}`, { params });
    return { data };
  },
  inputs: {
    connection: input({
      label: "Panorays Connection",
      type: "connection",
      required: true,
    }),
    supplierId: input({
      label: "Supplier ID",
      type: "string",
      required: true,
    }),
    fields: input({
      label: "Fields",
      type: "string",
      collection: "valuelist",
      required: false,
      comments: "Optional: Specify which fields to return",
    }),
  },
});

export const searchSuppliers = action({
  display: {
    label: "Search Suppliers",
    description: "Search for suppliers by name, asset, tags, or IDs",
  },
  perform: async (context, { connection, names, assets, tags, ids, limit, nextToken }) => {
    const client = createClient(connection);
    const params: Record<string, any> = {};
    if (names) params.names = Array.isArray(names) ? names : [names];
    if (assets) params.assets = Array.isArray(assets) ? assets : [assets];
    if (tags) params.tags = Array.isArray(tags) ? tags : [tags];
    if (ids) params.ids = Array.isArray(ids) ? ids : [ids];
    if (limit) params.limit = limit;
    if (nextToken) params.next_token = nextToken;
    
    const { data } = await client.get("/v2/suppliers", { params });
    return { data };
  },
  inputs: {
    connection: input({
      label: "Panorays Connection",
      type: "connection",
      required: true,
    }),
    names: input({
      label: "Supplier Names",
      type: "string",
      collection: "valuelist",
      required: false,
    }),
    assets: input({
      label: "Assets",
      type: "string",
      collection: "valuelist",
      required: false,
    }),
    tags: input({
      label: "Tags",
      type: "string",
      collection: "valuelist",
      required: false,
    }),
    ids: input({
      label: "Supplier IDs",
      type: "string",
      collection: "valuelist",
      required: false,
    }),
    limit: input({
      label: "Limit",
      type: "string",
      required: false,
      clean: (value) => value ? util.types.toNumber(value) : undefined,
    }),
    nextToken: input({
      label: "Next Token",
      type: "string",
      required: false,
    }),
  },
});
```

**Connection Implementation:**
```typescript
// src/connections.ts
import { connection } from "@prismatic-io/spectral";

export const panoraysConnection = connection({
  key: "panorays",
  display: {
    label: "Panorays API",
    description: "Panorays API connection using Bearer token authentication",
  },
  inputs: {
    baseUrl: {
      label: "Base URL",
      type: "string",
      required: true,
      shown: true,
      default: "https://api.panoraysapp.com",
      comments: "Panorays API base URL",
    },
    accessToken: {
      label: "API Token",
      type: "password",
      required: true,
      shown: true,
      comments: "Panorays API Bearer token",
    },
  },
});

// src/client.ts
import { Connection, ConnectionError } from "@prismatic-io/spectral";
import { HttpClient, createClient as createHttpClient } from "@prismatic-io/spectral/dist/clients/http";
import { util } from "@prismatic-io/spectral";
import { panoraysConnection } from "./connections";

export const createClient = (connection: Connection): HttpClient => {
  if (connection.key !== panoraysConnection.key) {
    throw new ConnectionError(
      connection,
      `Expected Panorays connection, got: ${connection.key}`
    );
  }

  const baseUrl = util.types.toString(connection.fields?.baseUrl);
  const accessToken = util.types.toString(connection.fields?.accessToken);

  if (!baseUrl || !accessToken) {
    throw new Error("Base URL and access token are required");
  }

  return createHttpClient({
    baseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    responseType: "json",
  });
};
```

**Key Actions List:**
1. **Suppliers:**
   - `GetSupplier` - Retrieve supplier by ID
   - `SearchSuppliers` - Search by name, asset, tags, IDs
   - `CreateSupplier` - Create new supplier
   - `UpdateSupplier` - Update supplier information
   - `DeleteSupplier` - Delete supplier

2. **Risk Data:**
   - `GetSupplierRiskData` - Composite action to get full risk profile
   - `GetBusinessSnapshot` - Get business snapshot
   - `GetSupplierTests` - Get test results
   - `GetRemediationTasks` - Get remediation tasks (if available)

3. **Questionnaires:**
   - `GetSupplierQuestionnaires` - List all questionnaires
   - `GetQuestionnaire` - Get specific questionnaire
   - `SendQuestionnaire` - Send questionnaire to supplier

4. **Business Information:**
   - `GetBusinessInformation` - Get business information questions/answers
   - `UpdateBusinessInformation` - Update business information

5. **Tags:**
   - `GetTags` - List all tags
   - `CreateTag` - Create new tag
   - `UpdateTag` - Update tag
   - `DeleteTag` - Delete tag

6. **Webhooks:**
   - `SubscribeToWebhooks` - Subscribe to Panorays events
   - `UnsubscribeFromWebhooks` - Unsubscribe from events
   - `ListSubscriptions` - List current subscriptions

7. **Data Mapping:**
   - `MapPanoraysToLuminance` - Transform Panorays data for Luminance
   - `MapLuminanceToPanorays` - Transform Luminance data for Panorays

8. **Utilities:**
   - `RawRequest` - For advanced use cases

**Data Sources:**
- `SelectSupplier` - Picklist of suppliers (searches and returns list)
- `SelectTag` - Picklist of available tags
- `SelectQuestionnaireTemplate` - Picklist of questionnaire templates

---

### Option B: Raw API Requests

**Pros:**
- Quick to implement for simple use cases (hours vs days)
- No component publishing required
- Direct control over requests
- Immediate testing and iteration

**Cons:**
- Code duplication across flows
- Less maintainable (changes need to be made in multiple places)
- Harder to test (no unit tests)
- No type safety (runtime errors possible)
- Manual error handling in each flow
- No reusable data sources
- Authentication must be configured in each flow

**When to Use:**
- One-off integrations with no future expansion
- Simple GET requests (1-2 calls)
- Proof of concept or prototype
- Time constraints require immediate implementation
- Less than 3-4 API calls per flow

**Example Flow Structure:**
```
Prismatic Flow: Contract Generation with Risk Data
├── Step 1: HTTP Request (Panorays)
│   ├── Method: GET
│   ├── URL: https://api.panoraysapp.com/v2/suppliers
│   ├── Query Params: names={supplierName}
│   └── Headers: Authorization: Bearer {token}
│
├── Step 2: Data Transform
│   └── Extract supplier ID from response
│
├── Step 3: HTTP Request (Panorays)
│   ├── Method: GET
│   ├── URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}
│   └── Headers: Authorization: Bearer {token}
│
├── Step 4: HTTP Request (Panorays)
│   ├── Method: GET
│   ├── URL: https://api.panoraysapp.com/v2/suppliers/{supplierId}/business_snapshot
│   └── Headers: Authorization: Bearer {token}
│
├── Step 5: Data Transform
│   └── Map Panorays data to Luminance annotation format
│       - combined_score → annotation.risk_score
│       - business_impact → annotation.business_impact
│       - latest_assessment_date → annotation.assessment_date
│
└── Step 6: Luminance Action
    ├── Action: Create a New Matter
    ├── Body: { name, required_matter_annotations: [...] }
    └── Includes risk data as annotations
```

**Raw API Request Configuration Example:**
```json
{
  "method": "GET",
  "url": "https://api.panoraysapp.com/v2/suppliers",
  "headers": {
    "Authorization": "Bearer {{config.panorays_api_token}}",
    "Accept": "application/json"
  },
  "queryParams": {
    "names": "{{trigger.data.supplier_name}}",
    "limit": "100"
  }
}
```

**Limitations with Raw API:**
- Each flow must configure authentication separately
- Error handling must be implemented in each flow
- Data transformation logic duplicated across flows
- No type checking or validation
- Harder to maintain when API changes
- No reusable picklists for supplier/tag selection

---

## Implementation Comparison Matrix

| Criteria | Component (Option A) | Raw API (Option B) |
|----------|---------------------|-------------------|
| **Initial Development Time** | 2-3 days | 2-4 hours |
| **Reusability** | High - Use across all flows | Low - Duplicate in each flow |
| **Maintainability** | High - Single source of truth | Low - Update multiple places |
| **Type Safety** | Yes - TypeScript | No - Runtime errors possible |
| **Error Handling** | Centralized, consistent | Manual per flow |
| **Testing** | Unit tests possible | Manual testing only |
| **Data Sources** | Yes - Picklists for suppliers/tags | No - Manual entry |
| **Authentication** | Centralized in connection | Configure per flow |
| **Code Duplication** | Minimal | High |
| **API Changes Impact** | Update component once | Update all flows |
| **Complex Transformations** | Easy - Reusable functions | Difficult - Duplicate logic |
| **Webhook Support** | Built-in trigger support | Manual webhook handling |
| **Documentation** | Component-level docs | Flow-level comments |
| **Long-term Cost** | Lower (maintain once) | Higher (maintain many) |

**Recommendation for USSA:**
Given the complexity of the use cases (4 distinct use cases, bi-directional sync, webhooks, workflow triggers), **Option A (Component)** is strongly recommended. The initial investment of 2-3 days will pay off quickly with:
- Faster flow development (reusable actions)
- Easier maintenance (single component to update)
- Better reliability (type safety, error handling)
- Scalability (easy to add new actions)

---

## Component Implementation Details

### Development Timeline

**Phase 1: Core Component (Days 1-2)**
- Set up project structure (TypeScript, Prismatic CLI)
- Implement connection (Bearer token)
- Create HTTP client
- Implement core supplier actions:
  - `GetSupplier`
  - `SearchSuppliers`
  - `CreateSupplier`
  - `UpdateSupplier`

**Phase 2: Risk Data Actions (Day 2-3)**
- Implement risk data actions:
  - `GetSupplierRiskData` (composite)
  - `GetBusinessSnapshot`
  - `GetSupplierQuestionnaires`
  - `GetSupplierTests`
- Implement data mapping utilities:
  - `MapPanoraysToLuminance`
  - `MapLuminanceToPanorays`

**Phase 3: Advanced Features (Day 3-4)**
- Implement webhook actions:
  - `SubscribeToWebhooks`
  - `UnsubscribeFromWebhooks`
  - `ListSubscriptions`
- Implement webhook trigger for Panorays events
- Create data sources (picklists):
  - `SelectSupplier`
  - `SelectTag`

**Phase 4: Testing & Documentation (Day 4-5)**
- Unit tests for core actions
- Integration testing
- Documentation
- Component publishing

### Component File Structure (Detailed)

```
panorays-component/
├── src/
│   ├── actions/
│   │   ├── suppliers.ts
│   │   │   - getSupplier()
│   │   │   - searchSuppliers()
│   │   │   - createSupplier()
│   │   │   - updateSupplier()
│   │   │   - deleteSupplier()
│   │   │
│   │   ├── riskData.ts
│   │   │   - getSupplierRiskData() // Composite action
│   │   │   - getBusinessSnapshot()
│   │   │   - getSupplierTests()
│   │   │   - getRemediationTasks()
│   │   │
│   │   ├── questionnaires.ts
│   │   │   - getSupplierQuestionnaires()
│   │   │   - getQuestionnaire()
│   │   │   - sendQuestionnaire()
│   │   │
│   │   ├── businessInfo.ts
│   │   │   - getBusinessInformation()
│   │   │   - updateBusinessInformation()
│   │   │
│   │   ├── tags.ts
│   │   │   - getTags()
│   │   │   - createTag()
│   │   │   - updateTag()
│   │   │   - deleteTag()
│   │   │
│   │   ├── webhooks.ts
│   │   │   - subscribeToWebhooks()
│   │   │   - unsubscribeFromWebhooks()
│   │   │   - listSubscriptions()
│   │   │
│   │   ├── dataMapping.ts
│   │   │   - mapPanoraysToLuminance()
│   │   │   - mapLuminanceToPanorays()
│   │   │   - transformRiskData()
│   │   │
│   │   └── index.ts
│   │       - Export all actions
│   │
│   ├── client.ts
│   │   - createClient() // HTTP client factory
│   │   - toAuthorizationHeaders() // Auth helper
│   │
│   ├── connections.ts
│   │   - panoraysConnection // Bearer token connection
│   │
│   ├── dataSources.ts
│   │   - selectSupplier() // Picklist data source
│   │   - selectTag() // Picklist data source
│   │
│   ├── triggers.ts
│   │   - panoraysWebhookTrigger() // Webhook trigger with HMAC validation
│   │
│   ├── utils.ts
│   │   - dateTransform() // Date format utilities
│   │   - scoreTransform() // Score normalization
│   │
│   └── index.ts
│       - Component definition
│       - Export connections, actions, triggers, data sources
│
├── assets/
│   └── icon.png
│
├── package.json
├── tsconfig.json
├── webpack.config.js
├── jest.config.js
└── README.md
```

### Example: Composite Risk Data Action

```typescript
// src/actions/riskData.ts
import { action, input } from "@prismatic-io/spectral";
import { createClient } from "../client";

export const getSupplierRiskData = action({
  display: {
    label: "Get Supplier Risk Data",
    description: "Get comprehensive risk profile including supplier details, business snapshot, and questionnaires",
  },
  perform: async (context, { connection, supplierId, includeTests, includeRemediation }) => {
    const client = createClient(connection);
    
    // Parallel API calls for efficiency
    const [supplier, businessSnapshot, questionnaires] = await Promise.all([
      client.get(`/v2/suppliers/${supplierId}`),
      client.get(`/v2/suppliers/${supplierId}/business_snapshot`),
      client.get(`/v2/suppliers/${supplierId}/questionnaires`),
    ]);

    const riskData = {
      supplier: supplier.data,
      businessSnapshot: businessSnapshot.data,
      questionnaires: questionnaires.data,
    };

    // Optional: Include tests if requested
    if (includeTests) {
      const tests = await client.get(`/v2/suppliers/${supplierId}/tests`);
      riskData.tests = tests.data;
    }

    // Optional: Include remediation tasks if requested
    if (includeRemediation) {
      try {
        const remediation = await client.get(`/v2/suppliers/${supplierId}/remediation`);
        riskData.remediation = remediation.data;
      } catch (error) {
        // Remediation endpoint may not be available for all suppliers
        riskData.remediation = null;
      }
    }

    return { data: riskData };
  },
  inputs: {
    connection: input({
      label: "Panorays Connection",
      type: "connection",
      required: true,
    }),
    supplierId: input({
      label: "Supplier ID",
      type: "string",
      required: true,
    }),
    includeTests: input({
      label: "Include Test Results",
      type: "boolean",
      required: false,
      default: false,
    }),
    includeRemediation: input({
      label: "Include Remediation Tasks",
      type: "boolean",
      required: false,
      default: false,
    }),
  },
});
```

### Example: Data Mapping Utility

```typescript
// src/actions/dataMapping.ts
import { action, input } from "@prismatic-io/spectral";

export const mapPanoraysToLuminance = action({
  display: {
    label: "Map Panorays Data to Luminance",
    description: "Transform Panorays supplier risk data into Luminance matter annotations",
  },
  perform: async (context, { riskData, annotationTypeId }) => {
    const supplier = riskData.supplier || riskData;
    
    // Extract key risk metrics
    const riskScore = supplier.combined_score || null;
    const businessImpact = supplier.business_impact || null;
    const assessmentDate = supplier.latest_assessment_date || null;
    
    // Transform questionnaire data
    const questionnaireScores = (supplier.questionnaires || []).map((q: any) => ({
      score: q.questionnaire_score,
      type: q.questionnaire_type,
      submitted: q.questionnaire_submit_date,
    }));

    // Build Luminance annotation content
    const annotationContent = {
      risk_score: riskScore,
      business_impact: businessImpact,
      assessment_date: assessmentDate ? new Date(assessmentDate).toISOString().split('T')[0] : null,
      questionnaire_scores: questionnaireScores,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
    };

    // Build required_matter_annotations array format
    const annotations = [{
      annotation_type_id: annotationTypeId,
      content: annotationContent,
    }];

    return { data: { annotations, annotationContent } };
  },
  inputs: {
    riskData: input({
      label: "Panorays Risk Data",
      type: "jsonForm",
      required: true,
      comments: "Risk data from Panorays API (supplier object or GetSupplierRiskData output)",
    }),
    annotationTypeId: input({
      label: "Annotation Type ID",
      type: "string",
      required: true,
      clean: (value) => parseInt(value, 10),
      comments: "Luminance annotation type ID for risk data",
    }),
  },
});
```

---

## Technical Specifications

### Panorays API Authentication

**Method:** Bearer Token (JWT)
- Obtain API token from Panorays platform or support
- Include in `Authorization: Bearer <token>` header
- Base URL: `https://api.panoraysapp.com`

**Connection Configuration:**
```typescript
{
  baseUrl: "https://api.panoraysapp.com",
  accessToken: "<panorays_api_token>"
}
```

### Luminance API Authentication

**Method:** OAuth 2.0 Client Credentials
- Token URL: `https://<subdomain>.app.luminance.com/auth/oauth2/token`
- Base URL derived: `https://<subdomain>.app.luminance.com/api2`
- Already implemented in existing component

### Data Transformation Requirements

**Panorays → Luminance:**
- Convert Panorays date formats to ISO 8601
- Map business impact (1-5) to Luminance annotation
- Transform questionnaire array to structured annotations
- Flatten nested business information objects

**Luminance → Panorays:**
- Extract supplier name from matter name or annotations
- Map matter state to Panorays custom factors
- Convert Luminance tags to Panorays tags
- Transform relationship annotations to relationships array

### Error Handling

- **Panorays API Errors:**
  - 401: Invalid/expired token → Refresh token or alert
  - 404: Supplier not found → Create supplier or handle gracefully
  - 429: Rate limit → Implement exponential backoff
  - 400: Validation error → Log and return user-friendly message

- **Luminance API Errors:**
  - Already handled in existing component
  - Reuse error handling patterns

### Rate Limiting

- **Panorays:** Check API documentation for rate limits
- **Luminance:** Check API documentation for rate limits
- Implement request queuing if needed
- Use webhooks where possible to reduce polling

---

## Data Synchronization Strategy

### Synchronization Methods

#### 1. Webhook-Based (Real-Time) - Preferred

**Panorays Webhooks:**
- Subscribe to supplier update events
- Subscribe to questionnaire completion events
- Subscribe to risk score change events
- Subscribe to remediation task creation events

**Webhook Events:**
- `supplier.updated`
- `supplier.risk_score_changed`
- `questionnaire.completed`
- `remediation_task.created`

**Implementation:**
1. Register webhook endpoint in Prismatic
2. Subscribe to events via Panorays API: `POST /v2/hooks/subscriptions`
3. Verify webhook requests using HMAC signature
4. Process events and update Luminance

#### 2. Polling-Based (Scheduled)

**Use Cases:**
- Fallback if webhooks unavailable
- Periodic full sync
- Batch processing

**Polling Strategy:**
- Poll Panorays for suppliers with recent updates
- Use `latest_assessment_date` to filter
- Poll every 15-60 minutes depending on requirements

#### 3. Event-Driven (Luminance → Panorays)

**Luminance Events:**
- Matter created → Check/create supplier in Panorays
- Matter updated → Update Panorays supplier
- Matter annotation added → Update Panorays custom factors

**Implementation:**
- Use Luminance webhooks (if available)
- Or poll Luminance matter events API
- Filter for supplier-related changes

### Conflict Resolution

**Strategy:** Panorays as source of truth for risk data, Luminance as source of truth for contract data

- **Risk scores:** Always sync from Panorays → Luminance
- **Contract status:** Sync from Luminance → Panorays (as custom factors)
- **Supplier name:** Luminance takes precedence (contract context)
- **Business impact:** Bidirectional, but Panorays preferred

### Data Mapping Configuration

Store mapping configuration in Prismatic integration config:
```json
{
  "supplierNameMapping": {
    "source": "matter.name",
    "transform": "extractSupplierName"
  },
  "riskScoreMapping": {
    "source": "panorays.combined_score",
    "target": "matter.annotation.risk_score",
    "threshold": 70
  },
  "businessImpactMapping": {
    "source": "panorays.business_impact",
    "target": "matter.annotation.business_impact"
  }
}
```

---

## Risk-Based Workflow Triggers

### Trigger Conditions

#### 1. High-Risk Supplier Detection

**Condition:** `combined_score > threshold` OR `business_impact >= 4`

**Actions:**
- Create high-priority review task in Luminance
- Assign to legal/risk team
- Add annotation flagging high risk
- Send notification to stakeholders

**Luminance API:**
- `POST /api2/projects/{project_id}/tasks/{task_id}/reviews`
- `POST /api2/projects/{project_id}/matters/{matter_id}/annotations`

#### 2. Risk Score Threshold Breach

**Condition:** Risk score increases above configured threshold

**Actions:**
- Escalate matter to review workflow
- Create remediation task
- Update matter status
- Notify contract owner

#### 3. New Remediation Task

**Condition:** Remediation task created in Panorays

**Actions:**
- Create corresponding task in Luminance
- Link to related matter
- Set due date from Panorays
- Assign to appropriate user

**Panorays API:**
- `GET /v2/suppliers/{supplierId}/remediation`

**Luminance API:**
- `POST /api2/projects/{project_id}/tasks`
- `POST /api2/projects/{project_id}/tasks/{task_id}/reviews`

#### 4. Questionnaire Completion

**Condition:** Questionnaire submitted in Panorays

**Actions:**
- Update matter annotations with questionnaire data
- Update contract review status
- Trigger contract generation if all prerequisites met

#### 5. Risk Score Improvement

**Condition:** Risk score decreases below threshold

**Actions:**
- Close related review tasks
- Update matter status to "Approved" or "Low Risk"
- Remove high-risk flags
- Notify stakeholders of improvement

### Workflow Configuration

Store workflow trigger rules in Prismatic config:
```json
{
  "riskTriggers": [
    {
      "condition": "combined_score > 70",
      "action": "create_review_task",
      "priority": "high",
      "assignTo": "legal_team"
    },
    {
      "condition": "business_impact >= 4",
      "action": "escalate_workflow",
      "workflowId": 123
    },
    {
      "condition": "remediation_task_created",
      "action": "create_luminance_task",
      "templateId": 456
    }
  ]
}
```

---

## Security Considerations

### Authentication & Authorization

1. **API Tokens:**
   - Store Panorays API token securely in Prismatic secrets
   - Rotate tokens regularly
   - Use least-privilege tokens

2. **OAuth 2.0:**
   - Use client credentials flow for Luminance
   - Store credentials securely
   - Implement token refresh

3. **Webhook Security:**
   - Verify HMAC signatures on Panorays webhooks
   - Use HTTPS for all webhook endpoints
   - Validate webhook payloads

### Data Privacy

1. **PII Handling:**
   - Supplier contact information may contain PII
   - Ensure compliance with data protection regulations
   - Limit access to sensitive data

2. **Data Encryption:**
   - Encrypt data in transit (HTTPS)
   - Encrypt sensitive data at rest in Prismatic

3. **Audit Logging:**
   - Log all API requests
   - Track data synchronization events
   - Monitor for anomalies

### Error Handling

- Never expose API tokens in error messages
- Sanitize error responses
- Log errors securely
- Implement retry logic with exponential backoff

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Deliverables:**
- Panorays API component (if using Option A)
- Basic authentication setup
- Core supplier data retrieval actions
- Initial data mapping configuration

**Actions:**
- `GetSupplier`
- `SearchSuppliers`
- `GetSupplierRiskData`

### Phase 2: Use Case 1 - Contract Generation (Week 3-4)

**Deliverables:**
- Contract generation flow with Panorays data
- Risk data mapping to Luminance annotations
- Template population logic
- Testing and validation

**Integration Points:**
- Panorays supplier lookup
- Risk data retrieval
- Luminance matter creation with annotations

### Phase 3: Use Case 2 - Document Upload with Risk Review (Week 5-6)

**Deliverables:**
- Document upload flow
- Supplier extraction from documents
- Risk review attachment
- Workflow trigger on high risk

**Integration Points:**
- Workday → Luminance document upload
- Panorays risk data retrieval
- Luminance annotation creation

### Phase 4: Bi-Directional Sync (Week 7-8)

**Deliverables:**
- Panorays → Luminance sync
- Luminance → Panorays sync
- Webhook setup and handling
- Conflict resolution logic

**Integration Points:**
- Panorays webhook subscriptions
- Luminance event polling
- Bidirectional data mapping

### Phase 5: Risk-Based Workflows (Week 9-10)

**Deliverables:**
- Workflow trigger configuration
- Risk threshold monitoring
- Automated task creation
- Notification system

**Integration Points:**
- Risk score monitoring
- Workflow automation
- Task management

### Phase 6: Testing & Optimization (Week 11-12)

**Deliverables:**
- End-to-end testing
- Performance optimization
- Error handling refinement
- Documentation

---

## API Reference Quick Links

### Panorays API

- **Base URL:** `https://api.panoraysapp.com`
- **Documentation:** https://panorays-papi-v2-documentation.redocly.app/swagger/supplier
- **Authentication:** Bearer token in `Authorization` header

**Key Endpoints:**
- `GET /v2/suppliers` - List/search suppliers
- `GET /v2/suppliers/{id}` - Get supplier details
- `POST /v2/suppliers` - Create supplier
- `PUT /v2/suppliers/{id}` - Update supplier
- `GET /v2/suppliers/{id}/business_snapshot` - Get business snapshot
- `GET /v2/suppliers/{id}/questionnaires` - Get questionnaires
- `GET /v2/suppliers/{id}/tests` - Get test results
- `POST /v2/hooks/subscriptions` - Subscribe to webhooks

### Luminance API

- **Base URL:** `https://<subdomain>.app.luminance.com/api2`
- **Documentation:** See `Repository/api2-spec/LuminanceAPI2-OpenAPI.yaml`
- **Authentication:** OAuth 2.0 Client Credentials

**Key Endpoints:**
- `POST /api2/projects/{project_id}/matters/create` - Create matter
- `POST /api2/projects/{project_id}/matters/{matter_id}/annotations` - Add annotations
- `POST /api2/projects/{project_id}/folders/{folder_id}/upload` - Upload document
- `GET /api2/projects/{project_id}/matters` - List matters
- `PATCH /api2/projects/{project_id}/matters/{matter_id}` - Update matter

---

## Next Steps

1. **Review and Approve Plan**
   - Stakeholder review of use cases
   - Technical architecture approval
   - Timeline confirmation

2. **Gather Requirements**
   - Confirm Panorays API access and credentials
   - Identify specific risk data fields needed
   - Define risk thresholds and workflow rules
   - Map supplier identification strategy

3. **Choose Implementation Option**
   - Decision: Component vs Raw API
   - If component: Start component development
   - If raw API: Design flow structure

4. **Set Up Development Environment**
   - Prismatic workspace setup
   - Panorays API access
   - Luminance API access
   - Test data preparation

5. **Begin Phase 1 Implementation**
   - Start with foundation components
   - Establish authentication
   - Build core actions

---

## Appendix

### A. Sample Data Structures

#### Panorays Supplier Response
```json
{
  "id": "supplier-123",
  "name": "JLB Credit",
  "business_impact": 4,
  "combined_score": 75,
  "evaluation_type": "Continuous 360 Evaluation",
  "latest_assessment_date": "2024-01-15T10:00:00Z",
  "questionnaires": [
    {
      "questionnaire_id": "q-456",
      "questionnaire_score": 80,
      "questionnaire_sent_date": "2024-01-10T09:00:00Z",
      "questionnaire_submit_date": "2024-01-12T14:30:00Z",
      "questionnaire_type": "external"
    }
  ],
  "business_information": [
    {
      "type": "text",
      "question": "Industry",
      "answer": "Technology"
    }
  ],
  "contacts": [
    {
      "email": "contact@jlbcredit.com",
      "name": "John Doe",
      "position": "Security Officer"
    }
  ],
  "tags": ["high-risk", "technology"],
  "relationships": ["vendor", "supplier"]
}
```

#### Luminance Matter with Risk Annotations
```json
{
  "id": 789,
  "name": "JLB Credit - Service Agreement",
  "state": "draft",
  "info": {
    "supplier_id": "supplier-123",
    "business_impact": 4,
    "risk_score": 75,
    "tags": ["high-risk", "technology"]
  },
  "annotations": [
    {
      "annotation_type_id": 10,
      "content": {
        "risk_score": 75,
        "assessment_date": "2024-01-15",
        "questionnaire_score": 80
      }
    }
  ]
}
```

### B. Error Scenarios

1. **Supplier Not Found in Panorays**
   - Option 1: Create supplier in Panorays
   - Option 2: Continue without risk data (flag for manual review)
   - Option 3: Prompt user to add supplier

2. **Multiple Suppliers Found**
   - Use asset/domain matching
   - Prompt user to select
   - Use most recent assessment

3. **API Rate Limiting**
   - Implement exponential backoff
   - Queue requests
   - Use webhooks to reduce polling

4. **Data Mapping Failures**
   - Log mapping errors
   - Use default values where appropriate
   - Flag for manual review

---

## Questions & Decisions Needed

1. **Supplier Identification:**
   - How to reliably match suppliers between systems?
   - Use supplier name, domain, or custom identifier?
   - Handle name variations and aliases?
   - **Recommendation:** Use supplier name as primary, with asset/domain as secondary match. Store Panorays supplier_id in Luminance matter `info.supplier_id` for future lookups.

2. **Risk Thresholds:**
   - What risk scores trigger workflows?
   - Different thresholds for different contract types?
   - Who defines and maintains thresholds?
   - **Recommendation:** Start with configurable thresholds (e.g., combined_score > 70 = high risk). Store in Prismatic config variables for easy adjustment.

3. **Data Ownership:**
   - Which system is source of truth for each data type?
   - How to handle conflicts?
   - Update frequency and sync direction?
   - **Recommendation:** 
     - Risk data: Panorays → Luminance (one-way)
     - Contract status: Luminance → Panorays (as custom factors)
     - Business impact: Bidirectional, Panorays preferred

4. **Workflow Rules:**
   - Which workflows to trigger for which risk levels?
   - Who gets notified?
   - Task assignment rules?
   - **Recommendation:** Define workflow rules in Prismatic config. Start with simple rules (high risk → escalate), expand based on feedback.

5. **Component vs Raw API:**
   - Final decision on implementation approach
   - Timeline implications
   - Maintenance considerations
   - **Recommendation:** **Component (Option A)** - Better long-term value, aligns with existing patterns, supports all use cases effectively.

6. **Webhook vs Polling:**
   - Use Panorays webhooks for real-time sync?
   - Fallback to polling if webhooks unavailable?
   - **Recommendation:** Implement webhooks as primary, polling as fallback. Webhooks provide real-time updates and reduce API calls.

7. **Error Handling:**
   - What happens when supplier not found in Panorays?
   - How to handle API rate limits?
   - Retry strategy for failed syncs?
   - **Recommendation:** 
     - Supplier not found: Create supplier in Panorays OR flag for manual review
     - Rate limits: Implement exponential backoff, queue requests
     - Failed syncs: Log error, retry with exponential backoff, alert after N failures

---

## Summary & Recommendations

### Implementation Approach: **Component (Option A)**

**Rationale:**
- 4 distinct use cases requiring multiple API calls each
- Bi-directional sync needs reusable actions
- Webhook support benefits from component triggers
- Workflow triggers require data transformation utilities
- Long-term maintenance and scalability priorities
- Aligns with existing Luminance component pattern

**Estimated Timeline:**
- **Component Development:** 4-5 days
- **Use Case 1 (Contract Generation):** 2-3 days
- **Use Case 2 (Document Upload):** 2-3 days
- **Use Case 3 (Bi-Directional Sync):** 3-4 days
- **Use Case 4 (Workflow Triggers):** 2-3 days
- **Testing & Documentation:** 2-3 days
- **Total:** 15-20 days

**Key Success Factors:**
1. ✅ Establish clear supplier identification strategy
2. ✅ Define risk thresholds and workflow rules upfront
3. ✅ Implement robust error handling and retry logic
4. ✅ Set up webhook infrastructure early
5. ✅ Create comprehensive data mapping documentation
6. ✅ Test with real Panorays and Luminance data

**Next Steps:**
1. **Review and Approve Plan** - Stakeholder sign-off on approach and timeline
2. **Gather Credentials** - Obtain Panorays API token and Luminance OAuth credentials
3. **Set Up Development Environment** - Prismatic workspace, component project structure
4. **Begin Component Development** - Start with core supplier actions
5. **Iterative Implementation** - Build and test each use case incrementally

---

*Document Version: 2.0*  
*Last Updated: 2024-01-XX*  
*Author: Integration Team*
