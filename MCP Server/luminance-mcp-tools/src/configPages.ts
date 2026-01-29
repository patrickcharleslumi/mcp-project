import { configPage, configVar, connectionConfigVar } from "@prismatic-io/spectral";

/**
 * Connections page for the MCP integration.
 *
 * Architecture: Agent → MCP → (Luminance + Salesforce)
 *
 * - Luminance: Credentials from customer connections. Use stableKey that matches
 *   your existing org-activated / customer Luminance connection so deployers
 *   don't re-enter; Prismatic binds it when the key matches.
 *
 * - Salesforce: Configured within the instance using Consumer Key + Secret + Credentials
 *   (no login/redirect). Use Salesforce Username-Password flow with Connected App
 *   Consumer Key, Consumer Secret, username and password.
 *
 * @see MCP_LLM_PROXY_RUNTHROUGH.md
 */
export const configPages = {
  Connections: configPage({
    tagline:
      "Luminance uses credentials from customer connections when the stable key matches. " +
      "Salesforce is configured per instance with Consumer Key, Consumer Secret, username and password for OAuth Username-Password authentication.",
    elements: {
      "Luminance Connection": connectionConfigVar({
        stableKey: "luminance-connection",
        dataType: "connection",
        connectionType: "customApp",
        inputs: {
          baseUrl: {
            label: "Base URL",
            type: "string",
            required: true,
            shown: true,
            default: "https://<your-domain>.app.luminance.com",
            comments:
              "Luminance API base URL. Omit if using an org-activated Luminance connection (set same stable key in org).",
            permissionAndVisibilityType: "customer",
            visibleToOrgDeployer: true,
          },
          accessToken: {
            label: "Access Token",
            type: "password",
            required: true,
            shown: false,
            comments: "Luminance API access token (org-level).",
            permissionAndVisibilityType: "organization",
            visibleToOrgDeployer: false,
            default: "YOUR_LUMINANCE_ACCESS_TOKEN",
          },
        },
      }),
      "Salesforce Token URL": configVar({
        stableKey: "salesforce-token-url",
        dataType: "string",
        description:
          "Salesforce OAuth2 token URL. Use https://test.salesforce.com/services/oauth2/token for sandbox.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        defaultValue: "https://login.salesforce.com/services/oauth2/token",
      }),
      "Salesforce Consumer Key": configVar({
        stableKey: "salesforce-consumer-key",
        dataType: "string",
        description: "Connected App Consumer Key (Client ID).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
      "Salesforce Consumer Secret": configVar({
        stableKey: "salesforce-consumer-secret",
        dataType: "string",
        description:
          "Connected App Consumer Secret (Client Secret). Store as a sensitive string.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
      "Salesforce Username": configVar({
        stableKey: "salesforce-username",
        dataType: "string",
        description: "Salesforce user for API access (used with Password flow).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
      "Salesforce Password": configVar({
        stableKey: "salesforce-password",
        dataType: "string",
        description:
          "Salesforce user password (append security token if required). Use an integration user for security.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
    },
  }),
};
