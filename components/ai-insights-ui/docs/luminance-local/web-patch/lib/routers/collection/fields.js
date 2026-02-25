'use strict';

const express = require('express'),
    pathUrl = require('path').posix;

const aggregator = require('../../aggregator'),
    params = require('./params'),
    { getVisibleScope } = require('../utils');

const { DATE_REGEX } = require('../../query_builder/index');

function addAggregation (cb) {
    return function (req, res, next) {
        const agg = cb(req);

        if (req.field.relationship)
            agg.filter = params.extractFilter(req.collectionParams.filter, req.field);

        if (!req.fieldAggregation) {
            req.fieldAggregation = agg;
        } else {
            let parent = req.fieldAggregation;

            while (parent.child)
                parent = parent.child;

            parent.child = agg;
        }

        next();
    };
}

exports.aggregations = _.transform([
    'avg',
    'cardinality',
    'count',
    'max',
    'min',
    'proportion',
    'sum',
    'first'
], function (aggs, name) {
    aggs[name] = {
        type: name
    };
}, {});

exports.aggregations['array'] = {type: 'array_agg'};

exports.collations = _.transform([
    'natural',
    'naturalbool'
], function (aggs, name) {
    aggs[name] = {
        type: name
    };
}, {});

function appendSearch (req, res, next, opts) {
    if (_.get(opts, 'model.name') !== 'documents')
        return res.error(404);
    const doesNotHaveSimilar = (!_.includes(_.keys(req.query), 'similar.text') && !_.includes(_.keys(req.query), 'similar.id'));
    const doesNotUseES = !req.query.analyze || !req.app.es || req.app.es.read === false || !req.ESEnabled;
    if (doesNotHaveSimilar || doesNotUseES)
        return res.error(422);
    req.findSimilar = true;
    next();
}

