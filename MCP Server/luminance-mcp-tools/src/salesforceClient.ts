import { util } from "@prismatic-io/spectral";
import { createClient } from "@prismatic-io/spectral/dist/clients/http";
import { createHash, createSign } from "crypto";

/** Token response from Salesforce OAuth2 password flow */
interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  id?: string;
  token_type?: string;
  issued_at?: string;
  signature?: string;
}

/** Context shape passed from flow onExecution (configVars only). */
interface FlowContextWithConfig {
  configVars: Record<string, unknown>;
}

/**
 * Create a Salesforce API client using instance-level config (Consumer Key, Secret, Username, Password).
 * Uses Salesforce OAuth2 Username-Password flow; no login/redirect UI.
 */
export async function createSalesforceClient(
  context: FlowContextWithConfig
): Promise<ReturnType<typeof createClient>> {
  const tokenUrl = util.types.toString(
    context.configVars["Salesforce Token URL"] ?? ""
  );
  const consumerKey = util.types.toString(
    context.configVars["Salesforce Consumer Key"] ?? ""
  );
  const consumerSecret = util.types.toString(
    context.configVars["Salesforce Consumer Secret"] ?? ""
  );
  const username = util.types.toString(
    context.configVars["Salesforce Username"] ?? ""
  );
  const password = util.types.toString(
    context.configVars["Salesforce Password"] ?? ""
  );

  if (!tokenUrl || !consumerKey || !consumerSecret || !username || !password) {
    throw new Error(
      "Salesforce connection incomplete. Set Salesforce Token URL, Consumer Key, Consumer Secret, Username, and Password in instance configuration."
    );
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: consumerKey,
    client_secret: consumerSecret,
    username,
    password,
  }).toString();

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(
      `Salesforce token request failed (${tokenRes.status}): ${text}`
    );
  }

  const data = (await tokenRes.json()) as SalesforceTokenResponse;
  const instanceUrl = (data.instance_url ?? "").replace(/\/$/, "");
  const accessToken = data.access_token ?? "";

  if (!instanceUrl || !accessToken) {
    throw new Error(
      "Salesforce token response missing instance_url or access_token."
    );
  }

  return createClient({
    baseUrl: instanceUrl,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Create a Salesforce API client using JWT Bearer token flow.
 * Uses private key signing instead of username/password authentication.
 */
export async function createSalesforceClientJWT(
  context: FlowContextWithConfig
): Promise<ReturnType<typeof createClient>> {
  const tokenUrl = util.types.toString(
    context.configVars["Salesforce Token URL"] ?? ""
  );
  const consumerKey = util.types.toString(
    context.configVars["Salesforce Consumer Key"] ?? ""
  );
  const privateKey = util.types.toString(
    context.configVars["Salesforce Private Key"] ?? ""
  );
  const username = util.types.toString(
    context.configVars["Salesforce Username"] ?? ""
  );

  if (!tokenUrl || !consumerKey || !privateKey || !username) {
    throw new Error(
      "Salesforce JWT connection incomplete. Set Salesforce Token URL, Consumer Key, Private Key, and Username in instance configuration."
    );
  }

  // Create JWT Bearer token
  const jwtToken = createJwtBearerToken(consumerKey, username, privateKey, tokenUrl);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwtToken,
  }).toString();

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(
      `Salesforce JWT token request failed (${tokenRes.status}): ${text}`
    );
  }

  const data = (await tokenRes.json()) as SalesforceTokenResponse;
  const instanceUrl = (data.instance_url ?? "").replace(/\/$/, "");
  const accessToken = data.access_token ?? "";

  if (!instanceUrl || !accessToken) {
    throw new Error(
      "Salesforce JWT token response missing instance_url or access_token."
    );
  }

  return createClient({
    baseUrl: instanceUrl,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Create a JWT Bearer token for Salesforce authentication
 */
function createJwtBearerToken(
  clientId: string,
  username: string,
  privateKey: string,
  tokenUrl: string
): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: username,
    aud: tokenUrl,
    exp: now + 300, // 5 minutes expiration
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}
