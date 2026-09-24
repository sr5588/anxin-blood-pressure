"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const api_1 = require("../../services/api");
const domain_1 = require("../../shared/domain");
Page({
    data: {
        range: '7',
        period: 'all',
        points: [],
        rows: [],
        locked: false,
        olderCount: 0,
        trialEligible: false,
        premium: false,
        offline: false,
        average: null,
        ranges: [
            { key: 'today', label: '今天' },
            { key: '7', label: '7天' },
            { key: '30', label: '30天' },
            { key: 'all', label: '全部' },
        ],
        longRanges: [
            { key: '90', label: '90天' },
            { key: '180', label: '半年' },
            { key: '365', label: '1年' },
        ],
        periods: [
            { key: 'all', label: '全部' },
            { key: 'morning', label: '☀ 清晨' },
            { key: 'evening', label: '☾ 晚间' },
        ],
    },
    onShow() {
        (0, theme_1.applyTheme)(this);
        this.load();
    },
    async load() {
        try {
            const b = await (0, api_1.bootstrap)();
            this.setData({
                premium: b.access.type !== 'FREE',
                olderCount: b.olderCount,
                trialEligible: b.trialEligible,
            });
            const locked = b.access.type === 'FREE' && !['today', '7'].includes(this.data.range);
            this.setData({ locked, offline: false });
            if (locked) {
                this.setData({ rows: [], points: [], average: null });
                return;
            }
            this.render(await (0, api_1.history)(this.data.range, this.data.period));
        }
        catch {
            const locked = (0, api_1.cachedAccess)().type === 'FREE' && !['today', '7'].includes(this.data.range);
            this.setData({ offline: true, locked });
            this.render(locked ? [] : (0, api_1.offlineHistory)(this.data.range, this.data.period));
        }
    },
    render(rows) {
        const points = (0, domain_1.trendPoints)(rows, this.data.range);
        this.setData({
            points,
            rows: rows
                .slice(-10)
                .reverse()
                .map((s) => ({
                ...s,
                label: (0, domain_1.dateKey)(s.measuredAt).slice(5) + ' ' + (0, domain_1.timeText)(s.measuredAt),
            })),
            average: rows.length
                ? {
                    systolic: Math.round(rows.reduce((n, s) => n + s.average.systolic, 0) / rows.length),
                    diastolic: Math.round(rows.reduce((n, s) => n + s.average.diastolic, 0) / rows.length),
                    count: rows.length,
                }
                : null,
        });
    },
    chooseRange(e) {
        this.setData({ range: e.currentTarget.dataset.key });
        this.load();
    },
    choosePeriod(e) {
        this.setData({ period: e.currentTarget.dataset.key });
        this.load();
    },
    access() {
        wx.navigateTo({ url: '/pages/access/index' });
    },
    async export() {
        try {
            await (0, api_1.exportData)('json');
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    records() {
        wx.navigateTo({ url: '/pages/records/index?range=' + this.data.range });
    },
});
