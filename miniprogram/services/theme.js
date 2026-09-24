"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentTheme = currentTheme;
exports.applyTheme = applyTheme;
exports.setTheme = setTheme;
exports.watchTheme = watchTheme;
function currentTheme() {
    const saved = wx.getStorageSync('anxin:theme');
    if (saved === 'dark' || saved === 'light')
        return saved;
    return wx.getAppBaseInfo().theme === 'dark' ? 'dark' : 'light';
}
function applyTheme(page) {
    const theme = currentTheme(), dark = theme === 'dark';
    page.setData({ theme });
    wx.setNavigationBarColor({
        frontColor: dark ? '#ffffff' : '#000000',
        backgroundColor: dark ? '#101824' : '#f7f8fa',
    });
    wx.setBackgroundColor({ backgroundColor: dark ? '#101824' : '#f7f8fa' });
    wx.setTabBarStyle({
        color: dark ? '#94a4ba' : '#7a8da5',
        selectedColor: dark ? '#82baff' : '#277dee',
        backgroundColor: dark ? '#16202e' : '#ffffff',
        borderStyle: dark ? 'black' : 'white',
        fail: () => { },
    });
}
function setTheme(theme) {
    wx.setStorageSync('anxin:theme', theme);
    const pages = getCurrentPages();
    if (pages.length)
        applyTheme(pages[pages.length - 1]);
}
function watchTheme() {
    wx.onThemeChange(() => {
        const pages = getCurrentPages();
        if (pages.length)
            applyTheme(pages[pages.length - 1]);
    });
}
