'use strict';

const sql = require('sql'),
    _ = require('lodash'),
    Node = require('sql/lib/node'),
    Query = require('sql/lib/node/query'),
    Postgres = require('sql/lib/dialect/postgres'),
    PrefixUnaryNode = require('sql/lib/node/prefixUnary'),
    Table = require('sql/lib/table'),
    TextNode = require('sql/lib/node/text'),
    HavingNode = require('sql/lib/node/having'),
    OrderByNode = require('sql/lib/node/orderBy'),
    valueExpressionMixin = require('sql/lib/node/valueExpression'),
    Column = require('sql/lib/column'),
    PostfixUnaryNode = require('sql/lib/node/postfixUnary'),
    BinaryNode = require('sql/lib/node/binary'),
    TernaryNode = require('sql/lib/node/ternary'),
    LiteralNode = require('sql/lib/node/literal'),
    OrderByValueNode = require('sql/lib/node/orderByValue'),
    ReturningNode = require('sql/lib/node/returning');

const ParameterNode = require('sql/lib/node/parameter');

const processParams = function(val) {
    return Array.isArray(val) ? val.map(ParameterNode.getNodeOrParameterNode) : ParameterNode.getNodeOrParameterNode(val);
};

const getArrayOrArgsAsArray = function(args) {
    if (_.isArray(args[0])) {
        return args[0];
    }
    return [].slice.call(args);
};

const Modifier = Node.define({
    constructor: function(table, type, count) {
        this.table = table;
        this.type = type;
        this.count = count;
    }
});

const genericMethod = sql.op = function(operator, separator) {
    const self = this;
    const nodeTypes = [PostfixUnaryNode, BinaryNode, TernaryNode];

    const setArg = function (args, index) {
        return args[index] !== undefined ? processParams(args[args.length - index - 1]) : undefined;
    };

    return function () {
        return new (nodeTypes[arguments.length])({
            left      : self.toNode(),
            operator  : operator,
            middle    : setArg(arguments, 1),
            separator : separator,
            right     : setArg(arguments, 0)
        });
    };
};

Column.prototype.op = genericMethod;

// TODO: make 'ascending' and 'asc' use the OrderByValueNode rather than creating a separate method
Column.prototype._ascend = function () {
    return new OrderByValueNode({
        value: this.toNode(),
        direction: new TextNode('ASC')
    });
};

Column.prototype.o = function (...args) {
    return this.op('^@')(...args);
};
Node.prototype.clone = function () {
    const clone = Object.create(this.constructor.prototype);

    _.extend(clone, this);
    if (this.nodes)
        clone.nodes = this.nodes.map(function (n) { return n.clone() });

    return clone;
};

const VersionConditionalNode = Node.define({
    type: 'VERSION CONDITIONAL',
    constructor: function (config) {
        Node.call(this);
        this.version = config.version;
        this.pre = config.pre;
        this.post = config.post;
    }
});
_.extend(VersionConditionalNode.prototype, valueExpressionMixin());

