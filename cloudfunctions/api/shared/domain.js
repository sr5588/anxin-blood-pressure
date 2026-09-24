"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateKey = dateKey;
exports.timeText = timeText;
exports.dayStart = dayStart;
exports.getFreeHistoryStartDate = getFreeHistoryStartDate;
exports.periodOf = periodOf;
exports.rangeStart = rangeStart;
exports.validateReading = validateReading;
exports.average = average;
exports.needsThird = needsThird;
exports.normalizeSession = normalizeSession;
exports.safetyMessage = safetyMessage;
exports.getEffectiveHistoryAccess = getEffectiveHistoryAccess;
exports.grantWindow = grantWindow;
exports.visibleSessions = visibleSessions;
exports.trendPoints = trendPoints;
exports.exportCSV = exportCSV;
const config_1 = require("./config");
const OFFSET = 8 * 3600000;
function dateKey(ms) {
    return new Date(ms + OFFSET).toISOString().slice(0, 10);
}
function timeText(ms) {
    return new Date(ms + OFFSET).toISOString().slice(11, 16);
}
function dayStart(ms) {
    return Date.parse(dateKey(ms) + 'T00:00:00+08:00');
}
function getFreeHistoryStartDate(now = Date.now()) {
    return dayStart(now) - 6 * config_1.DAY_MS;
}
function periodOf(ms) {
    const h = new Date(ms + OFFSET).getUTCHours();
    return config_1.TimePeriodConfig.find((p) => (h < 5 ? h + 24 : h) >= p.start && (h < 5 ? h + 24 : h) < p.end).key;
}
function rangeStart(range, now) {
    return range === 'all' ? 0 : dayStart(now) - (range === 'today' ? 0 : Number(range) - 1) * config_1.DAY_MS;
}
function validateReading(r, now = Date.now()) {
    for (const key of ['systolic', 'diastolic', 'pulse']) {
        const [min, max] = config_1.MedicalConfig.inputRanges[key];
        if (!Number.isInteger(r[key]) || r[key] < min || r[key] > max)
            throw new Error('读数超出支持范围，请核对血压计');
    }
    if (r.systolic <= r.diastolic)
        throw new Error('收缩压应高于舒张压，请核对读数');
    if (!Number.isFinite(r.measuredAt) ||
        r.measuredAt < Date.UTC(2000, 0, 1) ||
        r.measuredAt > now + 60000)
        throw new Error('测量时间无效或晚于现在');
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(r.readingId))
        throw new Error('记录标识无效');
}
function average(readings) {
    if (!readings.length)
        throw new Error('没有测量读数');
    const mean = (k) => Math.round(readings.reduce((n, r) => n + r[k], 0) / readings.length);
    return { systolic: mean('systolic'), diastolic: mean('diastolic'), pulse: mean('pulse') };
}
function needsThird(a, b) {
    return (Math.abs(a.systolic - b.systolic) >= config_1.MedicalConfig.repeatMeasurementDifference ||
        Math.abs(a.diastolic - b.diastolic) >= config_1.MedicalConfig.repeatMeasurementDifference);
}
function normalizeSession(input, now = Date.now()) {
    if (!input ||
        !/^[a-zA-Z0-9_-]{6,80}$/.test(input.sessionId) ||
        !Array.isArray(input.readings) ||
        input.readings.length < 1 ||
        input.readings.length > 3)
        throw new Error('测量组无效');
    input.readings.forEach((r) => validateReading(r, now));
    if (new Set(input.readings.map((r) => r.readingId)).size !== input.readings.length)
        throw new Error('重复读数');
    if (!['in_progress', 'partial', 'complete'].includes(input.status))
        throw new Error('测量状态无效');
    if (input.status === 'complete' &&
        (input.readings.length < 2 ||
            (input.readings.length === 2 && needsThird(...input.readings))))
        throw new Error('本组需要继续复测或按未完成保存');
    const context = { symptoms: [], irregularHeartbeat: false };
    if (input.context) {
        if (['left', 'right'].includes(input.context.arm))
            context.arm = input.context.arm;
        if (['sitting', 'standing'].includes(input.context.posture))
            context.posture = input.context.posture;
        if (['before', 'after'].includes(input.context.medication))
            context.medication = input.context.medication;
        context.symptoms = Array.isArray(input.context.symptoms)
            ? input.context.symptoms.filter((s) => ['dizzy', 'headache', 'palpitation', 'chest', 'breath', 'weakness'].includes(s))
            : [];
        context.irregularHeartbeat = input.context.irregularHeartbeat === true;
    }
    return {
        sessionId: input.sessionId,
        readings: input.readings.map((r) => ({
            readingId: r.readingId,
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse,
            measuredAt: r.measuredAt,
        })),
        measuredAt: input.readings[0].measuredAt,
        period: periodOf(input.readings[0].measuredAt),
        context,
        average: average(input.readings),
        status: input.status,
        createdAt: Math.min(now, input.readings[0].measuredAt),
        updatedAt: now,
        deletedAt: null,
        schemaVersion: 1,
    };
}
function safetyMessage(r, symptoms = []) {
    const c = config_1.MedicalConfig.emergencySafetyRules;
    if (symptoms.some((s) => c.urgentSymptoms.includes(s)))
        return {
            level: 'urgent',
            text: '若有胸痛、明显呼吸困难，或突发一侧无力、言语不清，请立即呼叫120或急诊就医，不要等待复测。',
        };
    if (r.systolic >= c.systolic || r.diastolic >= c.diastolic)
        return {
            level: 'urgent',
            text: '本次读数明显偏高。若有胸痛、呼吸困难或突发无力，请立即呼叫120。无上述症状时请安静休息后复测，并尽快联系医疗人员。',
        };
    if (r.systolic < c.lowSystolic || r.diastolic < c.lowDiastolic)
        return {
            level: 'attention',
            text: '本次读数偏低。如有头晕、乏力或不适，请咨询医生；出现晕厥等严重症状请及时急诊就医。',
        };
    if (r.systolic >= config_1.MedicalConfig.homeBpThreshold.systolic ||
        r.diastolic >= config_1.MedicalConfig.homeBpThreshold.diastolic)
        return {
            level: 'attention',
            text: '本次家庭血压较高。请继续规范监测，并根据个人情况咨询医生。单次读数不能用于诊断。',
        };
    return { level: 'normal', text: '继续规律记录，关注长期变化。请勿根据记录自行调整用药。' };
}
function getEffectiveHistoryAccess(grants, now = Date.now()) {
    const valid = grants.filter((g) => g.status === 'active' &&
        g.entitlementKey === 'history_access' &&
        g.startsAt <= now &&
        (g.isLifetime || (g.expiresAt !== null && g.expiresAt > now)));
    const life = valid.find((g) => g.isLifetime);
    if (life)
        return {
            type: 'LIFETIME',
            startsAt: life.startsAt,
            expiresAt: null,
            source: life.source,
            remainingTime: null,
        };
    for (const trial of [false, true]) {
        const pool = grants
            .filter((g) => g.status === 'active' &&
            g.entitlementKey === 'history_access' &&
            !g.isLifetime &&
            (g.source === 'trial') === trial &&
            g.expiresAt !== null &&
            g.expiresAt > now)
            .sort((a, b) => a.startsAt - b.startsAt);
        let start = null, end = 0, source = null;
        for (const g of pool) {
            if (g.startsAt <= (end || now)) {
                start = start === null ? g.startsAt : Math.min(start, g.startsAt);
                end = Math.max(end, g.expiresAt);
                source = g.source;
            }
        }
        if (start !== null && end > now)
            return {
                type: trial ? 'TRIAL' : 'TIME_LIMITED',
                startsAt: start,
                expiresAt: end,
                source,
                remainingTime: end - now,
            };
    }
    return { type: 'FREE', startsAt: null, expiresAt: null, source: null, remainingTime: 0 };
}
function grantWindow(grants, days, lifetime, now) {
    const access = getEffectiveHistoryAccess(grants, now);
    const start = access.type === 'TIME_LIMITED' ? access.expiresAt : now;
    return {
        startsAt: now,
        expiresAt: lifetime ? null : start + (days || 0) * config_1.DAY_MS,
        isLifetime: lifetime,
    };
}
function visibleSessions(all, access, range, now, period = 'all') {
    if (access.type === 'FREE' && !['today', '7'].includes(range))
        return [];
    const start = Math.max(rangeStart(range, now), access.type === 'FREE' ? getFreeHistoryStartDate(now) : 0);
    return all
        .filter((s) => !s.deletedAt &&
        s.measuredAt >= start &&
        s.measuredAt <= now &&
        (period === 'all' || s.period === period))
        .sort((a, b) => a.measuredAt - b.measuredAt);
}
function trendPoints(sessions, range) {
    if (range === 'today')
        return sessions.map((s) => ({ label: timeText(s.measuredAt), ...s.average, count: 1 }));
    const grouped = {};
    sessions.forEach((s) => { var _a; return (grouped[_a = dateKey(s.measuredAt)] || (grouped[_a] = [])).push(s); });
    return Object.keys(grouped)
        .sort()
        .map((day) => ({
        label: day.slice(5),
        systolic: Math.round(grouped[day].reduce((n, s) => n + s.average.systolic, 0) / grouped[day].length),
        diastolic: Math.round(grouped[day].reduce((n, s) => n + s.average.diastolic, 0) / grouped[day].length),
        count: grouped[day].length,
    }));
}
function exportCSV(sessions) {
    const header = 'sessionId,readingId,measuredAt,timezone,systolic,diastolic,pulse,period,arm,posture,medication,symptoms,irregularHeartbeat,sessionStatus';
    const cell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return ('\uFEFF' +
        [
            header,
            ...sessions
                .filter((s) => !s.deletedAt)
                .flatMap((s) => s.readings.map((r) => [
                s.sessionId,
                r.readingId,
                new Date(r.measuredAt).toISOString(),
                'Asia/Shanghai',
                r.systolic,
                r.diastolic,
                r.pulse,
                s.period,
                s.context.arm,
                s.context.posture,
                s.context.medication,
                s.context.symptoms.join('|'),
                s.context.irregularHeartbeat,
                s.status,
            ]
                .map(cell)
                .join(','))),
        ].join('\r\n'));
}
