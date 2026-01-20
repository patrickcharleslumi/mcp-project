// Models
import { Document, GroupEvent, Group, GroupAnnotation, User, WorkflowStage, Workflow, Email, GroupVersion } from '../../../models/models';

// Views
import BaseView from '../../base';
import { TextInputWithEmbeddedInfoFactory, type TextInputWithEmbeddedInfo } from '../../generic-components/forms/form-elements/inputs/text-input-with-embedded-info';
import { EmbeddedUserMentionChildFactory } from '../../common/input/text-input-with-embedded-info/embedded-user-mention-child-factory';
import { handleMentionText } from '../../../../../../lib/mention-handler.js';
import { GroupEventListView } from './group-events-view/group-events-list-view';

// Utils
import Utils from '../../../utils/utils';
import { StandardPretty, CustomPretty } from './group-events-view/utils/event-prettifications';

// Misc
import _ from 'lodash';
import { Resolved } from '../../../models/base/utils';

// Constants
const GROUP_EVENTS_COLLECTION_LIMIT = 15;

export namespace GroupEventsView {
    export interface Options extends BaseView.Options<Group.Model> {
        group_events_collection: GroupEvent.Collection
    }
}

export class GroupEventsView extends BaseView<Group.Model> {
    // JQuery
    $list_view_container: JQuery<HTMLElement>;
    $input_container: JQuery<HTMLElement>;
    $add_comment_container: JQuery<HTMLElement>;

    // Models / Collections
    group_events_collection: GroupEvent.Collection;
    pretty_events_collection: GroupEvent.Collection;
    carry_over_unrefactored_item: (GroupEvent.Model & Resolved) | null = null;

    // Views
    group_event_list_view: GroupEventListView | null = null;
    add_comment_input: TextInputWithEmbeddedInfo | null = null;

