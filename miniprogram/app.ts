import { watchTheme } from './services/theme';
import { AppConfig } from './config';
App({
  globalData: { lastError: '' },
  onLaunch() {
    watchTheme();
    if (AppConfig.provider === 'cloud' && AppConfig.cloudEnv)
      wx.cloud.init({ env: AppConfig.cloudEnv, traceUser: false });
  },
  onError(message: string) {
    if (AppConfig.provider === 'mock') this.globalData.lastError = message;
  },
});