Table.prototype.joinCondition = function (other, relationship) {
    function applyField (table, field) {
        const out = {};
        if (_.isNull(field) || _.isUndefined(field)) return { type: 'null' };

        if (_.isPlainObject(field)) {
            if (!_.isUndefined(field.value)) {
                out.key = applyField(table, _.omit(field, 'value'));
                out.value = field.value;
                out.type = 'singleField';
                return out;
            }
            if (_.isUndefined(field.key))
                return { type: 'null' };
        } else {
            field = { key: field };
        }
        if (_.isUndefined(field.key))
            return { type: 'null' };
        const colParts = field.key.split('.');
        let column = table.getColumn(colParts[0]);
        if (colParts.length > 1)
            column = column.path(sql.array(colParts.slice(1)));
        if (field.cast)
            column = _.reduce(_.flatten([field.cast]), (co, ca) => co.cast(ca), column);
        return column;
    }

    let resColumns, refColumns;
    const name = relationship.model.table.getName();
    const otherName = relationship.otherModel.table.getName();
    const fields = relationship.fields || [relationship.field];
    const otherFields = relationship.otherFields || [relationship.otherField];
    const applySelf = _.partial(applyField, this);
    const applyOther = _.partial(applyField, other);

    if (this.getName() === name && other.getName() === otherName) {
        resColumns = _.map(fields, applySelf);
        refColumns = _.map(otherFields, applyOther);
    } else if (other.getName() === name && this.getName() === otherName) {
        resColumns = _.map(otherFields, applySelf);
        refColumns = _.map(fields, applyOther);
    } else {
        throw new Error(`Cannot construct join: ${this.getName()}, ${other.getName()}, ${name}, ${otherName}`);
    }

    const hasInvalidColumn = _.some(resColumns, col => !col || col.type === 'null')
        || _.some(refColumns, col => !col || col.type === 'null');
    if (hasInvalidColumn)
        return sql.FALSE;

    const singleField = function (item, comp) {
        return item.type === 'singleField' ? (item.key[comp] ? item.key[comp](item.value) : item.key.op(comp)(item.value)) : false;
    };

    return _.reduce(_.range(resColumns.length), function (on, i) {
        const op = relationship.op ? relationship.op[i - 1] : 'and';
        const comp = relationship.comp ? relationship.comp[i] : 'equals';
        const equality = singleField(resColumns[i], comp) || singleField(refColumns[i], comp) || (resColumns[i][comp] ? resColumns[i][comp](refColumns[i]) : resColumns[i].op(comp)(refColumns[i]));
        return on ? equality[op](on) : equality;
    }, null);

};

Table.prototype.joinTo = _.wrap(Table.prototype.joinTo, function (orig, other, relationship) {
    if (!relationship)
        return orig.call(this, other);

    const condition = this.joinCondition(other, relationship);
    return this.join(other).on(condition);
});

Table.prototype.leftJoinTo = function (other, relationship) {
    const join = this.joinTo(other, relationship);
    join.subType = 'LEFT';

    return join;
};

Table.prototype.crossJoin = function (other, relationship) {
    const join = this.joinTo(other, relationship);
    join.subType = 'CROSS';

    return join;
};

// mitigates node-sql's lodash prototype pollution vulnerability
Table.prototype.addColumn = _.wrap(Table.prototype.addColumn, function (orig, col, options) {
    return orig.call(this, col, _.extend({}, options));
});

Table.prototype.clone = _.wrap(Table.prototype.clone, function (orig, config) {
    return orig.call(this, _.extend({}, config, {
        columns: _.map(this.columns, function (c) {
            // clone columns to plain objects
            // these will then be recreated in super call
            return _.extend({}, c);
        })
    }));
});

Table.prototype.primaryKeyColumns = function () {
    return this.columns.filter(function (c) {
        return c.primaryKey;
    });
};

function escapeQuote (str) {
    return str.replace('\'', '\'\'');
}

Table.prototype.string = function (str) {
    return this.literal('\'' + escapeQuote(str) + '\'');
};

Table.prototype.integer = function (int) {
    const parsed = parseInt(int);
    return this.literal(parsed);
};

const ValuesNode = Node.define({
    type: 'VALUES',
    constructor: function(table) {
        Node.call(this);
        this.table = table;
    }
});

var Values = function (config) {
    Values.super_.call(this, _.defaults({}, config));
    this._values = _.map(config.values, val => {
        if (_.isArray(val)) return val;
        if (_.isPlainObject(val)) {
            if (!this.columns.length)
                this.columns = _.map(_.keys(val), key => new Column({ name: key, property: key, table: this }));

            return _.map(this.columns, col => val[col.name]);
        }
    });
    _.each(this.columns, (col) => {
        const key = col.alias || col.name || col.property;
        this[key] = this[key] || col;
    });
};
require('util').inherits(Values, Table);

Values.prototype.as = function (alias, columns) {
    const v = new Values(this._initialConfig);
    if (columns) {
        v.columns = _.map(columns, key => new Column({ name: key, property: key, table: v }));
        _.each(this.columns, (col) => {
            const key = col.alias || col.name || col.property;
            this[key] = this[key] || col;
        });
    }
    v.alias = alias;
    v._name = alias;
    return v;
};

