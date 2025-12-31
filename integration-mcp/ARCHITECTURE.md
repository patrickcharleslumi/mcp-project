# Integration MCP Server Architecture

## Overview

The Integration MCP Server provides semantic tools for MSA optimization workflows, sitting between an agent/orchestrator and the Luminance API.

## Architecture Diagram

```
┌─────────────────┐
│  Agent/LLM      │
│  Orchestrator   │
└────────┬────────┘
         │ JSON-RPC 2.0 (stdio)
         │
┌────────▼────────┐
│  MCP Client     │
└────────┬────────┘
         │
┌────────▼────────┐
│  MCP Server      │
│  (integration-mcp)│
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│ Luminance API   │
│ (v1 & v2)       │
└─────────────────┘
```

## Components

### 1. MCP Server (`server.py`)

- Implements MCP protocol (JSON-RPC 2.0 over stdio)
- Routes tool calls to appropriate handlers
- Manages lifecycle and error handling

### 2. Tools (`tools/`)

Four semantic tools:

#### `get_company_context`
- Retrieves company metadata (size, region, industry)
- Used for filtering precedents
- **Status**: Placeholder (needs integration with company database)

#### `get_similar_msas`
- Finds signed MSAs similar to a draft
- Filters by company attributes
- Returns compact metadata (IDs, dates, similarity scores)
- **Status**: Uses document search (needs ML similarity in production)

#### `get_clause_fallbacks`
- Analyzes clause positions in signed precedents
- Suggests 1-3 fallback options per clause type
- Returns frequency statistics and references
- **Status**: Basic frequency analysis (needs NLP/ML clustering in production)

#### `estimate_signing_likelihood`
- Scores scenarios with different clause combinations
- Predicts signing probability and time-to-sign
- **Status**: Heuristic model (needs trained ML model in production)

### 3. Luminance Client (`luminance_client.py`)

- HTTP client for Luminance API v1 and v2
- Rate limiting and retry logic
- Async/await support
- Tenant scoping

### 4. Configuration (`config.py`)

- Environment-based configuration
- Feature flags
- Rate limits and timeouts

### 5. Logging (`logger.py`)

- Structured logging with JSON output
- Sensitive data redaction
- Tool execution timing

## Data Flow

### Example: MSA Optimization Workflow

1. **Agent calls `get_company_context`**
   - Input: `tenant_id`, `company_name`
   - Output: Company metadata

2. **Agent calls `get_similar_msas`**
   - Input: `tenant_id`, `msa_id`, `project_id`, filters
   - Output: List of similar signed MSAs

3. **Agent calls `get_clause_fallbacks`**
   - Input: `tenant_id`, `msa_id`, `project_id`, optional `similar_msa_ids`
   - Output: Fallback suggestions per clause type

4. **Agent calls `estimate_signing_likelihood`** (optional)
   - Input: `tenant_id`, `msa_id`, `company_context`, `scenarios[]`
   - Output: Scoring for each scenario

## Security & Guardrails

### Tenant Scoping
- All tools require `tenant_id`
- Client validates tenant access (placeholder - needs implementation)

### Rate Limiting
- Configurable per-minute limit (default: 60)
- Token bucket algorithm
- Blocks when limit exceeded

### Timeouts
- Configurable per-tool timeout (default: 30s)
- Prevents hanging requests

### Input Validation
- JSON schema validation for all tool inputs
- Type checking via Pydantic

### Observability
- Structured logging (JSON)
- Tool execution timing
- Error tracking
- Sensitive data redaction

## Production Considerations

### Missing Features (MVP → Production)

1. **Company Context**
   - Integration with company database
   - External system integration (Salesforce, HubSpot)

2. **Similarity Search**
   - ML-based document similarity
   - Semantic search capabilities
   - Vector embeddings

3. **Clause Analysis**
   - NLP-based clause extraction
   - Semantic clustering of clause positions
   - Risk scoring from clause content

4. **Signing Likelihood Model**
   - Trained ML model
   - Historical data integration
   - Feature engineering (company, clause, historical patterns)

5. **Tenant Permissions**
   - Actual permission checking
   - User context integration
   - Audit logging

## Testing

### Unit Tests
- Tool handlers
- Client methods
- Configuration

### Integration Tests
- End-to-end tool execution
- API client with mock server
- Error scenarios

### Manual Testing
- `test_client.py` for local testing
- MCP client integration

## Deployment

### Local Development
```bash
python -m integration_mcp.server
```

### Production
- Run as subprocess from orchestrator
- Stdio transport (JSON-RPC 2.0)
- Environment variables for configuration

## Future Enhancements

1. **Caching**
   - Cache company context
   - Cache similar MSAs
   - TTL-based invalidation

2. **Batch Operations**
   - Batch clause analysis
   - Parallel API calls

3. **Metrics & Monitoring**
   - Prometheus metrics
   - Distributed tracing
   - Performance dashboards

4. **External Integrations**
   - Salesforce adapter
   - HubSpot adapter
   - HR systems

