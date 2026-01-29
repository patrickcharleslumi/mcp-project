import { createClient } from "@prismatic-io/spectral/dist/clients/http";
/** Context shape passed from flow onExecution (configVars only). */
interface FlowContextWithConfig {
    configVars: Record<string, unknown>;
}
/**
 * Create a Salesforce API client using OAuth2 JWT Bearer flow.
 * Simple configuration with Consumer Key, Username, and Private Key.
 */
export declare function createSalesforceClient(context: FlowContextWithConfig): Promise<ReturnType<typeof createClient>>;
export {};
