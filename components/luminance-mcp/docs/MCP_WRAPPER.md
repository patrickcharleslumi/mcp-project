## MCP HTTP Wrapper

### Overview

This service exposes a stable, audited HTTP surface for the agent to call into Luminance. It includes:
- Version comparison for group documents
- Clause text search & similarity lookup
- Group info + tags
- Template catalog lookup
- Bulk enrichment

### Running locally

```bash
export MCP_API_KEY=dev-key
export LUMINANCE_BASE_URL=https://your-domain.example
export LUMINANCE_API_TOKEN=your-token
export LUMINANCE_PROJECT_ID=1
uvicorn mcp.app:app --reload --port 8080
```

### Env configuration

- `MCP_API_KEY` (required)
- `LUMINANCE_BASE_URL` (required)
- `LUMINANCE_API_TOKEN` (required)
- `LUMINANCE_PROJECT_ID` (required)
- `MCP_REQUEST_TIMEOUT_SECONDS`
- `RATE_LIMIT_PER_MINUTE`
- `MCP_MAX_CONCURRENCY`
- `MCP_CACHE_TTL_SECONDS`
- `MCP_CACHE_MAX_ENTRIES`
- `MCP_MAX_CLAUSES_PER_DOCUMENT`
- `MCP_MAX_DOCUMENTS_SCAN`
- `MCP_FEATURE_ENABLED`
- `MCP_VERIFY_TLS` (set to `false` for local self-signed certs)
- `MCP_TEMPLATE_CATALOG_PATH`

### Endpoints & curl

```bash
curl -X POST http://localhost:8080/mcp/groups/123/version-comparison \
  -H "Authorization: Bearer dev-key" \
  -H "X-User-Id: demo-user" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: abc-123" \
  -d '{"baseDocumentId":"doc:v1:987","compareDocumentId":"doc:v2:988","options":{"clauseGranularity":true,"sensitivity":"medium"}}'
```

```bash
curl -X POST http://localhost:8080/mcp/groups/123/clauses/search \
  -H "Authorization: Bearer dev-key" \
  -H "Content-Type: application/json" \
  -d '{"clauseId":"c-12","filters":{"governingLaw":"England and Wales","tcvRange":{"min":100000,"max":1000000}},"limit":10}'
```

```bash
curl -X GET http://localhost:8080/mcp/groups/123/info \
  -H "Authorization: Bearer dev-key"
```

### Tests

```bash
pytest tests/unit
pytest tests/integration
```

### OpenAPI

Generated spec is tracked at `components/luminance-mcp/reference/mcp-openapi.yaml`.

Upstream Luminance endpoints used by the MCP wrapper are documented in
`components/luminance-mcp/reference/luminance-upstream-openapi.yaml`.

### Postman / HTTPie examples

See `components/luminance-mcp/reference/agent-contract.md` for JSON payloads. Example HTTPie:

```bash
http POST :8080/mcp/groups/123/version-comparison \
  Authorization:"Bearer dev-key" \
  baseDocumentId="doc:v1:987" compareDocumentId="doc:v2:988"
```

### Security review notes

- API key required for all `/mcp/*` routes.
- X-Request-ID propagated to downstream Luminance API calls.
- Structured logs omit secrets.
- Rate limiting and timeouts applied for upstream requests.

### Rollout / migration plan

- Start with `MCP_FEATURE_ENABLED=false` in production (dark launch).
- Enable per environment once monitoring and error mapping are validated.
- Gradually increase `MCP_MAX_CONCURRENCY` after verifying Luminance rate limits.
