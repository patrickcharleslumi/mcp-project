# Getting the Luminance MCP Up and Running

This guide covers what you need to get the MCP integration running when **the Luminance authentication connection already exists for the Prismatic customer**.

---

## 1. Use the Customer’s Existing Luminance Connection

You want the MCP to use the Luminance connection that’s **already** set up for the customer. That’s done via **Organization-Activated Customer Connections** in Prismatic.

### Option A: Luminance is already an org-activated customer connection

If Luminance is already an **Organization-Activated Customer Connection** in your org:

1. In Prismatic: **Org name (bottom-left)** → **Connections**.
2. Find the Luminance connection and note its **Stable Key** (e.g. `luminance-connection` or `luminance-api`).
3. In this integration, the “Luminance Connection” config var uses **`stableKey: "luminance-connection"`**.  
   If your org-activated connection uses a different stable key, we can change the integration’s `stableKey` in `configPages.ts` to match so Prismatic ties them together.

When the stable keys (and connection type) match, “adding a connection” in the integration will reference that org-activated connection. Deployments for a customer will then use **that customer’s** Luminance credentials already stored in Prismatic. No second Luminance login in the MCP config.

### Option B: Luminance comes from another integration (e.g. Luminance API component)

If the customer’s Luminance auth is configured in **another** integration (e.g. “Luminance API” or another product that uses a Luminance connector):

- That connection lives in that **integration/instance**, not as a shared org-activated connection.
- To reuse it in the MCP, you have two paths:

**Path 1 – Preferable:** Turn it into an org-activated connection and point the MCP at it:

1. **Create** an Organization-Activated Customer Connection for Luminance:
   - Org name → **Connections** → **+ Add Connection**.
   - Choose the **Luminance** connector (or “OAuth2” if that’s how Luminance is modelled).
   - Connection type: **Organization-Activated Customer Connection**.
   - Set **Stable Key** to `luminance-connection` (or whatever this MCP uses / you’ll align to).
2. **Per customer:**  
   Customers → pick customer → **Connections** → **+ Add connection** → select that Luminance org-activated connection → fill in Token URL / client ID / secret (or whatever the connector expects).
3. Ensure the MCP integration’s “Luminance Connection” uses the **same** stable key (and type) so it automatically uses this org-activated connection. Then the MCP uses “the Luminance connection already in the customer.”

**Path 2 – Keep instance-level config:**  
If you don’t use org-activated connections, the MCP’s “Sign in to Luminance” config page will keep defining its **own** connection. In that case, whoever deploys the MCP instance must enter Luminance details again (Token URL + org-level client id/secret we baked in). So it’s “new” from the wizard’s point of view, even if it’s the same Luminance env the customer already uses elsewhere.

---

## 2. What You Need to Get the MCP Running (Checklist)

### In Prismatic

| Step | Action |
|------|--------|
| 1 | **Import the integration**  
`npm run import` (from this repo, with Node 20+ and `PRISMATIC_URL` set). |
| 2 | **Create an instance**  
Integration → Create instance → name it (e.g. “Luminance MCP Tools”). |
| 3 | **Luminance connection**  
If using an org-activated Luminance connection (Option A or Path 1 above), no extra config; it will use the customer’s existing one.  
If not, complete “Sign in to Luminance” (Token URL; client id/secret are org-level and can stay as in code). |
| 4 | **Salesforce (optional)**  
If you use flows that need Salesforce, configure “Salesforce Connection” or point to an existing org-activated Salesforce connection the same way. |
| 5 | **Deploy to a customer**  
Deploy the instance to the customer whose Luminance connection you want to use. |

### For Using the MCP in Cursor (or another client)

| Step | Action |
|------|--------|
| 6 | **Get a Prismatic token**  
`prism me:token` (or from Prismatic UI → get auth token / API key). |
| 7 | **Get the MCP endpoint**  
Integration → **MCP** (or **AI** → MCP).  
Typical shape:  
`https://mcp.luminance-production-eu-central-1.prismatic.io/mcp`  
(or the URL shown for this integration). |
| 8 | **Configure Cursor**  
Edit `~/.cursor/mcp.json`:  
```json  
{  
  "mcpServers": {  
    "luminance-mcp-tools": {  
      "url": "https://mcp.luminance-production-eu-central-1.prismatic.io/mcp",  
      "headers": {  
        "Authorization": "Bearer YOUR_PRISMATIC_TOKEN"  
      }  
    }  
  }  
}  
```  
Use the real MCP URL and token. |
| 9 | **Restart Cursor**  
Fully quit and reopen Cursor. |

---

## 3. Aligning With an Existing Luminance Connection

If your **existing** Luminance connection in the customer already has a known stable key (e.g. from another integration or from an org-activated connection), we should use that same key in this MCP.

Current value in code:

- **Stable key:** `luminance-connection`  
- **Config var label:** `"Luminance Connection"`  
- **Type:** OAuth2 (`connectionType: "oauth2"`)

If your Prismatic Luminance connection uses a different stable key (e.g. `luminance-api` or `Luminance API Connection`), say what it is and we can update `configPages.ts` to use that stable key so the MCP “uses the authentication connection for Luminance already in the prismatic customer.”

---

## 4. Quick Reference

- **Import:**  
  `PRISMATIC_URL=https://app.luminance-production-eu-central-1.prismatic.io npm run import`
- **Token:**  
  `prism me:token`
- **MCP URL (example):**  
  `https://mcp.luminance-production-eu-central-1.prismatic.io/mcp`
- **Config file:**  
  `~/.cursor/mcp.json`

If you share the exact **stable key** and **connection type** (e.g. “Luminance OAuth2” or “Luminance API”) of the connection you already use for that customer, the next step is to align this MCP’s `stableKey` and `connectionType` with that so it runs using that existing Luminance authentication.
