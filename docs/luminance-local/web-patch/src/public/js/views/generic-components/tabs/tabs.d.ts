import BaseView from '../../base';

interface TabsConfig {
    key: string,
    title: string,
    iconClass?: string,
    className?: string,
    badge_count?: number,
    badge_dot?: boolean,
}

declare namespace Tabs {
    interface Options extends BaseView.Options {
        tabs: TabsConfig[];
        defaultSelected: string;
    }
}

declare class Tabs extends BaseView {
    constructor(opts: Tabs.Options);
    selected: string | undefined;
    setBadge(tab: string, opts?: { count?: number, dot?: boolean }): void;
}

export = Tabs;
