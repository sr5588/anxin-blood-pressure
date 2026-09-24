"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("../../services/theme");
const wheel_feedback_1 = require("../../services/wheel-feedback");
const config_1 = require("../../shared/config");
const domain_1 = require("../../shared/domain");
const api_1 = require("../../services/api");
const local_1 = require("../../services/local");
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const C = config_1.MedicalConfig;
Page({
    data: {
        stage: 'prepare',
        showDetails: false,
        soundOn: local_1.storage.get('wheelSound', true),
        resumed: false,
        step: 1,
        seconds: C.preparationSeconds,
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
        date: (0, domain_1.dateKey)(Date.now()),
        time: (0, domain_1.timeText)(Date.now()),
        maxDate: (0, domain_1.dateKey)(Date.now()),
        context: { symptoms: [], irregularHeartbeat: false },
        readings: [],
        sessionId: '',
        result: null,
        safety: null,
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
    feedback: new wheel_feedback_1.WheelFeedback(),
    timer: null,
    async onLoad() {
        this.setData({
            date: (0, domain_1.dateKey)(Date.now()),
            time: (0, domain_1.timeText)(Date.now()),
            maxDate: (0, domain_1.dateKey)(Date.now()),
            soundOn: local_1.storage.get('wheelSound', true),
        });
        const draft = local_1.storage.get('draft', null);
        this.feedback.init();
        if (draft && draft.readings?.length) {
            this.setData({ ...draft, saving: false, scrolling: false, resumed: true });
            return;
        }
        this.setData({ stage: local_1.storage.get('preparationSeen', false) ? 'input' : 'prepare' });
        const rows = (0, local_1.localAll)()
            .filter((s) => !s.deletedAt)
            .sort((a, b) => a.measuredAt - b.measuredAt), last = rows.pop();
        this.setData({
            sessionId: (0, local_1.uid)('session'),
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
        (0, theme_1.applyTheme)(this);
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
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    },
    persist() {
        if (this.data.stage !== 'done')
            local_1.storage.set('draft', { ...this.data, saving: false, scrolling: false });
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
        local_1.storage.set('preparationSeen', true);
        this.setData({ stage: 'input', confirmed: false, prepEnd: 0 });
    },
    changing() {
        this.setData({ scrolling: true, confirmed: false });
        this.feedback.tick();
    },
    changed(e) {
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
        local_1.storage.set('wheelSound', soundOn);
        this.setData({ soundOn });
    },
    confirmAndSave() {
        if (this.data.scrolling || this.data.saving)
            return;
        this.setData({ confirmed: true });
        return this.save();
    },
    confirm() {
        if (!this.data.scrolling)
            this.setData({ confirmed: !this.data.confirmed });
    },
    dateChange(e) {
        this.setData({ date: e.detail.value, timeEdited: true, confirmed: false });
    },
    timeChange(e) {
        this.setData({ time: e.detail.value, timeEdited: true, confirmed: false });
    },
    choose(e) {
        const { field, value } = e.currentTarget.dataset;
        this.setData({
            ['context.' + field]: this.data.context[field] === value ? null : value,
        });
    },
    symptom(e) {
        const key = e.currentTarget.dataset.key;
        let symptoms = this.data.context.symptoms.slice();
        symptoms = symptoms.includes(key)
            ? symptoms.filter((s) => s !== key)
            : [...symptoms, key];
        this.setData({
            'context.symptoms': symptoms,
            symptomOptions: this.data.symptomOptions.map((o) => ({
                ...o,
                selected: symptoms.includes(o.key),
            })),
        });
        const safety = (0, domain_1.safetyMessage)({ systolic: 0, diastolic: 0 }, symptoms);
        if (safety.level === 'urgent')
            wx.showModal({ title: '⚠ 请先关注身体不适', content: safety.text, showCancel: false });
    },
    none() {
        this.setData({
            'context.symptoms': [],
            symptomOptions: this.data.symptomOptions.map((o) => ({ ...o, selected: false })),
        });
    },
    irregular() {
        this.setData({ 'context.irregularHeartbeat': !this.data.context.irregularHeartbeat });
    },
    async save() {
        if (!this.data.confirmed || this.data.saving || this.data.scrolling)
            return;
        this.setData({ saving: true });
        try {
            const [s, d, p] = this.data.values;
            const firstTime = Date.parse(this.data.date + 'T' + this.data.time + ':00+08:00');
            const measuredAt = this.data.timeEdited ? firstTime : Date.now();
            const reading = {
                readingId: (0, local_1.uid)('reading'),
                systolic: s + C.inputRanges.systolic[0],
                diastolic: d + C.inputRanges.diastolic[0],
                pulse: p + C.inputRanges.pulse[0],
                measuredAt,
            };
            const readings = [...this.data.readings, reading];
            const third = readings.length === 2 && (0, domain_1.needsThird)(readings[0], readings[1]);
            const done = readings.length === 3 || (readings.length === 2 && !third);
            const session = (0, domain_1.normalizeSession)({
                sessionId: this.data.sessionId,
                readings,
                context: this.data.context,
                status: done ? 'complete' : 'in_progress',
            });
            const safety = (0, domain_1.safetyMessage)(reading, this.data.context.symptoms);
            const synced = await (0, api_1.saveSession)(session);
            this.setData({
                readings,
                safety,
                synced,
                confirmed: false,
                third,
                symptomOptions: this.data.symptomOptions,
            });
            if (done) {
                this.setData({ stage: 'done', result: (0, domain_1.average)(readings) });
                local_1.storage.set('draft', null);
            }
            else {
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
        }
        catch (e) {
            (0, api_1.errorToast)(e);
        }
        finally {
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
        const synced = await (0, api_1.saveSession)((0, domain_1.normalizeSession)({
            sessionId: this.data.sessionId,
            readings,
            context: this.data.context,
            status: 'partial',
        }));
        this.setData({ stage: 'done', result: (0, domain_1.average)(readings), synced });
        local_1.storage.set('draft', null);
    },
    home() {
        wx.switchTab({ url: '/pages/today/index' });
    },
});
