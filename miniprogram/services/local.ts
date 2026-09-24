import { Session } from '../../shared/types';
import { AppConfig } from '../config';
const fs = () => wx.getFileSystemManager();
const userScope = () =>
  AppConfig.provider === 'cloud' ? wx.getStorageSync('anxin:cloud:activeUser') || 'unbound' : '';
const root = () =>
  wx.env.USER_DATA_PATH + '/anxin-' + AppConfig.provider + (userScope() ? '-' + userScope() : '');
const storageKey = (key: string) =>
  'anxin:' + AppConfig.provider + ':' + (userScope() ? userScope() + ':' : '') + key;
export function initLocal() {
  try {
    fs().accessSync(root());
  } catch {
    fs().mkdirSync(root(), true);
  }
}
export function localAll(): Session[] {
  initLocal();
  return fs()
    .readdirSync(root())
    .filter((n) => n.endsWith('.json'))
    .map((n) => {
      try {
        return JSON.parse(fs().readFileSync(root() + '/' + n, 'utf8') as string) as Session;
      } catch {
        throw new Error('本地记录读取失败，请勿清理应用数据');
      }
    });
}
export function putLocal(s: Session, synced = false) {
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(s.sessionId)) throw new Error('记录标识无效');
  initLocal();
  const path = root() + '/' + s.sessionId + '.json';
  fs().writeFileSync(
    path + '.tmp',
    JSON.stringify({ ...s, _syncedUpdatedAt: synced ? s.updatedAt : 0 }),
    'utf8',
  );
  fs().renameSync(path + '.tmp', path);
}
export function pendingLocal(): Session[] {
  return localAll().filter(
    (s) => (s as Session & { _syncedUpdatedAt?: number })._syncedUpdatedAt !== s.updatedAt,
  );
}
export function removeLocal(id: string) {
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(id)) throw new Error('记录标识无效');
  initLocal();
  if (
    fs()
      .readdirSync(root())
      .includes(id + '.json')
  )
    fs().unlinkSync(root() + '/' + id + '.json');
}
export function clearLocal() {
  initLocal();
  for (const file of fs().readdirSync(root()))
    if (file.endsWith('.json') || file.endsWith('.tmp')) fs().unlinkSync(root() + '/' + file);
}
export function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}
export const storage = {
  get<T>(key: string, fallback: T): T {
    const value = wx.getStorageSync(storageKey(key));
    return value === '' || value === null || value === undefined ? fallback : value;
  },
  set(key: string, value: unknown) {
    wx.setStorageSync(storageKey(key), value);
  },
};
