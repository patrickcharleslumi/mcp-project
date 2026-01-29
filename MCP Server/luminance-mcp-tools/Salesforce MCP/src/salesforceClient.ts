import { util } from "@prismatic-io/spectral";
import { createClient } from "@prismatic-io/spectral/dist/clients/http";
import crypto from "crypto";

/** Token response from Salesforce OAuth2 JWT Bearer flow */
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
 * Create a Salesforce API client using OAuth2 JWT Bearer flow.
 * Simple configuration with Consumer Key, Username, and Private Key.
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
  const username = util.types.toString(
    context.configVars["Salesforce Username"] ?? ""
  );
  const privateKey = util.types.toString(
    context.configVars["Salesforce Private Key"] ?? ""
  );

  if (!tokenUrl || !consumerKey || !username || !privateKey) {
    throw new Error(
      "Salesforce connection incomplete. Set all required Salesforce configuration values (Token URL, Consumer Key, Username, Private Key)."
    );
  }

  // Create JWT token
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: consumerKey,
    sub: username,
    aud: tokenUrl,
    exp: now + 300, // 5 minutes from now
    iat: now
  };

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign the message
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(privateKey, 'base64url');

  const jwt = `${message}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
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