'use strict';

const _ = require('lodash');

const Base = require('../models/base');
const Filter = require('../models/filter');
const User = require('../models/user');

const Utils = {
    Annotations: require('./annotations'),
    Documents: require('./documents'),
    Strings: require('./strings'),
    ThemesSummaries: require('./themes-summaries')
};
// In its infancy, corporate isn't set up as a room type currently. If you want to change COLUMN_PRESETS.corporate and see your changes, make a copy of
// COLUMN_PRESETS.review and use that instead (see line module.exports for context).
const COLUMN_PRESETS = Object.freeze({
    email: ['search_preview', 'email_subject', 'email_from', 'email_to', 'email_sent', 'custodian', 'notes', { 'generic-*': 5 }],
    file: ['document_type', 'language', 'media_type', 'metadata_page_count', 'metadata_created', 'metadata_updated', 'file_uploaded', 'file_uploaded_by'],
    review: ['import_status', 'irregularity', 'search_preview', 'notes', 'progress', { 'fragment-clause-*': 10 }, { 'entity-*': 5 }],
    corporate: ['search_preview', 'contract_status', 'entity-party', 'entity-datetime-contract-effective', 'entity-datetime-contract-terminate', 'entity-law', 'entity-timeperiod-contract-term', 'fragment-clause-term', 'fragment-clause-assignment', 'fragment-clause-termination', 'fragment-clause-indemnification', 'fragment-clause-confidentiality', 'fragment-clause-limitation-of-liability', 'fragment-clause-payment'],
});
const AVAILABLE_FILTER_COLUMN_MAPPING = Object.freeze({
    'source:referenceid': 'source_reference',
    'source:signed': 'source_signed',
    'alias': 'alias',
    'contracttype': 'contract_type',
    'documenttype': 'document_type',
    'language': 'language',
    'title': 'title',
    'pagecount': 'metadata_page_count',
    'document:custodian': 'custodian',
    'document:duplicationfamily': 'duplicates',
    'document:family': 'family',
    'emailaddress': 'email_address',
    'redacted': 'redacted',
});
// List of annotations that should not highlight relevant columns
const RELEVANT_COLUMNS_BY_FILTER_BLACKLIST = Object.freeze([
    'generic:text', // generic text annotation is rarely being used
]);
const SORT_FILTER_GROUPING = Filter.Groups.reserve(1); // grouping to avoid sort groups clashing with document working set filter
const GROUPBY_FILTER_GROUPING = Filter.Groups.reserve(1); // grouping to avoid groups clashing with document working set filter
// TODO Localise the below column config names
const COLUMNS = Object.freeze([
    {
        key: 'select',
        scrollable: false,
        static: true,
        hidden: false,
        selection_cell: true,
    },
    {
        key: 'index',
        name: '',
        scrollable: false,
        static: true
    },
    {
        key: 'icon',
        name: '',
        className: 'icon-attachment',
        scrollable: false,
        static: true
    },
    {
        key: 'download',
        name: '',
        hidden: true,
        visible: false,
        scrollable: false,
        static: true,
        availability: {
            room_whitelist: ['discovery'],
        }
    },
    {
        key: 'name',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        scrollable: false,
        resizable: true,
        sort: 'natural:name',
        static: true
    },
    {
        key: 'document_family_summary',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        scrollable: false,
        resizable: false,
        availability: {
            ui_config: 'document_family_summary_enabled', // [CONFIG] {boolean} ui.document_family_summary_enabled when true, add Document Family Summary tag to insight column list
        }
    },
    {
        key: 'amendments',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        resizable: false,
        availability: {
            feature: 'corporate_amendments' // [FEATURE] corporate_amendments: enables the 'Amendments' insight details column
        },
    },
    {
        key: 'search-relevance',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        scrollable: false,
        resizable: true,
        static: true,
        visible: false,
    },
    {
        key: 'document_id',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: 'id',
        resizable: true,
    },
    {
        key: 'source_reference',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.reference_id`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.reference_id`,
        resizable: true,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'source:referenceid',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'source:referenceid',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sort_dir: 'asc',
        annotations: {
            type: 'source:referenceid'
        }
    },
    {
        key: 'source_signed',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.reference_id`, // TODO
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.reference_id`,
        resizable: true,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'source:signed',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'source:signed',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sort_dir: 'asc',
        annotations: {
            type: 'source:signed'
        }
    },
    {
        key: 'alias',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.alias`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.alias`,
        resizable: true,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'alias',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'alias',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'alias'
        }
    },
    {
        key: 'import_status',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: false,
        sort: 'state'
    },
    {
        key: 'contract_type',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.lower:content.type`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.lower:content.type`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'contracttype',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'contracttype',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'contracttype'
        },
        availability: {
            room_whitelist: ['diligence', 'property', 'corporate'],
            room_filter_fn: function(room) {
                return room.shouldShowContracttypes();
            }
        }
    },
    {
        key: 'contract_name',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: 'group_version.group.name',
        availability: {
            ui_config: 'contract_tags_enabled', // [CONFIG] {boolean} ui.contract_tags_enabled when true, add Contract Name tag to insight column list
        }
    },
    {
        key: 'contract_version',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: 'group_version.name',
        availability: {
            ui_config: 'contract_tags_enabled', // [CONFIG] {boolean} ui.contract_tags_enabled when true, add Contract Version tag to insight column list
        }
    },
    {
        key: 'contract_status',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: false,
        availability: {
            ui_config: 'contract_status_enabled', // [CONFIG] {boolean} ui.contract_status_enabled when true, add Contract Status column to insight column list
        }
    },
    {
        key: 'document_type',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.lower:content.type`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.lower:content.type`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'documenttype',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'documenttype',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'documenttype'
        },
        availability: {
            room_whitelist: ['diligence', 'property', 'corporate']
        }
    },
    {
        key: 'language',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.language`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.language`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'language',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'language',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'language'
        }
    },
    {
        key: 'ai_validated',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        availability: {
            ui_config: 'document_preview_tagging_validation_enabled',
        },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.value`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.value`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'ai:validated',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active',
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'ai:validated',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active',
        },
        annotations: {
            type: 'ai:validated',
        }
    },
    {
        key: 'title',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.title`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.title`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'title',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'title',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'title'
        },
        availability: {
            room_whitelist: ['diligence', 'property', 'corporate']
        }
    },
    {
        key: 'document_version',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        details: false,
        resizable: false,
        sort: 'version',
        availability: {
            feature: 'versioning', // [FEATURE] versioning: enables the 'Version' insight details column
        }
    },
    {
        key: 'media_type',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: 'media_type'
    },
    {
        key: 'metadata_page_count',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.pagecount`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.pagecount`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'pagecount',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'pagecount',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sort_null_order_map: {
            asc: 'nulls_last',
            desc: 'nulls_last'
        },
        annotations: {
            type: 'pagecount'
        }
    },
    {
        key: 'metadata_created',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.timestamp`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.timestamp`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'file:created',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'file:created',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'entity:datetime',
            role: 'file:created'
        }
    },
    {
        key: 'metadata_updated',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.timestamp`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.timestamp`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'file:updated',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'file:updated',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'entity:datetime',
            role: 'file:updated'
        }
    },
    {
        key: 'file_uploaded',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: 'created_at'
    },
    {
        key: 'file_uploaded_by',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: 'uploaded_by',
        resizable: true
    },
    {
        key: 'attachments',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'irregularity',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        sort: 'risk_score',
        sort_dir: 'desc',
        availability: {
            feature: 'anomalies', // [FEATURE] anomalies: enables the 'Anomalies' insight details column
        }
    },
    {
        key: 'notes',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        detailed: true,
        sort_options: [
            {
                key: 'note-count',
                sort: `count:issue:${SORT_FILTER_GROUPING}.id`,
                sort_dir: 'desc',
                display_text: 'Note Count',
            },
            {
                key: 'severity',
                sort: `issue:${SORT_FILTER_GROUPING}.severity`,
                sort_dir: 'desc',
                display_text: 'Note Severity',
                sort_value_aggregator_map: {
                    asc: 'min',
                    desc: 'max'
                },
            },
            {
                key: 'created_at',
                sort: `issue:${SORT_FILTER_GROUPING}.created_at`,
                sort_dir: 'desc',
                display_text: 'Created At',
                sort_value_aggregator_map: {
                    asc: 'min',
                    desc: 'max'
                },
                sort_null_order_map: {
                    asc: 'nulls_last',
                    desc: 'nulls_last'
                },
            },
        ],
        sort_options_availability: {
            ui_config: 'multi_sort_notes_enabled' // [CONFIG] {boolean} ui.multi_sort_notes_enabled: if true, give multiple options for the notes column on insight details to be sorted by
        }
    },
    {
        key: 'progress',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true
    },
    {
        key: 'tasks',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true
    },
    {
        key: 'redlines',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        sort: `count:edit:${SORT_FILTER_GROUPING}.id`,
        sort_dir: 'desc',
        availability: {
            feature: 'redlines', // [FEATURE] redlines: enables the 'Redlines' insight details column
        }
    },
    {
        key: 'folder',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `folder:${SORT_FILTER_GROUPING}.full_path`,
        group_by: `folder:${GROUPBY_FILTER_GROUPING}.full_path`,
    },
    {
        key: 'ask_lumi',
        get name() { return  Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        availability: {
            ui_config: 'saved_searches_with_ask_lumi.document_list_view_table_ask_lumi_enabled'
        }
    },
    {
        key: 'search_preview',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true
    },
    {
        key: 'sources',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true
    },
    {
        key: 'custodian',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.custodian`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.custodian`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: null,
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: null,
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            'type': 'document:custodian'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'deduplicate_custodian',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        availability: {
            room_whitelist: ['discovery']
        },
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.custodian`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.custodian`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: ['deduplicate'],
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: ['deduplicate'],
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            'type': 'document:custodian',
            'role': 'deduplicate'
        }
    },
    {
        key: 'chaindeduplicate_custodian',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.custodian`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.custodian`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: ['chaindeduplicate'],
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'document:custodian',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: ['chaindeduplicate'],
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            'type': 'document:custodian',
            'role': 'chaindeduplicate'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'duplicates',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        sort: `count:annotation:${SORT_FILTER_GROUPING}.id`,
        group_by: `count:annotation:${GROUPBY_FILTER_GROUPING}.id`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'document:duplicationfamily',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'document:duplicationfamily',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sort_dir: 'desc',
        annotations: {
            type: 'document:duplicationfamily'
        },
        availability: {
            feature: 'deduplication'
        }
    },
    {
        key: 'family',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `natural:annotation:${SORT_FILTER_GROUPING}.content.family`,
        group_by: `natural:annotation:${GROUPBY_FILTER_GROUPING}.content.family`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'document:family',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'document:family',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'document:family'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_subject',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.title`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.title`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'title',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:subject',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'title',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:subject',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'entity',
        annotations: {
            'type': 'title',
            'role': 'email:subject'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_address',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.emailaddress`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.emailaddress`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'emailaddress',
        annotations: {
            type: 'emailaddress'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_from',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.emailaddress`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.emailaddress`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:from',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:from',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'emailaddress',
        annotations: {
            'type': 'emailaddress',
            'role': 'email:from'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_to',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.emailaddress`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.emailaddress`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:to',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:to',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'emailaddress',
        annotations: {
            'type': 'emailaddress',
            'role': 'email:to'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_sent',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.timestamp`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.timestamp`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:sent',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:sent',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'entity:datetime',
        annotations: {
            'type': 'entity:datetime',
            'role': 'email:sent'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_received',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        sort: `annotation:${SORT_FILTER_GROUPING}.content.timestamp`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.timestamp`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:received',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'entity:datetime',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:received',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'entity:datetime',
        annotations: {
            'type': 'entity:datetime',
            'role': 'email:received'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_cc',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.emailaddress`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.emailaddress`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:cc',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:cc',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'emailaddress',
        annotations: {
            'type': 'emailaddress',
            'role': 'email:cc'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'email_bcc',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.emailaddress`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.emailaddress`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'email:bcc',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'emailaddress',
            [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'email:bcc',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        sortKey: 'emailaddress',
        annotations: {
            'type': 'emailaddress',
            'role': 'email:bcc'
        },
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'productions',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        resizable: true,
        availability: {
            room_whitelist: ['discovery']
        }
    },
    {
        key: 'redacted',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        details: false,
        resizable: false,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.redacted`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.redacted`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'redacted'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'redacted'
        },
        annotations: {
            type: 'redacted'
        }
    },
    {
        key: 'related_documents',
        get name() { return Utils.Strings.getL10n(`document-list-view-table.columns.${this.key}`) },
        detailed: true,
        resizable: false,
        availability: {
            feature: 'related_documents' // [FEATURE] related_documents: enables the 'Related Documents' insight details column
        },
    },
]);

/**
 * getAvailableColumnsForRoom - async function that gives back an array of column configs
 *
 * @param  {import('../models/room').Model} room the room model
 * @param  {Object} user_settings user settings
 * @param  {Object} opts collection of annotation types enabled in the room
 * @param  {import('../models/annotation_type').Collection} opts.enabled_annotation_types
 * @param  {import('../models/group_annotation').Collection} opts.enabled_group_annotation_types
 * @param  {import('../models/ticket_annotation').Collection} opts.enabled_ticket_annotation_types
 * @return available column configs
 */
async function getAvailableColumnsForRoom(
    room,
    user_settings,
    {
        enabled_annotation_types,
        enabled_group_annotation_types,
        enabled_ticket_annotation_types,
    },
) {
    await Promise.all([
        room.resolve(enabled_annotation_types),
        room.resolve(enabled_group_annotation_types),
        room.resolve(enabled_ticket_annotation_types),
    ]);
    /** @type {typeof COLUMNS} */
    const all_columns = _.cloneDeep(COLUMNS)
        // if any key is a function, evaluate it for the given room (ie. what the column does depends on what room it's used in)
        .map(column => _.mapValues(column, (val/* , key */) => {
            return _.isFunction(val) ? val(room, user_settings, enabled_annotation_types) : val;
        }));

    // keep track of column keys so we can check for key before adding
    // this will allow us to override the configs for entities or annotation_types
    const col_keys = [];

    // loop through all of the hard
    let columns = _.filter(all_columns, function(col) {
        // if there's a requirement for when to show, check these
        if (col.availability) {
            const room_whitelist = col.availability.room_whitelist;
            if (room_whitelist && !_.includes(room_whitelist, room.get('type'))) {
                return false;
            }

            const room_filter_fn  = col.availability.room_filter_fn;
            if (room_filter_fn && !room_filter_fn(room))
                return false;

            const config = col.availability.ui_config;
            if (config && !_.get(user_settings.global, config)) {
                return false;
            }

            const feature = col.availability.feature;
            if (feature && !room.hasFeature(feature)) {
                return false;
            }
        }

        col_keys.push(col.key);

        return true;
    });

    // get a list of entity types from the schema
    /** @type {string[]} */
    let available_entities = [];
    if (room?.hasFeature('userentities')) { // [FEATURE] userentities: add generic entity column for each type on insight
        available_entities = Utils.Annotations.getAvailableEntities();
    }
    const feature_enabled_types = { //see COLUMNS for declaration
        'entity:signature': 'signatures', // [FEATURE] signatures: enables insight column for entity:signature
    };

    const entity_columns = [];

    // add a column for each entity
    _.forEach(available_entities, function(entity_type) {
        if (feature_enabled_types[entity_type] && !room?.hasFeature(feature_enabled_types[entity_type])) return;
        const col_key = entity_type.replace(':', '-');
        if (!_.includes(col_keys, col_key)) {
            col_keys.push(col_key);
            entity_columns.push({
                key: col_key,
                name: Utils.Strings.pretty(entity_type, 'annotation_type'),
                resizable: true,
                sort: `annotation:${SORT_FILTER_GROUPING}.content.` + Utils.Annotations.valueFieldForSort({ type: entity_type }),
                group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.` + Utils.Annotations.valueField({ type: entity_type }),
                sort_restrictions: {
                    [`annotation:${SORT_FILTER_GROUPING}.type`]: entity_type,
                    [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active',
                },
                group_by_restrictions: {
                    [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: entity_type,
                    [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active',
                    [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: null,
                },
                sort_null_order_map: {
                    asc: 'nulls_last',
                    desc: 'nulls_last'
                },
                sort_value_aggregator_map: {
                    asc: 'min',
                    desc: 'max'
                },
                sortKey: entity_type,
                annotations: {
                    type: entity_type
                }
            });
        }
    });

    if (room.hasFeature('userentities')) entity_columns.push({
        key: 'entity-money-currency',
        name: Utils.Strings.getL10n('document-list-view.columns.value_currencies'),
        details: false,
        resizable: true,
        sort: `annotation:${SORT_FILTER_GROUPING}.content.currency`,
        group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.currency`,
        sort_restrictions: {
            [`annotation:${SORT_FILTER_GROUPING}.type`]: 'entity:money',
            [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
        },
        group_by_restrictions: {
            [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'entity:money',
            [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
        },
        annotations: {
            type: 'entity:money'
        },
        availability: {
            feature: 'userentities' // [FEATURE] userentities: enables the 'Value Currencies' insight details column
        }
    });

    _.sortBy(entity_columns, col => col.name).forEach(col => columns.push(col));

    // clone the model for the properties, but we're going to change the models inside
    const sorted_enabled_annotation_types = enabled_annotation_types.clone();

    const group_annotation_types_to_add = enabled_group_annotation_types.filterFn(
        (ann_type) => {
            if (['templated:identifier'].includes(ann_type.get('type'))) {
                return true;
            }

            return false;
        }
    );

    const ticket_annotation_types_to_add = enabled_ticket_annotation_types.filterFn(
        () => {
            return false;
        }
    );

    sorted_enabled_annotation_types.set([
        ...enabled_annotation_types.models,
        ...group_annotation_types_to_add,
        ...ticket_annotation_types_to_add,
    ]);

    sorted_enabled_annotation_types.comparator = function(a, b) {
        const key_a = Utils.Strings.naturalSortKey(a.prettyKey());
        const key_b = Utils.Strings.naturalSortKey(b.prettyKey());

        return key_a < key_b ? -1 : (key_a > key_b ? 1 : 0);
    };
    sorted_enabled_annotation_types.sort();
    const enabled_clauses = [];

    // go through all annotation_types enabled in the room and add columns for them
    sorted_enabled_annotation_types.each(function(annotation_type) {
        if (!annotation_type || !_.isFunction(annotation_type.get)) return;
        if (_.includes(['documenttype', 'contracttype'], annotation_type.get('type')) || annotation_type.get('system')) return;

        const type = annotation_type.get('type');
        if (!_.isString(type) || !type || type === 'constructor') return;
        const key = annotation_type.get('key');
        if (!_.isString(key) || !key) return;
        const id = annotation_type.id;

        let col_details;

        if (type === 'fragment:clause') {
            enabled_clauses.push(annotation_type);
            col_details = {
                key: 'fragment-clause-' + key.toLowerCase(),
                detailed: true,
                sort: `count:annotation:${SORT_FILTER_GROUPING}.id`,
                group_by: `count:annotation:${GROUPBY_FILTER_GROUPING}.id`,
                sort_restrictions: {
                    [`annotation:${SORT_FILTER_GROUPING}.type`]: 'fragment:clause',
                    [`annotation:${SORT_FILTER_GROUPING}.content.type`]: 'i:' + key,
                    [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
                },
                group_by_restrictions: {
                    [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: 'fragment:clause',
                    [`annotation:${GROUPBY_FILTER_GROUPING}.content.type`]: 'i:' + key,
                    [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
                },
                resizable: true,
                sort_dir: 'desc',
                sortKey: 'fragment:clause',
            };
        }
        else if (type.startsWith('generic:') || type.startsWith('entity') || ['folder'].includes(type) || type === 'emailaddress') {
            col_details = {
                key: type.replace(':', '-') + '-' + key.replace(':', '-'),
                detailed: false,
                sort: `annotation:${SORT_FILTER_GROUPING}.content.` + Utils.Annotations.valueFieldForSort({ type: type }),
                group_by: `annotation:${GROUPBY_FILTER_GROUPING}.content.` + Utils.Annotations.valueField({ type: type }),
                sort_restrictions: {
                    [`annotation:${SORT_FILTER_GROUPING}.type`]: type,
                    [`annotation:${SORT_FILTER_GROUPING}.roles`]: 'i:' + key,
                    [`annotation:${SORT_FILTER_GROUPING}.state`]: 'active'
                },
                group_by_restrictions: {
                    [`annotation:${GROUPBY_FILTER_GROUPING}.type`]: type,
                    [`annotation:${GROUPBY_FILTER_GROUPING}.roles`]: 'i:' + key,
                    [`annotation:${GROUPBY_FILTER_GROUPING}.state`]: 'active'
                },
                sort_null_order_map: {
                    asc: 'nulls_last',
                    desc: 'nulls_last'
                },
                sort_value_aggregator_map: {
                    asc: 'min',
                    desc: 'max'
                },
                sort_dir: 'asc',
                sortKey: type,
                visible: false,
                hidden: false,
                resizable: true,
                annotations: {
                    type: type,
                    role: key
                },
            };
        } else if (type === 'templated:identifier') {
            col_details = {
                key: 'templated-identifiers-' + key.toLowerCase(),
                detailed: false,
                resizable: false,
                availability: {
                    ui_config: 'identifier_filters',
                },
                sortKey: 'templated:identifier',
                annotations: {
                    group: true,
                    annotation_type_id: id,
                }
            };
        }
        else {
            // Skip unknown/unsupported types silently to avoid noisy logs for malformed data.
            return;
        }

        if (col_details && !_.includes(col_keys, col_details.key)) {
            // annotation_type.prettyKey tries 1) dictionary -> 2) `name` from `annotation_types` table -> 3) old prettify function
            col_details.name = annotation_type.prettyKey();
            col_keys.push(col_details.key);
            columns.push(col_details);
        }
    });

    if (
        !!LUMINANCE.settings.themes?.app?.document?.themes_summaries?.enabled &&
        !!LUMINANCE.settings.themes?.app?.document?.themes_summaries?.list_view_enabled
    ) {
        for (const enabled_clause of enabled_clauses) {
            const clause_key = enabled_clause.get('key');
            if (Utils.ThemesSummaries.THEMES_TO_EXCLUDE.includes(clause_key)) continue;
            const col_details = {
                key: 'theme-' + clause_key,
                detailed: true,
                get name() {
                    const name = enabled_clause?.prettyKey() || clause_key;
                    const name_with_summary = name + ' ' + Utils.Strings.getL10n('document-list-view-table.summary');
                    return name_with_summary;
                },
                className: 'theme-summary-cell',
                sortKey: 'insight',
            };
            columns.push(col_details);
        }
    }

    return columns;
}

/**
 * Creates a single filter to perform bulk actions on, combines `document_working_set's` filter and selected_models.
 * This does not consider `document_working_sets`s filter_cb function, so must reapply functionality which is dependent
 * on that. Currently we recall `Utils.Documents.wrapFilter()`.
 * @param {object} opts
 * @param {import('../models/document').Collection} opts.document_working_set
 * @param {import('../models/document').Collection} opts.selected_models
 * @param {boolean} [opts.include_families=false] whether or not to also pass the filter through `Filter.generateFamilyParentFilter`
 * @param {boolean} [opts.import_complete=false] whether or not to put the filter in the conditions of another filter filtering to import_state = complete
 * @param {boolean} [opts.hide_groups=false] whether or not to set hide_groups flag to Utils.Documents.wrapFilter
 * @param {boolean} [opts.filter_to_not_inactive_group_versions=false] whether or not to set filter_to_not_inactive_group_versions flag to Utils.Documents.wrapFilter
 * @param {boolean} [opts.remove_unserializable=true] whether or not to remove any filters that can't be desierialized
 * @returns {Filter}
 */
function getBulkDocumentActionFilter({
    document_working_set,
    selected_models,
    include_families = false,
    import_complete = false,
    hide_groups = false,
    filter_to_not_inactive_group_versions = false,
    remove_unserializable = true,
}) {
    const is_manually_selecting = !!(selected_models && selected_models.selecting && selected_models.length >= 1);
    const applied_filter = Utils.Documents.wrapFilter(document_working_set.filter, {
        hide_groups,
        filter_to_not_inactive_group_versions,
    }).clone( );

    /**
     * remove_unserializable: true
     * Checking if the applied filters contain any unserializable filters
     * If they do, then remove the unserializable filters,
     * and, if they contain any document id filters in their conditions, then create a new filter for these document ids
     */
    if (remove_unserializable) {
        const filters_to_remove = [];
        for (const filter of applied_filter.conditions.models) {
            if (!filter.unserializable) continue;
            filters_to_remove.push(filter);
        }

        applied_filter.conditions.remove(filters_to_remove);
    }

    let filter;
    if (is_manually_selecting) {
        const is_inverted_selection = !!selected_models.select_all;
        const selected = selected_models.models;
        let ids_to_filter = selected_models.models;
        if (is_inverted_selection) {
            // on insight/list, if 'select_all', we start contextMembers off unticked
            // this means they'll be 'selected_models' but since they don't match the applied
            // filter, we don't need to filter them out.
            const contextMembers = document_working_set.contextMembers && document_working_set.contextMembers.models || []; // docs that don't match the filter but are shown
            ids_to_filter = _.difference(selected_models.models, contextMembers); // ignore any selected_models that are contextMembers
        }

        const id = is_inverted_selection
            ? ids_to_filter.map(doc => `!:${doc.id}`)
            : ids_to_filter.map(doc => doc.id);
        const id_filter = new Filter({ id }, {
            array_op: is_inverted_selection ? 'and' : 'or',
            filtering: 'documents',
            conditions: is_inverted_selection ? [] : [ Utils.Documents.hiddenStatesFilter ], // applied filter will apply the hiddenStatesFilter
        });

        // if you've selected documents manually, we don't want to apply the original
        // document working set filter (as you might manually select some documents
        // outside of that set), see 18784
        filter = is_inverted_selection ? new Filter({ }, {
            filtering: 'documents',
            operation: 'and',
            conditions: [
                new Filter({ }, {
                    filtering: 'documents',
                    operation: 'or',
                    conditions: [
                        // get docs that are ticked in the UI
                        new Filter({
                            //! this relies on the selected_models being a sub set of document_working_set.models
                            id: _.difference(document_working_set.map(doc => doc.id), selected.map(doc => doc.id)),
                        }, {
                            array_op: 'or',
                            filtering: 'documents',
                        }),
                        // and OR it with the applied filter minus the docs that have been unselected
                        new Filter({ }, {
                            filtering: 'documents',
                            operation: 'and',
                            conditions: [
                                id_filter,
                                applied_filter,
                            ],
                        }),
                    ],
                })
            ],
        }) : id_filter;
    }
    else filter = applied_filter;

    // Filter for only import_complete docs
    filter = import_complete ? new Filter({ }, {
        filtering: 'documents',
        operation: 'and',
        conditions: [
            new Filter({ }, {
                filtering: 'documents',
                operation: 'and',
                conditions: [
                    new Filter({
                        state: 'import_complete',
                    }, {
                        filtering: 'documents',
                        operation: 'and',
                    }),
                    filter
                ],
            })
        ],
    }) : filter;

    return include_families ? Filter.generateFamilyParentFilter(filter) : filter;
}
/**
 * should be the same as the steps for calculating the key in getAvailableColumnsForRoom
 * for annotations
 * @param {string} annotation_type
 * @returns
 */
function getColumnForFilter(annotation_type) {
    if (AVAILABLE_FILTER_COLUMN_MAPPING[annotation_type]) return AVAILABLE_FILTER_COLUMN_MAPPING[annotation_type];
    if (RELEVANT_COLUMNS_BY_FILTER_BLACKLIST.includes(annotation_type)) return null;
    return annotation_type.startsWith('generic:') || annotation_type.startsWith('entity') || ['folder'].includes(annotation_type) || annotation_type === 'emailaddress' ?
        annotation_type.replace(':', '-') : annotation_type;
}
/**
 * De-nest the filter keeping track of the `filtering` and `attributes` of the filter
 * Some insight columns don't work well if you fully de-nest them.
 * For those cases, detect the relevant column name return that in the `column` property
 * @param {Filter} filter
 * @param {{string: COLUMNS[number]}[]} annotation_type_to_column_key_mapping
 * @returns
 */
function getCollapsedFilterInfo(filter, annotation_type_to_column_key_mapping) {
    /** @type {{filtering: string, attributes: any, column: string | null}[]} */
    let collapsed_filter_info = [];
    let filtering = filter.filtering;
    if (filter.serialization_data?.key === 'serialized:contract:status') {
        collapsed_filter_info.push({ filtering, attributes: filter.attributes, column: 'contract_status' });
    }
    if (filter.conditions?.length) {
        // if there is an annotation type without a role
        // show the corresponding column for the type
        // if there is a role, we will show the column for that role instead
        const children = filter.conditions;
        const child = children.find(child => child.get('type') in annotation_type_to_column_key_mapping);
        const has_role = !!children.models.find( child => child.get('roles') && child.get('roles') !== '*' );
        const is_and = filter.operation === 'and';
        if (!!child && !has_role && is_and)
            return [...collapsed_filter_info, {filtering, attributes: filter.attributes, column: annotation_type_to_column_key_mapping[child.get('type')] }];
    }
    if (filter.filtering) collapsed_filter_info.push({
        filtering,
        attributes: filter.attributes,
        column: null,
    });
    if (filter.conditions?.length) {
        const children_collapsed_info =  filter.conditions.models.map(filter => getCollapsedFilterInfo(filter, annotation_type_to_column_key_mapping));
        children_collapsed_info.forEach(child_info => collapsed_filter_info = [...collapsed_filter_info, ...child_info]);
    }
    return collapsed_filter_info;
}

/**
 * @param {Awaited<ReturnType<typeof getAvailableColumnsForRoom>>} available_columns
 * @param {boolean} group_annotation_filtering_enabled
 * @param {object} opts
 * @param {string} opts.filtering
 * @param {object} opts.attributes
 */
function getColumnFromFilterInfo(available_columns, group_annotation_filtering_enabled, {filtering, attributes}) {

    const findNonClauseColumnKey = () => {
        if (Object.keys(AVAILABLE_FILTER_COLUMN_MAPPING).includes(attributes.type))
            return AVAILABLE_FILTER_COLUMN_MAPPING[attributes.type];
        if (!attributes.roles) return null;
        const key = attributes.roles.startsWith('i:') ? attributes.roles.slice(2) : attributes.roles;
        const column = available_columns.find(({ annotations }) =>
            decodeURIComponent(annotations?.role) === decodeURIComponent(key)
        );
        return column?.key ?? null;
    };

    const findClauseColumnKey = () => {
        if (!attributes['content.type']) return null;
        const content_type = attributes['content.type'].startsWith('i:')
            ? attributes['content.type'].slice(2).toLowerCase()
            : attributes['content.type'].toLowerCase();
        const key = `fragment-clause-${content_type}`;
        const column = available_columns.find(({ sortKey, key: _key }) =>
            sortKey === 'fragment:clause'
            && decodeURIComponent(_key) === decodeURIComponent(key)
        );
        return column?.key ?? null;
    };

    switch (filtering) {
        case 'annotations': {
            // when group_annotation_filtering_enabled = false, search for both clause annotations and common annotations
            // when filter is filtering 'annotations'
            if (!group_annotation_filtering_enabled) {
                const common_annotation_key = findNonClauseColumnKey();
                if (common_annotation_key) return common_annotation_key;
            }
            return findClauseColumnKey();
        }
        case 'common_annotations': {
            return findNonClauseColumnKey();
        }
        case 'amendments':
        case 'amendment_originals':
            return 'amendments';
        case 'issues':
            return 'notes';
        case 'risks':
            return 'irregularity';
        case 'redactions':
            return 'redactions';
        case 'reviews': {
            if (attributes.review_state && attributes.review_state !== '*')
                return 'progress';
            return 'tasks';
        }
        case 'documents': {
            if (attributes.content) return 'search_preview';
            if (attributes.state) return 'import_status';
            if (attributes.media_type) return 'media_type';
            if (attributes['related_document.id']) return 'related_documents';
            if (attributes['created_at']) return 'file_uploaded';
            if (attributes['created_by']) return 'file_uploaded_by';
            return null;
        }
        default:
            return null;
    }
}
async function getRelevantInsightColumnsFromFilter({
    room,
    filter,
    group_annotation_filtering_enabled,
    view_context,
}) {
    await room.resolve([
        room.visible_annotation_types,
        room.group_annotation_types,
        room.ticket_annotation_types
    ]);
    const user_settings = User.me.settings;
    const available_columns = await getAvailableColumnsForRoom(
        room,
        user_settings,
        {
            enabled_annotation_types: room.visible_annotation_types,
            enabled_group_annotation_types: room.group_annotation_types,
            enabled_ticket_annotation_types: room.ticket_annotation_types,
        }
    );
    const filtered_columns = available_columns.filter(col => col.annotations?.type);
    const column_types = filtered_columns.map(col => col.annotations?.type).filter(col => col !== undefined);
    const deduped_column_types = [...new Set(column_types)];
    const annotation_type_to_column_key_mapping = Object.fromEntries(
        deduped_column_types.map(type => [type, getColumnForFilter(type)])
    );
    filter = filter.deepClone();
    await filter.denest(
        [],
        {
            view_context,
        }
    );
    const collapsed_filter = getCollapsedFilterInfo(filter, annotation_type_to_column_key_mapping);
    const relevant_columns = [];
    collapsed_filter.forEach(({filtering, attributes, column}) => {
        if (column) relevant_columns.push(column);
        else {
            const column_from_filter_info = getColumnFromFilterInfo(
                available_columns,
                group_annotation_filtering_enabled,
                {
                    filtering,
                    attributes
                },
            );
            relevant_columns.push(column_from_filter_info);
        }

        const clause_type = decodeURIComponent(attributes['content.type']?.split('i:')?.at(-1));
        const role = Array.isArray(attributes['roles']) ? attributes['roles'][0] : attributes['roles'];
        const entity_role = decodeURIComponent(role?.split('i:')?.at(-1));
        const relevant_theme_summary_column = available_columns.find(col => {
            const theme_found_from_clause = decodeURIComponent(col.key)?.toLowerCase() === `theme-${clause_type}`.toLowerCase();
            const theme_found_from_entity = decodeURIComponent(col.key)?.toLowerCase() === `theme-${entity_role}`.toLowerCase();
            return theme_found_from_clause || theme_found_from_entity;
        });
        if (relevant_theme_summary_column) relevant_columns.push(relevant_theme_summary_column.key);
    });
    const relevant_columns_without_null_values = relevant_columns.filter(Boolean);
    return new Set(relevant_columns_without_null_values);
}

module.exports = {
    SORT_FILTER_GROUPING: SORT_FILTER_GROUPING,
    COLUMN_PRESETS: COLUMN_PRESETS,
    getAvailableColumnsForRoom: getAvailableColumnsForRoom,
    getColumnFromFilterInfo,
    getRelevantInsightColumnsFromFilter,
    columnPresetsForRoom: function(room) {
        const room_defaults = _.get(room.get('settings'), 'insight_details_columns_default');
        if (_.isArray(room_defaults))
            return room_defaults;

        // Use Disco for disco, but corporate for dili + corp
        switch (room.get('type')) {
            case 'discovery':
                return COLUMN_PRESETS.email;
            default:
                return COLUMN_PRESETS.corporate;
        }
    },
    InsightViewState: Base.Model.extend({
        initialize: function(attrs, opts) {
            opts.listenable_properties = _.extend(opts.listenable_properties || {}, {
                current_task: undefined,
                group_document_families: false,
                infinite_scroll: false,
                selected_models: undefined,
                visible_columns: undefined,
                table_column_configs: undefined,
                widget_in_fullscreen_mode: false,
                widget_slots: undefined,
                updates_in_progress: 0,
            });
            Base.Model.prototype.initialize.apply(this, arguments);

            this.current_task = opts.current_task;
            this.group_document_families = opts.group_document_families;
            this.infinite_scroll = opts.infinite_scroll;
            this.selected_models = opts.selected_models;
            this.visible_columns = opts.visible_columns;
            this.table_column_configs = opts.table_column_configs;
            this.widget_in_fullscreen_mode = opts.widget_in_fullscreen_mode;
            this.widget_slots = opts.widget_slots;
        },
        resetOnSetMode: function() {
            this.selected_models.selecting = true;
            this.selected_models.select_all = true;
        },
        triggerUpdateStart: function() {
            if (this.updates_in_progress === 0) {
                this.trigger('change:updates_in_progress', true);
            }
            this.updates_in_progress++;
        },
        triggerUpdateEnd: function() {
            this.updates_in_progress--;
            if (this.updates_in_progress === 0) {
                this.trigger('change:updates_in_progress', false);
            }
        },
    }),
    getBulkDocumentActionFilter,
};
