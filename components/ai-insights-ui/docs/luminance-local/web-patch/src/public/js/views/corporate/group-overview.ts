// Models
import {
    Document,
    Group,
    GroupEvent,
    GroupRoles,
    User,
    Room,
    GroupVersion,
    WorkflowStage,
    Folder,
    WorkflowStageFields
} from '../../models/models';

// Views
import BaseView from '../base';
import Dialog from '../generic-components/popups/dialog';
import { OverlayMenuView } from '../generic-components/menus/overlay-menu';
import UsersFilterBar from '../common/usersFilterBar';
import Tabs from '../generic-components/tabs/tabs';
import createDialog from '../generic-components/popups/dialog';
import GroupAnnotationsView from './group-annotations';
import { GroupEventsView } from './group-overview/group-events-view';
import { GroupVersionTubeMap } from './group-overview/group-version-tube-map';
import { GroupOverviewActionsView } from './group-overview/group-overview-actions-view';
import { GroupOverviewRelatedView } from './group-overview/group-overview-related-view';
import NewVersionFromExistingView from './contract-audit-trail/new-version-from-existing-view';
import ContractUploadView from '../account-admin/contract-upload-bulk-modal';
import { GroupAnnotationFieldsBaseView } from './group-overview/group-annotation-fields-view';
import { GroupAiInsightsView } from './group-overview/group-ai-insights-view';
import { WIDGET_TOOLS, GroupOverviewToolsView } from './group-overview/group-overview-tools-view';
import { ProgressWorkflowButtonView } from './progress-workflow-button-view';
import { ProgressWorkflowEventsBus } from '../../utils/groups/progress-workflow-events-bus';
import { RedirectWarningModal } from './redirect-warning-modal';
import GroupOverviewMoveStageView from './group-overview/group-overview-move-stage-view';

// Misc
import _ from 'lodash';
import Utils from '../../utils/utils';
import Autocomplete from '../generic-components/forms/form-elements/autocompletes/autocomplete';
import { GroupUploadFolderSelectorView } from '../common/group-upload-folder-selector-view';
import { GroupOverviewConvertToDocxFormWrapper, IConvertToDocxFormController } from './group-overview/group-overview-actions-view/group-overview-convert-to-docx-form-view';
import { DocumentConversionProgress, DocumentConversionProgressController } from './document-conversion-progress';
import { createAwaitDocumentImportModal } from '../common/create-await-document-import-modal';
import { Resolved } from '../../models/base/utils';
import { GroupNameController } from '../../utils/groups';
import { GroupPermissionEvaluator, IGroupPermissionEvaluator } from '../../utils/models/group/group-permission-evaluator';
import {  GroupRolesView, GroupRolesViewFactory } from './group-overview/group-roles-view';
import { GroupRolesDataHandler, IGroupRolesDataHandler } from './group-overview/group-roles-handler';

// Types
import { GroupRoleType } from '../../models/group_role';
import { createGroupOverviewPermissions, GroupPermissionHandler, IGroupPermissionHandler } from './group-overview/group-overview-permission';
import { resolveLoadEventEmitterSource } from '../base/load-event-emitter';
import { handleUnchangedDocuments } from '../../utils/unchanged-documents-handler';
const { STANDARD, ADMIN } = GroupRoles.GROUP_ROLE_TYPE;

export namespace GroupOverview {
    export interface Options extends BaseView.Options<Group.Model & Resolved> {
        room: Room.Model;
        always_enable?: boolean;
        me: User.Model & Resolved;
    }
}

type FileForUpload = File & {
    group_information?: ContractTagsObject | AttachmentTagObject,
    relativePath?: string,
    webkitRelativePath?: string,
}

type FilesForUpload = {
    'files': Array<FileForUpload>
}

type ContractTagsObject = {
    group_name: string,
    group_version_name: string,
    group_info: {
        high_priority: boolean,
    },
    group_version_stage_id?: number,
    group_workflow_id?: number,
    group_version_type?: string
};

type AttachmentTagObject = {
    group_name: string,
    group_version_type: 'attachment'
}

type GroupInformation = {
    contract_tags?: Record<string, ContractTagsObject>,
    amendments?: Array<Document.Model>,
    target_folder?: Folder.Model,
}

interface MenuItem {
    name: string;
    icon: string;
    tag: string;
    classes: string[];
    callback: () => void;
}

export enum MODES {
    SUMMARY = 'summary',
    APPROVAL_PARALLEL = 'approval',
}

export enum MODE_FOR_STAGE_TYPE {
    review = MODES.SUMMARY,
    approval_parallel = MODES.APPROVAL_PARALLEL,
}

export class GroupOverview extends BaseView<Group.Model & Resolved> {
    // JQuery
    $header = this.$root.filter('.header');
    $topbar = this.$header.find('.topbar');
    $group_menu = this.$topbar.find('button.group-menu-button');
    $group_pretty_id_value = this.$topbar.find('.group-pretty-id.value');
    $group_name = {
        name_span: this.$topbar.find('.group-name-span'),
        name_input: this.$topbar.find('input.group-name.value'),
    };
    $collaborators_container = this.$topbar.find('.collaborators-container');
    $watchers_container = this.$topbar.find('.watchers-container');
    $submitted_name_value = this.$topbar.find('.submitted-name.value');
    $timeline = this.$header.find('.timeline-container');
    $status_name = this.$timeline.find('.status-name');
    $reviewer_name = this.$timeline.find('.reviewer-name');
    $reviewer_name_value = this.$timeline.find('.reviewer-name.value');
    $reviewer_edit_icon = this.$timeline.find('.edit-icon');
    $tube_map_container = this.$timeline.find('.tube-map-container');
    $body = this.$root.filter('.body');
    $content_and_actions_container = this.$body.find('.content-and-actions-container');
    $content_container = this.$body.find('.content-container');
    $context_container = this.$body.find('.context-container');
    $extract_matter_tags_button = this.$context_container.find('.header .actions button.group-annotations-extract-button');
    $preview_button = this.$context_container.find('.header .actions button.preview');
    $preview_button_label = this.$preview_button.find('span.label');
    $actions_container = this.$body.find('.actions-container');
    $activity_and_related = this.$body.find('.activity-and-related-container');
    $tabs_container = this.$activity_and_related.find('.tabs-container');
    $tabs = {
        activity: this.$activity_and_related.find('.activity-container'),
        related: this.$activity_and_related.find('.related-container'),
        ai_insights: this.$activity_and_related.find('.ai-insights-container'),
    };
    $file_upload = this.$root.filter('.file-upload');
    $file_upload_attachment = this.$root.filter('.file-upload-attachment');
    $group_menu_button = this.$topbar.find('.group-menu-button');

    // Models and Collections
    me: User.Model & Resolved;
    room: Room.Model;
    relevant_group_version: GroupVersion.Model | null = null;
    relevant_document: Document.Model | null = null;
    all_group_versions: GroupVersion.Collection | null = null;
    assignable_reviewers: User.Collection | null = null;
    assigned_to: User.Model | null = null;
    workflow_stage: WorkflowStage.Model | null = null;
    groupNameController: GroupNameController | null = null;
    group_roles_handler: IGroupRolesDataHandler | null = null;
    private workflow_stage_id: number | null = null;

    // Views
    group_overview_tube_map: GroupVersionTubeMap | null = null;
    group_events_view: GroupEventsView | null = null;
    group_overview_related_view: GroupOverviewRelatedView | null = null;
    group_overview_actions_view: GroupOverviewActionsView | null = null;
    tools_views: GroupOverviewToolsView[];
    group_annotations_view: GroupAnnotationFieldsBaseView | GroupAnnotationsView | null = null;
    group_ai_insights_view: GroupAiInsightsView | null = null;
    activity_tabs: Tabs | null = null;
    group_menu_overlay: OverlayMenuView | null = null;
    workflow_button: ProgressWorkflowButtonView | null = null;
    collaborators_view: GroupRolesView | null = null;
    watchers_view: GroupRolesView | null = null;

    // Events Handlers
    progress_workflow_events_bus: ProgressWorkflowEventsBus;

    // Primitives
    expanded_context: boolean | null = null;
    is_executed_version: boolean;
    can_update_assignee = false;
    actions_buttons_refresh_should_await_document_import_promise: Promise<boolean>;

    group_permissions: IGroupPermissionHandler;
    group_permission_evaluator: IGroupPermissionEvaluator;

