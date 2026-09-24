"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
exports.initLocal = initLocal;
exports.localAll = localAll;
exports.putLocal = putLocal;
exports.pendingLocal = pendingLocal;
exports.removeLocal = removeLocal;
exports.clearLocal = clearLocal;
exports.uid = uid;
const config_1 = require("../config");
const fs = () => wx.getFileSystemManager();
const userScope = () => config_1.AppConfig.provider === 'cloud' ? wx.getStorageSync('anxin:cloud:activeUser') || 'unbound' : '';
const root = () => wx.env.USER_DATA_PATH + '/anxin-' + config_1.AppConfig.provider + (userScope() ? '-' + userScope() : '');
const storageKey = (key) => 'anxin:' + config_1.AppConfig.provider + ':' + (userScope() ? userScope() + ':' : '') + key;
function initLocal() {
    try {
        fs().accessSync(root());
    }
    catch {
        fs().mkdirSync(root(), true);
    }
}
function localAll() {
    initLocal();
    return fs()
        .readdirSync(root())
        .filter((n) => n.endsWith('.json'))
        .map((n) => {
        try {
            return JSON.parse(fs().readFileSync(root() + '/' + n, 'utf8'));
        }
        catch {
            throw new Error('本地记录读取失败，请勿清理应用数据');
        }
    });
}
function putLocal(s, synced = false) {
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(s.sessionId))
        throw new Error('记录标识无效');
    initLocal();
    const path = root() + '/' + s.sessionId + '.json';
    fs().writeFileSync(path + '.tmp', JSON.stringify({ ...s, _syncedUpdatedAt: synced ? s.updatedAt : 0 }), 'utf8');
    fs().renameSync(path + '.tmp', path);
}
function pendingLocal() {
    return localAll().filter((s) => s._syncedUpdatedAt !== s.updatedAt);
}
function removeLocal(id) {
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(id))
        throw new Error('记录标识无效');
    initLocal();
    if (fs()
        .readdirSync(root())
        .includes(id + '.json'))
        fs().unlinkSync(root() + '/' + id + '.json');
}
function clearLocal() {
    initLocal();
    for (const file of fs().readdirSync(root()))
        if (file.endsWith('.json') || file.endsWith('.tmp'))
            fs().unlinkSync(root() + '/' + file);
}
function uid(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}
exports.storage = {
    get(key, fallback) {
        const value = wx.getStorageSync(storageKey(key));
        return value === '' || value === null || value === undefined ? fallback : value;
    },
    set(key, value) {
        wx.setStorageSync(storageKey(key), value);
    },
};
