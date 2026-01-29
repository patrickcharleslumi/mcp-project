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

  const normalizePrivateKey = (rawKey: string): crypto.KeyObject => {
    if (!rawKey || !rawKey.trim()) {
      throw new Error("Salesforce private key missing.");
    }
    let key = rawKey.trim();
    if (
      (key.startsWith("\"") && key.endsWith("\"")) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1).trim();
    }
    if (key.includes("\\n")) {
      key = key.replace(/\\n/g, "\n");
    }
    if (key.includes("\\r\\n")) {
      key = key.replace(/\\r\\n/g, "\n");
    }

    if (key.includes("ENCRYPTED")) {
      throw new Error(
        "Salesforce private key is encrypted. Provide an unencrypted PKCS#8 PEM."
      );
    }

    const pemMatch = key.match(/-----BEGIN ([A-Z ]+PRIVATE KEY)-----/);
    const pemType = pemMatch?.[1];
    const begin = pemType ? `-----BEGIN ${pemType}-----` : "-----BEGIN PRIVATE KEY-----";
    const end = pemType ? `-----END ${pemType}-----` : "-----END PRIVATE KEY-----";

    // If no PEM markers, treat as base64 body and wrap as PKCS#8.
    let rawBody: string | null = null;
    if (!pemMatch || !key.includes(end)) {
      rawBody = key.replace(/\s+/g, "");
      if (!rawBody) {
        throw new Error("Salesforce private key missing.");
      }
      try {
        const decoded = Buffer.from(rawBody, "base64").toString("utf8").trim();
        if (decoded.includes("-----BEGIN") && decoded.includes("PRIVATE KEY-----")) {
          key = decoded;
        }
      } catch {
        // Ignore base64 decode errors and continue with wrapping.
      }
    }

    if (!key.includes("-----BEGIN")) {
      const lines = (rawBody ?? "").match(/.{1,64}/g) ?? [];
      key = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
    }

    if (!key.includes("-----BEGIN")) {
      throw new Error("Salesforce private key missing.");
    }

    if (key.includes("BEGIN EC PRIVATE KEY")) {
      throw new Error("Salesforce private key must be RSA, not EC.");
    }

    if (key.includes("BEGIN PRIVATE KEY") || key.includes("BEGIN RSA PRIVATE KEY")) {
      const pemMatchFinal = key.match(/-----BEGIN ([A-Z ]+PRIVATE KEY)-----/);
      const pemTypeFinal = pemMatchFinal?.[1];
      const beginFinal = pemTypeFinal
        ? `-----BEGIN ${pemTypeFinal}-----`
        : "-----BEGIN PRIVATE KEY-----";
      const endFinal = pemTypeFinal
        ? `-----END ${pemTypeFinal}-----`
        : "-----END PRIVATE KEY-----";

      const body = key
        .replace(beginFinal, "")
        .replace(endFinal, "")
        .replace(/\s+/g, "");
      if (!body) {
        throw new Error("Salesforce private key missing.");
      }
      const lines = body.match(/.{1,64}/g) ?? [];
      key = `${beginFinal}\n${lines.join("\n")}\n${endFinal}`;
    }

    const pemMatchFinal = key.match(/-----BEGIN ([A-Z ]+PRIVATE KEY)-----/);
    const pemTypeFinal = pemMatchFinal?.[1];
    const typeHint =
      pemTypeFinal === "RSA PRIVATE KEY"
        ? "pkcs1"
        : pemTypeFinal === "PRIVATE KEY"
          ? "pkcs8"
          : undefined;

    try {
      const keyObject = typeHint
        ? crypto.createPrivateKey({ key, format: "pem", type: typeHint })
        : crypto.createPrivateKey(key);

      if (keyObject.asymmetricKeyType !== "rsa") {
        throw new Error("Salesforce private key must be RSA.");
      }
      return keyObject;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Salesforce private key invalid or unsupported format. Use unencrypted PKCS#8 PEM with line breaks. ${message}`
      );
    }
  };

 

  const normalizedPrivateKey = normalizePrivateKey(privateKey);

  // Create JWT token
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const tokenOrigin = new URL(tokenUrl).origin;
  const payload = {
    iss: consumerKey,
    sub: username,
    aud: tokenOrigin,
    exp: now + 300, // 5 minutes from now
    iat: now
  };

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign the message
  let signature: string;
  try {
    signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(normalizedPrivateKey, 'base64url');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Salesforce private key signing failed. Ensure an unencrypted RSA private key. ${message}`
    );
  }

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