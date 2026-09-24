import { applyTheme } from '../../services/theme';
import { history, offlineHistory, deleteOne, errorToast } from '../../services/api';
import { dateKey, timeText } from '../../../shared/domain';
import { Range, Session } from '../../../shared/types';
Page({
  onShow() {
    applyTheme(this);
  },
  data: { rows: [] as any[], offline: false },
  range: '7' as Range,
  day: '',
  async onLoad(options: any) {
    this.range = options.range || '7';
    this.day = options.day || '';
    await this.load();
  },
  async load() {
    let rows: Session[];
    try {
      rows = await history(this.range);
      this.setData({ offline: false });
    } catch {
      rows = offlineHistory(this.range);
      this.setData({ offline: true });
    }
    this.setData({
      rows: rows
        .filter((s) => !this.day || dateKey(s.measuredAt) === this.day)
        .reverse()
        .map((s) => ({
          ...s,
          label: dateKey(s.measuredAt) + ' ' + timeText(s.measuredAt),
          raw: s.readings.map((r) => ({ ...r, time: timeText(r.measuredAt) })),
        })),
    });
  },
  async remove(e: any) {
    const r = await wx.showModal({
      title: '删除这组记录？',
      content: '将删除本机与备份中的这组原始读数。可取消此操作；确认删除后不能恢复。',
      confirmText: '删除记录',
      confirmColor: '#aa543a',
    });
    if (!r.confirm) return;
    try {
      await deleteOne(e.currentTarget.dataset.id);
      await this.load();
    } catch (e) {
      errorToast(e);
    }
  },
});
