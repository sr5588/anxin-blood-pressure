export type Theme = 'light' | 'dark';
export function currentTheme(): Theme {
  const saved = wx.getStorageSync('anxin:theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return wx.getAppBaseInfo().theme === 'dark' ? 'dark' : 'light';
}
export function applyTheme(page: { setData: (data: Record<string, unknown>) => void }) {
  const theme = currentTheme(),
    dark = theme === 'dark';
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
    fail: () => {},
  });
}
export function setTheme(theme: Theme) {
  wx.setStorageSync('anxin:theme', theme);
  const pages = getCurrentPages();
  if (pages.length) applyTheme(pages[pages.length - 1]);
}
export function watchTheme() {
  wx.onThemeChange(() => {
    const pages = getCurrentPages();
    if (pages.length) applyTheme(pages[pages.length - 1]);
  });
}
