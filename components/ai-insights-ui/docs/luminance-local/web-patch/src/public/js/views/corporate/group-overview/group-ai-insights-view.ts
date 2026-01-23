import BaseView from '../../base';
import Request from '../../../utils/request';
import type { Group, WorkflowStage, Room } from '../../../models/models';
import { Resolved } from '../../../models/base/utils';
import _ from 'lodash';
import $ from 'jquery';

export namespace GroupAiInsightsView {
    export type SummaryItem = {
        label: string;
        value: string;
        severity?: 'low' | 'medium' | 'high';
    };

    export type RecommendedAction = {
        id: string;
        title: string;
        description: string;
        rationale: string;
        confidence?: number;
        preview?: {
            transitions?: string[];
            notifications?: string[];
            systems?: string[];
        };
        status?: 'pending' | 'approved' | 'removed';
    };

    export type InsightsPayload = {
        summary: {
            items: SummaryItem[];
            reasoning: string[];
            confidence?: number;
        };
        recommendations: RecommendedAction[];
        workflow_preview: {
            transitions: string[];
            notifications: string[];
            systems: string[];
        };
        metadata?: {
            new_insights_count?: number;
            last_updated?: string;
        };
    };

    export interface Options extends BaseView.Options<Group.Model & Resolved> {
        room: Room.Model;
        workflow_stage: WorkflowStage.Model;
    }
}

type InsightsBridge = {
    _instances: Record<string, GroupAiInsightsView>;
    updateGroupInsights: (groupId: number, payload: GroupAiInsightsView.InsightsPayload, opts?: { markNew?: boolean }) => void;
};

type LuminanceWindow = Window & {
    __ai_insights_bridge?: InsightsBridge;
};

export class GroupAiInsightsView extends BaseView<Group.Model & Resolved> {
    // JQuery
    $summary_grid = this.$root.find('.ai-summary-panel .summary-grid');
    $summary_reasoning = this.$root.find('.ai-summary-panel .summary-reasoning');
    $summary_reasoning_toggle = this.$root.find('.ai-summary-panel .toggle-reasoning');
    $summary_confidence = this.$root.find('.ai-summary-panel .confidence-badge');
    $recommendations_container = this.$root.find('.ai-recommendations-panel .recommendations-list');
    $approve_all_button = this.$root.find('.ai-recommendations-panel .approve-all');
    $agent_chat_log = this.$root.find('.ai-agent-panel .agent-chat-log');
    $agent_thinking = this.$root.find('.ai-agent-panel .agent-thinking');
    $agent_input = this.$root.find('.ai-agent-panel .agent-input');

    // Models
    room: Room.Model;
    workflow_stage: WorkflowStage.Model;

    // Data
    insights_payload: GroupAiInsightsView.InsightsPayload | null = null;
    action_state_by_id = new Map<string, GroupAiInsightsView.RecommendedAction>();
    new_insights_count = 0;
    has_unread_insights = false;

    constructor({ room, workflow_stage, ...opts }: GroupAiInsightsView.Options) {
        const events = <any>{
            'click .ai-summary-panel .toggle-reasoning': (event: JQuery.ClickEvent) => this.onClickSummaryReasoning(event),
            'click .ai-recommendations-panel .approve-all': (event: JQuery.ClickEvent) => this.onClickApproveAll(event),
            'click .ai-action-item .toggle-reasoning': (event: JQuery.ClickEvent) => this.onClickActionReasoning(event),
            'click .ai-action-item .approve-action': (event: JQuery.ClickEvent) => this.onClickApproveAction(event),
            'click .ai-action-item .edit-action': (event: JQuery.ClickEvent) => this.onClickEditAction(event),
            'click .ai-action-item .remove-action': (event: JQuery.ClickEvent) => this.onClickRemoveAction(event),
            'click .ai-action-item .save-action': (event: JQuery.ClickEvent) => this.onClickSaveAction(event),
            'click .ai-action-item .cancel-action': (event: JQuery.ClickEvent) => this.onClickCancelAction(event),
            'submit .ai-agent-panel .agent-chat-input': (event: JQuery.SubmitEvent) => this.onSubmitAgentMessage(event),
        };
        super({
            ...opts,
            template: 'group-ai-insights-view',
            events,
        });

        this.room = room;
        this.workflow_stage = workflow_stage;
        this.registerInsightsBridge();
        this.onceRendered(() => this.load());
    }

