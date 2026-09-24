"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const theme_1 = require("./services/theme");
const config_1 = require("./config");
App({
    globalData: { lastError: '' },
    onLaunch() {
        (0, theme_1.watchTheme)();
        if (config_1.AppConfig.provider === 'cloud' && config_1.AppConfig.cloudEnv)
            wx.cloud.init({ env: config_1.AppConfig.cloudEnv, traceUser: false });
    },
    onError(message) {
        if (config_1.AppConfig.provider === 'mock')
            this.globalData.lastError = message;
    },
});