    // Functions
    resolve_should_await_document_import_promise: ((value: boolean | PromiseLike<boolean>) => void) | null = null;
    reviewers_filter_bar: UsersFilterBar | null = null;

    title(): string {
        return this.model.get('name');
    }
    preinitialize(): void {
        this.template = 'group-overview-view';
        this.iconClass = 'comments-o';
        this.events = <any>{
            // TOPBAR
            'click .header .topbar button.back': this.onClickBack,
            'keydown .header .topbar input.group-name.value': this.onKeyDownGroupName,
            'focusout .header .topbar input.group-name.value': this.onBlurGroupName,
            'click .header .topbar button.group-menu-button': this.onClickGroupMenuButton,

            // TIMELINE
            'click .timeline-container .reviewer-container .reviewer-name.value': this.onClickReviewer,
            'click .timeline-container .reviewer-container .edit-icon': this.onClickReviewer,

            // CONTEXT
            'click .body .context-container button.expand': this.onClickExpandContext,
            'click .header button.preview': this.onClickPreview,
            'click .header button.group-annotations-extract-button': this.onClickGroupAnnotationsExtractButton,
        };
    }
    constructor(opts: GroupOverview.Options) {
        super(opts);

        this.room = opts.room?.isCollectionInterface?.()
            ? new Room.Model({ id: this.model.get('room_id') })
            : opts.room;
        this.tools_views = [];
        this.is_executed_version = false;
        this.expanded_context = false;
        this.actions_buttons_refresh_should_await_document_import_promise = new Promise((res) => {
            this.resolve_should_await_document_import_promise = res;
        });
        this.me = opts.me;
        this.group_permission_evaluator = new GroupPermissionEvaluator({ group: this.model, me: this.me });
        this.group_permissions = this.setupGroupPermissions();

        this.progress_workflow_events_bus = new ProgressWorkflowEventsBus();
        // If / When the topbar is spun off into its own view, this event listener should go with it
        this.listenTo(this.progress_workflow_events_bus, 'change:matter_state_updating', (model: ProgressWorkflowEventsBus) => {
            this.$group_menu_button.prop('disabled', model.get('matter_state_updating'));
        });

        this.initializeUploadForms();
        this.onceRendered(() => this.load());
    }
    private setupGroupPermissions(): GroupPermissionHandler {
        const permission_data = {
            resolver: this,
            workflow_stage: this.workflow_stage,
            relevant_group_version: this.relevant_group_version,
            relevant_document: this.relevant_document,
            me: this.me,
            room: this.room,
            group_permission_evaluator: this.group_permission_evaluator,
            is_executed_version: this.is_executed_version,
        };
        const group_permissions = createGroupOverviewPermissions(permission_data);
        this.listenTo(group_permissions.show_tools, 'change:loaded', async () => {
            const show_tools = await resolveLoadEventEmitterSource(group_permissions.show_tools);
            this.$el.toggleClass('show-tools', show_tools);
            if (show_tools) this.toggleContext(true);
        });
        this.listenTo(group_permissions.show_group_menu, 'change:loaded', async () => {
            const show_group_menu = await resolveLoadEventEmitterSource(group_permissions.show_group_menu);
            this.$group_menu.toggleClass('hidden', !show_group_menu);
        });
        return group_permissions;
    }
    // rather than waiting for all permission to calculate, we just trigger
    // the re-calculation, then either listen to events or wait for
    // the promise for the permission we care about to be resolved
    private refreshGroupPermissions() {
        this.group_permissions.refresh({
            workflow_stage: this.workflow_stage,
            relevant_group_version: this.relevant_group_version,
            relevant_document: this.relevant_document,
            me: this.me,
            room: this.room,
            is_executed_version: this.is_executed_version,
        });
    }
    private initializeUploadForms(): void {
        this.$file_upload.fileupload({
            singleFileUploads: true,
            submit: function () {
                return false;
            },
            change: async (
                e,
                data: FilesForUpload,
            ) => {
                const file = data.files[0];

                if (!file) return;

                this.updateUploadPreparing(true);
                this.progress_workflow_events_bus.notify('ongoing', 'preparing_upload_file');

                // If document exists, upload into it's folder
                // If no document, prompt the user to select a folder to upload into
                let target;
                const document = await this.model.getActiveDocument();
                if (document) {
                    target = await this.resolve(document.folder);
                } else {
                    let target_folder_id;
                    const folder_selector_modal = this.createModal(
                        BaseView.getL10n('group-creator-actions-upload-button-view.upload_select_folder_modal_title'),
                        new GroupUploadFolderSelectorView({
                            model: this.model,
                            save_button_text: 'Continue',
                            save_button_class: 'primary',
                        }), {
                            close_events: [ 'save', 'cancel' ],
                            proxy_events: [ 'save' ],
                            on_close: () => {
                                this.updateUploadPreparing(false);
                                this.progress_workflow_events_bus.notify('finished', 'preparing_upload_file');
                            },
                        }
                    );
                    const selected_folder = await new Promise<boolean>((resolve, reject) => {
                        this.listenTo(folder_selector_modal, 'save', ({ folder_id }) => {
                            if (folder_id) target_folder_id = folder_id;
                            resolve(!!folder_id);
                        });
                        this.listenTo(folder_selector_modal, 'close', () => {
                            resolve(false);
                        });
                        this.listenTo(folder_selector_modal, 'error', (error) => {
                            reject(error);
                        });
                    }).catch((error) => {
                        console.warn('Folder selection failed:', error);
                        return;
                    });
                    if (!selected_folder) return;
                    target = await this.resolve(new Folder.Model({ id: target_folder_id }));
                }

                const workflow = await this.resolve(this.model.workflow);
                await this.resolve(this.model.versions);

                const { new_name } = await this.model.getNewVersionData();

                file.group_information = {
                    group_info: {
                        high_priority: false
                    },
                    group_name: this.model.get('name'),
                    group_version_name: new_name,
                    group_workflow_id: workflow.id,
                };

                this.handleUpload([ file ], target, false);
            }
        });


        this.$file_upload_attachment.fileupload({
            singleFileUploads: true,
            submit: function () {
                return false;
            },
            change: async (
                e,
                data: FilesForUpload,
            ) => {
                if (!this.model || !this.model.isResolved()) return;

                const file = data.files[0];

                if (!file) return;

                this.group_overview_actions_view?.toggleUploadPreparing(true);
                this.progress_workflow_events_bus.notify('ongoing', 'preparing_upload_file');

                // If document exists, upload into it's folder
                // If no document, upload into default upload folder
                let target;
                const document = await this.model.getActiveDocument();
                if (document) {
                    target = await this.resolve(document.folder);
                } else {
                    await this.resolve(this.model.workflow);
                    const settings = await Utils.Workflows.getGroupSettings(this.model.workflow);
                    const folder_id = settings?.get('default_upload_folder');
                    if (!folder_id) target = await this.getFolder();
                    else target = await this.resolve(new Folder.Model({ id: folder_id }));
                }

                file.group_information = {
                    group_name: this.model.get('name'),
                    group_version_type: 'attachment'
                };

                if (target) this.handleUpload([ file ], target, false, { is_attachment: true });
            }
        });
    }
    private async load(): Promise<void> {
        const group_overview_spinner = this.showLoadingSpinner(this.$el);
        this.relevant_group_version = await this.model.getActiveOrExecutedVersion({ force: true });
        this.is_executed_version = this.relevant_group_version?.get('state') === 'executed' || false;

        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();

        const [, resolved_workflow_stage, resolved_group_roles] = await Promise.all([
            this.loadRelevantDocument(),
            this.resolve(this.relevant_group_version.workflow_stage),
            this.resolve(this.model.group_roles),
        ]);
        this.workflow_stage = resolved_workflow_stage;

        this.initGroupNameController();

        group_overview_spinner.hide();

        this.refreshGroupPermissions();

        this.group_roles_handler = new GroupRolesDataHandler({
            group_model: this.model,
            group_roles: resolved_group_roles,
            group_permission_evaluator: this.group_permission_evaluator,
            resolver: this,
        });
        this.listenTo(this.group_roles_handler.group_roles, 'invalidate', this.refreshCheckForAccess);

        this.loadTopbar();
        this.loadTimeline();
        this.loadContext();
        this.loadActivityAndRelated();
        this.loadTools();
        this.loadActions();

        this.pollForGroupVersionChanges();
    }
    private async pollForGroupVersionChanges(): Promise<void> {
        this.workflow_stage_id = (await this.model.getActiveOrDraftVersion())?.get('workflow_stage_id') ?? null;

        const POLL_DELAY = 2000;

        this.poll(async (): Promise<void> => {
            const active_group_version = await this.model.getActiveOrDraftVersion({force: true});
            const new_workflow_stage_id = active_group_version?.get('workflow_stage_id');
            const stage_changed = this.workflow_stage_id !== new_workflow_stage_id;
            if (active_group_version && stage_changed) {
                // refreshView will update `this.workflow_stage_id` the workflow_stage_id
                await this.refreshView(active_group_version, active_group_version.workflow_stage);
                this.model.trigger('status:updated');
                this.trigger('invalidate:group_collection');
            }
        }, {
            delay: POLL_DELAY,
            immediate: false,
        });
    }

