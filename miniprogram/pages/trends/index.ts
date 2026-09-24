import { applyTheme } from '../../services/theme';
import {
  bootstrap,
  history,
  offlineHistory,
  cachedAccess,
  errorToast,
  exportData,
} from '../../services/api';
import { trendPoints, dateKey, timeText } from '../../../shared/domain';
import { Session, Range } from '../../../shared/types';
Page({
  data: {
    range: '7' as Range,
    period: 'all',
    points: [] as any[],
    rows: [] as any[],
    locked: false,
    olderCount: 0,
    trialEligible: false,
    premium: false,
    offline: false,
    average: null as any,
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
    applyTheme(this);
    this.load();
  },
  async load() {
    try {
      const b = await bootstrap();
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
      this.render(await history(this.data.range, this.data.period));
    } catch {
      const locked = cachedAccess().type === 'FREE' && !['today', '7'].includes(this.data.range);
      this.setData({ offline: true, locked });
      this.render(locked ? [] : offlineHistory(this.data.range, this.data.period));
    }
  },
  render(rows: Session[]) {
    const points = trendPoints(rows, this.data.range);
    this.setData({
      points,
      rows: rows
        .slice(-10)
        .reverse()
        .map((s) => ({
          ...s,
          label: dateKey(s.measuredAt).slice(5) + ' ' + timeText(s.measuredAt),
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
  chooseRange(e: any) {
    this.setData({ range: e.currentTarget.dataset.key });
    this.load();
  },
  choosePeriod(e: any) {
    this.setData({ period: e.currentTarget.dataset.key });
    this.load();
  },
  access() {
    wx.navigateTo({ url: '/pages/access/index' });
  },
  async export() {
    try {
      await exportData('json');
    } catch (e) {
      errorToast(e);
    }
  },
  records() {
    wx.navigateTo({ url: '/pages/records/index?range=' + this.data.range });
  },
});
