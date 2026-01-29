# MCP Runthrough: Luminance → LLM Proxy Agent → Prismatic MCP

This doc explains the end-to-end flow, what the Prismatic MCP instance needs, and how it aligns with [Prismatic’s MCP Flow Server](https://prismatic.io/docs/ai/model-context-protocol/).

---

## 1. Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────────┐
│  Luminance      │ ──► │  LLM proxy       │ ──► │  Prismatic MCP         │
│  (run locally)  │     │  agent           │     │  (hosted Flow Server)   │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
                                                              │
                        MCP tools = agent flows                │
                        (get-company-context,                  │
                         get-similar-msas, etc.)               ▼
                                                ┌─────────────────────────┐
                                                │  MCP instance uses:      │
                                                │  • Luminance (customer   │
                                                │    connection)           │
                                                │  • Salesforce (instance  │
                                                │    config: Consumer Key  │
                                                │    + Secret + user creds)│
                                                └─────────────────────────┘
```

- **Luminance (local)** invokes your agent.
- The **LLM proxy agent** is configured to use Prismatic’s MCP Flow Server as its tool backend.
- **Prismatic MCP** exposes your agent flows as MCP tools. When the agent calls a tool, Prismatic runs the flow.
- Those flows use **config** from the **MCP instance**: Luminance (from customer connection) and Salesforce (from instance config). The instance must be wired to both **your** Luminance env and **your** Salesforce org.

---

## 2. What the MCP Instance Must Have

The MCP instance in Prismatic is the one that runs when the agent calls a tool. It needs:

| Source | Purpose | How it’s provided |
|--------|---------|-------------------|
| **Luminance** | Calls Luminance API (company context, MSAs, etc.) | **Customer connection.** Use the same stable key as your existing org‑activated or customer Luminance connection so credentials come from customer connections. |
| **Salesforce** | Used by “Salesforce commercial context” flow | **Instance config.** Configure within the instance using Consumer Key, Consumer Secret, Username, and Password (Salesforce OAuth2 Username‑Password flow). No login/redirect UI. |

- **Luminance:** If the customer already has a Luminance connection in Prismatic (org‑activated or from another integration), the MCP integration uses that **same connection** when the stable key matches (`luminance-connection`). No need to re‑enter Luminance credentials.
- **Salesforce:** Configured **per instance** with: **Salesforce Token URL** (default `https://login.salesforce.com/services/oauth2/token`; use `https://test.salesforce.com/...` for sandbox), **Salesforce Consumer Key**, **Salesforce Consumer Secret**, **Salesforce Username**, **Salesforce Password**. The integration uses the Salesforce OAuth2 Username‑Password flow (no “Connect to Salesforce” / login UI). You need a Salesforce Connected App (Consumer Key + Secret) and a dedicated user (e.g. integration user) for API access.

---

## 3. Prismatic MCP Connection (from Prismatic docs)

From [Prismatic MCP Flow Server](https://prismatic.io/docs/ai/model-context-protocol/):

- **Hosted MCP:** Prismatic provides a built‑in MCP flow server. Your **tools** are **agent flows** with invocation schemas.
- **Endpoints:**  
  - **Global (region):** e.g. `mcp.eu-west-1.prismatic.io/mcp` (see table in the doc).  
  - **Private stack:** `mcp.<your-prismatic-domain>/mcp`  
  - **This integration only:** Integration → **MCP** tab → custom URL like `https://mcp.prismatic.io/SW5...../mcp`.
- **Auth:** Your LLM proxy connects with a **Prismatic API token** (e.g. `prism me:token` or from the UI), sent as `Authorization: Bearer <token>`.
- **Who sees which flows:**  
  - **Org members:** agent flows from **test instances**.  
  - **Customer users:** agent flows from **production instances** deployed to that customer.

So for your setup:

- The **LLM proxy agent** should use either:
  - The **integration‑specific MCP endpoint** (only this integration’s flows), or  
  - The **global/regional MCP endpoint** (all agent flows; you can still scope by instance/customer).
- Use a **Prismatic API token** that has access to the instance you deploy (test vs customer).

---

## 4. Clear Runthrough

### A. Prismatic side

| Step | Action |
|------|--------|
| 1 | **Import** the Luminance MCP Tools integration (e.g. `npm run import` with Node 20+ and `PRISMATIC_URL` set). |
| 2 | **Create an instance** of the integration (e.g. “Luminance MCP – LLM proxy”). |
| 3 | **Luminance**  
    - **If** the customer already has a Luminance connection (org‑activated or same stable key): ensure this integration’s “Luminance Connection” uses that **same stable key** (`luminance-connection`); credentials then come from customer connections.  
    - **If not:** configure Luminance (Token URL + org-level client id/secret as in the component). |
| 4 | **Salesforce (instance config)**  
    - In the instance’s **Connections** step, set: **Salesforce Token URL** (prod or `https://test.salesforce.com/services/oauth2/token` for sandbox), **Salesforce Consumer Key**, **Salesforce Consumer Secret**, **Salesforce Username**, **Salesforce Password**.  
    - No login/redirect UI: the integration uses the Username‑Password flow with these values. |
| 5 | **Deploy** the instance to the customer (or keep as test instance for org members). |
| 6 | **MCP tab:** Open the integration → **MCP** tab, copy the **custom MCP endpoint** (or note the global one for your region/stack). |

### B. Salesforce Connected App (required for Consumer Key + Secret)

You need a Connected App to get Consumer Key and Consumer Secret:

1. In Salesforce: **Setup** → **App Manager** → **New Connected App**.
2. Enable **OAuth**. For Username‑Password flow you still set a **Callback URL** (e.g. `https://login.salesforce.com/services/oauth2/success` or any valid URL; it is not used for the password flow).
3. Enable **Allow Username‑Password Flow** (or equivalent) so the Connected App can be used with grant_type=password.
4. Choose **Scopes** (e.g. “Access and manage your data (api)”, “Perform requests at any time (refresh_token)”).
5. Save. Copy **Consumer Key** and **Consumer Secret**.
6. In the MCP instance config, set **Salesforce Consumer Key** and **Salesforce Consumer Secret** to those values. Use a dedicated integration user for **Salesforce Username** and **Salesforce Password** (append security token to password if required).

For **sandbox**, set **Salesforce Token URL** to `https://test.salesforce.com/services/oauth2/token`; for production use `https://login.salesforce.com/services/oauth2/token` (default).

### C. LLM proxy agent side

| Step | Action |
|------|--------|
| 7 | **Prismatic token:** e.g. `prism me:token` or create in UI; must be valid for the instance you use. |
| 8 | **Point agent at MCP:** Configure the LLM proxy to use Prismatic’s MCP server:  
    - **URL:** integration‑specific endpoint from the MCP tab, or global `mcp.<your-prismatic-domain>/mcp`.  
    - **Headers:** `Authorization: Bearer <prismatic_token>`. |
| 9 | **Tool discovery:** The agent will see MCP tools = your agent flows (e.g. get-company-context, get-similar-msas, get-clause-fallbacks, estimate-signing-likelihood, get-salesforce-commercial-context). |

When Luminance (local) calls the agent, and the agent calls one of these tools, Prismatic runs the flow using the **instance’s** config: Luminance from customer connection, Salesforce from instance config (Consumer Key + Secret + Username + Password).

---

## 5. Connections Design (as implemented)

### 5.1 Luminance: customer connection

- **Stable key:** `luminance-connection`. Use the **same stable key** as your existing org‑activated or customer Luminance connection so credentials come from customer connections.
- **Org‑activated:** If Luminance is an **Organization‑Activated Customer Connection** with that stable key, Prismatic binds it and you don’t re‑enter Luminance credentials.

### 5.2 Salesforce: instance config (Consumer Key + Secret, no login)

- **No login/redirect UI.** Salesforce is configured **within the instance** using:
  - **Salesforce Token URL** (default `https://login.salesforce.com/services/oauth2/token`; use `https://test.salesforce.com/...` for sandbox)
  - **Salesforce Consumer Key** (Connected App Consumer Key)
  - **Salesforce Consumer Secret** (Connected App Consumer Secret)
  - **Salesforce Username** (integration user or similar)
  - **Salesforce Password** (user password; append security token if required)
- The integration uses the **Salesforce OAuth2 Username‑Password flow** (grant_type=password) to obtain an access token at runtime. No “Connect to Salesforce” button.

### 5.3 Single “Connections” page

- One **Connections** page with:
  - **Luminance Connection** (connectionConfigVar; bound to customer connection when stable key matches).
  - **Salesforce Token URL**, **Salesforce Consumer Key**, **Salesforce Consumer Secret**, **Salesforce Username**, **Salesforce Password** (configVar; all configured within the instance).

---

## 6. Summary

| Topic | Conclusion |
|-------|------------|
| **Architecture** | Agent → MCP → Luminance (customer connection) + Salesforce (instance config). |
| **Luminance** | Use the customer’s **existing** Luminance connection by matching **stable key** (`luminance-connection`). Credentials from customer connections. |
| **Salesforce** | Configure **within the instance** using Consumer Key, Consumer Secret, Username, and Password. Username‑Password flow; no login/redirect UI. |
| **MCP instance** | Must have Luminance (via customer connection) and Salesforce (via instance config) so flows that call Luminance API or Salesforce can run. |
| **LLM proxy** | Connect to Prismatic’s MCP endpoint (integration‑specific or global) with `Authorization: Bearer <prismatic_token>`. |

If your existing Luminance connection uses a different **stable key**, set that in `configPages.ts` for “Luminance Connection” so the MCP uses it.
