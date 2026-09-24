"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const greetings_1 = require("../../shared/greetings");
const api_1 = require("../../services/api");
const domain_1 = require("../../shared/domain");
const config_1 = require("../../shared/config");
const config_2 = require("../../config");
const local_1 = require("../../services/local");
Page({
    data: {
        greeting: '早上好',
        quote: '',
        season: 'autumn',
        dateLabel: '',
        date: '',
        latest: null,
        morning: null,
        evening: null,
        days: [],
        safety: null,
        offline: false,
        mock: config_2.AppConfig.provider === 'mock',
        pending: 0,
    },
    async onShow() {
        (0, theme_1.applyTheme)(this);
        const now = Date.now(), hour = Number((0, domain_1.timeText)(now).slice(0, 2));
        this.setData({
            ...(0, greetings_1.dailyGreeting)(now),
            greeting: hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好',
            date: (0, domain_1.dateKey)(now).replace(/-/g, ' / '),
        });
        this.render((0, api_1.offlineHistory)('7'));
        try {
            await (0, api_1.syncPending)();
            this.render(await (0, api_1.history)('7'));
            this.setData({ offline: false });
        }
        catch {
            this.setData({ offline: true });
        }
    },
    render(rows) {
        const today = rows.filter((s) => (0, domain_1.dateKey)(s.measuredAt) === (0, domain_1.dateKey)(Date.now()));
        const latest = rows[rows.length - 1];
        const fmt = (s) => s
            ? {
                ...s.average,
                time: (0, domain_1.timeText)(s.measuredAt),
                date: (0, domain_1.dateKey)(s.measuredAt) === (0, domain_1.dateKey)(Date.now())
                    ? '今天'
                    : (0, domain_1.dateKey)(s.measuredAt).slice(5),
                count: s.readings.length,
                status: s.status,
            }
            : null;
        const days = Array.from({ length: 7 }, (_, i) => {
            const day = (0, domain_1.dateKey)(Date.now() - (6 - i) * config_1.DAY_MS);
            return {
                label: i === 6 ? '今天' : String(Number(day.slice(-2))),
                done: rows.some((s) => (0, domain_1.dateKey)(s.measuredAt) === day),
            };
        });
        this.setData({
            latest: fmt(latest),
            morning: fmt(today.filter((s) => s.period === 'morning').pop()),
            evening: fmt(today.filter((s) => ['evening', 'bedtime'].includes(s.period)).pop()),
            days,
            safety: latest ? (0, domain_1.safetyMessage)(latest.average, latest.context.symptoms) : null,
            pending: local_1.storage.get('pending', []).length,
        });
    },
    record() {
        wx.navigateTo({ url: '/pages/measure/index' });
    },
    records() {
        wx.navigateTo({ url: '/pages/records/index' });
    },
    async retry() {
        try {
            await (0, api_1.syncPending)();
            await this.onShow();
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
});
