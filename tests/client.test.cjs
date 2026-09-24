const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'anxin-client-test-'));
let kv = new Map(),
  requests = [],
  handler;
const fsApi = {
  accessSync: (p) => fs.accessSync(p),
  mkdirSync: (p, r) => fs.mkdirSync(p, { recursive: r }),
  readdirSync: (p) => fs.readdirSync(p),
  readFileSync: (p, e) => fs.readFileSync(p, e),
  writeFileSync: (p, d, e) => fs.writeFileSync(p, typeof d === 'string' ? d : Buffer.from(d), e),
  renameSync: (a, b) => fs.renameSync(a, b),
  unlinkSync: (p) => fs.unlinkSync(p),
};
global.wx = {
  env: { USER_DATA_PATH: root },
  getFileSystemManager: () => fsApi,
  getStorageSync: (k) => (kv.has(k) ? structuredClone(kv.get(k)) : ''),
  setStorageSync: (k, v) => kv.set(k, structuredClone(v)),
  cloud: {
    callFunction: async ({ data }) => {
      requests.push(structuredClone(data));
      return { result: { ok: true, data: await handler(data) } };
    },
  },
};
const { AppConfig } = require('../miniprogram/config');
const local = require('../miniprogram/services/local');
const api = require('../miniprogram/services/api');
const { normalizeSession, getEffectiveHistoryAccess } = require('../miniprogram/shared/domain');
const scope = 'a'.repeat(64);
const bootstrap = () => ({
  access: getEffectiveHistoryAccess([]),
  products: [],
  olderCount: 0,
  trialEligible: false,
  syncEpoch: 0,
  userScope: scope,
});
const fixture = (id = 'session_test', n = 1) =>
  normalizeSession({
    sessionId: id,
    readings: Array.from({ length: n }, (_, i) => ({
      readingId: 'reading_' + i,
      systolic: 128,
      diastolic: 76,
      pulse: 68,
      measuredAt: Date.now() - 1000 + i,
    })),
    context: { symptoms: [], irregularHeartbeat: false },
    status: n === 1 ? 'in_progress' : 'complete',
  });
beforeEach(() => {
  for (const f of fs.readdirSync(root))
    fs.rmSync(path.join(root, f), { recursive: true, force: true });
  kv = new Map();
  requests = [];
  AppConfig.provider = 'cloud';
  AppConfig.cloudEnv = 'test-isolated';
  kv.set('anxin:cloud:activeUser', scope);
  handler = async (d) =>
    d.action === 'bootstrap'
      ? bootstrap()
      : d.action === 'sync'
        ? { session: d.session }
        : d.action === 'deleteAll'
          ? { syncEpoch: 1 }
          : [];
});
after(() => fs.rmSync(root, { recursive: true, force: true }));
test('zero epochs and disabled sound preference survive persistence', () => {
  local.storage.set('epoch', 0);
  local.storage.set('wheelSound', false);
  assert.equal(local.storage.get('epoch', -1), 0);
  assert.equal(local.storage.get('wheelSound', true), false);
});
test('durable file marker reconstructs outbox after interrupted storage write', async () => {
  local.putLocal(fixture());
  assert.deepEqual(local.storage.get('pending', []), []);
  await api.syncPending();
  assert.equal(requests.filter((x) => x.action === 'sync').length, 1);
  assert.equal(local.pendingLocal().length, 0);
});
test('append during in-flight sync sends the new version instead of losing it', async () => {
  let release, started;
  const start = new Promise((r) => (started = r)),
    gate = new Promise((r) => (release = r));
  let count = 0;
  handler = async (d) => {
    if (d.action === 'bootstrap') return bootstrap();
    if (d.action === 'sync') {
      if (++count === 1) {
        started();
        await gate;
      }
      return { session: d.session };
    }
    return [];
  };
  const first = fixture();
  await api.saveSession(first);
  await start;
  const second = {
    ...first,
    readings: [...first.readings, { ...first.readings[0], readingId: 'reading_second' }],
    status: 'complete',
  };
  await api.saveSession(second);
  release();
  await api.syncPending();
  assert.deepEqual(
    requests.filter((x) => x.action === 'sync').map((x) => x.session.readings.length),
    [1, 2],
  );
  assert.equal(local.pendingLocal().length, 0);
});
test('restore replaces stale synced copy but preserves unsent new records', async () => {
  local.putLocal(fixture('old_record'), true);
  local.putLocal(fixture('new_record'));
  local.storage.set('epoch', 0);
  await api.restore();
  assert.deepEqual(
    local.localAll().map((s) => s.sessionId),
    ['new_record'],
  );
  assert.equal(local.pendingLocal().length, 1);
});
test('account switch isolates local records and entitlement cache', async () => {
  local.putLocal(fixture('alice_record'), true);
  handler = async (d) =>
    d.action === 'bootstrap' ? { ...bootstrap(), userScope: 'b'.repeat(64) } : [];
  await api.bootstrap();
  assert.equal(local.localAll().length, 0);
  assert.equal(api.cachedAccess().type, 'FREE');
  wx.setStorageSync('anxin:cloud:activeUser', scope);
  assert.equal(local.localAll().length, 1);
});
test('full deletion removes local reports and records without touching other files', async () => {
  local.putLocal(fixture());
  fs.writeFileSync(path.join(root, '安心血压医生报告.pdf'), 'private');
  fs.writeFileSync(path.join(root, 'unrelated.txt'), 'keep');
  await api.deleteEverything();
  assert.equal(local.localAll().length, 0);
  assert.equal(fs.existsSync(path.join(root, '安心血压医生报告.pdf')), false);
  assert.equal(fs.existsSync(path.join(root, 'unrelated.txt')), true);
  assert.equal(local.storage.get('epoch', 0), 1);
});
test('corrupt local record is surfaced instead of silently omitted from export', () => {
  local.putLocal(fixture());
  const dir = path.join(root, 'anxin-cloud-' + scope);
  fs.writeFileSync(path.join(dir, 'broken.json'), '{broken');
  assert.throws(() => local.localAll(), /读取失败/);
});
test('explicit deletion can clear damaged records without parsing them', () => {
  local.putLocal(fixture());
  const dir = path.join(root, 'anxin-cloud-' + scope);
  fs.writeFileSync(path.join(dir, 'broken.json'), '{broken');
  local.clearLocal();
  assert.equal(local.localAll().length, 0);
});