Values.prototype.toNode = function () {
    return new ValuesNode(this);
};

// use like .from(sql.values([{id: 1, 2}, {3, 4}]).as('a'))

sql.values = function (vals) {
    return new Values({ values: vals });
};

Query.prototype.clone = function () {
    const self = this;

    const clone = Query.super_.prototype.clone.call(self);

    ['_distinctOn', '_groupBy', '_orderBy', '_select', 'indexesClause', 'whereClause'].forEach(function (prop) {
        if (self[prop])
            clone[prop] = clone.nodes[self.nodes.indexOf(self[prop])];
    });

    return clone;
};

Query.prototype.group = _.wrap(Query.prototype.group, function (orig) {
    orig.apply(this, _.slice(arguments, 1));

    if (this._groupBy)
        this._groupBy.add(this.nodes.pop().nodes[0]);
    else
        this._groupBy = this.nodes[this.nodes.length - 1];

    return this;
});

_.extend(HavingNode.prototype, valueExpressionMixin());

Query.prototype.having = function () {
    const args = getArrayOrArgsAsArray(arguments);
    if (!this.havingClause)
        this.havingClause = new HavingNode();
    this.havingClause.addAll(args);
    return this;
};

Query.prototype.order = function () {
    const args = getArrayOrArgsAsArray(arguments);
    let orderBy;
    if (args.length === 0) {
        return this;
    }
    if (this._orderBy) {
        orderBy = this._orderBy;
    } else {
        orderBy = this._orderBy = new OrderByNode();
    }
    orderBy.addAll(args);
    return this;
};

Query.prototype.limit = function (count) {
    this._limit = new Modifier(this, 'LIMIT', count);
    return this;
};

Query.prototype.offset = function (count) {
    this._offset = new Modifier(this, 'OFFSET', count);
    return this;
};

Query.prototype.addToEnd = function (text) {
    this._addendum = text;
    return this;
};

Query.prototype.addToStart = function (text) {
    this._prependum = text;
    return this;
};

Query.prototype.returning = function() {
    const returning = new ReturningNode();
    if (arguments.length === 0)
        returning.add('*');
    else
        returning.addAll(getArrayOrArgsAsArray(arguments));

    this._returning = returning;
    return this;
};

Query.prototype.select = _.wrap(Query.prototype.select, function (orig, ...args) {
    if (this.type === 'SUBQUERY') {
        this.columns = (this.columns || []).concat(_.reduce(args, (acc, column) => {
            const cols = [];
            if (column.star)
                cols.push.apply(cols, _.get(column, 'table.columns'));
            else
                cols.push(column);
            return acc.concat(_.map(cols, col => new Column({ name: col.alias || col.name, table: this, property: col.alias || col.name })));
        }, []));
    }
    return orig.apply(this, args);
});

