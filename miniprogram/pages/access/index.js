"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const api_1 = require("../../services/api");
const payment_1 = require("../../services/payment");
const config_1 = require("../../config");
const domain_1 = require("../../shared/domain");
Page({
    data: {
        state: '免费版',
        expires: '',
        products: [],
        trialEligible: false,
        busy: false,
        mock: config_1.AppConfig.provider === 'mock',
    },
    onShow() {
        (0, theme_1.applyTheme)(this);
        this.load();
    },
    async load() {
        try {
            const b = await (0, api_1.bootstrap)();
            this.setData({
                state: (0, api_1.accessLabel)(b.access),
                expires: b.access.expiresAt ? (0, domain_1.dateKey)(b.access.expiresAt) : '',
                products: b.products.map((p) => ({ ...p, price: (p.priceFen / 100).toFixed(2) })),
                trialEligible: b.trialEligible,
            });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    async buy(e) {
        if (this.data.busy)
            return;
        const product = this.data.products.find((p) => p.productId === e.currentTarget.dataset.id);
        this.setData({ busy: true });
        try {
            await payment_1.payment.purchase(product.productId);
            await this.load();
            wx.showToast({ title: '权益已更新' });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
        finally {
            this.setData({ busy: false });
        }
    },
    async trial() {
        if (this.data.busy)
            return;
        this.setData({ busy: true });
        try {
            await (0, api_1.call)('startTrial');
            await this.load();
            wx.showToast({ title: '体验已开始' });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
        finally {
            this.setData({ busy: false });
        }
    },
    async restore() {
        try {
            await payment_1.payment.restore();
            await this.load();
            wx.showToast({ title: '权益已恢复' });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    async export() {
        try {
            await (0, api_1.exportData)('json');
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    async refund() {
        try {
            await (0, api_1.call)('refundMock');
            await this.load();
            wx.showToast({ title: '模拟退款完成' });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
});
