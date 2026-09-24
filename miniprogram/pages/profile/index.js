"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const api_1 = require("../../services/api");
const local_1 = require("../../services/local");
const config_1 = require("../../config");
const domain_1 = require("../../shared/domain");
const report_1 = require("../../services/report");
Page({
    data: {
        state: '免费版',
        count: 0,
        pending: 0,
        lastSync: '尚未备份',
        mock: config_1.AppConfig.provider === 'mock',
        busy: false,
        premium: false,
        deleting: false,
    },
    onShow() {
        (0, theme_1.applyTheme)(this);
        this.load();
    },
    async load() {
        this.setData({
            count: (0, local_1.localAll)().filter((s) => !s.deletedAt).length,
            pending: local_1.storage.get('pending', []).length,
            lastSync: local_1.storage.get('lastSync', 0)
                ? (0, domain_1.dateKey)(local_1.storage.get('lastSync', 0)) + ' ' + (0, domain_1.timeText)(local_1.storage.get('lastSync', 0))
                : '尚未备份',
            deleting: local_1.storage.get('deleting', false),
        });
        try {
            const b = await (0, api_1.bootstrap)();
            this.setData({ state: (0, api_1.accessLabel)(b.access), premium: b.access.type !== 'FREE' });
        }
        catch { }
    },
    changeTheme(e) {
        (0, theme_1.setTheme)(e.currentTarget.dataset.theme);
    },
    access() {
        wx.navigateTo({ url: '/pages/access/index' });
    },
    redeem() {
        wx.navigateTo({ url: '/pages/redeem/index' });
    },
    async run(fn, message) {
        if (this.data.busy)
            return;
        this.setData({ busy: true });
        try {
            await fn();
            await this.load();
            wx.showToast({ title: message });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
        finally {
            this.setData({ busy: false });
        }
    },
    backup() {
        this.run(() => (0, api_1.syncPending)(), '备份已完成');
    },
    restore() {
        this.run(() => (0, api_1.restore)(), '记录已恢复');
    },
    async export(e) {
        const kind = e.currentTarget.dataset.kind;
        if (this.data.busy)
            return;
        this.setData({ busy: true });
        try {
            await (0, api_1.exportData)(kind);
        }
        catch (e) {
            const r = await wx.showModal({
                title: '完整导出未完成',
                content: '云服务或文件分享未完成。可以重试，或导出仅包含本机记录的副本（不保证包含全部云端数据）。',
                confirmText: '本机副本',
                cancelText: '稍后重试',
            });
            if (r.confirm) {
                try {
                    await (0, api_1.exportData)(kind, true);
                }
                catch (err) {
                    (0, api_1.errorToast)(err);
                }
            }
        }
        finally {
            this.setData({ busy: false });
        }
    },
    report(e) {
        const long = e.currentTarget.dataset.long === true;
        this.run(async () => {
            const rows = await (0, api_1.history)(long ? 'all' : '7');
            await (0, report_1.saveReport)(rows, long ? '全部历史' : '最近7个自然日');
        }, '报告已生成');
    },
    async removeAll() {
        const r = await wx.showModal({
            title: '删除全部健康记录？',
            content: '所有原始读数将从本机和云端永久删除。建议先完整导出。权益和必要交易流水保留，以防重复领取和支持订单查询。',
            confirmText: '继续删除',
            confirmColor: '#a84d35',
        });
        if (!r.confirm)
            return;
        this.run(() => (0, api_1.deleteEverything)(), '健康记录已删除');
    },
    privacy() {
        wx.showModal({
            title: '关于你的数据',
            content: '记录仅保存在本机，以及你启用的微信云开发账号中。应用内长期浏览按权益控制；完整JSON、CSV导出、备份及恢复始终免费。不会将血压用于诊断。删除健康记录后，试用标记和必要权益交易记录保留。所有时间按北京时间显示。开发演示模式没有联网备份。',
            showCancel: false,
        });
    },
});
