import { type Connection, util } from "@prismatic-io/spectral";
import {
  HttpClient,
  createClient as createHttpClient,
} from "@prismatic-io/spectral/dist/clients/http";

export const extractBaseUrlFromDomain = (domainOrUrl: string): string => {
  try {
    // If it already includes /api2, return as is
    if (domainOrUrl.includes("/api2")) {
      return domainOrUrl.replace(/\/$/, ""); // Remove trailing slash
    }

    // If it's a full URL, extract the domain
    let domain = domainOrUrl;
    if (domainOrUrl.startsWith("http://") || domainOrUrl.startsWith("https://")) {
      const url = new URL(domainOrUrl);
      domain = url.hostname;
    }

    // Extract subdomain (everything before the first dot)
    const subdomain = domain.split('.')[0];
    
    // Construct the API base URL with the subdomain
    return `https://${subdomain}.app.luminance.com/api2`;
  } catch (error) {
    throw new Error(`Invalid domain/URL format: ${domainOrUrl}`);
  }
};

export const createLuminanceClient = (
  connection: Connection
): HttpClient => {
  // Support both OAuth2 (with token.access_token) and direct API token (with fields.apiToken)
  const accessToken = connection.token?.access_token 
    ? util.types.toString(connection.token.access_token)
    : util.types.toString(connection.fields?.apiToken);

  if (!accessToken) {
    throw new Error(
      "Luminance connection missing access token. Please provide API token or authenticate OAuth2 connection."
    );
  }

  // Get base URL - support multiple sources:
  // 1. Direct baseUrl field
  // 2. Extract from tokenUrl (OAuth2)
  // 3. Extract from domain/baseUrl field
  let baseUrl: string;
  
  if (connection.fields?.baseUrl) {
    const baseUrlField = util.types.toString(connection.fields.baseUrl);
    baseUrl = extractBaseUrlFromDomain(baseUrlField);
  } else if (connection.fields?.tokenUrl) {
    // Extract from OAuth2 token URL
    const tokenUrl = util.types.toString(connection.fields.tokenUrl);
    baseUrl = extractBaseUrlFromDomain(tokenUrl);
  } else {
    throw new Error(
      "Luminance connection missing base URL or token URL. Please provide base URL or token URL."
    );
  }

  const client = createHttpClient({
    baseUrl,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    responseType: "json",
  });
  return client;
};
