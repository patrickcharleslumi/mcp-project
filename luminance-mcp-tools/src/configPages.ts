import { configPage, connectionConfigVar } from "@prismatic-io/spectral";

export const configPages = {
  Connections: configPage({
    elements: {
      "Luminance Connection": connectionConfigVar({
        stableKey: "luminance-connection",
        dataType: "connection",
        inputs: {
          baseUrl: {
            label: "Luminance Base URL",
            type: "string",
            required: true,
            comments: "Your Luminance instance base URL (e.g., https://your-domain.app.luminance.com)",
          },
          apiToken: {
            label: "Luminance API Token",
            placeholder: "Bearer token",
            type: "password",
            required: true,
            comments: "Luminance API Bearer token (access token from OAuth2, not client secret)",
          },
        },
      }),
    },
  }),
};
