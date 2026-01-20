import async from './async';
import Filter from '../models/filter';
import { Group, WorkflowStage } from '../models/models';

interface GroupVersionAggProperties {
    key: number | null;
    value: {
      key: 'active' | 'inactive';
      value: number;
    }[];
}
/**
 * Batches active groups according to the workflow stage type of its active version. Returns a function that can be used for aggregate counts.
 */
export function getGroupsWorkflowStageTypeAggBatchFetcher(groupFilter: Filter) {
    return async.batchify(async () => {
        const GROUP_VERSION_GROUPING = Filter.Groups.reserve(1);
        const groupAgg = new Group.Aggregation<GroupVersionAggProperties> ([], {
            field: [
                `version:${GROUP_VERSION_GROUPING}.state`,
                `version:${GROUP_VERSION_GROUPING}.workflow_stage.type`,
            ],
            type: 'values',
            filter: groupFilter,
            limit: null,
            analyze: true,
        });
        await groupAgg.resolve(groupAgg);

        return (workflowStageTypes: Array<string>) => {
            const executed_groups = groupAgg.get('executed')?.get('value')?.filter(item => workflowStageTypes.includes(item.key)) || [];
            const active_groups = groupAgg.get('active')?.get('value')?.filter(item => workflowStageTypes.includes(item.key)) || [];
            return executed_groups.concat(active_groups);
        };
    });
}

export async function getGroupsCountForStop(this: { groupsBatchFetcher: (workflowStageTypes: Array<string>) => Promise<Array<{ key: string, value: number }>> }, model: WorkflowStage.Model) {
    const current_stop_type = model.get('type') ?? '';
    const current_stop_types = [
        current_stop_type,
        ...(
            current_stop_type === 'approval' ?
                ['approval_parallel']
                : []
        ),
    ];

    const group_agg = await this.groupsBatchFetcher(current_stop_types);
    const count = group_agg?.reduce((sum, current) => sum + current.value, 0);

    return count;
}