    private async loadRelevantDocument(): Promise<Document.Model | null> {
        if (this.relevant_group_version?.document) this.relevant_document = await this.relevant_group_version.getDocumentIfVisible();
        return this.relevant_document;
    }

    private initGroupNameController(): void {
        if (!LUMINANCE.settings?.auto_generate_matter_name?.rename_matter_on_group_overview_enabled) return;

        this.groupNameController = new GroupNameController({
            group: this.model,
            workflow: this.model.workflow,
        });
    }

    // View Sections
    private async loadGroupWatchers(): Promise<void> {
        if (!this.group_roles_handler) return;

        this.watchers_view = await this.loadGroupRolesView(STANDARD);
        if (!this.watchers_view) return;

        this.watchers_view.appendElTo(this.$watchers_container).registerChildViewOf(this);

        const view_spinner = this.showLoadingSpinner(this.$watchers_container);
        await this.watchers_view.load();
        view_spinner.hide();
    }
    private loadTopbar(): void {
        const submitted_by_spinner = this.showLoadingSpinner(this.$submitted_name_value);

        // ID
        this.$group_pretty_id_value.text(this.model.get('pretty_id') ?? '-');

        // Group Name
        this.keepUpdated(this.model, 'change:name group_name:generated', () => {
            this.showGroupNameFromModel();
        });

        // Collaborators
        this.loadGroupCollaborators();

        // Watchers
        this.loadGroupWatchers();

        // Group Creator
        this.loadCreatorName().then((name: string) => {
            this.$submitted_name_value.text(name);
            submitted_by_spinner.hide();
        });


        if (this.is_executed_version) {
            this.$group_name.name_input.prop('disabled', true);
        }
    }
    private async loadCreatorName(): Promise<string> {
        const creator = new User.Model({ id: this.model.get('created_by') });
        await this.resolve(creator, { batch: true });

        const name = creator.get('name');
        if (!name) {
            console.warn(`[${GroupOverview.name}] Unable to load creator name; user ${this.model.get('created_by')} may no longer exist.`);
            return BaseView.getL10n('group-overview-view.no_user_found');
        }

        return name;
    }
    private showGroupNameFromModel(): void {
        const groupName = this.model.get('name');
        if (LUMINANCE.settings?.auto_generate_matter_name?.manual_matter_renaming_enabled) {
            this.$group_name.name_input.val(groupName);
            this.$group_name.name_input.attr('title', groupName);
            this.$group_name.name_input.removeClass('hidden');
        } else {
            this.$group_name.name_span.text(groupName);
            this.$group_name.name_span.attr('title', groupName);
            this.$group_name.name_span.removeClass('hidden');
        }
    }
    private async loadTubeMap(all_group_versions: GroupVersion.Collection, relevant_group_version: GroupVersion.Model): Promise<void> {
        // Ensure any existing tube map is properly disposed of before creating a new one
        if (this.group_overview_tube_map) {
            this.group_overview_tube_map.remove();
            this.group_overview_tube_map = null;
        }

        this.group_overview_tube_map = new GroupVersionTubeMap({
            room: this.room,
            collection: all_group_versions,
            selected: relevant_group_version,
            show_titles: false,
            getTitleFn: (m) => {
                return m.workflow_stage.get('name') ?? '-';
            },
            getStopNameFn: (m) => {
                return m.get('name') ?? '-';
            }
        });
        this.group_overview_tube_map.appendElTo(this.$tube_map_container).registerChildViewOf(this);

        this.listenTo(this.group_overview_tube_map, 'preview:version', (version) => this.previewVersion(version));
        this.listenTo(this.group_overview_tube_map, 'compare:version', (version) => this.compareVersion(version));

        this.listenTo(this.group_overview_tube_map, 'delete:version', async (group_version: GroupVersion.Model) => {
            const document = group_version.document;
            if (!document) return;
            // the option to delete a replaced document shouldn't appear, so we shouldn't hit this case, but just in case there are race conditions with this.version_menu_params
            // ^ This is obviously no longer the case. Need to think about it. 
            // if (document.get('version_state') === 'replaced') return;

            const document_revision = document.get('version') ?? null;
            const confirm_delete = await createDialog.getConfirmation(this, {
                title: BaseView.getL10n('group-overview-view.delete_version.title'),
                text: document_revision
                    ? BaseView.formatL10n('group-overview-view.delete_version.dialog_text_with_revision_number', document.get('name') ?? '', document_revision)
                    : BaseView.formatL10n('group-overview-view.delete_version.dialog_text', document.get('name') ?? ''),
                remove: true,
                button_text: 'Delete',
                resolve_on_cancel: true,
            });
            if (!confirm_delete) return;

            let deleted: Document.DeleteDocumentVersionResult | null = null;
            const is_final_version = this.all_group_versions?.length==1;
            if (is_final_version) {
                const confirm_delete_final_version = await createDialog.getConfirmation(this, {
                    title: BaseView.getL10n('group-overview-view.delete_final_version.title'),
                    text: BaseView.getL10n('group-overview-view.delete_final_version.dialog_text'),
                    remove: true,
                    button_text: 'Delete',
                    resolve_on_cancel: true,
                });
                if (!confirm_delete_final_version) return;

                try {
                    deleted = await document.deleteDocumentVersion();
                } catch (err) {
                    this.displayDeleteErrorModal();
                }
                if (!deleted?.success) return;

                await this.confirmedDeleteGroup();
                this.refreshEventsAndNotify();
                return;
            }

            try {
                deleted = await document.deleteDocumentVersion();
            } catch (err) {
                this.displayDeleteErrorModal();
            }
            if (!deleted?.success) return;

            this.refreshEventsAndNotify();
            if (group_version?.get('state') === 'active') {
                // refresh the view as we will be showing a new 'active' version which needs to
                // more than just the timeline.
                await this.refreshView();
            } else {
                await this.refreshTimeline();
            }
            this.trigger('invalidate:group_collection');

        });
    }
    private displayDeleteErrorModal(): void {
        new Dialog.Custom(this, {
            title: BaseView.getL10n('group-overview-view.delete_version.error_modal_title'),
            contents: [{
                type: 'text',
                value: BaseView.getL10n('group-overview-view.delete_version.error')
            }],
            actions: [{
                name: BaseView.getL10n('group-overview-view.delete_version.error_button_confirm'),
                icon: 'check',
                style: 'primary',
            }]
        });
    }
    async loadGroupRolesView(role_type: GroupRoleType): Promise<GroupRolesView | null> {
        if (!this.group_roles_handler) {
            throw new Error('Cannot load group roles view as GroupRolesDataHandler is not initialized');
        }

        const view_factory = new GroupRolesViewFactory({
            model: this.model,
            role_type,
            view_context: this,
            group_roles_handler: this.group_roles_handler,
        });
        const view = await view_factory.create({
            model: this.model,
            role_type,
        });

        return view;
    }
    private async loadGroupCollaborators(): Promise<void> {
        if (!this.group_roles_handler) return;

        const collaborators_view = await this.loadGroupRolesView(ADMIN);
        if (!collaborators_view) return;

        this.collaborators_view = collaborators_view;
        this.collaborators_view.appendElTo(this.$collaborators_container).registerChildViewOf(this);

        const view_spinner = this.showLoadingSpinner(this.$collaborators_container);
        await this.collaborators_view.load();
        view_spinner.hide();
    }
    private async loadTimeline(): Promise<void> {
        if (!this.workflow_stage) return;

        const tube_map_spinner = this.showLoadingSpinner(this.$tube_map_container);

        this.$status_name.text(this.workflow_stage.get('name'));
        this.$status_name.attr('title', this.workflow_stage.get('name'));

        // Group Version Assignee
        const setReviewer = async (): Promise<void> => {
            const reviewer_spinner = this.showLoadingSpinner(this.$reviewer_name);
            await this.loadReviewer();
            if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
            this.assigned_to = this.relevant_group_version.getAssignedTo();
            const name = this.assigned_to?.get('name') ?? BaseView.getL10n('group-overview-view.unassigned');
            this.can_update_assignee = !this.is_executed_version
                && await this.group_permission_evaluator.userCanManageAssignee({ resolver: this });
            this.$timeline.find('.reviewer-container').toggleClass('editable', this.can_update_assignee);
            reviewer_spinner.hide();
            this.$reviewer_name_value.text(name);
        };
        setReviewer();

        if (this.is_executed_version) {
            this.$reviewer_name_value.prop('disabled', true);
            this.$reviewer_edit_icon.prop('disabled', true);
        }

        const groupVersionsArr = await this.calculateGroupVersionsToShow();
        this.all_group_versions = new GroupVersion.Collection(groupVersionsArr, { limit: 50, fetching: false, fetched: true });

        if (!this.all_group_versions.length || !this.relevant_group_version) {
            this.$tube_map_container.toggleClass('hidden', true);
            tube_map_spinner.hide();
            return;
        }

        this.$tube_map_container.toggleClass('hidden', false);

        this.loadTubeMap(this.all_group_versions, this.relevant_group_version);

        tube_map_spinner.hide();
    }
    private async loadTools(): Promise<void> {
        if (!(await resolveLoadEventEmitterSource(this.group_permissions.show_tools)) || !this.workflow_stage) return;

        const enabled_tools = await Utils.Workflows.Tools.getEnabledToolsForStage(this.workflow_stage);

        if (this.tools_views.length) {
            this.tools_views.forEach(view => view.remove());
            this.tools_views = [];
        }
        WIDGET_TOOLS.forEach((possible_tool) => {
            if (!enabled_tools.includes(possible_tool)) return;

            const view = new GroupOverviewToolsView({
                type: possible_tool,
                model: this.model,
                additionalClassNames: ['container-style']
            });
            this.proxyEvents(view, 'open');
            view.appendElTo(this.$content_container).registerChildViewOf(this);
            this.tools_views.push(view);
        });
    }
    private async loadPreview(): Promise<void> {
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();

        this.$preview_button.toggleClass('hidden', !(await resolveLoadEventEmitterSource(this.group_permissions.can_preview)));
        if (await resolveLoadEventEmitterSource(this.group_permissions.can_preview)) {
            const version_name = this.relevant_group_version.get('name');
            const button_text = version_name
                ? BaseView.formatL10n('group-overview-view.context.preview_version', version_name)
                : BaseView.formatL10n('group-overview-view.context.preview');
            this.$preview_button_label.text(button_text);
        }
    }
    private async loadContext(): Promise<void> {
        // [CONFIG] {boolean} ui.v2_ui_enabled - display fields configured on the workflow in group overview
        const workflow_annotation_types_enabled = LUMINANCE.settings?.v2_ui_enabled;
        if (workflow_annotation_types_enabled && this.workflow_stage) {
            this.group_annotations_view = new GroupAnnotationFieldsBaseView({
                model: this.model,
                workflow_stage: this.workflow_stage,
                all_fields_readonly: !(await resolveLoadEventEmitterSource(this.group_permissions.can_edit_matter_tags)),
                events_bus: this.progress_workflow_events_bus,
            });
        } else {
            this.group_annotations_view = new GroupAnnotationsView({
                model: this.model,
                room: this.room,
                events_bus: this.progress_workflow_events_bus,
            });
        }

        // [CONFIG] {boolean} ui.agentic_workflow.enabled - enable agentic workflow
        // [CONFIG] {boolean} ui.agentic_workflow.matter_tag_extractor.enabled - enable matter tag extractor agent
        const matter_tag_extractor_agent_enabled = LUMINANCE.settings?.agentic_workflow?.enabled
            && LUMINANCE.settings?.agentic_workflow?.matter_tag_extractor?.enabled;
        const matter_tag_extractor_enabled = workflow_annotation_types_enabled && this.workflow_stage && matter_tag_extractor_agent_enabled;
        this.$extract_matter_tags_button.toggleClass('hidden', !matter_tag_extractor_enabled);

        this.loadPreview();

        const debouncedRefresh = _.debounce(() => {
            this.refreshEventsAndNotify();
        }, 1000);

        this.group_annotations_view?.appendElTo(this.$context_container.find('.body')).registerChildViewOf(this);

        const conduit = this.progress_workflow_events_bus.getEventsConduit();
        this.listenTo(conduit,
            'group_annotation:saved group_annotation:deleted group_annotation:created description:updated',
            (workflow_stage_field: WorkflowStageFields.Model) => {
                if (this.group_events_view) debouncedRefresh();
                if (workflow_stage_field) this.updateGroupName(workflow_stage_field);
            }
        );
    }

