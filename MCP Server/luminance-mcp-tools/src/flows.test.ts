import { invokeFlow } from "@prismatic-io/spectral/dist/testing";
import { getCompanyContext } from "./flows";

const luminanceConnection = {
  "Luminance Connection": {
    key: "luminance-connection",
    fields: {
      baseUrl: "https://test.app.luminance.com",
      apiToken: "dummy-api-token",
    },
  },
};

test("Test getCompanyContext flow", async () => {
  const { result } = await invokeFlow(getCompanyContext, {
    configVars: luminanceConnection,
    payload: {
      body: {
        data: {
          tenantId: "test_tenant",
          companyName: "Acme Corporation",
        },
      },
    },
  });

  const data = result?.data as any;
  expect(data).toBeDefined();
  expect(data?.company_id).toBeDefined();
  expect(data?.company_name).toBe("Acme Corporation");
  expect(data?.size_bucket).toBeDefined();
  expect(data?.region).toBeDefined();
});