    async load() {
        try {
            await this.resolve([this.model, this.room, this.workflow_stage], { batch: true });

            this.insights_payload = await this.fetchInsights();
            this.applyInsights(this.insights_payload, { markNew: false });
        } catch (error) {
            this.handleError(error, { context: 'GroupAiInsightsView.load', dialog: false, disable: false });
            this.showErrorState();
        }
    }

    async fetchInsights(): Promise<GroupAiInsightsView.InsightsPayload> {
        const group_id = this.model.get('id');
        try {
            const payload = await Request.call<GroupAiInsightsView.InsightsPayload>(
                `/api/groups/${group_id}/ai_insights`,
                'GET'
            );
            return payload;
        } catch (error) {
            console.warn('[GroupAiInsightsView] Failed to fetch insights payload', error);
            throw error;
        }
    }

    isPayloadEmpty(payload: GroupAiInsightsView.InsightsPayload) {
        const has_summary = payload.summary?.items?.length;
        const has_recommendations = payload.recommendations?.length;
        const has_tags = payload.workflow_preview?.transitions?.length;
        return !has_summary && !has_recommendations && !has_tags;
    }

    applyInsights(payload: GroupAiInsightsView.InsightsPayload, { markNew }: { markNew: boolean }) {
        this.insights_payload = payload;
        this.renderSummary(payload.summary);
        this.renderRecommendations(payload.recommendations);

        if (markNew) {
            const new_count = payload.metadata?.new_insights_count ?? payload.recommendations.length;
            this.new_insights_count = new_count;
            this.has_unread_insights = new_count > 0;
        } else {
            this.new_insights_count = 0;
            this.has_unread_insights = false;
        }
        this.emitBadgeState();
    }

    renderSummary(summary: GroupAiInsightsView.InsightsPayload['summary']) {
        this.$summary_grid.empty();
        this.$summary_grid.find('.empty-state').toggleClass('hidden', true);
        summary.items.forEach((item) => {
            const $row = $('<div class="summary-row"></div>');
            const $label = $(`<span class="label">${_.escape(item.label)}</span>`);
            const $value = $(`<span class="value">${_.escape(item.value)}</span>`);
            if (item.severity) $row.addClass(`severity-${item.severity}`);
            $row.append($label, $value);
            this.$summary_grid.append($row);
        });
        if (!summary.items.length) {
            this.$summary_grid.find('.empty-state').toggleClass('hidden', false);
        }

        this.$summary_reasoning.empty();
        summary.reasoning.forEach((line) => {
            const $line = $(`<div class="reasoning-line">• ${_.escape(line)}</div>`);
            this.$summary_reasoning.append($line);
        });

        const confidence = summary.confidence;
        if (_.isNumber(confidence)) {
            this.$summary_confidence
                .text(`Confidence ${(confidence * 100).toFixed(0)}%`)
                .toggleClass('hidden', false);
        } else {
            this.$summary_confidence.toggleClass('hidden', true);
        }
    }

    showErrorState() {
        this.$summary_grid.empty();
        this.$summary_reasoning.empty();
        this.$recommendations_container.empty();

        this.$summary_grid.append('<div class="empty-state">AI insights are temporarily unavailable.</div>');
        this.$recommendations_container.append('<div class="empty-state">No recommendations available.</div>');
    }

    onSubmitAgentMessage(event: JQuery.SubmitEvent) {
        event.preventDefault();
        const text = this.$agent_input.val()?.toString().trim();
        if (!text) return;
        this.$agent_input.val('');
        this.addAgentMessage('You', text);
        this.setThinking(true, 'Lumi is thinking');
        this.trigger('ai-agent:query', { group_id: this.model.get('id'), text });
    }

    addAgentMessage(label: string, text: string) {
        const type_class = label === 'Agent' || label === 'System' ? 'agent' : 'user';
        const $message = $(`
            <div class="agent-chat-message ${type_class}">
                <span class="label">${_.escape(label)}</span>
                <span class="text">${_.escape(text)}</span>
            </div>
        `);
        this.$agent_chat_log.append($message);
        this.$agent_chat_log.scrollTop(this.$agent_chat_log.prop('scrollHeight'));
    }


