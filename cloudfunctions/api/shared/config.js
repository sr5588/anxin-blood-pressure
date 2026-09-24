"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HISTORY_TIMEZONE = exports.FeatureFlags = exports.TimePeriodConfig = exports.MedicalConfig = exports.DAY_MS = void 0;
exports.DAY_MS = 86400000;
exports.MedicalConfig = {
    guidelineVersion: '中国高血压防治指南（2024年修订版）',
    guidelineUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11937835/',
    homeBpThreshold: { systolic: 135, diastolic: 85 },
    repeatMeasurementDifference: 10,
    repeatIntervalMinSeconds: 30,
    repeatIntervalRecommendedSeconds: 60,
    preparationSeconds: 300,
    inputRanges: { systolic: [60, 260], diastolic: [30, 180], pulse: [30, 220] },
    emergencySafetyRules: {
        systolic: 180,
        diastolic: 120,
        lowSystolic: 90,
        lowDiastolic: 60,
        urgentSymptoms: ['chest', 'breath', 'weakness'],
    },
    safetyPolicyNote: '安全分流阈值不用于诊断；急症症状优先于读数。上线前需临床复核。',
};
exports.TimePeriodConfig = [
    { key: 'morning', start: 5, end: 10 },
    { key: 'daytime', start: 10, end: 18 },
    { key: 'evening', start: 18, end: 22 },
    { key: 'bedtime', start: 22, end: 29 },
];
exports.FeatureFlags = { ENABLE_REAL_PAYMENT: false, ENABLE_MOCK_PAYMENT: true };
exports.HISTORY_TIMEZONE = 'Asia/Shanghai';
