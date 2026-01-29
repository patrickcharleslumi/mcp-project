import { oauth2Connection, OAuth2Type } from "@prismatic-io/spectral";
import { connection } from "@prismatic-io/spectral";

export const oAuth2 = oauth2Connection({
  key: "oAuth2",
  display: {
    label: "OAuth 2.0 Client Credentials",
    description: "",
    icons: {},
  },
  oauth2Type: OAuth2Type.ClientCredentials,
  inputs: {
    tokenUrl: {
      label: "Token URL",
      type: "string",
      required: true,
      shown: true,
      default: "https://<your-domain>.app.luminance.com/auth/oauth2/token",
      comments: "Token URL",
    },

    scopes: {
      label: "Scopes",
      type: "string",
      required: false,
      shown: true,
      comments: "Space-delimited scopes",
    },
    clientId: {
      label: "Client ID",
      type: "string",
      required: true,
      shown: true,
      comments: "Client identifier",
    },
    clientSecret: {
      label: "Client Secret",
      type: "password",
      required: true,
      shown: true,
      comments: "Client secret",
    },
  },
});

export const HMACsecretKey = connection({
  key: "secretKey",
  display: {
    label: "HMAC Secret Key",
    description: "HMAC Secret Key",
  },
  inputs: {
    secretKey: {
      label: "HMAC Secret Key",
      placeholder: "HMAC Secret Key",
      type: "password",
      shown: true,
      required: true,
    },
  },
});

export const customApp = connection({
  key: "customApp",
  display: {
    label: "Custom Application Connection",
    description: "Generic HTTP connection with Base URL and Bearer token",
  },
  inputs: {
    baseUrl: {
      label: "Base URL",
      type: "string",
      required: true,
      shown: true,
      placeholder: "https://api.example.com",
      comments: "Base URL of your custom application's API",
    },
    accessToken: {
      label: "Access Token (Bearer)",
      type: "password",
      required: true,
      shown: true,
      comments: "Bearer token used for authenticating requests to the custom app",
    },
  },
});

export default [oAuth2, HMACsecretKey, customApp];