    setThinking(is_thinking: boolean, label: string = 'Lumi is thinking') {
        this.$agent_thinking.toggleClass('hidden', !is_thinking);
        this.$agent_thinking.find('.thinking-label').text(label);
        if (is_thinking) {
            this.$agent_chat_log.scrollTop(this.$agent_chat_log.prop('scrollHeight'));
        }
    }

    emitBadgeState() {
        const count = this.new_insights_count || 0;
        const dot = this.has_unread_insights && count === 0;
        if (!count && !dot) {
            this.trigger('ai-insights:badge', { count: 0, dot: false });
            return;
        }
        this.trigger('ai-insights:badge', { count, dot });
    }

    clearBadge() {
        this.new_insights_count = 0;
        this.has_unread_insights = false;
        this.emitBadgeState();
    }

    registerInsightsBridge() {
        const win = window as LuminanceWindow;
        if (!win.__ai_insights_bridge) {
            win.__ai_insights_bridge = {
                _instances: {},
                updateGroupInsights: (groupId, payload, opts = { markNew: false }) => {
                    const view = win.__ai_insights_bridge?._instances[String(groupId)];
                    if (!view) return;
                    view.applyInsights(payload, { markNew: !!opts.markNew });
                },
            };
        }

        const group_id = String(this.model.get('id'));
        win.__ai_insights_bridge._instances[group_id] = this;
        this._cleanup.add(() => {
            delete win.__ai_insights_bridge?._instances[group_id];
        });
    }

    renderRecommendations(recommendations: GroupAiInsightsView.RecommendedAction[]) {
        this.action_state_by_id.clear();
        this.$recommendations_container.empty();
        this.$recommendations_container.find('.empty-state').toggleClass('hidden', true);

        recommendations.forEach((action) => {
            this.action_state_by_id.set(action.id, { ...action, status: action.status ?? 'pending' });
            this.$recommendations_container.append(this.buildActionItem(action));
        });
        if (!recommendations.length) {
            this.$recommendations_container.find('.empty-state').toggleClass('hidden', false);
        }

        this.refreshApproveAllVisibility();
    }

    buildActionItem(action: GroupAiInsightsView.RecommendedAction) {
        const confidence_label = _.isNumber(action.confidence)
            ? `Confidence ${(action.confidence * 100).toFixed(0)}%`
            : 'Confidence n/a';
        const $item = $(
            `<div class="ai-action-item" data-action-id="${_.escape(action.id)}">
                <div class="action-header">
                    <div class="title-and-confidence">
                        <span class="title">${_.escape(action.title)}</span>
                        <span class="confidence">${_.escape(confidence_label)}</span>
                    </div>
                    <div class="action-controls">
                        <button class="tertiary toggle-reasoning">Why this?</button>
                        <button class="secondary edit-action">Edit</button>
                        <button class="secondary remove-action">Remove</button>
                        <button class="primary approve-action">Approve</button>
                    </div>
                </div>
                <div class="action-body">
                    <div class="description">${_.escape(action.description)}</div>
                    <div class="reasoning hidden">${_.escape(action.rationale)}</div>
                    <div class="editor hidden">
                        <label>Title</label>
                        <input class="input-style edit-title" value="${_.escape(action.title)}" />
                        <label>Description</label>
                        <textarea class="input-style edit-description">${_.escape(action.description)}</textarea>
                        <div class="editor-actions">
                            <button class="secondary cancel-action">Cancel</button>
                            <button class="primary save-action">Save changes</button>
                        </div>
                    </div>
                </div>
            </div>`
        );

        if (action.status === 'approved') {
            $item.addClass('approved');
            $item.find('button.approve-action').prop('disabled', true).text('Approved');
        }
        if (action.status === 'removed') {
            $item.addClass('removed');
        }
        return $item;
    }


    onClickSummaryReasoning(event: JQuery.ClickEvent) {
        event.preventDefault();
        this.$summary_reasoning.toggleClass('hidden');
        const is_open = !this.$summary_reasoning.hasClass('hidden');
        this.$summary_reasoning_toggle.text(is_open ? 'Hide reasoning' : 'View reasoning');
    }

