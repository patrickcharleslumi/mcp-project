export declare const getSalesforceCommercialContext: {
    name: string;
    stableKey: string;
    description: string;
    isAgentFlow: true;
    isSynchronous: true;
    schemas: {
        invoke: {
            $schema: string;
            $comment: string;
            title: string;
            type: string;
            properties: {
                opportunityId: {
                    type: string;
                    description: string;
                };
                opportunityName: {
                    type: string;
                    description: string;
                };
            };
            required: never[];
        };
    };
    onExecution: (context: import("@prismatic-io/spectral").ActionContext<import("@prismatic-io/spectral").ConfigVars, {
        [x: string]: Record<string, import("@prismatic-io/spectral").ComponentManifestAction>;
    }, string[]>, params: import("@prismatic-io/spectral").ActionInputParameters<{
        onTrigger: {
            type: "data";
            label: string;
            clean: (value: unknown) => {
                results: import("@prismatic-io/spectral").TriggerPayload;
            };
        };
    }>) => Promise<{
        data: {
            opportunity_id: any;
            opportunity_name: any;
            deal_stage: {
                stage_name: any;
                close_date: any;
            };
            organization: {
                region: any;
                business_unit: any;
            };
            financial_metrics: {
                acv: any;
                arr: any;
                discount: any;
                total_discount: any;
                payment_terms: any;
            };
            legal_and_security: {
                legal_required: any;
                security_review_required: any;
                non_standard_terms_requested: any;
                redline_count: any;
            };
            competitive_landscape: {
                main_competitors: any;
                procurement_pressure: any;
                procurement_category: any;
            };
            contract_dates: {
                contract_start_date: any;
                contract_end_date: any;
            };
            renewal_information: {
                renewal_date: any;
                renewal_notice_period: any;
                auto_renewal: any;
            };
            next_steps: {
                next_step: any;
            };
            customer_health: {
                open_cases_count: any;
                max_open_case_severity: any;
                sla_breach: any;
                customer_health: any;
            };
            metadata: {
                retrieved_at: string;
                source: string;
            };
        };
    }>;
};
declare const _default: {
    name: string;
    stableKey: string;
    description: string;
    isAgentFlow: true;
    isSynchronous: true;
    schemas: {
        invoke: {
            $schema: string;
            $comment: string;
            title: string;
            type: string;
            properties: {
                opportunityId: {
                    type: string;
                    description: string;
                };
                opportunityName: {
                    type: string;
                    description: string;
                };
            };
            required: never[];
        };
    };
    onExecution: (context: import("@prismatic-io/spectral").ActionContext<import("@prismatic-io/spectral").ConfigVars, {
        [x: string]: Record<string, import("@prismatic-io/spectral").ComponentManifestAction>;
    }, string[]>, params: import("@prismatic-io/spectral").ActionInputParameters<{
        onTrigger: {
            type: "data";
            label: string;
            clean: (value: unknown) => {
                results: import("@prismatic-io/spectral").TriggerPayload;
            };
        };
    }>) => Promise<{
        data: {
            opportunity_id: any;
            opportunity_name: any;
            deal_stage: {
                stage_name: any;
                close_date: any;
            };
            organization: {
                region: any;
                business_unit: any;
            };
            financial_metrics: {
                acv: any;
                arr: any;
                discount: any;
                total_discount: any;
                payment_terms: any;
            };
            legal_and_security: {
                legal_required: any;
                security_review_required: any;
                non_standard_terms_requested: any;
                redline_count: any;
            };
            competitive_landscape: {
                main_competitors: any;
                procurement_pressure: any;
                procurement_category: any;
            };
            contract_dates: {
                contract_start_date: any;
                contract_end_date: any;
            };
            renewal_information: {
                renewal_date: any;
                renewal_notice_period: any;
                auto_renewal: any;
            };
            next_steps: {
                next_step: any;
            };
            customer_health: {
                open_cases_count: any;
                max_open_case_severity: any;
                sla_breach: any;
                customer_health: any;
            };
            metadata: {
                retrieved_at: string;
                source: string;
            };
        };
    }>;
}[];
export default _default;
