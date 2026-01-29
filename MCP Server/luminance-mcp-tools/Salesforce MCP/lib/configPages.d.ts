/**
 * Simple configuration for Salesforce JWT Bearer authentication.
 * Only the 4 required Salesforce settings for JWT.
 */
export declare const configPages: {
    Salesforce: {
        tagline: string;
        elements: {
            "Salesforce Token URL": {
                stableKey: string;
                dataType: "string";
                description: string;
                permissionAndVisibilityType: "customer";
                visibleToOrgDeployer: true;
                defaultValue: string;
            };
            "Salesforce Consumer Key": {
                stableKey: string;
                dataType: "string";
                description: string;
                permissionAndVisibilityType: "customer";
                visibleToOrgDeployer: true;
            };
            "Salesforce Username": {
                stableKey: string;
                dataType: "string";
                description: string;
                permissionAndVisibilityType: "customer";
                visibleToOrgDeployer: true;
            };
            "Salesforce Private Key": {
                stableKey: string;
                dataType: "string";
                description: string;
                permissionAndVisibilityType: "customer";
                visibleToOrgDeployer: true;
            };
        };
    };
};
