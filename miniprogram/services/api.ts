import { AppConfig } from '../config';
import { Session, Access, Range } from '../../shared/types';
import {
  dateKey,
  exportCSV,
  getEffectiveHistoryAccess,
  normalizeSession,
  visibleSessions,
} from '../../shared/domain';
import { localAll, putLocal, storage, clearLocal, removeLocal, pendingLocal } from './local';
import { mockCall } from './mock';
export async function call(action: string, data: any = {}): Promise<any> {
  if (AppConfig.provider === 'mock') return mockCall(action, data);
  if (!AppConfig.cloudEnv) throw new Error('请先配置CloudBase环境ID');
  const r = await wx.cloud.callFunction({
    name: AppConfig.functionName,
    data: { action, ...data },
  });
  const result = r.result as any;
  if (!result?.ok)
    throw Object.assign(new Error(result?.message || '云服务暂时不可用'), { code: result?.code });
  if ((action === 'export' || action === 'restore') && result.data?.url) {
    const file = await new Promise<WechatMiniprogram.DownloadFileSuccessCallbackResult>(
      (resolve, reject) =>
        wx.downloadFile({ url: result.data.url, success: resolve, fail: reject }),
    );
    if (file.statusCode !== 200) throw new Error('导出文件下载失败');
    const rows = JSON.parse(
      wx.getFileSystemManager().readFileSync(file.tempFilePath, 'utf8') as string,
    );
    try {
      await call('cleanupExport', { fileID: result.data.fileID });
      wx.getFileSystemManager().unlinkSync(file.tempFilePath);
    } catch {}
    return rows;
  }
  return result.data;
}
export async function bootstrap() {
  const b = await call('bootstrap');
  if (AppConfig.provider === 'cloud' && /^[a-f0-9]{64}$/.test(b.userScope)) {
    const old = wx.getStorageSync('anxin:cloud:activeUser');
    const unbound = !old ? pendingLocal() : [];
    wx.setStorageSync('anxin:cloud:activeUser', b.userScope);
    unbound.forEach((s) => putLocal(s));
  }
  storage.set('bootstrap', b);
  return b;
}
export function cachedAccess(): Access {
  const a = storage.get<any>('bootstrap', null)?.access as Access | undefined;
  if (!a || (a.expiresAt !== null && a.expiresAt <= Date.now()))
    return getEffectiveHistoryAccess([]);
  return a;
}
export async function saveSession(s: Session) {
  s = normalizeSession(s);
  putLocal(s);
  storage.set(
    'pending',
    pendingLocal().map((x) => x.sessionId),
  );
  if (AppConfig.provider === 'mock') {
    try {
      await syncPending();
      return true;
    } catch {
      return false;
    }
  }
  void syncPending().catch(() => {});
  return false;
}
let syncing: Promise<void> | null = null;
export function syncPending(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (storage.get('deleting', false)) throw new Error('请先完成健康数据删除');
    const b = await bootstrap(),
      savedEpoch = storage.get<number>('epoch', -1);
    if (savedEpoch !== -1 && savedEpoch !== b.syncEpoch)
      throw new Error('云端数据已重置，请使用恢复云端数据更新本机');
    storage.set('epoch', b.syncEpoch);
    while (true) {
      const s = pendingLocal()[0];
      storage.set(
        'pending',
        pendingLocal().map((x) => x.sessionId),
      );
      if (!s) break;
      try {
        await call('sync', { session: s, epoch: b.syncEpoch });
      } catch (e: any) {
        if (e.code === 'DELETED') {
          removeLocal(s.sessionId);
          continue;
        }
        throw e;
      }
      const current = localAll().find((x) => x.sessionId === s.sessionId);
      if (current && JSON.stringify(current) === JSON.stringify(s)) putLocal(s, true);
    }
    storage.set('pending', []);
    storage.set('lastSync', Date.now());
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
export async function history(range: Range, period = 'all'): Promise<Session[]> {
  const b = await bootstrap();
  const server = (await call('history', { range, period })) as Session[];
  const pending = storage.get<string[]>('pending', []);
  const map = new Map(server.map((s) => [s.sessionId, s]));
  for (const s of visibleSessions(
    localAll().filter((s) => pending.includes(s.sessionId)),
    b.access,
    range,
    Date.now(),
    period,
  ))
    map.set(s.sessionId, s);
  return [...map.values()].sort((a, b) => a.measuredAt - b.measuredAt);
}
export function offlineHistory(range: Range, period = 'all') {
  return visibleSessions(localAll(), cachedAccess(), range, Date.now(), period);
}
export async function allData(): Promise<Session[]> {
  const cloud = (await call('export')) as Session[];
  const map = new Map(cloud.map((s) => [s.sessionId, s]));
  for (const s of localAll().filter((s) =>
    storage.get<string[]>('pending', []).includes(s.sessionId),
  ))
    map.set(s.sessionId, s);
  return [...map.values()].filter((s) => !s.deletedAt).sort((a, b) => a.measuredAt - b.measuredAt);
}
export async function restore() {
  const b = await bootstrap();
  if (b.deletionPending) throw new Error('云端正在删除数据，请先完成删除');
  const rows = (await call('restore')) as Session[];
  const pending = storage.get('epoch', -1) === b.syncEpoch ? pendingLocal() : [];
  clearLocal();
  rows.forEach((s) => putLocal(s, true));
  pending.forEach((s) => putLocal(s));
  storage.set(
    'pending',
    pending.map((s) => s.sessionId),
  );
  storage.set('epoch', b.syncEpoch);
  storage.set('deleting', false);
  return rows.length;
}
export async function deleteEverything() {
  storage.set('deleting', true);
  const r = await call('deleteAll');
  clearLocal();
  const fs = wx.getFileSystemManager();
  for (const name of fs.readdirSync(wx.env.USER_DATA_PATH)) {
    if (/^安压日记.*\.(json|csv|pdf)$/.test(name))
      try {
        fs.unlinkSync(wx.env.USER_DATA_PATH + '/' + name);
      } catch {}
  }
  storage.set('pending', []);
  storage.set('draft', null);
  storage.set('epoch', r.syncEpoch);
  storage.set('deleting', false);
}
export async function deleteOne(id: string) {
  await call('deleteSession', { sessionId: id });
  removeLocal(id);
  storage.set(
    'pending',
    storage.get<string[]>('pending', []).filter((x) => x !== id),
  );
}
export async function exportData(kind: 'json' | 'csv', localOnly = false) {
  const rows = localOnly ? localAll().filter((s) => !s.deletedAt) : await allData();
  const body =
    kind === 'csv'
      ? exportCSV(rows)
      : JSON.stringify(
          {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            timezone: 'Asia/Shanghai',
            source: localOnly ? 'local-only' : 'cloud-and-local',
            sessions: rows,
          },
          null,
          2,
        );
  const path = wx.env.USER_DATA_PATH + '/安压日记-' + dateKey(Date.now()) + '.' + kind;
  wx.getFileSystemManager().writeFileSync(path, body, 'utf8');
  await wx.shareFileMessage({ filePath: path, fileName: '安压日记全部记录.' + kind });
  return rows.length;
}
export function errorToast(e: unknown) {
  wx.showModal({
    title: '温馨提示',
    content: e instanceof Error ? e.message : '操作未完成，请重试',
    showCancel: false,
  });
}
export function accessLabel(a: Access) {
  return { FREE: '免费版', TRIAL: '体验中', TIME_LIMITED: '一年 / 时长版', LIFETIME: '永久版' }[
    a.type
  ];
}
