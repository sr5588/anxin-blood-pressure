import { applyTheme } from '../../services/theme';
import { bootstrap, errorToast, exportData, accessLabel, call } from '../../services/api';
import { payment } from '../../services/payment';
import { AppConfig } from '../../config';
import { dateKey } from '../../../shared/domain';
Page({
  data: {
    state: '免费版',
    expires: '',
    products: [] as any[],
    trialEligible: false,
    busy: false,
    mock: AppConfig.provider === 'mock',
  },
  onShow() {
    applyTheme(this);
    this.load();
  },
  async load() {
    try {
      const b = await bootstrap();
      this.setData({
        state: accessLabel(b.access),
        expires: b.access.expiresAt ? dateKey(b.access.expiresAt) : '',
        products: b.products.map((p: any) => ({ ...p, price: (p.priceFen / 100).toFixed(2) })),
        trialEligible: b.trialEligible,
      });
    } catch (e) {
      errorToast(e);
    }
  },
  async buy(e: any) {
    if (this.data.busy) return;
    const product = this.data.products.find((p: any) => p.productId === e.currentTarget.dataset.id);
    this.setData({ busy: true });
    try {
      await payment.purchase(product.productId);
      await this.load();
      wx.showToast({ title: '权益已更新' });
    } catch (e) {
      errorToast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  async trial() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await call('startTrial');
      await this.load();
      wx.showToast({ title: '体验已开始' });
    } catch (e) {
      errorToast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  async restore() {
    try {
      await payment.restore();
      await this.load();
      wx.showToast({ title: '权益已恢复' });
    } catch (e) {
      errorToast(e);
    }
  },
  async export() {
    try {
      await exportData('json');
    } catch (e) {
      errorToast(e);
    }
  },
  async refund() {
    try {
      await call('refundMock');
      await this.load();
      wx.showToast({ title: '模拟退款完成' });
    } catch (e) {
      errorToast(e);
    }
  },
});
