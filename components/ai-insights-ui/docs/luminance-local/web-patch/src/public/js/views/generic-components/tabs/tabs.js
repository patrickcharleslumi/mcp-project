'use strict';

var BaseView = require('../../base'),
    $ = require('jquery');

module.exports = BaseView.extend({
    template: 'tabs-view',
    events: {
        'click .tab': 'onClickTab'
    },
    initialize: function({ tabs, defaultSelected }) {
        this.selected = defaultSelected;

        this.templateParams = { tabs };
        BaseView.prototype.initialize.apply(this, arguments);

        this.$tabs = this.$root.filter('.tab');
    },
    render: function() {
        BaseView.prototype.render.apply(this, arguments);
        this.select(this.selected);
    },
    select: function(tab) {
        this.selected = tab;

        this.$tabs.removeClass('selected');
        this.$tabs.filter(`[data-tab="${tab}"]`).addClass('selected');

        this.trigger('click', tab);
    },
    disable: function(tab, disable) {
        if (!tab) this.$tabs.prop('disabled', disable);
        else  this.$tabs.filter(`[data-tab="${tab}"]`).prop('disabled', disable);
    },
    onClickTab: function(event) {
        var tab = this.getDataAttribute(event, 'tab');
        this.select(tab);
    },
    setBadge: function(tab, { count, dot } = {}) {
        const $tab = this.$tabs.filter(`[data-tab="${tab}"]`);
        let $badge = $tab.find('.tab-badge');
        if (!count && !dot) {
            $badge.remove();
            return;
        }
        if (!$badge.length) {
            $badge = $('<span class="tab-badge"></span>');
            $tab.append($badge);
        }
        $badge.toggleClass('dot', !!dot);
        $badge.text(count ? String(count) : '');
    },
});