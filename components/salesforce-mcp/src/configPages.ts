import { configPage, configVar } from "@prismatic-io/spectral";

/**
 * Simple configuration for Salesforce JWT Bearer authentication.
 * Only the 4 required Salesforce settings for JWT.
 */
export const configPages = {
  Luminance: configPage({
    tagline: "Configure Luminance API access for downstream tools.",
    elements: {
      "Luminance Base URL": configVar({
        stableKey: "luminance-base-url",
        dataType: "string",
        description: "Luminance API base URL (e.g., https://localhost:4000).",
        permissionAndVisibilityType: "customer",
        visibleToOrgDeployer: true,
        defaultValue: "https://localhost:4000",
      }),
      "Luminance API Token": configVar({
        stableKey: "luminance-api-token",
        dataType: "string",
        description: "Bearer token for Luminance API access.",
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
};