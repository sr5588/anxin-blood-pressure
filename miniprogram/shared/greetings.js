"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayGreetings = void 0;
exports.dailyGreeting = dailyGreeting;
const domain_1 = require("./domain");
const config_1 = require("./config");
// Annual lunar dates are versioned, never repeated as fixed solar dates.
// 2026 source: https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html
exports.HolidayGreetings = {
    '01-01': '新的一年，愿你平安喜乐，日日有暖。',
    '05-01': '今天慢一点，把好时光留给自己。',
    '10-01': '山河锦绣，愿你与家人共享好时光。',
    '2026-02-17': '新春快乐，愿家人围坐，灯火可亲。',
    '2026-06-19': '端午安康，愿日子有清香，身边有牵挂。',
    '2026-09-25': '月圆人安，愿每一份牵挂都有团圆。',
};
const lines = {
    spring: [
        '春光正好，愿你心里有暖，眼里有光。',
        '花开有时，愿今天也有小小的欢喜。',
        '一窗春色，一份好心情，送给今天的你。',
        '春风轻轻来，愿你日日都自在。',
        '和喜欢的人说说话，就是好时光。',
        '把日子过慢些，让春光住进心里。',
        '新绿满枝头，愿今天万事温柔。',
        '阳光落在身上，幸福就在身旁。',
        '愿你走过的每一步，都有花香相伴。',
        '春天有信，好事会慢慢来到。',
        '一餐一饭，一笑一暖，都是幸福。',
        '窗外花开，愿你的心情也明亮。',
    ],
    summer: [
        '清风拂过，愿今天清爽又舒心。',
        '日子亮堂堂，心情也要甜一点。',
        '一杯温水，一阵清风，好好照顾自己。',
        '夏日悠长，愿你把欢喜慢慢收藏。',
        '树荫里歇一歇，生活不必着急。',
        '有家人的惦记，每一天都很温暖。',
        '愿你心有清凉，身边常有笑声。',
        '阳光很好，平安相伴就是幸福。',
        '慢慢吃饭，好好休息，把日子过甜。',
        '愿今天的好心情，像夏花一样明亮。',
        '听一听风声，给自己片刻轻松。',
        '把平常的一天，过成喜欢的样子。',
    ],
    autumn: [
        '秋风温柔，愿你平安，也有小小的欢喜。',
        '一叶知秋，愿身边的温暖一直都在。',
        '天凉添件衣，心里留一份暖。',
        '把好心情晒一晒，今天也会亮堂堂。',
        '秋日不忙，愿你和家人慢享时光。',
        '愿生活有收获，心中有牵挂。',
        '一碗热汤，一声问候，都是幸福。',
        '秋光正好，愿今天从容又自在。',
        '日子平平常常，有你就暖暖的。',
        '愿每一份惦念，都化成身边的温暖。',
        '看一看窗外，今天也有值得开心的事。',
        '秋意渐浓，愿你常安常乐。',
    ],
    winter: [
        '冬日有暖阳，愿你心里也暖洋洋。',
        '天冷了，记得添衣，也记得开心。',
        '围坐一桌热饭，就是最暖的幸福。',
        '愿窗外有阳光，身边有人惦记。',
        '慢慢来，平安的每一天都值得珍惜。',
        '手心暖一点，日子甜一点。',
        '愿你三餐温热，四季安心。',
        '冬天的好消息，是家人都平安。',
        '给自己泡杯温水，歇一歇也很好。',
        '屋里暖暖的，心里亮亮的。',
        '愿每一个寻常日子，都有温柔相伴。',
        '岁月有暖意，平安最珍贵。',
    ],
};
function dailyGreeting(now = Date.now()) {
    const key = (0, domain_1.dateKey)(now), month = Number(key.slice(5, 7)), season = month >= 3 && month <= 5
        ? 'spring'
        : month >= 6 && month <= 8
            ? 'summer'
            : month >= 9 && month <= 11
                ? 'autumn'
                : 'winter';
    return {
        season,
        quote: exports.HolidayGreetings[key] ||
            exports.HolidayGreetings[key.slice(5)] ||
            lines[season][Math.floor((0, domain_1.dayStart)(now) / config_1.DAY_MS) % lines[season].length],
        dateLabel: `${month}月${Number(key.slice(-2))}日`,
    };
}