    private addAiEventToActivity({ title, description }: { title: string, description: string }) {
        if (!this.group_events_view) return;
        const event_model = new GroupEvent.Model({
            type: 'comment',
            created_by: User.me?.id,
            created_at: new Date().toISOString(),
            icon: 'magic',
            pretty_content: [
                { text: 'AI recommendation approved: ', class: ['highlight'] },
                { text: title },
                { text: ` — ${description}` },
            ],
        });
        this.group_events_view.addLocalEvent(event_model);
    }
    private async loadActions(upload_preparing = false): Promise<void> {
        if (!(await resolveLoadEventEmitterSource(this.group_permissions.show_tools))) return;
        if (!this.room || !this.workflow_stage || !this.relevant_group_version) {
            console.error(`Could not load actions as the required models did not all exist: \
room: ${!!this.room}, workflow_stage: ${!!this.workflow_stage}, relevant_group_version: ${!!this.relevant_group_version}`);
            return;
        }

        const [
            resolved_room,
            resolved_workflow_stage,
            resolved_relevant_group_version,
        ] = await this.resolve([
            this.room,
            this.workflow_stage,
            this.relevant_group_version,
        ], { batch: true });

        if (!LUMINANCE.settings?.v2_ui_enabled && resolved_workflow_stage.get('type') === 'signed') return;

        const button_opts: ProgressWorkflowButtonView.Options = {
            model: this.model,
            additionalClassNames: 'action',
            events_bus: this.progress_workflow_events_bus,
        };
        if (this.resolve_should_await_document_import_promise)
            button_opts.resolveShouldAwaitDocumentImportPromise = this.resolve_should_await_document_import_promise;

        if (this.workflow_button) this.workflow_button.remove();
        this.workflow_button = new ProgressWorkflowButtonView(button_opts);

        this.workflow_button.appendElTo(this.$actions_container.find('.progress-workflow-container')).registerChildViewOf(this);
        this.listenTo(this.workflow_button, {
            'refresh:workflow_update': (new_group_version, new_workflow_stage) => {
                // This prevents triggering refreshView again if already triggered by polling
                if (this.workflow_stage_id !== new_workflow_stage?.id) {
                    this.trigger('invalidate:group_collection');
                    this.refreshView(new_group_version, new_workflow_stage);
                }
            },
            'group:executed': () => {
                this.trigger('invalidate:group_collection');
                this.trigger('close');
            },
            'contract_template_required_data': (data: GroupAnnotationFieldsBaseView.AllData) => {
                if (this.group_annotations_view && this.group_annotations_view instanceof GroupAnnotationFieldsBaseView) this.group_annotations_view.checkContractGenerationData(data);
            },
            'redirect_modal': (redirect_url: string, redirect_page: string) => {
                this.createModal(
                    BaseView.getL10n('redirect-warning-modal.redirect_notice'),
                    new RedirectWarningModal({ redirect_url, redirect_page }),
                    {
                        close_events: [ 'close' ],
                        on_close: (): void => {
                            this.progress_workflow_events_bus.notify('finished', 'workflow_progression_post_actions');
                        }
                    },
                );
            }
        });

        if (this.group_overview_actions_view) this.group_overview_actions_view.remove();
        this.group_overview_actions_view = new GroupOverviewActionsView({
            model: this.model,
            active_group_version: resolved_relevant_group_version,
            workflow_stage: resolved_workflow_stage,
            room: resolved_room,
            suggested_actions_only: !LUMINANCE.settings?.v2_ui_enabled,
            upload_preparing: upload_preparing,
        });
        this.group_overview_actions_view.appendElTo(this.$actions_container.find('.workflow-actions-container')).registerChildViewOf(this);

        this.proxyEvents(this.group_overview_actions_view, ['open', 'close', 'invalidate:group_collection']);
        // #264236: when multiple EditInWordInterface(s) are being listened to,
        // debounce prevents duplicate child views from rendering because of simultaneous 'document:replaced' events
        const debounced_refreshView = _.debounce((): Promise<void> => {
            return this.refreshView();
        }, 100);
        this.listenTo(this.group_overview_actions_view, 'document:replaced', async () => await debounced_refreshView());
        this.listenTo(this.group_overview_actions_view, 'upload', async (): Promise<void> => {
            this.$file_upload.click();
            this.reloadUploadForms();
        });
        this.listenTo(this.group_overview_actions_view, 'upload_attachment', (): void => {
            this.$file_upload_attachment.click();
            this.reloadUploadForms();
        });
        this.listenTo(this.group_overview_actions_view, 'select:existing', (): void => {
            const view = new NewVersionFromExistingView({ model: this.model, room: this.room });
            this.createModal(BaseView.getL10n('new-version-from-existing-view.modal_title'), view);
            this.listenTo(view, 'close', (): Promise<void> => this.refreshView());
        });
        this.listenTo(this.group_overview_actions_view, 'document:convert', (): Promise<void> => this.handleDocumentConversion());
    }
    private async handleDocumentConversion(): Promise<void> {
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();

        const builder = new GroupOverviewConvertToDocxFormWrapper({
            context: this,
            group: this.model,
            version: this.relevant_group_version,
        });
        const spinner = this.showLoadingSpinner(this.group_overview_actions_view?.$el, { disable_view: true, disabled: true });
        const view = await builder.build();
        spinner.hide();
        this.createModal(
            BaseView.getL10n('group-overview-actions-view.convert_to_docx'),
            view,
            {
                close_events: ['cancel', 'close', 'save'],
            }
        );
        this.listenTo(view, 'save', async (save_promise: ReturnType<IConvertToDocxFormController['save']>) =>
            this.handleDocumentConversionProgress(save_promise)
        );
    }
    private async handleDocumentConversionProgress(save_promise: ReturnType<IConvertToDocxFormController['save']>): Promise<void> {
        const spinner = this.showLoadingSpinner(
            this.group_overview_actions_view?.$el,
            { disable_view: true, disabled: true }
        );
        const progress_controller = new DocumentConversionProgressController({
            conversion_promise: save_promise,
            view_context: this,
        });
        const progress_view = new DocumentConversionProgress({
            message: BaseView.getL10n('group-overview-view.convert_to_docx_waiting_modal_message'),
            controller: progress_controller,
        });
        this.createModal(
            BaseView.getL10n('group-overview-view.convert_to_docx_waiting_modal_title'),
            progress_view,
            {
                close_events: ['complete'],
                modal_opts: {
                    cancel_icon: 'minus',
                    helper_text: BaseView.getL10n('group-overview-view.convert_to_docx_waiting_modal_helper_text'),
                },
            }
        );
        await progress_controller.getConversionPromise();
        spinner.hide();
        await this.refreshView();
        if (!this.group_overview_actions_view) {
            console.warn(`[${GroupOverview.name}] groupOverviewActionsView undefined after calling refreshView`);
            return;
        }
        this.group_overview_actions_view.toggleWordShowSpinnerOverride(true);
        this.group_overview_actions_view.wordShowSpinner();
        await progress_controller.getAwaitDocumentImportPromise();
        this.group_overview_actions_view.toggleWordShowSpinnerOverride(false);
        this.group_overview_actions_view.word_interface?.load();
    }
    private async loadActivityAndRelated(): Promise<void> {
        const tabs = new Tabs({
            tabs: [
                {
                    key: 'activity',
                    title: BaseView.getL10n('group-overview-view.activity_and_related.activity_title'),
                },
                {
                    key: 'related',
                    title: BaseView.getL10n('group-overview-view.activity_and_related.related_title'),
                },
                {
                    key: 'ai_insights',
                    title: 'AI Insights',
                    iconClass: 'magic',
                    className: 'ai-insights-tab',
                },
            ],
            defaultSelected: 'activity',
        });
        this.activity_tabs = tabs;
        tabs.appendElTo(this.$tabs_container).registerChildViewOf(this);
        this.listenTo(tabs, 'click', (selected_tab: string) => {
            for (const tab in this.$tabs) {
                this.$tabs[tab as keyof typeof this.$tabs].toggleClass('hidden', tab !== selected_tab);
            }
            if (selected_tab === 'ai_insights') {
                this.group_ai_insights_view?.clearBadge();
            }
        });

        this.group_events_view = new GroupEventsView({
            model: this.model,
            group_events_collection: this.model.all_events,
        });
        this.group_events_view.appendElTo(this.$tabs.activity).registerChildViewOf(this);

        await Promise.all([
            this.resolve(this.model.attachments),
            this.resolve(this.model.relations),
        ]);

        this.group_overview_related_view = new GroupOverviewRelatedView({
            model: this.model,
            group_permission_evaluator: this.group_permission_evaluator,
        });
        this.group_overview_related_view.appendElTo(this.$tabs.related).registerChildViewOf(this);
        this.proxyEvents(this.group_overview_related_view, 'open');
        this.listenTo(this.model.attachments, 'update', () => this.refreshEventsAndNotify());
        this.listenTo(this.model.relations, 'update', () => this.refreshEventsAndNotify());

        if (this.group_ai_insights_view) {
            this.group_ai_insights_view.remove();
            this.group_ai_insights_view = null;
        }
        if (this.workflow_stage && this.room) {
            this.group_ai_insights_view = new GroupAiInsightsView({
                model: this.model,
                workflow_stage: this.workflow_stage,
                room: this.room,
            });
            this.listenTo(
                this.group_ai_insights_view,
                'ai-agent:query',
                (payload: { group_id: number; text: string }) => {
                    this.handleAgentQuery(payload);
                }
            );
            this.listenTo(this.group_ai_insights_view, 'ai-action:approved', (payload: { action_id: string, title: string, description: string }) => {
                this.addAiEventToActivity(payload);
            });
            this.listenTo(this.group_ai_insights_view, 'ai-insights:badge', (payload: { count: number, dot: boolean }) => {
                this.activity_tabs?.setBadge('ai_insights', payload);
            });
            this.group_ai_insights_view.appendElTo(this.$tabs.ai_insights).registerChildViewOf(this);
        }
    }

