import { applyTheme } from '../../services/theme';
import { dateKey, dayStart, getFreeHistoryStartDate, timeText } from '../../../shared/domain';
import { DAY_MS } from '../../../shared/config';
import { bootstrap, history, offlineHistory, cachedAccess } from '../../services/api';
import { Session } from '../../../shared/types';
Page({
  data: {
    month: dateKey(Date.now()).slice(0, 7),
    selected: dateKey(Date.now()),
    cells: [] as any[],
    rows: [] as any[],
    locked: false,
    premium: false,
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    offline: false,
  },
  all: [] as Session[],
  onShow() {
    applyTheme(this);
    this.load();
  },
  async load() {
    try {
      const b = await bootstrap();
      this.setData({ premium: b.access.type !== 'FREE', offline: false });
      this.all = await history(this.data.premium ? 'all' : '7');
    } catch {
      this.setData({ premium: cachedAccess().type !== 'FREE', offline: true });
      this.all = offlineHistory(this.data.premium ? 'all' : '7');
    }
    this.render();
  },
  render() {
    const first = Date.parse(this.data.month + '-01T00:00:00+08:00'),
      offset = (new Date(first + 8 * 3600000).getUTCDay() + 6) % 7;
    const next = new Date(first + 8 * 3600000);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(0);
    const count = next.getUTCDate();
    const cells = Array.from({ length: offset }, (_, i) => ({ key: 'blank' + i, blank: true }));
    for (let d = 1; d <= count; d++) {
      const key = this.data.month + '-' + String(d).padStart(2, '0'),
        ts = Date.parse(key + 'T00:00:00+08:00');
      cells.push({
        key,
        day: d,
        selected: key === this.data.selected,
        locked: !this.data.premium && ts < getFreeHistoryStartDate(),
        future: ts > dayStart(Date.now()),
        done: this.all.some((s: Session) => dateKey(s.measuredAt) === key),
      } as any);
    }
    const locked =
      !this.data.premium &&
      Date.parse(this.data.selected + 'T00:00:00+08:00') < getFreeHistoryStartDate();
    this.setData({
      cells,
      locked,
      rows: locked
        ? []
        : this.all
            .filter((s: Session) => dateKey(s.measuredAt) === this.data.selected)
            .map((s: Session) => ({ ...s, label: timeText(s.measuredAt) })),
    });
  },
  select(e: any) {
    this.setData({ selected: e.currentTarget.dataset.key });
    this.render();
  },
  changeMonth(e: any) {
    const t = new Date(this.data.month + '-15T00:00:00Z');
    t.setUTCMonth(t.getUTCMonth() + Number(e.currentTarget.dataset.delta));
    const month = t.toISOString().slice(0, 7);
    if (month > dateKey(Date.now()).slice(0, 7)) return;
    this.setData({ month, selected: month + '-01' });
    this.render();
  },
  access() {
    wx.navigateTo({ url: '/pages/access/index' });
  },
  details() {
    wx.navigateTo({
      url:
        '/pages/records/index?range=' +
        (this.data.premium ? 'all' : '7') +
        '&day=' +
        this.data.selected,
    });
  },
});
