# AI Insights Button & Agent Integration (Luminance)

This doc explains the AI Insights tab, its architecture, and how to connect an Agent/MCP server.

## UX entry points
AI Insights is a **third tab** alongside Activity/Related in the matter overview.

Key UI files:
- `src/public/js/views/corporate/group-overview.ts`
- `views/templates/corporate/group-overview.hbs`
- `src/public/less/views/corporate/group-overview.less`
- `src/public/less/views/generic-components/tabs/tabs.less`
- `src/public/js/views/generic-components/tabs/tabs.js`

## Core view (AI Insights panel)
The panel is a standalone view with its own template + styles:

- **View:** `src/public/js/views/corporate/group-overview/group-ai-insights-view.ts`
- **Template:** `views/templates/corporate/group-overview/group-ai-insights-view.hbs`
- **Styles:** `src/public/less/views/corporate/group-overview/group-ai-insights-view.less`

The view renders:
1. AI summary (structured rows + confidence + reasoning)
2. Recommended actions (interactive cards + approvals)
3. Agent chat (mocked ask/response + “Lumi thinking” widget)

## Data flow
On `load()` the view calls:
```ts
this.insights_payload = await this.fetchInsights();
this.applyInsights(this.insights_payload, { markNew: false });
```

`fetchInsights()` hits:
```
GET /api/groups/:id/ai_insights
```
If the endpoint is unavailable, it **falls back to mock data**.

### Badge updates
The view emits:
```
ai-insights:badge
```
which is consumed by the tabs component to show a badge when new insights are available.

## Agent / MCP integration (bridge)
The view exposes a global bridge for external systems:
```ts
window.__ai_insights_bridge.updateGroupInsights(groupId, payload, { markNew: true });
```

This is the **integration point** for MCP/Agent servers:
- Your agent can call the bridge after fetching or computing insights.
- `payload` matches the `InsightsPayload` interface in the view file.
- `markNew: true` triggers the badge on the AI Insights tab.

## Minimal payload contract
```ts
type InsightsPayload = {
  summary: {
    items: { label: string; value: string; severity?: 'low'|'medium'|'high' }[];
    reasoning: string[];
    confidence?: number;
  };
  recommendations: {
    id: string;
    title: string;
    description: string;
    rationale: string;
    confidence?: number;
    preview?: { transitions?: string[]; notifications?: string[]; systems?: string[] };
  }[];
  workflow_preview: { transitions: string[]; notifications: string[]; systems: string[] };
  metadata?: { new_insights_count?: number; last_updated?: string };
};
```

## Suggested MCP flow
1. Agent receives matter context (group id).
2. Agent fetches/derives insights.
3. Agent sends payload to browser via MCP channel.
4. Browser calls `window.__ai_insights_bridge.updateGroupInsights(...)`.

## Mock behavior (local demo)
While the real MCP connection is offline:
- AI Insights uses a **mock payload** with Salesforce‑style content.
- Agent chat shows a **pulsating Lumi logo** for ~5s then returns a sample response.

## Where to hook in server-side
The expected backend endpoint is:
```
GET /api/groups/:id/ai_insights
```
You can implement a controller that proxies to MCP or your internal agent service.

## Notes
- `window.LUMINANCE` is frozen; use `window.__ai_insights_bridge`.
- The AI Insights badge is driven by `setBadge(...)` in the generic tabs component.
- Templates must be registered at boot; restart web when adding new `.hbs`.
