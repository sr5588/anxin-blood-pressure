"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const api_1 = require("../../services/api");
const domain_1 = require("../../shared/domain");
Page({
    onShow() {
        (0, theme_1.applyTheme)(this);
    },
    data: { rows: [], offline: false },
    range: '7',
    day: '',
    async onLoad(options) {
        this.range = options.range || '7';
        this.day = options.day || '';
        await this.load();
    },
    async load() {
        let rows;
        try {
            rows = await (0, api_1.history)(this.range);
            this.setData({ offline: false });
        }
        catch {
            rows = (0, api_1.offlineHistory)(this.range);
            this.setData({ offline: true });
        }
        this.setData({
            rows: rows
                .filter((s) => !this.day || (0, domain_1.dateKey)(s.measuredAt) === this.day)
                .reverse()
                .map((s) => ({
                ...s,
                label: (0, domain_1.dateKey)(s.measuredAt) + ' ' + (0, domain_1.timeText)(s.measuredAt),
                raw: s.readings.map((r) => ({ ...r, time: (0, domain_1.timeText)(r.measuredAt) })),
            })),
        });
    },
    async remove(e) {
        const r = await wx.showModal({
            title: '删除这组记录？',
            content: '将删除本机与备份中的这组原始读数。可取消此操作；确认删除后不能恢复。',
            confirmText: '删除记录',
            confirmColor: '#aa543a',
        });
        if (!r.confirm)
            return;
        try {
            await (0, api_1.deleteOne)(e.currentTarget.dataset.id);
            await this.load();
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
});