const origGetParameterValue = Postgres.prototype._getParameterValue;
Postgres.prototype._getParameterValue = function (value, quoteChar) {
    if (
        'object' === typeof value &&
        Array.isArray(value) &&
        this._myClass === Postgres &&
        (!value.length || 'object' !== typeof value[0] || _.isFunction(value[0].toISOString) || Array.isArray(value[0]))
    ) {
        value = value.map(item =>
            typeof item === 'string'
                ? '"' + item
                    .replace(/'/g, '\'\'')      // Escape single quotes by doubling
                    .replace(/"/g, '\\"')       // Escape double quotes with \
                    + '"'
                : this._getParameterValue(item, '"')
        );
        return '\'{' + value.join(',') + '}\'';
    }

    return origGetParameterValue.call(this, value, quoteChar);
};

Postgres.prototype.visitParameter = _.wrap(Postgres.prototype.visitParameter, function (orig, parameter) {
    const value = parameter.value();

    const idx = this.params.indexOf(value);

    if (!this.insValsToCols && this._queryNode && this._queryNode.insertClause) { // builds an index to check which columns each value is to be inserted into
        this.insValsToCols = new Map();
        _.each(this._queryNode.insertClause.valueSets, (insert) => {
            _.each(insert, (obj, col) => {
                const val = obj.value;
                if (!this.insValsToCols.has(val))
                    this.insValsToCols.set(val, new Set());
                this.insValsToCols.get(val).add(col);
            });
        });
    }

    if (
        idx >= 0 &&
        (_.has(this, '_queryNode.insertClause') || this._dedupeInternalParameters) &&
        (!this.insValsToCols?.get(value) || this.insValsToCols.get(value).size === 1) &&
        !_.includes(['active', 'deleted', 'pending'], value)
    ) // only allow de-duplication for inserts if a value to insert is in one column
        return this._getParameterText(idx + 1, value);

    return orig.apply(this, _.slice(arguments, 1));
});

const visitQuery = Postgres.prototype.visitQuery;
Postgres.prototype.visitQuery = function (node) {
    let out = visitQuery.apply(this, arguments);
    if (node.havingClause)
        out = out.concat(this.visit(node.havingClause));
    if (node._orderBy)
        out = out.concat(this.visit(node._orderBy));
    if (node._limit)
        out = out.concat(this.visit(node._limit));
    if (node._offset)
        out = out.concat(this.visit(node._offset));
    if (node._addendum)
        out = out.concat(node._addendum);
    if (node._prependum)
        out = [node._prependum].concat(out);
    if (node._returning)
        out = out.concat(this.visit(node._returning));
    if (node.type === 'SUBQUERY')
        this.output = out;
    return out;
};

const origVisit = Postgres.prototype.visit;
Postgres.prototype.visit = function (node) {
    if (node.type === 'VERSION CONDITIONAL')
        // TODO: correct comparision of version strings
        return this.visit(this.config.version < node.version ? node.pre : node.post);
    else if (node.type === 'UNION')
        return ['UNION'];
    else if (node.type === 'VALUES')
        return ['(', 'VALUES']
            .concat(node.table._values.map(params => processParams(params).map(i => i.toString())).map(param => '(' + param + ')').join(', '))
            .concat([
                ')',
                'AS',
                this.quote(node.table.alias || node.table._name),
                '(' + _.map(node.table.columns, col => this.quote(col.alias || col.name)).join(', ') + ')']);
    else
        return origVisit.apply(this, arguments);
};

Postgres.prototype.visitModifier = function (node) {
    return [node.type, node.count.type ? this.visit(node.count) : this.visit(new ParameterNode(node.count))];
};

Postgres.prototype.visitOrderBy = function(orderBy) {
    const self = this;
    return ['ORDER BY', orderBy.nodes.map(function (node) {
        return self.visit(node) + (node.nullOrder ? ' NULLS ' + node.nullOrder.toUpperCase(): '');
    }).join(', ')];
};

Postgres.prototype.visitBinary = _.wrap(Postgres.prototype.visitBinary, function(orig, binary) {
    const previousFlagStatus = this._dedupeInternalParameters;
    if (binary.operator === '#>>')
        this._dedupeInternalParameters = true;
    const out = orig.apply(this, _.slice(arguments, 1));
    this._dedupeInternalParameters = previousFlagStatus;
    return out;
});

Postgres.prototype.visitPrefixUnary = function(unary) {
    const text = (unary.noParentheses  ? '' : '(') + unary.operator + ' ' + this.visit(unary.left) + (unary.noParentheses ? '' : ')');
    return [text];
};

sql.Node = Node;
sql.Query = Query;

sql.distinct = function (node) {
    const unary = new PrefixUnaryNode({
        left: node,
        operator: 'DISTINCT'
    });
    unary.noParentheses = true;
    return unary;
};

sql.not = function (node) {
    return new PrefixUnaryNode({
        left: node,
        operator: 'NOT'
    });
};

[
    'ADD_CONCEPT_EXAMPLE', 'AGE', 'ANY', 'ARRAY', 'ARRAY_AGG', 'ARRAY_APPEND', 'ARRAY_LENGTH', 'BOOL_OR', 'CLASSIFY_CONCEPT_EXAMPLE', 'COALESCE', 'CONCAT', 'COUNT_DISTINCT',
    'CREATE_DOCUMENT_ANNOTATION_EVENT', 'CREATE_DOCUMENT_DOWNLOAD_EVENT', 'CREATE_DOCUMENT_VIEW_EVENT', 'CREATE_ROOM_ENTRY_EVENT',
    'CREATE_USER_EVENT', 'CURRENT_USER_IDS', 'DATE_PART', 'DATE_TRUNC', 'DIV', 'EXISTS', 'EXTRACT', 'FILE_FROM_MONIKER',
    'FIRST', 'FORMAT', 'GET_ANNOTATIONS_WITHIN_POSITIONS', 'GET_CLUSTER_RANGE_INSTANCES', 'GET_OVERLAPPING_CLUSTERS', 'JSONB_ARRAY_ELEMENTS_TEXT',
    'JSONB_BUILD_OBJECT', 'JSONB_EXTRACT_PATH', 'JSONB_SET', 'NATURAL_SORT_KEY', 'NOW',
    'NULLIF', 'NUMNODE', 'PHRASETO_TSQUERY', 'REGEXP_REPLACE', 'STRING_AGG', 'STRPOS', 'SUBSTRING',
    'TO_JSONB', 'TS_HEADLINE', 'TS_HIGHLIGHT', 'TS_SPREAD', 'UNNEST',
    'UPDATE_DOCUMENT_VIEW_EVENT_DURATION', 'UPDATE_DOCUMENT_VIEW_EVENT_PAGE', 'JSONB_AGG', 'GET_PROFILE_DETAILS_FROM_REPORT_TARGET_ID',
    'BEGIN_CASCADE_HARD_DELETE', 'END_CASCADE_HARD_DELETE',
].forEach(function (f) {
    sql.functions[f] = sql.functionCallCreator(f);
});

sql.functions.UNNEST_WITH_NULL = function (column) {
    return sql.functions.UNNEST(column.case([sql.functions.ARRAY_LENGTH(column, sql.text(1)).gt(sql.text(0))], [column], sql.array(null).cast('CITEXT[]')));
};

sql.selectSubQuery = function () {
    const s = sql.select.apply(this, arguments);
    s.type = 'SUBQUERY';

    return s;
};

sql.text = function (text) {
    return new TextNode(text);
};

sql.versionConditional = function (version, pre, post) {
    return new VersionConditionalNode({
        version: version,
        pre: pre,
        post: post
    });
};

sql.ROW_TO_JSON = function (table) {
    return sql.functionCallCreator('ROW_TO_JSON')(table.literal(table.alias || table._name));
};

sql.JSONB_BUILD_OBJECT = function (opts) {
    let args = [];
    if (_.isPlainObject(opts))
        _.each(opts, (val, key) => {
            args.push(new LiteralNode('\'' + key + '\''));
            args.push(val);
        });
    else
        args = _.map(arguments, function (arg, index) {
            return index % 2 ? arg : new LiteralNode('\'' + arg + '\'');
        });
    return sql.function('JSONB_BUILD_OBJECT').apply(sql, args);
};

sql.literal = function(literal) {
    return new LiteralNode(literal);
};
Object.defineProperty(sql, 'TRUE', {
    get: () => {
        return new BinaryNode({
            left: sql.literal('1'),
            right: sql.literal('1'),
            operator: '=',
        });
    }
});
Object.defineProperty(sql, 'FALSE', {
    get: () => {
        return new BinaryNode({
            left: sql.literal('0'),
            right: sql.literal('1'),
            operator: '=',
        });
    }
});

Node.prototype.op = sql.op;

Node.prototype.union = function (other) {
    const UnionNode = Node.define({
        type: 'UNION'
    });
    return this.add(new UnionNode()).add(other);
};

Node.prototype.filter = function (whereClause) {
    return this.op('FILTER')(whereClause.wherePrefix());
};

Node.prototype.coerce = function (cast) {
    return this.add('::').add(cast);
};

Node.prototype.distinct = function () {
    return new PrefixUnaryNode({
        left: this,
        operator: 'DISTINCT'
    });
};

Node.prototype.wherePrefix = function () {
    return new PrefixUnaryNode({
        left: this,
        operator: 'WHERE'
    });
};

module.exports = sql;
