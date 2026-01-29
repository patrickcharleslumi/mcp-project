import {
  configPage,
  configVar,
  dataSourceConfigVar,
  connectionConfigVar,
  OAuth2Type,
} from "@prismatic-io/spectral";

const getConfigString = (context: any, key: string): string =>
  String(context?.configVars?.[key] ?? "").trim();

const getLuminanceAuth = (context: any): { baseUrl: string; clientId: string; clientSecret: string } => {
  const connection = context?.configVars?.["Luminance API Connection"];
  const connectionTokenUrl = String(connection?.fields?.tokenUrl ?? "").trim();
  const baseUrlInput = getConfigString(context, "Luminance Base URL");
  const tokenUrl = connectionTokenUrl || (baseUrlInput ? new URL("/auth/oauth2/token", baseUrlInput).toString() : "");
  const baseUrl = tokenUrl ? tokenUrl.replace("/auth/oauth2/token", "") : "";
  const clientId =
    String(connection?.fields?.clientId ?? "").trim() || getConfigString(context, "Luminance Client ID");
  const clientSecret =
    String(connection?.fields?.clientSecret ?? "").trim() ||
    getConfigString(context, "Luminance Client Secret");
  return { baseUrl, clientId, clientSecret };
};

const fetchLuminanceToken = async (
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> => {
  const tokenUrl = new URL("/auth/oauth2/token", baseUrl).toString();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Luminance token request failed (${response.status}): ${text}`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Luminance token response missing access_token.");
  }
  return payload.access_token;
};

/**
 * Simple configuration for Salesforce JWT Bearer authentication.
 * Only the 4 required Salesforce settings for JWT.
 */
export const configPages = {
  "Initial Configuration": configPage({
    tagline: "Set up Luminance and Salesforce connections for this instance.",
    elements: {
      "Setup Instructions": `
        <p>Configure the Luminance API connection first so we can load divisions and matter tags.</p>
        <p>Then configure Salesforce credentials and select the Counterparty Name tag mapping.</p>
      `,
      "Luminance API Connection": connectionConfigVar({
        stableKey: "luminance-api-connection",
        dataType: "connection",
        description: "OAuth2 Client Credentials connection for Luminance API.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        oauth2Type: OAuth2Type.ClientCredentials,
        inputs: {
          tokenUrl: {
            label: "Token URL",
            type: "string",
            required: true,
            shown: true,
            default: "https://localhost:4000/auth/oauth2/token",
          },
          scopes: {
            label: "Scopes",
            type: "string",
            required: false,
            shown: true,
            comments: "Space-delimited scopes (optional)",
          },
          clientId: {
            label: "Client ID",
            type: "string",
            required: true,
            shown: true,
          },
          clientSecret: {
            label: "Client Secret",
            type: "password",
            required: true,
            shown: true,
          },
        },
      }),
    },
  }),
  "Luminance API": configPage({
    tagline: "Configure Luminance API access used by dynamic pickers.",
    elements: {
      "Luminance Base URL": configVar({
        stableKey: "luminance-base-url",
        dataType: "string",
        description: "Luminance API base URL (e.g., https://localhost:4000).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        defaultValue: "https://localhost:4000",
      }),
      "Luminance Client ID": configVar({
        stableKey: "luminance-client-id",
        dataType: "string",
        description: "Client ID for Luminance OAuth2 client credentials.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
      "Luminance Client Secret": configVar({
        stableKey: "luminance-client-secret",
        dataType: "string",
        description: "Client secret for Luminance OAuth2 client credentials.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
    },
  }),
  Salesforce: configPage({
    tagline: "Configure Salesforce JWT Bearer authentication.",
    elements: {
      "Salesforce Token URL": configVar({
        stableKey: "salesforce-token-url",
        dataType: "string",
        description:
          "Salesforce OAuth2 token URL. Use your org's custom domain URL for best results.",
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
      "Salesforce Username": configVar({
        stableKey: "salesforce-username",
        dataType: "string",
        description: "Salesforce user for API access (must be authorized for the Connected App).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
      "Salesforce Private Key": configVar({
        stableKey: "salesforce-private-key",
        dataType: "string",
        description: "Private key for JWT signing (full PEM format including BEGIN/END headers).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
      }),
    },
  }),
  "Luminance Tag Mapping": configPage({
    tagline: "Pick the division and Counterparty Name matter tag dynamically.",
    elements: {
      "Luminance Division": dataSourceConfigVar({
        stableKey: "luminance-division",
        dataSourceType: "picklist",
        description: "Select the Luminance division to resolve matter tags.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        perform: async (context) => {
          const { baseUrl, clientId, clientSecret } = getLuminanceAuth(context);
          if (!baseUrl || !clientId || !clientSecret) {
            return { result: [] };
          }
          const token = await fetchLuminanceToken(baseUrl, clientId, clientSecret);
          const response = await fetch(new URL("/api2/projects?limit=null", baseUrl).toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to fetch divisions (${response.status}): ${text}`);
          }
          const data = (await response.json()) as Array<{ id?: number | string; name?: string }>;
          const options = (data || []).map((item) => ({
            key: String(item.id ?? ""),
            label: String(item.name ?? item.id ?? "Unknown"),
          }));
          return { result: options };
        },
      }),
      "Counterparty Name Tag": dataSourceConfigVar({
        stableKey: "counterparty-name-tag",
        dataSourceType: "picklist",
        description: "Select the matter tag that stores the Counterparty Name.",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        perform: async (context) => {
          const { baseUrl, clientId, clientSecret } = getLuminanceAuth(context);
          if (!baseUrl || !clientId || !clientSecret) {
            return { result: [] };
          }
          const token = await fetchLuminanceToken(baseUrl, clientId, clientSecret);
          const response = await fetch(
            new URL("/api2/annotation_types?limit=null", baseUrl).toString(),
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to fetch annotation types (${response.status}): ${text}`);
          }
          const data = (await response.json()) as Array<{
            key?: string;
            name?: string;
            state?: string;
          }>;
          const options = (data || [])
            .filter((item) => (item.state ?? "active") === "active")
            .map((item) => ({
              key: String(item.key ?? ""),
              label: String(item.name ?? item.key ?? "Unknown"),
            }))
            .filter((item) => item.key);
          return { result: options };
        },
      }),
    },
  }),
};