    private async handleAgentQuery(payload: { group_id: number; text: string }): Promise<void> {
        const view = this.group_ai_insights_view;
        if (!view) return;
        try {
            const response = await Utils.Request.call(
                `/api/groups/${payload.group_id}/ai_agent_query`,
                'POST',
                {
                    content_type: 'application/json',
                    data: JSON.stringify({ text: payload.text }),
                }
            );
            const message = typeof response?.message === 'string'
                ? response.message
                : typeof response?.summary === 'string'
                    ? response.summary
                    : JSON.stringify(response);
            view.addAgentMessage('Agent', message);
            if (response?.insights_payload) {
                view.applyInsights(response.insights_payload, { markNew: true });
            }
        } catch (error) {
            console.warn('[GroupOverview] ai_agent_query failed', error);
            view.addAgentMessage('System', 'Agent unavailable. Check server logs.');
        } finally {
            view.setThinking(false);
        }
    }

    private async loadReviewer(): Promise<void> {
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
        await this.resolve(this.relevant_group_version.workflow_stage.roles),
        await this.resolve(this.relevant_group_version.workflow_stage.roles.users),
        this.assignable_reviewers = this.relevant_group_version.workflow_stage.roles.users;
    }
    // Functions
    private reloadUploadForms(): void {
        this.initializeUploadForms();
    }

    /**
     * Refreshes the events list and triggers an event to notify other listeners (e.g., cells in the matters list)
     */
    private refreshEventsAndNotify(): void {
        this.group_events_view?.refreshList();
        this.model.trigger('events:updated');
    }