    onClickActionReasoning(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        const $reasoning = $item.find('.reasoning');
        $reasoning.toggleClass('hidden');
        const is_open = !$reasoning.hasClass('hidden');
        $item.find('.toggle-reasoning').text(is_open ? 'Hide reasoning' : 'Why this?');
    }

    onClickApproveAll(event: JQuery.ClickEvent) {
        event.preventDefault();
        const actions = Array.from(this.action_state_by_id.values()).filter(action => action.status === 'pending');
        if (!actions.length) return;
        this.showApprovalModal(actions, () => {
            actions.forEach(action => this.markActionApproved(action.id));
        });
    }

    onClickApproveAction(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        const action_id = $item.data('action-id');
        const action = this.action_state_by_id.get(action_id);
        if (!action || action.status !== 'pending') return;
        this.showApprovalModal([action], () => {
            this.markActionApproved(action.id);
        });
    }

    onClickEditAction(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        $item.addClass('editing');
        $item.find('.editor').toggleClass('hidden', false);
        $item.find('.description').toggleClass('hidden', true);
        $item.find('.reasoning').toggleClass('hidden', true);
    }

    onClickRemoveAction(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        const action_id = $item.data('action-id');
        const action = this.action_state_by_id.get(action_id);
        if (!action) return;
        action.status = 'removed';
        $item.addClass('removed');
        this.refreshApproveAllVisibility();
    }

    onClickSaveAction(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        const action_id = $item.data('action-id');
        const action = this.action_state_by_id.get(action_id);
        if (!action) return;
        const new_title = $item.find('.edit-title').val()?.toString().trim();
        const new_description = $item.find('.edit-description').val()?.toString().trim();
        if (new_title) action.title = new_title;
        if (new_description) action.description = new_description;
        $item.replaceWith(this.buildActionItem(action));
        this.refreshApproveAllVisibility();
    }

    onClickCancelAction(event: JQuery.ClickEvent) {
        event.preventDefault();
        const $item = this.getActionItemFromEvent(event);
        const action_id = $item.data('action-id');
        const action = this.action_state_by_id.get(action_id);
        if (!action) return;
        $item.replaceWith(this.buildActionItem(action));
    }

    markActionApproved(action_id: string) {
        const action = this.action_state_by_id.get(action_id);
        if (!action) return;
        action.status = 'approved';
        const $item = this.$recommendations_container.find(`[data-action-id="${action_id}"]`);
        $item.addClass('approved');
        $item.find('button.approve-action').prop('disabled', true).text('Approved');
        this.trigger('ai-action:approved', {
            action_id,
            title: action.title,
            description: action.description,
        });
        this.refreshApproveAllVisibility();
    }

    refreshApproveAllVisibility() {
        const pending = Array.from(this.action_state_by_id.values()).filter(action => action.status === 'pending');
        this.$approve_all_button.toggleClass('hidden', pending.length < 2);
    }

    showApprovalModal(actions: GroupAiInsightsView.RecommendedAction[], on_confirm: () => void) {
        const preview_items = actions.flatMap(action => action.preview?.transitions ?? []);
        const html = `
            <div class="ai-approval-preview">
                <div class="section-title">Workflow preview</div>
                <ul>${preview_items.map(item => `<li>${_.escape(item)}</li>`).join('')}</ul>
                <div class="section-title">Notifications</div>
                <ul>${(actions[0]?.preview?.notifications ?? []).map(item => `<li>${_.escape(item)}</li>`).join('')}</ul>
                <div class="section-title">Systems</div>
                <ul>${(actions[0]?.preview?.systems ?? []).map(item => `<li>${_.escape(item)}</li>`).join('')}</ul>
                <div class="section-title">What happens next</div>
                <div class="section-body">Changes are applied only after you approve.</div>
            </div>
        `;
        const Dialog = require('../../generic-components/popups/dialog');
        const dialog = new Dialog(this, {
            type: 'confirm',
            html,
            buttons: {
                confirm: {
                    name: 'Approve & proceed',
                    handler: () => on_confirm(),
                },
                cancel: {
                    name: 'Cancel',
                },
            },
        });
        this.listenTo(dialog, 'close', () => dialog.remove());
    }

    getActionItemFromEvent(event: JQuery.ClickEvent) {
        return $(event.currentTarget).closest('.ai-action-item');
    }
}
