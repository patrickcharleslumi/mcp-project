/* eslint-env mocha */
// @ts-check
'use strict';

const { wrappedRender } = require('../../../utils/app_utils.js');
const { resolve, applySpecs, revertSpecs, clearLoggedRequests } = require('../../../utils/request_utils.js');
const { generateGroupSpec, generateGroupAnnotationStub } = require('../../../utils/specs_utils.js');

const { GroupAiInsightsView } = require('../../../../../src/public/js/views/corporate/group-overview/group-ai-insights-view');
const { Group, Room, WorkflowStage } = require('../../../../../src/public/js/models/models');

const { expect } = require('chai');

describe('GroupAiInsightsView', function() {
    const groupId = 901;
    const roomId = 902;
    const workflowStageId = 903;
    const workflowId = 904;
    const annotationTypeId = 905;
    const roomGroupAnnotationTypeId = 906;

    async function setup() {
        clearLoggedRequests();
        const group = new Group.Model({ id: groupId });
        const room = new Room.Model({ id: roomId });
        const workflowStage = new WorkflowStage.Model({ id: workflowStageId });

        await resolve([group, room, workflowStage], { batch: true });

        const { container, view } = await wrappedRender(GroupAiInsightsView, {
            model: group,
            room,
            workflow_stage: workflowStage,
        });

        return { container, view };
    }

    const specs = [
        {
            url: `/api/rooms/${roomId}`,
            body: { id: roomId, name: 'Corporate', type: 'corporate', settings: {} },
        },
        generateGroupSpec({ id: groupId, room_id: roomId }),
        {
            url: `/api/groups/${groupId}`,
            body: { id: groupId, name: 'Test Matter', room_id: roomId, workflow_id: workflowId },
        },
        {
            url: `/api/workflow_stages/${workflowStageId}`,
            body: { id: workflowStageId, workflow_id: workflowId, name: 'Review', type: 'review', state: 'active', ordering_index: 1 },
        },
        {
            url: `/api/groups/${groupId}/ai_insights`,
            body: {
                summary: {
                    items: [
                        { label: 'Matter type', value: 'MSA' },
                        { label: 'Priority', value: 'High', severity: 'high' },
                    ],
                    reasoning: ['Short renewal window'],
                    confidence: 0.8,
                },
                recommendations: [
                    {
                        id: 'move',
                        title: 'Move to Legal Review',
                        description: 'Advance to Legal Review stage.',
                        rationale: 'Risk thresholds exceeded.',
                        confidence: 0.7,
                        preview: {
                            transitions: ['Draft → Legal Review'],
                            notifications: ['Notify counsel'],
                            systems: ['Workflow'],
                        },
                    },
                ],
                workflow_preview: {
                    transitions: ['Draft → Legal Review'],
                    notifications: ['Notify counsel'],
                    systems: ['Workflow'],
                },
            },
        },
        {
            url: `/api/workflow_stage_fields?workflow_stage_id=${workflowStageId}&ordering_index=!%3Anull&op=and&sort=natural:ordering_index`,
            body: [{ id: 1, workflow_stage_id: workflowStageId, room_group_annotation_type_id: roomGroupAnnotationTypeId, required: false, read_only_field: false, allow_multiple_answers: false, helper_text: 'Helper', ordering_index: 1 }],
        },
        {
            url: `/api/room_group_annotation_types/${roomGroupAnnotationTypeId}`,
            body: { id: roomGroupAnnotationTypeId, room_id: roomId, annotation_type_id: annotationTypeId },
        },
        {
            url: `/api/annotation_types/${annotationTypeId}`,
            body: { id: annotationTypeId, type: 'entity:party', key: 'counterparty', name: 'Counterparty' },
        },
        {
            url: `/api/groups/${groupId}/annotations?state=active&limit=null`,
            body: [generateGroupAnnotationStub({ id: 1, group_id: groupId, annotation_type_id: annotationTypeId, content: { party: 'Acme Ltd' } })],
        },
        {
            url: `/api/groups/annotations?group_id=${groupId}&state=active&op=and&limit=null`,
            body: [generateGroupAnnotationStub({ id: 1, group_id: groupId, annotation_type_id: annotationTypeId, content: { party: 'Acme Ltd' } })],
        },
        {
            url: `/api/workflows/stages/${workflowStageId}/fields?group_id=${groupId}`,
            body: [{ id: 1, workflow_stage_id: workflowStageId, room_group_annotation_type_id: roomGroupAnnotationTypeId, required: false, read_only_field: false, allow_multiple_answers: false, helper_text: 'Helper', ordering_index: 1 }],
        },
    ];

    applySpecs(specs);
    revertSpecs(specs);

    it('renders summary, recommendations, and matter tags', async function() {
        const { container } = await setup();

        expect(container.querySelector('.group-ai-insights-view')).to.exist;
        expect(container.querySelector('.ai-summary-panel .summary-row')).to.exist;
        expect(container.querySelector('.ai-recommendations-panel .ai-action-item')).to.exist;
        expect(container.querySelector('.ai-matter-tags-panel .tag-row')).to.exist;
    });
});
