import { configPage, configVar } from "@prismatic-io/spectral";

/**
 * Simple configuration for Salesforce JWT Bearer authentication.
 * Only the 4 required Salesforce settings for JWT.
 */
export const configPages = {
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