    preinitialize() {
        this.template = 'group-events-view';
        this.events = <any>{
            'click .add-comment-container button.add-comment': this.onClickAddComment,
        };
    }
    constructor(opts: GroupEventsView.Options) {
        super(opts);

        this.$list_view_container = this.$root.filter('.list-view-container');
        this.$add_comment_container = this.$root.filter('.add-comment-container');
        this.$input_container = this.$add_comment_container.find('.input-container');

        this.group_events_collection = opts.group_events_collection.clone();

        // this is not a perfect proxying of group_events_collection to pretty_events_collection, as we can't "refactor" single items generically as they come in,
        // and can only do them in bulk (when the next page is fetched) as some of the events require context of other events before / after them.
        this.pretty_events_collection = new GroupEvent.Collection([], { fetchable: false, limit: 50 });
        this.group_events_collection.limit = GROUP_EVENTS_COLLECTION_LIMIT;

        // as we can't generically proxy the fetch method on pretty_events_collection, we must perform the first fetch manually, so that
        // group_events_collection#hasNextPage / group_events_collection#fetchNextPage works
        this.pretty_events_collection.hasNextPage = (...opts) => this.group_events_collection.hasNextPage(...opts);

        this.pretty_events_collection.fetchNextPage = async ({ success, complete, error, ...non_async_opts } = {}) => {
            this.pretty_events_collection.fetching = true;
            try {
                await this.group_events_collection.promisify(this.group_events_collection.fetchNextPage)({ ...non_async_opts });

                const limit = this.group_events_collection.limit ?? GROUP_EVENTS_COLLECTION_LIMIT;

                // grab only the newly fetched models
                const length_modulo_limit = this.group_events_collection.length % limit;
                const number_of_models_in_final_page = length_modulo_limit === 0 ? limit : length_modulo_limit;

                const index_to_slice_from = this.group_events_collection.length - number_of_models_in_final_page;
                const newest_models = this.group_events_collection.slice(index_to_slice_from);

                const newest_refactored_models = await this.refactorItems(new GroupEvent.Collection(newest_models, { limit: 50 }));
                for (const model of newest_refactored_models.models) {
                    this.pretty_events_collection.add(model);
                }

                this.pretty_events_collection.fetching = false;
                if (success) success(this.pretty_events_collection);
            } catch (err) {
                console.warn(err);
                this.pretty_events_collection.fetching = false;
                if (error) error(err);
            } finally {
                this.pretty_events_collection.fetching = false;
                if (complete) complete();
            }
        };

        this.onceRendered(() => this.load());
    }
    private async load() {
        this.resetCollections();
        this.loadListView();
        this.loadInput();
    }
    resetCollections() {
        // clone all existing properties, but remove existing models and ensure the limit is 50
        this.group_events_collection.invalidate();
        this.group_events_collection.set([]);
        this.group_events_collection.fetched = false;
        this.group_events_collection.fetching = false;

        this.carry_over_unrefactored_item = null;

        this.pretty_events_collection.reset();
    }
    refreshList() {
        this.resetCollections();
        this.loadListView();
    }
    addLocalEvent(event_model: GroupEvent.Model) {
        // Add to both collections so the event is visible immediately and persists in this view
        this.group_events_collection.add(event_model);
        this.pretty_events_collection.add(event_model);
        if (this.group_event_list_view) {
            this.group_event_list_view.setScrollToBottom({ behavior: 'smooth' });
        }
    }
    private async loadListView() {
        if (this.group_event_list_view) {
            this.group_event_list_view.remove();
        }

        this.group_event_list_view = new GroupEventListView({
            collection: this.pretty_events_collection,
        });
        this.group_event_list_view.appendElTo(this.$list_view_container).registerChildViewOf(this);

        await this.resolve(this.group_events_collection, { reject_on_cancel: false });

        const new_refactored_models = await this.refactorItems(this.group_events_collection);
        for (const model of new_refactored_models.models) {
            this.pretty_events_collection.add(model);
        }
        this.pretty_events_collection.fetched = true;
        this.pretty_events_collection.fetching = false;
    }
    private async loadInput() {
        const inputSpinner = this.showLoadingSpinner(this.$input_container);

        await this.resolve(this.model.room);
        await this.resolve(this.model.room.roles);
        await this.resolve(this.model.room.roles.users);

        if (this.add_comment_input) this.add_comment_input.remove();

        this.add_comment_input = new TextInputWithEmbeddedInfoFactory({
            child_factory: new EmbeddedUserMentionChildFactory(),
        }).create({
            placeholder: BaseView.getL10n('group-events-view.input_placeholder'),
            allow_multiple_lines: true,
        });
        this.add_comment_input.prependElTo(this.$input_container).registerChildViewOf(this);

        this.add_comment_input.addSuggestionProvider('user', async (query) => {
            const lowerQuery = query.toLowerCase();
            return this.model.room.roles.users.toArray()
                .filter((user: User.Model) => !query || (user.get('name') || '').toLowerCase().includes(lowerQuery))
                .map((user: User.Model) => ({
                    id: String(user.id),
                    type: 'user',
                    text: user.get('name') || '',
                }));
        });

        this.listenTo(this.add_comment_input, 'enter', () => this.addComment());
        this.listenToEl(this.add_comment_input.$input, 'click', () => {
            if (!this.group_event_list_view) return;
            this.group_event_list_view.setScrollToBottom({ behavior: 'smooth' });
        });
        inputSpinner.hide();
    }
    // split single event to multiple rows or combine multiple events into single row if desired (by adding modifying models in collection)
    async refactorItems(collection: GroupEvent.Collection) {
        // must iterate backward through collection so that chronological order is ascending and unassigned/assigned appear in the logical order
        // insert selected items to top of collection so that they stack in the correct (descending) chronological order desired for display
        const item_promises: Promise<GroupEvent.Model | null>[] = [];

        const items_to_refactor = collection.getResolvedModels();
        if (this.carry_over_unrefactored_item) {
            // add the item from the last refactor call that couldn't be refactored due to requiring the next page of items
            if (!this.carry_over_unrefactored_item.isResolved()) {
                await this.resolve(this.carry_over_unrefactored_item);
            }
            items_to_refactor.unshift(this.carry_over_unrefactored_item.clone());
            this.carry_over_unrefactored_item = null;
        }

        for (let index = 0; index <= items_to_refactor.length - 1; index++) {
            const refactored_item = this.refactorItem(index, items_to_refactor);
            item_promises.push(refactored_item);
        }

        const resolved_models = await Promise.all(item_promises);

        // [CONFIG] {boolean} ui.piol.enabled - If true, will do an extra filter to remove email sending events that have already been sent
        // otherwise just uses the resolved models and avoids the pointless filter.
        const filtered_models = LUMINANCE?.settings?.piol?.enabled
            ? resolved_models.filter((model: GroupEvent.Model | null) => {
                if (model?.get('type') === 'thirdparty:email:sending') {
                    return !resolved_models.some((m: GroupEvent.Model | null) => m?.get('type') === 'thirdparty:email:sent');
                }
                return true;
            })
            : resolved_models;

        return new GroupEvent.Collection(
            filtered_models.filter(model => model !== null),
            { limit: 50 }
        );
    }
    async refactorItem(index: number, models: (GroupEvent.Model & Resolved)[]) {
        const item = models[index];

        const type = item.get('type');
        const content = item.get('content');
        const time = item.get('created_at');
        const user_id = item.get('created_by');

        const username = await this.getUsername(user_id);

        switch (type) {
            case 'create': {
                // If created from an email
                if (content.info?.email_message_id) {

                    const original_workflow = new Workflow.Model({ id: content.workflow_id });
                    await this.resolve(original_workflow, { batch: true });
                    const original_workflow_name = original_workflow.get('name');

                    if (!username || !original_workflow_name) break;

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('create_from_email', [username, original_workflow_name], { class_list: ['highlight'] }) });
                    return item.set('icon', 'plus');
                }

                // Else
                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('create', [username]) });
                return item.set('icon', 'plus');
            }
            case 'update': {
                // only show name change event if actually a different name
                if (content.new_name !== content.old_name) {
                    const new_name = content?.new_name;
                    const old_name = content?.old_name;
                    if (!old_name || !new_name) break;

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update', [old_name, new_name, username]) });
                    return item.set('icon', 'pencil');
                }
                break;
            }
            case 'update_info': {
                // only show attention flag change if actually changes
                if ((content.new_info?.high_priority !== undefined) && (content.new_info?.high_priority !== content.old_info.high_priority)) {
                    const new_high_priority_status = content.new_info.high_priority
                        ? BaseView.getL10n('group-events-view.priorities.high_priority')
                        : BaseView.getL10n('group-events-view.priorities.low_priority');

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update_info', [new_high_priority_status, username]) });
                    return item.set('icon', 'exclamation');
                }
                break;
            }
            case 'update_owner': {
                const old_owner_id = content.old_owner;
                const new_owner_id = content.new_owner;
                // only show owner change event if actually a different owner
                if (old_owner_id !== new_owner_id) {
                    if (old_owner_id && new_owner_id) {
                        const [old_owner_name, new_owner_name] = await Promise.all([
                            this.getUsername(old_owner_id),
                            this.getUsername(new_owner_id),
                        ]);

                        // "Request owner updated from X to Y"
                        item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update_owner.updated', [old_owner_name, new_owner_name, username]) });
                    } else if (new_owner_id) {
                        const new_owner_name = await this.getUsername(new_owner_id);

                        // "Request owner set to Y"
                        item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update_owner.set', [new_owner_name, username]) });
                    } else {
                        // "Request owner removed"
                        item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update_owner.removed', [username]) });
                    }
                    return item.set('icon', 'user');
                }
                break;
            }
            case 'update_description': {
                // only show description change event if actually a different description
                if (content.new_description !== content.old_description) {

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('update_description', [username]) });
                    return item.set('icon', 'align-left');
                }
                break;
            }
            case 'delete': {
                const name = content?.name;
                if (!name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('delete', [name, username]) });
                return item.set('icon', 'trash');
            }
            case 'version:assigned': {
                // if we have an unassigned event before an assigned one, skip this event as we made a reassign event already
                const previous_model = models[index - 1];

                if (previous_model) {
                    const shouldSkip = previous_model.get('type') === 'version:unassigned' && previous_model.get('created_at') === time;
                    if (shouldSkip) break;
                }

                const id = content?.user_id;
                if (!id) break;

                const assigned_to_name = await this.getUsername(id);

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.assigned', [assigned_to_name, username]) });
                return item.set('icon', 'user');
            }
            // if event immediately followed by assigned make a 'reassigned' event instead
            case 'version:unassigned': {
                const id = content?.user_id;
                if (!id) break;

                const assigned_to_name = await this.getUsername(id);

                const next_model = models[index + 1];
                if (!next_model || !next_model.isResolved()) {
                    // ignore this item this time, it will be added back in when we fetch the next page
                    if (!next_model) this.carry_over_unrefactored_item = item;
                    break;
                }

                if (next_model.get('type') === 'version:assigned' && next_model.get('created_at') === time) {
                    const second_id = next_model.get('content').user_id;
                    if (!second_id) break;
                    const second_user_name = await this.getUsername(second_id);

                    const important_parts = [assigned_to_name, second_user_name, username];
                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.reassigned', important_parts) });
                } else {
                    const important_parts = [assigned_to_name, username];
                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.unassigned', important_parts) });
                }
                return item.set('icon', 'user');
            }
            case 'version:moved_keep_version':
            case 'version:moved': {
                // when version enters workflow, give WF name and WF stage
                // when version exits workflow, do not give specific information
                const new_stage = content?.new_workflow_stage_id;
                const old_stage = content?.old_workflow_stage_id;

                if (new_stage && old_stage) {
                    const new_stage_model = new WorkflowStage.Model({ id: new_stage });
                    const old_stage_model = new WorkflowStage.Model({ id: old_stage });
                    await Promise.all([
                        this.resolve(new_stage_model, { batch: true }),
                        this.resolve(old_stage_model, { batch: true }),
                    ]);

                    const newStageName = new_stage_model.get('name');
                    const oldStageName = old_stage_model.get('name');
                    if (!newStageName || !oldStageName) break;

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.status_updated', [oldStageName, newStageName, username]) });
                    item.set({ icon: 'heartbeat' });
                } else if (new_stage && _.isNull(old_stage)) {
                    const new_stage_model = new WorkflowStage.Model({ id: new_stage });
                    await this.resolve(new_stage_model);
                    const workflow_model = new Workflow.Model({ id: new_stage_model.get('workflow_id') });
                    await this.resolve(workflow_model);

                    const workflowName = workflow_model.get('name');
                    const newStageName = new_stage_model.get('name');
                    if (!workflowName || !newStageName) break;

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.entered_and_set', [workflowName, newStageName, username]) });
                    item.set({ icon: 'sign-in' });
                } else if (_.isNull(new_stage) && old_stage) {
                    const old_stage_model = new WorkflowStage.Model({ id: old_stage });
                    await this.resolve(old_stage_model);
                    const workflow_model = new Workflow.Model({ id: old_stage_model.get('workflow_id') });
                    await this.resolve(workflow_model);

                    const workflowName = workflow_model.get('name');
                    if (!workflowName) break;

                    item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.exited', [workflowName, username]) });
                    item.set({ icon: 'sign-out' });
                }

                return item;
            }
            case 'version:deleted': {
                const group_version = new GroupVersion.Model({ id: content?.group_version_id });
                await this.resolve(group_version, { batch: true });
                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.deleted', [username, group_version.get('name') ?? '']) });
                return item.set({ icon: 'trash' });
            }
            case 'version:new_document': {
                const group_version = new GroupVersion.Model({ id: content?.group_version_id });
                await this.resolve(group_version, { batch: true });
                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.new', [username, group_version.get('name') ?? '']) });
                return item.set({ icon: 'plus' });
            }
            case 'version:renamed': {
                const old_name = content?.old_name;
                const new_name = content?.new_name;
                if (!old_name || !new_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.renamed', [old_name, new_name, username]) });
                return item.set({ icon: 'pencil' });
            }
            case 'version:unattach': {
                const document_id = content?.document_id;
                if (!document_id) break;

                const document = new Document.Model({ id: document_id });
                await this.resolve(document, { batch: true });
                const document_name = document.get('name');
                if (!document_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.unattached', [document_name, username]) });
                return item.set('icon', 'paperclip');
            }
            case 'version:attach': {
                const document_id = content?.document_id;
                if (!document_id) break;
                const document = new Document.Model({ id: document_id });
                await this.resolve(document, { batch: true });
                const document_name = document.get('name');
                if (!document_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('version.attached', [document_name, username]) });
                return item.set('icon', 'paperclip');
            }
            case 'annotation:create':
            case 'annotation:change':
            case 'annotation:delete': {
                const annotation = new GroupAnnotation.Model({ id: content.annotation_id });
                await this.resolve(annotation, { batch: true });

                const annotation_type_id = annotation.get('annotation_type_id');
                const annotation_type = annotation.annotation_type;
                await this.resolve(annotation_type, { batch: true });

                const annotation_type_name = annotation_type.get('name');
                const annotation_type_type = annotation_type.get('type');
                if (!annotation_type_name || !annotation_type_type) break;

                const event_type = annotation_type_type === 'templated:identifier' ? 'identifier' : 'default';

                let pretty_group_annotation_content;
                if (annotation_type_id) pretty_group_annotation_content = await Utils.GroupAnnotations.prettyContent({ annotation_type_id, content: content.value ?? annotation.get('content') });
                else break;

                if (!pretty_group_annotation_content) pretty_group_annotation_content = 'N/A';

                const pretty_content = StandardPretty.generatePrettyContentForTranslatedString(`${type}.${event_type}`, [`${annotation_type_name}:`, pretty_group_annotation_content, username]); // bit of a hack to get the colon in the right place
                if (annotation_type_type === 'generic:text') {
                    // if we are dealing with a generic:text annotation type, we want to style the content slightly differently
                    // the text should not be capitalised, and be less bold
                    pretty_content[1].class = ['highlight', 'lighter'];
                }
                item.set({ 'pretty_content': pretty_content });
                return item.set('icon', 'tag');
            }
            case 'role:created':
            case 'role:updated':
            case 'role:deleted': {
                const action = type.replace('role:', '');
                const updated_by = username;

                const pretty_content = await this.getPrettyContentForGroupRoleEvent(action, content, updated_by);
                if (!pretty_content) break;

                item.set({ 'pretty_content': pretty_content });
                return item.set('icon', 'user');
            }
            case 'relation:delete': {
                const target_id = content?.target_id;
                if (!target_id) break;

                const target = new Group.Model({ id: target_id });
                await this.resolve(target, { batch: true });
                const target_name = target.get('name');
                if (!target_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('relation.unrelated', [target_name, username]) });
                return item.set('icon', 'link');
            }
            case 'relation:create': {
                const target_id = content?.target_id;
                if (!target_id) break;

                const target = new Group.Model({ id: target_id });
                await this.resolve(target, { batch: true });
                const target_name = target.get('name');
                if (!target_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('relation.related', [target_name, username]) });
                return item.set('icon', 'link');
            }
            case 'comment': {
                return this.refactorComment(item);
            }
            case 'email:comment': {
                return this.refactorEmailComment(item);
            }
            case 'source_document_id_lost': {
                const document_id = content?.document_id;
                if (!document_id) break;

                const document = new Document.Model({ id: document_id });
                await this.resolve(document, { batch: true });
                const document_name = document.get('name');
                if (!document_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('source_document_id_lost', [document_name]) });
                return item.set('icon', 'heartbeat');
            }
            case 'thirdparty:email:sent': {
                const email = content?.email;
                const from_name = content?.from_name;
                if (!email || !from_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('thirdparty.sent_email', [email, from_name]) });
                return item.set('icon', 'paper-plane');
            }
            case 'thirdparty:email:received': {
                const email = content?.email;
                const from_name = content?.from_name;
                const type = content?.type;
                if (!email || !from_name || !type) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('thirdparty.received_email', [_.capitalize(type), email, from_name]) });
                return item.set('icon', 'inbox');
            }
            case 'thirdparty:email:sending': {
                const email = content?.email;
                const from_name = content?.from_name;
                if (!email || !from_name) break;

                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('thirdparty.sending_email', [email, from_name]) });
                return item.set('icon', 'paper-plane');
            }
            case 'email:sent': {
                const user_name = await this.getUsername(content?.user_id);
                const to_recipients = content?.to_recipients ?? [];
                const cc_recipients = content?.cc_recipients ?? [];
                const recipients = [...to_recipients, ...cc_recipients].sort();
                const subject = content?.subject;

                if (!recipients.length || !subject) break;

                const { pretty_content, pretty_remaining_recipients } = CustomPretty.generatePrettyContentForEmailEvent('sent', user_name, recipients, subject);

                item.set({
                    'pretty_content': pretty_content,
                    'tooltip_content': {
                        'email-recipients-list-tooltip-overflow': pretty_remaining_recipients
                    }
                });
                return item.set('icon', 'paper-plane');
            }
            case 'email:received': {
                const sent_by = content?.sent_by;
                const to_recipients = content?.to_recipients ?? [];
                const cc_recipients = content?.cc_recipients ?? [];
                const recipients = [...to_recipients, ...cc_recipients];
                const subject = content?.subject;

                if (!sent_by || !recipients.length || !subject) break;

                const dictKey = await this.checkIfEmailAttachmentIsVersion(content?.email_message_id);

                const { pretty_content, pretty_remaining_recipients } = CustomPretty.generatePrettyContentForEmailEvent(dictKey, sent_by, recipients, subject);
                item.set({
                    'pretty_content': pretty_content,
                    'tooltip_content': {
                        'email-recipients-list-tooltip-overflow': pretty_remaining_recipients
                    }
                });
                return item.set('icon', 'inbox');
            }
            case 'opened_in_plugin': {
                return null;
            }
            default: {
                console.warn('Trying to get pretty event title for unhandled event.');
                item.set({ 'pretty_content': StandardPretty.generatePrettyContentForTranslatedString('event', []) });
                return item.set('icon', 'question');
            }
        }

        return null;
    }
    refactorEmailComment(comment: GroupEvent.Model) {
        if (comment.get('type') !== 'email:comment') return null;

        const content = comment.get('content');
        const text = content?.text ?? '';

        // For email comments, wrap the content in a special container for scrolling
        return comment.set({
            'pretty_content': [{
                text: text,
                class: 'email-comment-content'
            }]
        });
    }
    private async checkIfEmailAttachmentIsVersion(email_id: number) {
        const email = new Email.Model({ id: email_id });
        const version = await email.getVersionAttachment();
        return version?.length ? 'received_with_attachment' : 'received_without_attachment';
    }
    async getPrettyContentForGroupRoleEvent(action: string, content: any, updated_by: string) {
        const group_role_user_name = await this.getUsername(content?.group_role_user_id);

        const appendGroupRoleType = (type: string) => {
            group_role_types.push(
                type === 'admin'
                    ? BaseView.getL10n('group-events-view.group_role.type.admin')
                    : BaseView.getL10n('group-events-view.group_role.type.standard')
            );
        };

        const group_role_types: string[] = [];
        switch (action) {
            case 'created':
            case 'deleted':
                appendGroupRoleType(content.group_role_type);
                break;
            case 'updated':
                appendGroupRoleType(content.old_group_role_type);
                appendGroupRoleType(content.new_group_role_type);
                break;
        }

        return StandardPretty.generatePrettyContentForTranslatedString(
            `group_role.${action}`, [
                group_role_user_name,
                ...group_role_types,
                updated_by
            ]);
    }
    private async getUsername(user_id: number | undefined): Promise<string> {
        if (!user_id) return BaseView.getL10n('group-events-view.no_user_found');

        const user = new User.Model({ id: user_id });
        await this.resolve(user, { batch: true });
        const name = user.get('name');
        if (!name) {
            console.warn(`[${GroupEventsView.name}] Unable to load username; user ${user_id} may no longer exist.`);
            return BaseView.getL10n('group-events-view.no_user_found');
        }

        return name;
    }
    refactorComment(comment: GroupEvent.Model) {
        if (comment.get('type') !== 'comment') return null;

        const content = comment.get('content');
        const text = content?.text ?? '';
        const pretty_content_array = handleMentionText(text).pretty_content;
        return comment.set({ 'pretty_content': pretty_content_array });
    }
    async addComment(comment = '') {
        if (!this.add_comment_input) return;

        const commentToAdd = comment ? comment : this.add_comment_input.getInputValue();
        this.add_comment_input.clearInputValue();

        if (!commentToAdd) return;

        const newGroupEventModel = new GroupEvent.Model({
            group_id: this.model.id,
            content: {
                text: commentToAdd,
            },
            type: 'comment',
        });

        const refactoredComment = this.refactorComment(newGroupEventModel.clone()); // prevents us setting attributes on the model before saving

        if (refactoredComment) this.pretty_events_collection.unshift(refactoredComment);

        await newGroupEventModel.save();

        this.model.trigger('events:updated');
    }
    // Events
    private onClickAddComment() {
        this.addComment();
    }
}
