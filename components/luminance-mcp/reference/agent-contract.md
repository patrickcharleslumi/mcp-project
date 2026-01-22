## Agent Contract

The MCP wrapper accepts task-style payloads that wrap inputs. Each endpoint supports:

```json
{
  "taskId": "task-123",
  "inputs": {
    "...": "..."
  }
}
```

### Version Comparison

Request:

```json
{
  "taskId": "task-compare-001",
  "inputs": {
    "baseDocumentId": "doc:v1:987",
    "compareDocumentId": "doc:v2:988",
    "options": { "clauseGranularity": true, "sensitivity": "medium" }
  }
}
```

Response (partial):

```json
{
  "status": "success",
  "summary": "3 clauses changed",
  "payload": {
    "diffSummary": { "changedCount": 3 },
    "changedClauses": [
      { "clauseId": "c-12", "diffScore": 0.83 }
    ]
  },
  "taskId": "task-compare-001"
}
```

### Clause Search

Request:

```json
{
  "taskId": "task-clause-001",
  "inputs": {
    "clauseId": "c-12",
    "filters": {
      "governingLaw": "England and Wales",
      "tcvRange": { "min": 100000, "max": 1000000 }
    },
    "limit": 10
  }
}
```

### Group Info

Request:

```http
GET /mcp/groups/123/info
X-Task-Id: task-group-001
```

### Bulk Enrich

```json
{
  "taskId": "task-bulk-001",
  "inputs": {
    "groupIds": [123, 456]
  }
}
```