    async refreshView(new_group_version?: GroupVersion.Model, new_workflow_stage?: WorkflowStage.Model): Promise<void> {
        this.workflow_stage_id = new_workflow_stage?.id
            ?? (new_group_version
                ? new_group_version.get('workflow_stage_id')
                : (await this.model.getActiveOrDraftVersion())?.get('workflow_stage_id')
            ) ?? null;
        try {
            await this.resolve(this.model, { force: true });
        } catch (error: unknown) {
            if (error instanceof Object && 'status' in error && error.status === 404) {
                console.logger.warn(`[${GroupOverview.name}] Group with id ${this.model.id} not found. User may not have access to this group.`);
            } else {
                console.logger.error(`[${GroupOverview.name}] Unknown error resolving model: ${error}`);
            }
            this.trigger('invalidate:group_collection');
            return this.closeOverlay();
        }

        if (!new_group_version) {
            this.relevant_group_version = await this.getLatestActiveGroupVersion();
            if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
        } else {
            this.relevant_group_version = new_group_version;
        }

        await this.loadRelevantDocument(); // when this screen gets opened right after generate contract, this is not yet resolved

        if (!new_workflow_stage) {
            this.workflow_stage = await this.resolve(this.relevant_group_version.workflow_stage, { force: true });
        } else {
            this.workflow_stage = new_workflow_stage;
        }

        if (this.groupNameController) {
            await this.groupNameController.updateWorkflow(this.model.workflow);
        } else {
            await this.initGroupNameController();
        }


        this.refreshGroupPermissions();
        this.refreshPreview();
        this.refreshActions();
        await Promise.all([
            this.refreshFields(),
            this.refreshTools(),
            this.refreshTimeline(),
        ]);
        this.refreshTopbar();
        this.refreshEventsAndNotify();
    }
    async getLatestActiveGroupVersion(): Promise<GroupVersion.Model | null> {
        try {
            await this.resolve(this.model, { force: true });
        } catch {
            this.trigger('invalidate:group_collection');
            return null;
        }
        return await this.model.getActiveVersion({ force: true });
    }
    async refreshCheckForAccess(): Promise<void> {
        this.relevant_group_version = await this.getLatestActiveGroupVersion();
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
    }
    refreshTopbar(): void {
        this.group_roles_handler?.refreshGroupRolesCollection({ force: true });
        this.collaborators_view?.refreshEditableState();
        this.watchers_view?.refreshEditableState();
    }
    refreshPreview(): void {
        this.loadPreview();
    }
    async refreshFields(): Promise<void> {
        if (!this.workflow_stage) return console.error('No workflow stage found');
        if (this.group_annotations_view instanceof GroupAnnotationFieldsBaseView) {
            if (this.workflow_stage) {
                this.group_annotations_view.setWorkflowStage(this.workflow_stage);
                this.group_annotations_view.refreshFields(!(await resolveLoadEventEmitterSource(this.group_permissions.can_edit_matter_tags)));
            } else {
                console.warn('Can not refresh workflow stage fields as workflow stage is undefined');
            }
        }
    }
    async refreshTools(): Promise<void> {
        for (const tools_view of this.tools_views) {
            tools_view.remove();
        }
        this.tools_views = [];
        await this.loadTools();
    }
    refreshActions(): void {
        let upload_preparing;
        if (this.group_overview_actions_view) {
            upload_preparing = this.group_overview_actions_view.getUploadPreparing();
            this.group_overview_actions_view.remove();
        }
        if (this.workflow_button) this.workflow_button.remove();
        this.actions_buttons_refresh_should_await_document_import_promise = new Promise((res) => {
            this.resolve_should_await_document_import_promise = res;
        });
        this.loadActions(upload_preparing);
    }
    async refreshTimeline(): Promise<void> {
        if (this.group_overview_tube_map) {
            this.group_overview_tube_map.remove();
            this.group_overview_tube_map = null;
        }
        await this.loadTimeline();
    }
    /**
     * The tube map only show versions with a unique name - e.g. the document has been versioned up
     * The functionality of this function was approved by the product team to resolve #356971
     */
    async calculateGroupVersionsToShow(): Promise<GroupVersion.Model[]> {
        await this.resolve(this.model.versions, { force: true });
        const all_group_versions = await this.model.versions.awaitGetResolvedModels();

        // Order by id descending to ensure the newest version is first
        const visible_group_versions = all_group_versions
            .filter(version => version.get('type') !== 'attachment' && version.get('state') !== 'deleted')
            .sort((a, b) => b.id - a.id);

        const group_versions_to_show: GroupVersion.Model[] = [];

        for (const group_version of visible_group_versions) {
            // skip if we've already seen this version
            if (group_versions_to_show.some(version => version.get('name') === group_version.get('name'))) continue;

            // skip if there is no document
            if (!group_version.get('document_id')) continue;

            group_versions_to_show.push(group_version);
        }

        // values are in opposite order
        group_versions_to_show.reverse();

        return group_versions_to_show;
    }
    private toggleContext(expand = !this.expanded_context): void {
        this.expanded_context = expand;
        this.$context_container.toggleClass('expanded', expand);
    }
    async deleteGroup(): Promise<void> {
        const confirm_delete = await createDialog.getConfirmation(this, {
            title: BaseView.getL10n('group-overview-view.delete_group.title'),
            text: BaseView.getL10n('group-overview-view.delete_group.dialog_text'),
            remove: true,
            button_text: 'Delete',
            resolve_on_cancel: true,
        });
        if (!confirm_delete) return;

        await this.confirmedDeleteGroup();
    }
    async confirmedDeleteGroup(): Promise<void> {
        await this.model.destroy({
            wait: true,
            success: () => {
                this.trigger('close');
                this.room.trigger('deleted:group');
            },
            error: () => {
                createDialog(this, {
                    type: 'error'
                });
            }
        });
    }
    async collectGroupInformation(files: Array<File>): Promise<GroupInformation | false | undefined> {
        const folder = await this.getFolder();
        if (!folder) return;

        return new Promise((resolve) => {
            const collect_group_information_modal = new ContractUploadView({
                folder,
                files,
                room: this.room,
                existing_contract: this.model,
                include_workflow_stage: true,
                skip_to_live_contracts: true
            });

            this.createModal(
                BaseView.getL10n('group-overview-view.upload_new_version'),
                collect_group_information_modal,
                {
                    close_events: ['close', 'submit'],
                    on_close(e: JQuery.EventBase | string, { contract_tags, amendments, target_folder }: GroupInformation = {}) {
                        const tags = { contract_tags, amendments, target_folder };
                        resolve(e === 'submit'
                            ? tags
                            : false
                        );
                    },
                }
            );
        });
    }
    handleUpload(files: Array<File>, folder: Folder.Model, drop = false, opts: { is_attachment: boolean } = { is_attachment: false }) {
        BaseView.catchErrors(async(files: Array<File>, folder?: Folder.Model, drop = false) => {
            if (!folder) folder = await this.getFolder();
            if (!folder) throw new Error('Unable to upload without a folder to upload into');

            const upload = await Utils.Uploads.begin.call(this, files, {
                drop: drop,
                target: folder,
                on_conflict: (conflicts: { name: string; path: string; }[]) => new Promise((resolve) => {
                    const message = BaseView.formatL10n('group-overview-view.conflict_message', conflicts.length);
                    const prompt = BaseView.formatL10n('group-overview-view.conflict_prompt', conflicts.length);
                    const details = [
                        BaseView.formatL10n('group-overview-view.replaced_files', conflicts.length),
                        ...conflicts.map(f => f.path),
                    ].join('\n');
                    new Dialog.Custom(this, {
                        width: 500,
                        title: BaseView.getL10n('group-overview-view.warning'),
                        contents: [message, prompt].map((text) => ({ type: 'text', value: text })),
                        details: details,
                        actions: [{
                            name: BaseView.getL10n('group-overview-view.skip'),
                            icon: 'share',
                            style: 'secondary',
                            handler: () => resolve('skip'),
                        }, {
                            name: BaseView.getL10n('group-overview-view.replace'),
                            icon: 'check',
                            style: 'primary',
                            handler: () => resolve('continue'),
                        }],
                        on_close: () => resolve('cancel'),
                    });
                })
            });
            if (upload) {
                const getUploadedDocuments = async () => {
                    const document_filter = this.model_factory.createModel('Filter', { 'upload_id': upload.id }, {
                        filtering: 'documents',
                        conditions: [],
                    });
                    this.keepUpdated(upload, 'change:id', () => document_filter.set('upload_id', upload.id));
                    // we can't use `upload.documents` because it filters hidden states
                    const docs = this.model_factory.createCollection('Document', [], { filter: document_filter, limit: 50});
                    await this.resolve(docs);
                    return docs;
                };
                this.listenToOnce(upload, 'upload:uploading', async () => {
                    folder.folders.invalidate();
                    folder.documents.invalidate();
                    this.room.trigger('is:uploading');
                    this.progress_workflow_events_bus.notify('ongoing', 'upload_file', upload.id);
                    this.progress_workflow_events_bus.notify('finished', 'preparing_upload_file');
                    this.group_overview_actions_view?.toggleUploadPreparing(false);
                });
                this.listenTo(upload, 'upload:complete', async () => { // Re-fetch models to refresh the page views on successful upload
                    await this.resolve(this.model, { force: true });
                    const should_await_document_import = await this.actions_buttons_refresh_should_await_document_import_promise;
                    if (should_await_document_import) await createAwaitDocumentImportModal(this.model, this);
                    if (opts.is_attachment && this.group_overview_related_view) this.model.attachments.invalidate();
                    const docs = await getUploadedDocuments();
                    if (files.length === docs.length){
                        // if attachments are not the same length as files some doc names have clashed
                        // this means we will have triggered the unchanged documents handling modal, which notifies the bus
                        this.progress_workflow_events_bus.notify('finished', 'upload_file', upload.id);
                        this.group_overview_actions_view?.toggleUploadPreparing(false);
                        this.refreshView();
                    }
                });
                this.listenTo(upload, 'upload:error', async () => {
                    this.progress_workflow_events_bus.notify('finished', 'upload_file', upload.id);
                    this.updateUploadPreparing(false);
                });
                this.listenTo(upload, 'upload:cancelled', async (msg: string) => {
                    if (msg === 'Documents unchanged' && opts.is_attachment) {
                        this.progress_workflow_events_bus.notify('finished', 'preparing_upload_file');
                        await this.handleUnchangedDocuments(files, folder, upload.id, opts.is_attachment);
                    }
                    this.progress_workflow_events_bus.notify('finished', 'upload_file', upload.id);
                    this.updateUploadPreparing(false);
                });
                this.listenTo(upload, 'upload:ignored-documents', async (ignoredDocuments) => {
                    if (opts.is_attachment){
                        await this.handleUnchangedDocuments(files.filter(file => ignoredDocuments.some((ignoredDocument: {name: string}) => ignoredDocument.name === file.name)), folder, upload.id, opts.is_attachment);
                    }
                });
            } else {
                this.updateUploadPreparing(false);
            }
        }, { get context() { return BaseView.getL10n('group-overview-view.upload_failed') } })(files, folder, drop);
    }
    async handleUnchangedDocuments(files: File[], target: Folder.Model, upload_id: number, is_attachment: boolean) {
        return handleUnchangedDocuments({
            view_context: this,
            files,
            target,
            upload_id,
            resolver: this.resolve.bind(this),
            checkAlreadyAttached: (existing_documents: Document.Model[]) => {
                const attachments_list_view = this.group_overview_related_view?.groupOverviewRelatedAttachmentsListView;
                if (!attachments_list_view) return false;

                return attachments_list_view.collection.some(gv =>
                    existing_documents.some(document => gv.get('document_id') === document.id)
                ) && existing_documents.length > 0;
            },
            onAttach: async (documents: Document.Collection) => {
                this.linkExistingDocuments(documents.models);
                this.group_overview_actions_view?.toggleUploadPreparing(false);
                this.refreshView();
            },
            onRename: async (renamed_files: File[]) => {
                this.group_overview_actions_view?.toggleUploadPreparing(true);
                this.progress_workflow_events_bus.notify('ongoing', 'preparing_upload_file');
                this.handleUpload(renamed_files, target, false, { is_attachment: is_attachment });
            },
            onFinish: async () => {
                this.progress_workflow_events_bus.notify('finished', 'upload_file', upload_id);
            }
        });
    }
    async linkExistingDocuments(documents: Document.Model[]) {
        if (documents.length > 0) {
            // Get the attachments list view to use its linkAttachment method
            const attachments_list_view = this.group_overview_related_view?.groupOverviewRelatedAttachmentsListView;
            if (attachments_list_view) {
                const attachments: GroupVersion.Model[] = [];
                for (const doc of documents) {
                    const state = doc.get('state');
                    if (state && ['deleted', 'upload_failure','upload_cancelled'].includes(state)) continue;
                    // Check if document is already attached to this group
                    const already_attached = attachments_list_view.collection.find(gv => gv.get('document_id') === doc.id);
                    if (already_attached) continue;
                    const attachment = await attachments_list_view.linkAttachment(doc.id);
                    if (attachment) attachments.push(attachment);
                }
                // Update the attachments collection to reflect the new attachments
                if (this.group_overview_related_view) {
                    this.model.attachments.invalidate();
                }
            }
        }
    }
    async getFolder(): Promise<Folder.Model | undefined> {
        if (!this.relevant_group_version) {
            this.noActiveOrExecutedGroupVersionErrorAndClose();
            return;
        }

        const document = await this.loadRelevantDocument();

        if (!document) {
            const folders = this.model_factory.createCollection('Folder', [], {
                parent: this.room,
                filter: this.model_factory.createModel('Filter', {
                    state: 'active',
                    parent_id: null,
                    field: ['id', 'parent_id', 'name']
                }, {
                    array_op: 'and'
                }),
                limit: 1,
            });
            await this.resolve(folders);
            return folders.at(0);
        } else {
            await this.resolve(document.folder);
            return document.folder;
        }
    }
    getFileExtension(type: string): string {
        switch (type) {
            case 'preview':
            case 'redacted-preview':
            case 'redacted': return'.pdf';
            case 'xlsx': return'.xlsx';
            case 'xlsm': return'.xlsm';
            default: return '';
        }
    }
    private async downloadDocument(): Promise<void> {
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
        if (!this.relevant_document) {
            console.error('Trying to download a document that does not exist or user does not have access to');
            return;
        }

        const loading_spinner = this.showLoadingSpinner(this.group_menu_overlay?.$el, { disabled: true });

        const document = this.relevant_document;

        //TODO: add more cases if doc can be excel
        const room_perm = this.room.get('permissions');
        let type;
        if (room_perm === 'native') {
            type = LUMINANCE.settings.enable_native_with_metadata_downloads ? 'soft' : 'data'; // pick soft over data
        } else if (room_perm) {
            type = this.room.get('permissions');
        }

        const cookie_name = _.uniqueId('CONTRACT_DOWNLOAD_');
        const url = document.dataDownloadUrl({
            download: cookie_name,
            type: type,
        });

        try {
            const blob = await Utils.Request.fetch.get(url, {}, { response_type: 'blob' });
            const file_extension = this.getFileExtension(type);
            const filename = document.get('name') + file_extension;
            this.downloadBlob(blob, filename);
            loading_spinner.hide();
        } catch (err) {
            console.warn(err);
            loading_spinner.hide();
        }
    }
    private async previewVersion(version = this.relevant_group_version): Promise<void> {
        if (!version || !(await version.getDocumentIfVisible())) return;

        this.trigger('open', {
            model: version.document,
            room: this.room,
        });
    }
    private async compareVersion(version: GroupVersion.Model): Promise<void> {
        if (!version || !this.relevant_group_version || !(await version.getDocumentIfVisible())) return;

        this.trigger('open', {
            model: version.document,
            room: this.room,
            opts: {
                context: {
                    document: this.relevant_document,
                }
            }
        });
    }
    /**
     * Disable the progress workflow buttons and the upload buttons between upload initiation and when upload completes / cancels / errors
     * @param {boolean} is_preparing
     */
    private updateUploadPreparing(is_preparing: boolean): void {
        this.group_overview_actions_view?.toggleUploadPreparing(is_preparing);
    }
    private noActiveOrExecutedGroupVersionErrorAndClose(): void {
        console.error('No active or executed group version found, closing the view');
        this.trigger('close');
        this.trigger('invalidate:group_collection');
    }

