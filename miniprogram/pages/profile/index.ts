import { applyTheme, setTheme } from '../../services/theme';
import {
  bootstrap,
  accessLabel,
  errorToast,
  syncPending,
  restore,
  exportData,
  deleteEverything,
  history,
} from '../../services/api';
import { storage, localAll } from '../../services/local';
import { AppConfig } from '../../config';
import { dateKey, timeText } from '../../../shared/domain';
import { saveReport } from '../../services/report';
Page({
  data: {
    state: '免费版',
    count: 0,
    pending: 0,
    lastSync: '尚未备份',
    mock: AppConfig.provider === 'mock',
    busy: false,
    premium: false,
    deleting: false,
  },
  onShow() {
    applyTheme(this);
    this.load();
  },
  async load() {
    this.setData({
      count: localAll().filter((s) => !s.deletedAt).length,
      pending: storage.get<string[]>('pending', []).length,
      lastSync: storage.get('lastSync', 0)
        ? dateKey(storage.get('lastSync', 0)) + ' ' + timeText(storage.get('lastSync', 0))
        : '尚未备份',
      deleting: storage.get('deleting', false),
    });
    try {
      const b = await bootstrap();
      this.setData({ state: accessLabel(b.access), premium: b.access.type !== 'FREE' });
    } catch {}
  },
  changeTheme(e: any) {
    setTheme(e.currentTarget.dataset.theme);
  },
  access() {
    wx.navigateTo({ url: '/pages/access/index' });
  },
  redeem() {
    wx.navigateTo({ url: '/pages/redeem/index' });
  },
  async run(fn: () => Promise<unknown>, message: string) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await fn();
      await this.load();
      wx.showToast({ title: message });
    } catch (e) {
      errorToast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  backup() {
    this.run(() => syncPending(), '备份已完成');
  },
  restore() {
    this.run(() => restore(), '记录已恢复');
  },
  async export(e: any) {
    const kind = e.currentTarget.dataset.kind as 'json' | 'csv';
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await exportData(kind);
    } catch (e) {
      const r = await wx.showModal({
        title: '完整导出未完成',
        content:
          '云服务或文件分享未完成。可以重试，或导出仅包含本机记录的副本（不保证包含全部云端数据）。',
        confirmText: '本机副本',
        cancelText: '稍后重试',
      });
      if (r.confirm) {
        try {
          await exportData(kind, true);
        } catch (err) {
          errorToast(err);
        }
      }
    } finally {
      this.setData({ busy: false });
    }
  },
  report(e: any) {
    const long = e.currentTarget.dataset.long === true;
    this.run(async () => {
      const rows = await history(long ? 'all' : '7');
      await saveReport(rows, long ? '全部历史' : '最近7个自然日');
    }, '报告已生成');
  },
  async removeAll() {
    const r = await wx.showModal({
      title: '删除全部健康记录？',
      content:
        '所有原始读数将从本机和云端永久删除。建议先完整导出。权益和必要交易流水保留，以防重复领取和支持订单查询。',
      confirmText: '继续删除',
      confirmColor: '#a84d35',
    });
    if (!r.confirm) return;
    this.run(() => deleteEverything(), '健康记录已删除');
  },
  privacy() {
    wx.showModal({
      title: '关于你的数据',
      content:
        '记录仅保存在本机，以及你启用的微信云开发账号中。应用内长期浏览按权益控制；完整JSON、CSV导出、备份及恢复始终免费。不会将血压用于诊断。删除健康记录后，试用标记和必要权益交易记录保留。所有时间按北京时间显示。开发演示模式没有联网备份。',
      showCancel: false,
    });
  },
});
