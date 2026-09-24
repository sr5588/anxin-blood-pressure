import { applyTheme } from '../../services/theme';
import { call, errorToast } from '../../services/api';
import { AppConfig } from '../../config';
Page({
  onShow() {
    applyTheme(this);
  },
  data: { code: '', busy: false, mock: AppConfig.provider === 'mock' },
  input(e: any) {
    this.setData({ code: e.detail.value });
  },
  async paste() {
    try {
      const r = await wx.getClipboardData();
      this.setData({ code: r.data.trim().slice(0, 64) });
    } catch (e) {
      errorToast(e);
    }
  },
  async scan() {
    try {
      const r = await wx.scanCode({ onlyFromCamera: false });
      const match = /^anxin-bp:\/\/redeem\?token=([A-Za-z0-9-]{10,32})$/.exec(r.result);
      if (!match) throw new Error('这不是安压日记兑换二维码');
      this.setData({ code: match[1] });
    } catch (e) {
      errorToast(e);
    }
  },
  async redeem() {
    if (this.data.busy || !this.data.code) return;
    this.setData({ busy: true });
    try {
      const r = await call('redeem', { code: this.data.code });
      await wx.redirectTo({ url: '/pages/access/index' });
      wx.showToast({ title: r.alreadyRedeemed ? '已使用过此码' : '兑换成功' });
    } catch (e) {
      errorToast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
});