exports.router = function (opts) {
    const router = new express.Router();

    const instanceRouter = router.instanceRouter = new express.Router();

    const useEs = function(req) {
        const params = req.collectionParams;
        return params.analyze && opts.model.esType && req.app.es && req.app.es.read !== false && req.ESEnabled;
    };

    const FAKE_TABLES = new Set(['common_annotations', 'party_roles']);
    const isFakeTableModel = function (model) {
        return FAKE_TABLES.has(model?.name);
    };
    const isFakeTableField = function (field) {
        if (!field) return false;
        if (isFakeTableModel(field.model)) return true;
        if (!field.relationship) return false;
        return field.relationship.some(rel => isFakeTableModel(rel.otherModel));
    };
    const aggregationUsesFakeTable = function (aggregation) {
        if (!aggregation) return false;
        if (isFakeTableField(aggregation.field)) return true;
        return aggregation.child ? aggregationUsesFakeTable(aggregation.child) : false;
    };

    router.use('/:field', params.parse(_.extend({ sortAliases: ['key', 'value'] }, opts)), function (req, res, next) {
        if (req.params.field === 'relevance'){
            req.field = 'relevance';
            return appendSearch(req, res, next, opts);
        }
        req.field = opts.model.getField(req.params.field, {
            relationships: true,
            statistics: req.query.stats === 'true',
            analyze: req.query.analyze === 'true',
            batchOpt: req.query.batchOpt === 'true'
        });

        if (!req.field) {
            return res.error(404);
        }

        if (!params.applyPrefixFields({
            op: 'and',
            operands: [{
                filter: {
                    field: req.field
                }
            }, req.collectionParams.filter]
        }) && req.query.analyze === 'true')
            return res.error(422);

        next();
    }, instanceRouter);

    const subFields = [function (req, res, next) {
        if (req.params.type !== pathUrl.basename(req.collectionUrl))
            return res.error(404);

        next();
    }, router];

    instanceRouter.use('/:type/fields', addAggregation(function (req) {
        return _.extend(_.pick(req.collectionParams, 'limit', 'offset', 'sort'), {
            type: 'values',
            field: req.field,
            counts: req.query.counts ? req.query.counts === 'true' : true,
        });
    }), subFields);

    function sendAggregation (req, res, next) {

        let similarParams = _.pickBy(req.query, (val, key) => {
            return _.includes(['similar.text', 'similar.id'], key);
        });

        const params = req.collectionParams;

        const uses_fake_table = aggregationUsesFakeTable(req.fieldAggregation);
        if (params.analyze && !useEs(req) && uses_fake_table) {
            const agg_type = req.fieldAggregation?.type;
            if (agg_type === 'range') {
                const ranges = req.fieldAggregation?.ranges || [];
                return res.send(ranges.map(range => ({
                    key: null,
                    from: range.from ?? null,
                    to: range.to ?? null,
                    value: 0
                })));
            }
            return res.send([]);
        }

        _.async.waterfall([
            function (cb) {
                if (!params.analyze || !opts.model.esType || !_.get(req.app, 'es.acl'))
                    return cb(null, null);
                getVisibleScope({ pg: req.pg, model: opts.model.name }, cb);
            },
            function (result, next) {
                aggregator[useEs(req) ? 'es' : 'pg'].aggregate({
                    es: req.app.es,
                    pg: req.pg,
                    userId: req.user.id,
                    params: _.extend(_.defaults(params, result ? { acl: result } : {}), similarParams),
                    model: opts.model,
                    aggregation: req.fieldAggregation,
                    findSimilar: req.findSimilar,
                    instance: _.get(req, 'app.conf.ui.demo')? req.instance : undefined,
                    annotationServerIds: req.annotationServerIds,
                    annotationServerRels: req.annotationServerRels,
                    conf: req.app.conf
                }, function (err, output) {
                    if (err && _.startsWith(err.message, '[query_shard_exception] failed to create query'))
                        return res.sendStatus(422);

                    if (err) return next(err);

                    if (!_.isArray(output) && !_.isPlainObject(output))
                        output = {
                            value: output
                        };

                    if (_.isArray(output)) {
                        req.collection = output;
                        // Required here to break circular dep
                        // TODO: Fix?
                        require('../collection')(opts).sendCollection(req, res, next);
                    } else
                        res.send(output);
                });
            }
        ], next);
    }

    function fieldAggregation (cb) {
        return [addAggregation(cb), sendAggregation];
    }

    instanceRouter.get('/values', fieldAggregation(function (req) {
        return _.extend(_.pick(req.collectionParams, 'limit', 'offset', 'sort'), {
            type: 'values',
            field: req.field,
            counts: req.query.counts ? req.query.counts === 'true' : true
        });
    }));

    _.each(exports.aggregations, function (agg, name) {
        instanceRouter.get('/' + name, fieldAggregation(function (req) {
            let args = {};

            if (name === 'proportion')
                args = {
                    value: req.query.value
                };

            return _.extend({
                field: req.field,
                counts: req.query.counts ? req.query.counts === 'true' : true,
            }, agg, args);
        }));
    });

    const histogramAndRangeRouter = new express.Router();

    histogramAndRangeRouter.get('/', sendAggregation);
    histogramAndRangeRouter.use('/:type/fields', subFields);

    instanceRouter.use('/histogram', function (req, res, next) {
        const date = req.histogramDate = (req.field.type === 'date' || _.get(req.field, 'column.type') === 'date');
        if (!req.query.interval
            || !date && !req.query.interval.match(/^\d+(\.\d+)?$/)
            || date && !req.query.interval.match(/^(?:\d+(\.\d+)?[wdhms]|year|quarter|month|day|hour|minute|second)$/)
        )
            return res.error(422);
        if (req.query.includeEmpty && !_.includes(['true', 'false'], req.query.includeEmpty))
            return res.error(422);
        if (req.query.utc && !_.includes(['true', 'false'], req.query.utc))
            return res.error(422);

        next();
    }, addAggregation(function (req) {
        const agg = {
            type: 'histogram',
            field: req.field,
            date: req.histogramDate,
            interval: !req.histogramDate ? Number(req.query.interval) : req.query.interval,
            utc: req.query.utc === 'true',
            extended_bounds: {},
            sort: req.collectionParams.sort,
            limit: req.collectionParams.limit
        };

        if (req.query.includeEmpty === 'true') {
            agg.min_doc_count = 0;

            _((function collectRanges(filter) {
                if (filter.filter && filter.filter.type.match(/^[gl]te?$/))
                    return [filter.filter];
                else if (filter.operands)
                    return _.map(filter.operands, collectRanges);
                else
                    return [];
            })(req.collectionParams.filter)).flattenDeep().each(function (filter) {
                var bounds = agg.extended_bounds;

                switch (filter.type) {
                    case 'gte':
                    case 'gt':
                        bounds.min = extremum(Math.min, filter.value, bounds.min);
                        break;
                    case 'lte':
                    case 'lt':
                        bounds.max = extremum(Math.max, filter.value, bounds.max);
                        break;
                }
            });
        }

        return agg;

        function extremum (base, a, b) {
            if (_.isUndefined(b))
                return a;

            if (req.histogramDate) {
                // If the date values are passed in as relative/rounded dates then assume they should form the extended bounds (ideally we would parse them into absolute dates)
                if (a.match(DATE_REGEX.diff) || a.match(DATE_REGEX.round)) return a;
                if (b.match(DATE_REGEX.diff) || b.match(DATE_REGEX.round)) return b;

                // Use the configured timezone to parse dates correctly
                const timezone = req.app.conf.timezone || 'UTC';
                const moment = require('moment-timezone');
                const dateA = moment(a);
                const dateB = moment(b);
                const resultTime = base(dateA.valueOf(), dateB.valueOf());
                return moment.tz(resultTime, timezone).toISOString();
            }
            else
                return base(a, b);
        }
    }), histogramAndRangeRouter);

    instanceRouter.use('/range', function(req, res, next) {
        if (!useEs(req)) {
            if (req.collectionParams?.analyze && aggregationUsesFakeTable(req.fieldAggregation || { field: req.field })) return next();
            return res.status(422).send('Range aggregations only supported by Elasticsearch');
        }
        next();
    }, addAggregation(function (req) {
        // A flag that tells the query builder to use a date range aggregation (i.e. a range aggregation where the range values are dates)
        req.rangeDate = (req.field.type === 'date' || _.get(req.field, 'column.type') === 'date');

        // The ranges to aggregate over will be provided in the query string using parameters of the form range:(\d)+.from and range:(\d)+.to,
        // where the group number, "(\d)+", is used to group together the from and to values into ranges

        /** @type {{ from: string | undefined, to: string | undefined }[]} Array of ranges to aggregate over */
        const ranges = [];

        /** @type {Set<number>} Set of all group numbers used in the query string for range parameters */
        const groupNumbers = new Set();

        /** @type {Map<number, string>} Map between group number and start of range (i.e. 'from' values) */
        const startRangesByGroupNumber = new Map();

        /** @type {Map<number, string>} Map between group number and end of range (i.e. 'to' values) */
        const endRangesByGroupNumber = new Map();

        for (const key of Object.keys(req.query)) { // Looping over query string keys and grouping the range parameters
            const match = key.match(/range(:\d+)?\.(from|to)/);
            if (!match) continue;

            const group = match[1]; // This should be e.g. ':0'
            const groupNumber = parseInt(group?.slice(1)) || 0; // Removing the ':' from the start of the first capturing group

            const rangePosition = match[2]; // This should be either 'from' or 'to'

            if (rangePosition === 'from') startRangesByGroupNumber.set(groupNumber, req.query[key]);
            else if (rangePosition === 'to') endRangesByGroupNumber.set(groupNumber, req.query[key]);
            else continue;

            groupNumbers.add(groupNumber);
        }

        for (const groupNumber of groupNumbers) { // Looping over group numbers and constructing array of ranges
            const range = {};

            if (startRangesByGroupNumber.has(groupNumber)) range.from = startRangesByGroupNumber.get(groupNumber);
            if (endRangesByGroupNumber.has(groupNumber)) range.to = endRangesByGroupNumber.get(groupNumber);

            ranges.push(range);
        }

        const agg = {
            type: 'range',
            field: req.field,
            date: req.rangeDate,
            ranges,
            sort: req.collectionParams.sort,
            limit: req.collectionParams.limit,
        };

        return agg;

    }), histogramAndRangeRouter);

    return router;
};
