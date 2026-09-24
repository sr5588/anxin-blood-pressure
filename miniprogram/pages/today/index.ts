import { applyTheme } from '../../services/theme';
import { dailyGreeting } from '../../../shared/greetings';
import { history, offlineHistory, syncPending, errorToast } from '../../services/api';
import { dateKey, timeText, safetyMessage } from '../../../shared/domain';
import { DAY_MS } from '../../../shared/config';
import { Session } from '../../../shared/types';
import { AppConfig } from '../../config';
import { storage } from '../../services/local';
Page({
  data: {
    greeting: '早上好',
    quote: '',
    season: 'autumn',
    dateLabel: '',
    date: '',
    latest: null as any,
    morning: null as any,
    evening: null as any,
    days: [] as any[],
    safety: null as any,
    offline: false,
    mock: AppConfig.provider === 'mock',
    pending: 0,
  },
  async onShow() {
    applyTheme(this);
    const now = Date.now(),
      hour = Number(timeText(now).slice(0, 2));
    this.setData({
      ...dailyGreeting(now),
      greeting: hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好',
      date: dateKey(now).replace(/-/g, ' / '),
    });
    this.render(offlineHistory('7'));
    try {
      await syncPending();
      this.render(await history('7'));
      this.setData({ offline: false });
    } catch {
      this.setData({ offline: true });
    }
  },
  render(rows: Session[]) {
    const today = rows.filter((s) => dateKey(s.measuredAt) === dateKey(Date.now()));
    const latest = rows[rows.length - 1];
    const fmt = (s: Session | undefined) =>
      s
        ? {
            ...s.average,
            time: timeText(s.measuredAt),
            date:
              dateKey(s.measuredAt) === dateKey(Date.now())
                ? '今天'
                : dateKey(s.measuredAt).slice(5),
            count: s.readings.length,
            status: s.status,
          }
        : null;
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = dateKey(Date.now() - (6 - i) * DAY_MS);
      return {
        label: i === 6 ? '今天' : String(Number(day.slice(-2))),
        done: rows.some((s) => dateKey(s.measuredAt) === day),
      };
    });
    this.setData({
      latest: fmt(latest),
      morning: fmt(today.filter((s) => s.period === 'morning').pop()),
      evening: fmt(today.filter((s) => ['evening', 'bedtime'].includes(s.period)).pop()),
      days,
      safety: latest ? safetyMessage(latest.average, latest.context.symptoms) : null,
      pending: storage.get<string[]>('pending', []).length,
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
      await syncPending();
      await this.onShow();
    } catch (e) {
      errorToast(e);
    }
  },
});
