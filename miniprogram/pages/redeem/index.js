"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const api_1 = require("../../services/api");
const config_1 = require("../../config");
Page({
    onShow() {
        (0, theme_1.applyTheme)(this);
    },
    data: { code: '', busy: false, mock: config_1.AppConfig.provider === 'mock' },
    input(e) {
        this.setData({ code: e.detail.value });
    },
    async paste() {
        try {
            const r = await wx.getClipboardData();
            this.setData({ code: r.data.trim().slice(0, 64) });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    async scan() {
        try {
            const r = await wx.scanCode({ onlyFromCamera: false });
            const match = /^anxin-bp:\/\/redeem\?token=([A-Za-z0-9-]{10,32})$/.exec(r.result);
            if (!match)
                throw new Error('这不是安压日记兑换二维码');
            this.setData({ code: match[1] });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
    },
    async redeem() {
        if (this.data.busy || !this.data.code)
            return;
        this.setData({ busy: true });
        try {
            const r = await (0, api_1.call)('redeem', { code: this.data.code });
            await wx.redirectTo({ url: '/pages/access/index' });
            wx.showToast({ title: r.alreadyRedeemed ? '已使用过此码' : '兑换成功' });
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
        finally {
            this.setData({ busy: false });
        }
    },
});