    // Events
    private onClickPreview(): void {
        this.previewVersion();
    }
    private async onClickGroupAnnotationsExtractButton(): Promise<void> {
        await this.model.extractGroupAnnotations();
        this.refreshFields();
    }
    private onClickBack(): void {
        return this.closeOverlay();
    }
    private closeOverlay(): void {
        this.trigger('close', { model: this.model });
    }
    private onClickReviewer(): void {
        if (!this.can_update_assignee || !this.assignable_reviewers || this.assignable_reviewers.fetching) return;

        this.$reviewer_name_value.text('');

        this.reviewers_filter_bar = new UsersFilterBar({
            collection: this.assignable_reviewers,
            alwaysShowSuggestions: true,
            inModalView: true,
            searchKey: false,
            empty_text: Utils.Strings.getL10n('group-overview-view.unassigned'),
            showEmpty: true,
            constructSuggestionsFn: (collection: User.Collection) => {
                const suggestions = _.compact(collection.map((sug) => { // _.compact removes undefined values from map
                    const key = sug.get('id');
                    const value = sug.get('name');
                    if (!key || !value) return;

                    return { key, value };
                }));
                return suggestions;
            },
        });
        this.reviewers_filter_bar.appendElTo(this.$reviewer_name_value).registerChildViewOf(this);
        this.reviewers_filter_bar.focus();

        this.listenTo(this.reviewers_filter_bar, 'user:selected', (user: Autocomplete.Suggestion) => this.handleNewReviewerSelection(user));
    }
    private async handleNewReviewerSelection(user: Autocomplete.Suggestion): Promise<void> {
        if (!this.relevant_group_version) return this.noActiveOrExecutedGroupVersionErrorAndClose();
        const spinner = this.showLoadingSpinner(this.$reviewer_name_value);

        const set_to_unassigned = `${user.id}` === 'null';
        const new_assignee_id = set_to_unassigned ? null : user.id;

        const user_may_lose_access = await this.group_permission_evaluator.userMayLoseAccessOnAssigneeChange({ resolver: this, new_assignee_id });

        if (user_may_lose_access) {
            const confirmation = await createDialog.getConfirmation(this, {
                title: BaseView.getL10n('group-overview-view.assignee_change_warning.title'),
                text: BaseView.getL10n('group-overview-view.assignee_change_warning.text'),
                resolve_on_cancel: true,
            });

            if (!confirmation) {
                spinner.hide();
                this.refreshTimeline();
                return;
            }
        }

        const reviewer_exists = user.id && !set_to_unassigned && user.isResolved();
        if (this.assigned_to?.id === user.id || (!this.assigned_to && set_to_unassigned)) {

            const reviewer_name = reviewer_exists
                ? user.get('value')
                : BaseView.getL10n('group-overview-view.unassigned');

            this.reviewers_filter_bar?.clearFocus();
            this.reviewers_filter_bar?.remove();
            this.$reviewer_name_value.text(reviewer_name);

            spinner.hide();
            return;
        }
        this.reviewers_filter_bar?.clearFocus();
        this.reviewers_filter_bar?.remove();

        await this.relevant_group_version.promisify(this.relevant_group_version.save)({
            assigned_to: new_assignee_id,
        });
        this.relevant_group_version.set('assigned_to', new_assignee_id);

        if (user_may_lose_access) {
            console.logger.info(`[${GroupOverview.name}] User may lose access to group after changing assignee. Refreshing view.`);
            spinner.hide();
            this.refreshView();
            return;
        }

        if (this.assignable_reviewers) {
            const reviewer = this.assignable_reviewers.models.find(assignable_reviewer => assignable_reviewer.id === user.id);
            this.assigned_to = reviewer_exists && reviewer
                ? reviewer
                : null;

            this.$reviewer_name_value.text(reviewer_exists
                ? user.get('value')
                : BaseView.getL10n('group-overview-view.unassigned')
            );
        } else {
            this.$reviewer_name_value.text(BaseView.getL10n('group-overview-view.error.loading_reviewer'));
        }

        await this.refreshGroupPermissions();
        this.refreshTopbar();
        this.trigger('invalidate:group_collection');
        this.refreshEventsAndNotify();

        spinner.hide();
    }
    private onKeyDownGroupName(e: JQuery.EventBase): void {
        if (e.originalEvent instanceof KeyboardEvent && e.originalEvent.isComposing) return;
        if (e.key === 'Enter') {
            this.$group_name.name_input.blur();
        }
    }
    private async onBlurGroupName(): Promise<void> {
        const spinner = this.showLoadingSpinner(this.$group_name.name_input);

        const old_name = this.model.get('name');
        const new_name = String(this.$group_name.name_input.val()).trim(); // make sure matter names are always trimmed

        if (old_name === new_name) {
            spinner.hide();
            return;
        }

        const validation_result = await this.room.validateGroupName(new_name);
        switch (validation_result?.valid) {
            case true:
                await this.model.promisify(this.model.save)({
                    name: new_name,
                }, {
                    wait: true,
                    success: () => {
                        this.model.set('name', new_name);
                        this.showGroupNameFromModel();
                        this.refreshEventsAndNotify();
                    },
                    error: () => {
                        createDialog(this, {
                            type: 'error'
                        });
                    }
                });
                this.model.set('name', new_name);
                this.$group_name.name_input.val(new_name);
                break;
            default:
                this.$group_name.name_input.val(this.model.get('name'));
        }

        spinner.hide();
    }
    private onClickExpandContext(expand = !this.expanded_context): void {
        this.expanded_context = expand;
        this.toggleContext(this.expanded_context);
    }
    private async onClickGroupMenuButton(e: JQuery.EventBase): Promise<void> {

        //Disable group menu if cannot do any action.
        if (
            !(await resolveLoadEventEmitterSource(this.group_permissions.can_delete))
            && !(await resolveLoadEventEmitterSource(this.group_permissions.can_download))
            && !(await resolveLoadEventEmitterSource(this.group_permissions.can_move_group))
        ) return;
        let menu_items: MenuItem[] = [];

        if (await resolveLoadEventEmitterSource(this.group_permissions.can_delete)) {
            menu_items = [
                {
                    name: BaseView.getL10n('group-overview-view.topbar.delete'),
                    icon: 'trash',
                    tag: 'button',
                    classes: ['tertiary', 'cancel'],
                    callback: () => { this.deleteGroup() },
                },
            ];
        }

        if (await resolveLoadEventEmitterSource(this.group_permissions.can_download)) menu_items.unshift({
            name: BaseView.getL10n('group-overview-view.topbar.download'),
            icon: 'download',
            tag: 'button',
            classes: ['tertiary'],
            callback: () => { this.downloadDocument() },
        });

        // Add "Move Matter" option based on permission
        if (await resolveLoadEventEmitterSource(this.group_permissions.can_move_group)) {
            menu_items.unshift({
                name: BaseView.getL10n('group-overview-view.topbar.move_matter'),
                icon: 'exchange',
                tag: 'button',
                classes: ['tertiary'],
                callback: () => { this.openMoveGroupModal() },
            });
        }

        if (this.group_menu_overlay) this.group_menu_overlay.remove();

        this.group_menu_overlay = new OverlayMenuView({
            items: menu_items,
        });
        this.group_menu_overlay.registerChildViewOf(this);
        this.group_menu_overlay.appearAtCursor(e);
    }

