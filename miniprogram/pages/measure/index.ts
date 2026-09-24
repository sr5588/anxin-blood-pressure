import { applyTheme } from '../../services/theme';
import { WheelFeedback } from '../../services/wheel-feedback';
import { MedicalConfig } from '../../../shared/config';
import { Reading, Session, Context } from '../../../shared/types';
import {
  average,
  needsThird,
  normalizeSession,
  dateKey,
  timeText,
  safetyMessage,
} from '../../../shared/domain';
import { saveSession, errorToast } from '../../services/api';
import { storage, uid, localAll } from '../../services/local';
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const C = MedicalConfig;
Page({
  data: {
    stage: 'prepare',
    showDetails: false,
    soundOn: storage.get('wheelSound', true),
    resumed: false,
    step: 1,
    seconds: C.preparationSeconds as number,
    remaining: 60,
    canContinue: false,
    values: [68, 46, 38],
    systolics: range(...C.inputRanges.systolic),
    diastolics: range(...C.inputRanges.diastolic),
    pulses: range(...C.inputRanges.pulse),
    timeEdited: false,
    confirmed: false,
    scrolling: false,
    saving: false,
    date: dateKey(Date.now()),
    time: timeText(Date.now()),
    maxDate: dateKey(Date.now()),
    context: { symptoms: [], irregularHeartbeat: false } as Context,
    readings: [] as Reading[],
    sessionId: '',
    result: null as any,
    safety: null as any,
    synced: false,
    waitEnd: 0,
    third: false,
    prepEnd: 0,
    armOptions: [
      { key: 'left', label: '🫲 左臂' },
      { key: 'right', label: '🫱 右臂' },
    ],
    postureOptions: [
      { key: 'sitting', label: '🪑 坐位' },
      { key: 'standing', label: '🧍 站立位' },
    ],
    medOptions: [
      { key: 'before', label: '💊 服药前' },
      { key: 'after', label: '💊 服药后' },
    ],
    symptomOptions: [
      { key: 'dizzy', label: '😵 头晕' },
      { key: 'headache', label: '🤕 头痛' },
      { key: 'palpitation', label: '♡ 心慌' },
      { key: 'chest', label: '🫁 胸闷 / 胸痛' },
      { key: 'breath', label: '呼吸困难' },
      { key: 'weakness', label: '突发一侧无力' },
    ],
  },
  feedback: new WheelFeedback(),
  timer: null as ReturnType<typeof setInterval> | null,
  async onLoad() {
    this.setData({
      date: dateKey(Date.now()),
      time: timeText(Date.now()),
      maxDate: dateKey(Date.now()),
      soundOn: storage.get<boolean>('wheelSound', true),
    });
    const draft = storage.get<any>('draft', null);
    this.feedback.init();
    if (draft && draft.readings?.length) {
      this.setData({ ...draft, saving: false, scrolling: false, resumed: true });
      return;
    }
    this.setData({ stage: storage.get('preparationSeen', false) ? 'input' : 'prepare' });
    const rows = localAll()
        .filter((s) => !s.deletedAt)
        .sort((a, b) => a.measuredAt - b.measuredAt),
      last = rows.pop();
    this.setData({
      sessionId: uid('session'),
      values: last
        ? [
            last.average.systolic - C.inputRanges.systolic[0],
            last.average.diastolic - C.inputRanges.diastolic[0],
            last.average.pulse - C.inputRanges.pulse[0],
          ]
        : [68, 46, 38],
    });
  },
  onShow() {
    applyTheme(this);
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
  },
  onHide() {
    this.stop();
    this.persist();
  },
  onUnload() {
    this.feedback.destroy();
    this.stop();
    this.persist();
  },
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  persist() {
    if (this.data.stage !== 'done')
      storage.set('draft', { ...this.data, saving: false, scrolling: false });
  },
  tick() {
    if (this.data.stage === 'wait') {
      const remaining = Math.max(0, Math.ceil((this.data.waitEnd - Date.now()) / 1000));
      this.setData({
        remaining,
        canContinue: remaining <= C.repeatIntervalRecommendedSeconds - C.repeatIntervalMinSeconds,
      });
    }
    if (this.data.prepEnd && this.data.stage === 'prepare')
      this.setData({ seconds: Math.max(0, Math.ceil((this.data.prepEnd - Date.now()) / 1000)) });
  },
  startPrep() {
    this.setData({
      prepEnd: Date.now() + C.preparationSeconds * 1000,
      seconds: C.preparationSeconds,
    });
  },
  ready() {
    storage.set('preparationSeen', true);
    this.setData({ stage: 'input', confirmed: false, prepEnd: 0 });
  },
  changing() {
    this.setData({ scrolling: true, confirmed: false });
    this.feedback.tick();
  },
  changed(e: any) {
    this.setData({ values: e.detail.value, scrolling: false, confirmed: true });
    this.feedback.settle();
  },
  scrollEnd() {
    this.setData({ scrolling: false });
  },
  toggleDetails() {
    this.setData({ showDetails: !this.data.showDetails });
  },
  toggleSound() {
    const soundOn = !this.data.soundOn;
    storage.set('wheelSound', soundOn);
    this.setData({ soundOn });
  },
  confirmAndSave() {
    if (this.data.scrolling || this.data.saving) return;
    this.setData({ confirmed: true });
    return this.save();
  },
  confirm() {
    if (!this.data.scrolling) this.setData({ confirmed: !this.data.confirmed });
  },
  dateChange(e: any) {
    this.setData({ date: e.detail.value, timeEdited: true, confirmed: false });
  },
  timeChange(e: any) {
    this.setData({ time: e.detail.value, timeEdited: true, confirmed: false });
  },
  choose(e: any) {
    const { field, value } = e.currentTarget.dataset;
    this.setData({
      ['context.' + field]: (this.data.context as any)[field] === value ? null : value,
    });
  },
  symptom(e: any) {
    const key = e.currentTarget.dataset.key;
    let symptoms = this.data.context.symptoms.slice();
    symptoms = symptoms.includes(key)
      ? symptoms.filter((s: string) => s !== key)
      : [...symptoms, key];
    this.setData({
      'context.symptoms': symptoms,
      symptomOptions: this.data.symptomOptions.map((o: any) => ({
        ...o,
        selected: symptoms.includes(o.key),
      })),
    });
    const safety = safetyMessage({ systolic: 0, diastolic: 0 }, symptoms);
    if (safety.level === 'urgent')
      wx.showModal({ title: '⚠ 请先关注身体不适', content: safety.text, showCancel: false });
  },
  none() {
    this.setData({
      'context.symptoms': [],
      symptomOptions: this.data.symptomOptions.map((o: any) => ({ ...o, selected: false })),
    });
  },
  irregular() {
    this.setData({ 'context.irregularHeartbeat': !this.data.context.irregularHeartbeat });
  },
  async save() {
    if (!this.data.confirmed || this.data.saving || this.data.scrolling) return;
    this.setData({ saving: true });
    try {
      const [s, d, p] = this.data.values;
      const firstTime = Date.parse(this.data.date + 'T' + this.data.time + ':00+08:00');
      const measuredAt = this.data.timeEdited ? firstTime : Date.now();
      const reading: Reading = {
        readingId: uid('reading'),
        systolic: s + C.inputRanges.systolic[0],
        diastolic: d + C.inputRanges.diastolic[0],
        pulse: p + C.inputRanges.pulse[0],
        measuredAt,
      };
      const readings = [...this.data.readings, reading];
      const third = readings.length === 2 && needsThird(readings[0], readings[1]);
      const done = readings.length === 3 || (readings.length === 2 && !third);
      const session = normalizeSession({
        sessionId: this.data.sessionId,
        readings,
        context: this.data.context,
        status: done ? 'complete' : 'in_progress',
      } as Session);
      const safety = safetyMessage(reading, this.data.context.symptoms);
      const synced = await saveSession(session);
      this.setData({
        readings,
        safety,
        synced,
        confirmed: false,
        third,
        symptomOptions: this.data.symptomOptions,
      });
      if (done) {
        this.setData({ stage: 'done', result: average(readings) });
        storage.set('draft', null);
      } else {
        this.setData({
          stage: 'wait',
          waitEnd: Date.now() + C.repeatIntervalRecommendedSeconds * 1000,
          remaining: C.repeatIntervalRecommendedSeconds,
          canContinue: false,
        });
        this.persist();
      }
      if (safety.level === 'urgent')
        await wx.showModal({ title: '⚠ 安全提醒', content: safety.text, showCancel: false });
    } catch (e) {
      errorToast(e);
    } finally {
      this.setData({ saving: false });
    }
  },
  next() {
    this.tick();
    if (this.data.canContinue)
      this.setData({ stage: 'input', step: this.data.readings.length + 1, confirmed: false });
  },
  async finishEarly() {
    const readings = this.data.readings;
    const synced = await saveSession(
      normalizeSession({
        sessionId: this.data.sessionId,
        readings,
        context: this.data.context,
        status: 'partial',
      } as Session),
    );
    this.setData({ stage: 'done', result: average(readings), synced });
    storage.set('draft', null);
  },
  home() {
    wx.switchTab({ url: '/pages/today/index' });
  },
});
