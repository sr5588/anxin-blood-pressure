"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.call = call;
exports.bootstrap = bootstrap;
exports.cachedAccess = cachedAccess;
exports.saveSession = saveSession;
exports.syncPending = syncPending;
exports.history = history;
exports.offlineHistory = offlineHistory;
exports.allData = allData;
exports.restore = restore;
exports.deleteEverything = deleteEverything;
exports.deleteOne = deleteOne;
exports.exportData = exportData;
exports.errorToast = errorToast;
exports.accessLabel = accessLabel;
const config_1 = require("../config");
const domain_1 = require("../shared/domain");
const local_1 = require("./local");
const mock_1 = require("./mock");
async function call(action, data = {}) {
    if (config_1.AppConfig.provider === 'mock')
        return (0, mock_1.mockCall)(action, data);
    if (!config_1.AppConfig.cloudEnv)
        throw new Error('请先配置CloudBase环境ID');
    const r = await wx.cloud.callFunction({
        name: config_1.AppConfig.functionName,
        data: { action, ...data },
    });
    const result = r.result;
    if (!result?.ok)
        throw Object.assign(new Error(result?.message || '云服务暂时不可用'), { code: result?.code });
    if ((action === 'export' || action === 'restore') && result.data?.url) {
        const file = await new Promise((resolve, reject) => wx.downloadFile({ url: result.data.url, success: resolve, fail: reject }));
        if (file.statusCode !== 200)
            throw new Error('导出文件下载失败');
        const rows = JSON.parse(wx.getFileSystemManager().readFileSync(file.tempFilePath, 'utf8'));
        try {
            await call('cleanupExport', { fileID: result.data.fileID });
            wx.getFileSystemManager().unlinkSync(file.tempFilePath);
        }
        catch { }
        return rows;
    }
    return result.data;
}
async function bootstrap() {
    const b = await call('bootstrap');
    if (config_1.AppConfig.provider === 'cloud' && /^[a-f0-9]{64}$/.test(b.userScope)) {
        const old = wx.getStorageSync('anxin:cloud:activeUser');
        const unbound = !old ? (0, local_1.pendingLocal)() : [];
        wx.setStorageSync('anxin:cloud:activeUser', b.userScope);
        unbound.forEach((s) => (0, local_1.putLocal)(s));
    }
    local_1.storage.set('bootstrap', b);
    return b;
}
function cachedAccess() {
    const a = local_1.storage.get('bootstrap', null)?.access;
    if (!a || (a.expiresAt !== null && a.expiresAt <= Date.now()))
        return (0, domain_1.getEffectiveHistoryAccess)([]);
    return a;
}
async function saveSession(s) {
    s = (0, domain_1.normalizeSession)(s);
    (0, local_1.putLocal)(s);
    local_1.storage.set('pending', (0, local_1.pendingLocal)().map((x) => x.sessionId));
    if (config_1.AppConfig.provider === 'mock') {
        try {
            await syncPending();
            return true;
        }
        catch {
            return false;
        }
    }
    void syncPending().catch(() => { });
    return false;
}
let syncing = null;
function syncPending() {
    if (syncing)
        return syncing;
    syncing = (async () => {
        if (local_1.storage.get('deleting', false))
            throw new Error('请先完成健康数据删除');
        const b = await bootstrap(), savedEpoch = local_1.storage.get('epoch', -1);
        if (savedEpoch !== -1 && savedEpoch !== b.syncEpoch)
            throw new Error('云端数据已重置，请使用恢复云端数据更新本机');
        local_1.storage.set('epoch', b.syncEpoch);
        while (true) {
            const s = (0, local_1.pendingLocal)()[0];
            local_1.storage.set('pending', (0, local_1.pendingLocal)().map((x) => x.sessionId));
            if (!s)
                break;
            try {
                await call('sync', { session: s, epoch: b.syncEpoch });
            }
            catch (e) {
                if (e.code === 'DELETED') {
                    (0, local_1.removeLocal)(s.sessionId);
                    continue;
                }
                throw e;
            }
            const current = (0, local_1.localAll)().find((x) => x.sessionId === s.sessionId);
            if (current && JSON.stringify(current) === JSON.stringify(s))
                (0, local_1.putLocal)(s, true);
        }
        local_1.storage.set('pending', []);
        local_1.storage.set('lastSync', Date.now());
    })().finally(() => {
        syncing = null;
    });
    return syncing;
}
async function history(range, period = 'all') {
    const b = await bootstrap();
    const server = (await call('history', { range, period }));
    const pending = local_1.storage.get('pending', []);
    const map = new Map(server.map((s) => [s.sessionId, s]));
    for (const s of (0, domain_1.visibleSessions)((0, local_1.localAll)().filter((s) => pending.includes(s.sessionId)), b.access, range, Date.now(), period))
        map.set(s.sessionId, s);
    return [...map.values()].sort((a, b) => a.measuredAt - b.measuredAt);
}
function offlineHistory(range, period = 'all') {
    return (0, domain_1.visibleSessions)((0, local_1.localAll)(), cachedAccess(), range, Date.now(), period);
}
async function allData() {
    const cloud = (await call('export'));
    const map = new Map(cloud.map((s) => [s.sessionId, s]));
    for (const s of (0, local_1.localAll)().filter((s) => local_1.storage.get('pending', []).includes(s.sessionId)))
        map.set(s.sessionId, s);
    return [...map.values()].filter((s) => !s.deletedAt).sort((a, b) => a.measuredAt - b.measuredAt);
}
async function restore() {
    const b = await bootstrap();
    if (b.deletionPending)
        throw new Error('云端正在删除数据，请先完成删除');
    const rows = (await call('restore'));
    const pending = local_1.storage.get('epoch', -1) === b.syncEpoch ? (0, local_1.pendingLocal)() : [];
    (0, local_1.clearLocal)();
    rows.forEach((s) => (0, local_1.putLocal)(s, true));
    pending.forEach((s) => (0, local_1.putLocal)(s));
    local_1.storage.set('pending', pending.map((s) => s.sessionId));
    local_1.storage.set('epoch', b.syncEpoch);
    local_1.storage.set('deleting', false);
    return rows.length;
}
async function deleteEverything() {
    local_1.storage.set('deleting', true);
    const r = await call('deleteAll');
    (0, local_1.clearLocal)();
    const fs = wx.getFileSystemManager();
    for (const name of fs.readdirSync(wx.env.USER_DATA_PATH)) {
        if (/^安压日记.*\.(json|csv|pdf)$/.test(name))
            try {
                fs.unlinkSync(wx.env.USER_DATA_PATH + '/' + name);
            }
            catch { }
    }
    local_1.storage.set('pending', []);
    local_1.storage.set('draft', null);
    local_1.storage.set('epoch', r.syncEpoch);
    local_1.storage.set('deleting', false);
}
async function deleteOne(id) {
    await call('deleteSession', { sessionId: id });
    (0, local_1.removeLocal)(id);
    local_1.storage.set('pending', local_1.storage.get('pending', []).filter((x) => x !== id));
}
async function exportData(kind, localOnly = false) {
    const rows = localOnly ? (0, local_1.localAll)().filter((s) => !s.deletedAt) : await allData();
    const body = kind === 'csv'
        ? (0, domain_1.exportCSV)(rows)
        : JSON.stringify({
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            timezone: 'Asia/Shanghai',
            source: localOnly ? 'local-only' : 'cloud-and-local',
            sessions: rows,
        }, null, 2);
    const path = wx.env.USER_DATA_PATH + '/安压日记-' + (0, domain_1.dateKey)(Date.now()) + '.' + kind;
    wx.getFileSystemManager().writeFileSync(path, body, 'utf8');
    await wx.shareFileMessage({ filePath: path, fileName: '安压日记全部记录.' + kind });
    return rows.length;
}
function errorToast(e) {
    wx.showModal({
        title: '温馨提示',
        content: e instanceof Error ? e.message : '操作未完成，请重试',
        showCancel: false,
    });
}
function accessLabel(a) {
    return { FREE: '免费版', TRIAL: '体验中', TIME_LIMITED: '一年 / 时长版', LIFETIME: '永久版' }[a.type];
}