    /**
     * Opens a modal to move the group to another workflow stage
     */
    private async openMoveGroupModal(): Promise<void> {
        // Create the move stage view
        const moveStageView = new GroupOverviewMoveStageView({
            model: this.model,
            room: this.room,
        });

        // Create a modal with the move stage view
        const modal = this.createModal(
            BaseView.getL10n('group-overview-view.move_matter.title'),
            moveStageView,
            {
                close_events: ['close', 'cancel'],
            }
        );

        // Listen for save events
        this.listenTo(moveStageView, 'save', async ({
            stage,
            assignee
        }: {
            stage: WorkflowStage.Model,
            assignee: User.Model | null
        }) => {
            const spinner = this.showLoadingSpinner(modal.$el, { disable_view: true });

            try {
                // Call the API to move the group to a new stage using the model method
                await this.model.moveWorkflowStage(stage.id, assignee?.id);

                // Refresh the view after successful move
                if (stage.id !== this.workflow_stage_id) await this.refreshView();
                modal.trigger('close');
            } catch (error) {
                console.error('Failed to move group to new stage:', error);
                new Dialog(this, {
                    name: BaseView.getL10n('group-overview-view.move_matter.error.title'),
                    type: 'error',
                    text:  BaseView.getL10n('group-overview-view.move_matter.error.text'),
                });
            } finally {
                spinner.hide();
            }
        });
    }

    private async updateGroupName(workflow_stage_field: WorkflowStageFields.Model): Promise<void> {
        if (!this.groupNameController) return;

        const workflow_stage_field_resolved = await this.resolve(workflow_stage_field);
        const room_group_annotation_type_id = workflow_stage_field_resolved.get('room_group_annotation_type_id');
        await this.groupNameController.updateForChangedAnnotation(room_group_annotation_type_id);
    }
}
