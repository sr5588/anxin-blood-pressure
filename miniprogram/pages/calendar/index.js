"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const domain_1 = require("../../shared/domain");
const api_1 = require("../../services/api");
Page({
    data: {
        month: (0, domain_1.dateKey)(Date.now()).slice(0, 7),
        selected: (0, domain_1.dateKey)(Date.now()),
        cells: [],
        rows: [],
        locked: false,
        premium: false,
        weekdays: ['一', '二', '三', '四', '五', '六', '日'],
        offline: false,
    },
    all: [],
    onShow() {
        (0, theme_1.applyTheme)(this);
        this.load();
    },
    async load() {
        try {
            const b = await (0, api_1.bootstrap)();
            this.setData({ premium: b.access.type !== 'FREE', offline: false });
            this.all = await (0, api_1.history)(this.data.premium ? 'all' : '7');
        }
        catch {
            this.setData({ premium: (0, api_1.cachedAccess)().type !== 'FREE', offline: true });
            this.all = (0, api_1.offlineHistory)(this.data.premium ? 'all' : '7');
        }
        this.render();
    },
    render() {
        const first = Date.parse(this.data.month + '-01T00:00:00+08:00'), offset = (new Date(first + 8 * 3600000).getUTCDay() + 6) % 7;
        const next = new Date(first + 8 * 3600000);
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(0);
        const count = next.getUTCDate();
        const cells = Array.from({ length: offset }, (_, i) => ({ key: 'blank' + i, blank: true }));
        for (let d = 1; d <= count; d++) {
            const key = this.data.month + '-' + String(d).padStart(2, '0'), ts = Date.parse(key + 'T00:00:00+08:00');
            cells.push({
                key,
                day: d,
                selected: key === this.data.selected,
                locked: !this.data.premium && ts < (0, domain_1.getFreeHistoryStartDate)(),
                future: ts > (0, domain_1.dayStart)(Date.now()),
                done: this.all.some((s) => (0, domain_1.dateKey)(s.measuredAt) === key),
            });
        }
        const locked = !this.data.premium &&
            Date.parse(this.data.selected + 'T00:00:00+08:00') < (0, domain_1.getFreeHistoryStartDate)();
        this.setData({
            cells,
            locked,
            rows: locked
                ? []
                : this.all
                    .filter((s) => (0, domain_1.dateKey)(s.measuredAt) === this.data.selected)
                    .map((s) => ({ ...s, label: (0, domain_1.timeText)(s.measuredAt) })),
        });
    },
    select(e) {
        this.setData({ selected: e.currentTarget.dataset.key });
        this.render();
    },
    changeMonth(e) {
        const t = new Date(this.data.month + '-15T00:00:00Z');
        t.setUTCMonth(t.getUTCMonth() + Number(e.currentTarget.dataset.delta));
        const month = t.toISOString().slice(0, 7);
        if (month > (0, domain_1.dateKey)(Date.now()).slice(0, 7))
            return;
        this.setData({ month, selected: month + '-01' });
        this.render();
    },
    access() {
        wx.navigateTo({ url: '/pages/access/index' });
    },
    details() {
        wx.navigateTo({
            url: '/pages/records/index?range=' +
                (this.data.premium ? 'all' : '7') +
                '&day=' +
                this.data.selected,
        });
    },
});
