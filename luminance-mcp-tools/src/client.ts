import { type Connection, util } from "@prismatic-io/spectral";
import { createClient } from "@prismatic-io/spectral/dist/clients/http";

export function createLuminanceClient(luminanceConnection: Connection) {
  const { baseUrl, apiToken } = luminanceConnection.fields;

  const baseUrlStr = util.types.toString(baseUrl).replace(/\/$/, ""); // Remove trailing slash

  return createClient({
    baseUrl: baseUrlStr,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${util.types.toString(apiToken)}`,
    },
  });
}
