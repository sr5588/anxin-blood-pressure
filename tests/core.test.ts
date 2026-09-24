import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS } from '../shared/config';
import {
  getFreeHistoryStartDate,
  dateKey,
  needsThird,
  normalizeSession,
  safetyMessage,
  getEffectiveHistoryAccess,
  exportCSV,
  visibleSessions,
} from '../shared/domain';
import { Session } from '../shared/types';
import { MemoryRepository } from '../server/repository';
import { HealthService, createCode, hash } from '../server/service';
import { seedProducts } from '../server/catalog';
const NOW = Date.parse('2026-09-22T12:00:00+08:00');
export const session = (at = NOW): Session =>
  normalizeSession(
    {
      sessionId: 'session_123',
      readings: [
        { readingId: 'reading_1', systolic: 128, diastolic: 78, pulse: 68, measuredAt: at },
        { readingId: 'reading_2', systolic: 126, diastolic: 76, pulse: 70, measuredAt: at + 1 },
      ],
      context: { symptoms: [], irregularHeartbeat: false },
      status: 'complete',
    },
    NOW,
  );
async function setup() {
  const repo = new MemoryRepository();
  for (const p of seedProducts) await repo.set('products', p.productId, p);
  const api = new HealthService(repo, { allowMockPayment: true, now: () => NOW });
  return { repo, api };
}
test('free boundary is six calendar midnights ago, including midnight exactly', () => {
  assert.equal(dateKey(getFreeHistoryStartDate(NOW)), '2026-09-16');
  assert.equal(
    getFreeHistoryStartDate(Date.parse('2026-09-22T23:59:59+08:00')),
    getFreeHistoryStartDate(NOW),
  );
  const s = session(getFreeHistoryStartDate(NOW));
  assert.equal(visibleSessions([s], getEffectiveHistoryAccess([]), '7', NOW).length, 1);
  s.measuredAt--;
  assert.equal(visibleSessions([s], getEffectiveHistoryAccess([]), '7', NOW).length, 0);
});
test('all raw readings retained; compare either pressure at inclusive 10', () => {
  const s = session();
  assert.deepEqual(s.average, { systolic: 127, diastolic: 77, pulse: 69 });
  assert.equal(s.readings.length, 2);
  assert.equal(needsThird(s.readings[0], { ...s.readings[1], diastolic: 88 }), true);
  assert.throws(() =>
    normalizeSession({ ...s, readings: [{ ...s.readings[0], systolic: 70, diastolic: 80 }] }),
  );
});
test('urgent symptoms independent of numbers, thresholds inclusive, never diagnostic', () => {
  assert.equal(safetyMessage({ systolic: 128, diastolic: 76 }, ['chest']).level, 'urgent');
  assert.equal(safetyMessage({ systolic: 180, diastolic: 80 }).level, 'urgent');
  assert.equal(safetyMessage({ systolic: 135, diastolic: 85 }).level, 'attention');
});
test('server enforces history but full export and backup stay free', async () => {
  const { api } = await setup();
  await api.sync('alice', session(NOW - 30 * DAY_MS), 0);
  assert.equal((await api.history('alice', '7')).length, 0);
  await assert.rejects(api.history('alice', 'all'), /长期回顾/);
  assert.equal((await api.exportAll('alice')).length, 1);
  assert.equal((await api.exportAll('bob')).length, 0);
  assert.equal(exportCSV(await api.exportAll('alice')).split('\r\n').length, 3);
});
test('trial requires old data, explicit start, one per account and exact hours', async () => {
  const { api } = await setup();
  await assert.rejects(api.startTrial('alice'));
  await api.sync('alice', session(NOW - 8 * DAY_MS), 0);
  const grants = await Promise.allSettled([api.startTrial('alice'), api.startTrial('alice')]);
  assert.equal(grants.filter((g) => g.status === 'fulfilled').length, 1);
  const g = (await api.grants('alice'))[0];
  assert.equal(g.expiresAt! - g.startsAt, 7 * DAY_MS);
  assert.equal(getEffectiveHistoryAccess([g], g.expiresAt!).type, 'FREE');
});
test('payment is idempotent under concurrency; year stacks; lifetime wins; refund revokes only its grant', async () => {
  const { api } = await setup();
  const a = await api.createOrder('alice', 'history_access_365d', 'request_0001');
  await Promise.all([
    api.confirmMockPayment('alice', a.orderId),
    api.confirmMockPayment('alice', a.orderId),
  ]);
  assert.equal((await api.grants('alice')).length, 1);
  const b = await api.createOrder('alice', 'history_access_365d', 'request_0002');
  await api.confirmMockPayment('alice', b.orderId);
  assert.equal((await api.access('alice')).expiresAt, NOW + 730 * DAY_MS);
  await api.refundMock('alice', a.orderId);
  assert.equal((await api.access('alice')).expiresAt, NOW + 365 * DAY_MS);
  const l = await api.createOrder('alice', 'history_access_lifetime', 'request_0003');
  await api.confirmMockPayment('alice', l.orderId);
  assert.equal((await api.access('alice')).type, 'LIFETIME');
  await api.refundMock('alice', l.orderId);
  assert.equal((await api.access('alice')).type, 'TIME_LIMITED');
});
test('redemption hash-only, concurrent last code claim has one winner, replay idempotent', async () => {
  const { repo, api } = await setup();
  const c = await createCode(
    repo,
    { days: 30, maxRedemptions: 1, validDays: 30, campaignId: 'test', createdBy: 'admin' },
    NOW,
  );
  const stored = await repo.get('redemption_codes', c.codeId);
  assert.ok(!JSON.stringify(stored).includes(c.code));
  const results = await Promise.allSettled([
    api.redeem('alice', c.code),
    api.redeem('bob', c.code),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const user = results[0].status === 'fulfilled' ? 'alice' : 'bob';
  assert.equal(
    (await api.redeem(user, c.code.toLowerCase().replace(/-/g, ' '))).alreadyRedeemed,
    true,
  );
  assert.equal((await api.grants(user)).length, 1);
});
test('code binding, validity, rate limit and production mock guard', async () => {
  const { api, repo } = await setup();
  const c = await createCode(
    repo,
    {
      days: 7,
      maxRedemptions: 100,
      validDays: 1,
      campaignId: 'test',
      boundUserId: 'alice',
      createdBy: 'admin',
    },
    NOW,
  );
  await assert.rejects(api.redeem('bob', c.code), /无效/);
  for (let i = 0; i < 4; i++) await assert.rejects(api.redeem('bob', 'INVALID'));
  await assert.rejects(api.redeem('bob', c.code), /10分钟/);
  const prod = new HealthService(repo, { allowMockPayment: false, now: () => NOW });
  await assert.rejects(
    prod.createOrder('alice', 'history_access_365d', 'valid_request'),
    /尚未配置/,
  );
  await assert.rejects(prod.confirmMockPayment('alice', 'x'), /未启用/);
});
test('immutable raw values, account isolation, deletion epoch prevents stale resurrection', async () => {
  const { api } = await setup();
  await api.sync('alice', session(), 0);
  const changed = session();
  changed.readings[0].systolic = 129;
  await assert.rejects(api.sync('alice', changed, 0), /不可覆盖/);
  await api.deleteSession('bob', 'session_123');
  assert.equal((await api.exportAll('alice')).length, 1);
  await api.deleteAll('alice');
  await assert.rejects(api.sync('alice', session(), 0), /版本/);
  assert.equal((await api.exportAll('alice')).length, 0);
});

test('Gregorian boundary survives leap day and Asia/Shanghai midnight', () => {
  assert.equal(
    dateKey(getFreeHistoryStartDate(Date.parse('2024-03-01T00:00:00+08:00'))),
    '2024-02-24',
  );
  assert.equal(dateKey(getFreeHistoryStartDate(Date.parse('2026-09-21T16:00:00Z'))), '2026-09-16');
});
test('trial never starts at signup, paid and lifetime accounts cannot claim it', async () => {
  const { api } = await setup();
  assert.equal((await api.account('new')).trialStartedAt, null);
  await api.sync('alice', session(NOW - 8 * DAY_MS), 0);
  const o = await api.createOrder('alice', 'history_access_lifetime', 'request_life');
  await api.confirmMockPayment('alice', o.orderId);
  await assert.rejects(api.startTrial('alice'), /已有/);
  assert.equal((await api.account('alice')).trialStartedAt, null);
});
test('expired entitlement falls back to free but health data remains exportable', async () => {
  const { api } = await setup();
  const o = await api.createOrder('alice', 'history_access_365d', 'request_expire');
  await api.confirmMockPayment('alice', o.orderId);
  await api.sync('alice', session(NOW - 8 * DAY_MS), 0);
  api.options.now = () => NOW + 365 * DAY_MS;
  assert.equal((await api.access('alice')).type, 'FREE');
  assert.equal((await api.exportAll('alice')).length, 1);
  await assert.rejects(api.history('alice', '30'));
});
test('redeem time stacks on paid time; lifetime does not consume another code', async () => {
  const { api, repo } = await setup();
  const o = await api.createOrder('alice', 'history_access_365d', 'request_stack');
  await api.confirmMockPayment('alice', o.orderId);
  const c = await createCode(
    repo,
    { days: 30, maxRedemptions: 1, validDays: 90, campaignId: 'gift', createdBy: 'admin' },
    NOW,
  );
  await api.redeem('alice', c.code);
  assert.equal((await api.access('alice')).expiresAt, NOW + 395 * DAY_MS);
  const l = await createCode(
    repo,
    { days: null, maxRedemptions: 1, validDays: 90, campaignId: 'gift', createdBy: 'admin' },
    NOW,
  );
  await api.redeem('alice', l.code);
  const unused = await createCode(
    repo,
    { days: 7, maxRedemptions: 1, validDays: 90, campaignId: 'gift', createdBy: 'admin' },
    NOW,
  );
  await assert.rejects(api.redeem('alice', unused.code), /永久/);
  assert.equal((await repo.get<any>('redemption_codes', unused.codeId)).redeemedCount, 0);
});
test('code windows and disabled status enforced, limit resumes after cooldown', async () => {
  const { api, repo } = await setup();
  const c = await createCode(
    repo,
    { days: 7, maxRedemptions: 1, validDays: 1, campaignId: 'gift', createdBy: 'admin' },
    NOW,
  );
  const code = await repo.get<any>('redemption_codes', c.codeId);
  await repo.set('redemption_codes', c.codeId, { ...code, status: 'disabled' });
  await assert.rejects(api.redeem('alice', c.code), /无效/);
  await repo.set('redemption_codes', c.codeId, { ...code, validFrom: NOW + DAY_MS });
  await assert.rejects(api.redeem('alice', c.code), /无效/);
  await repo.set('redemption_codes', c.codeId, { ...code, validUntil: NOW });
  await assert.rejects(api.redeem('alice', c.code), /过期/);
  await repo.set('redemption_codes', c.codeId, code);
  api.options.now = () => NOW + 600001;
  await api.redeem('alice', c.code);
  assert.equal((await api.access('alice')).type, 'TIME_LIMITED');
});
test('transaction rollback leaves no partially granted redemption', async () => {
  const { api, repo } = await setup();
  const c = await createCode(
    repo,
    { days: 7, maxRedemptions: 1, validDays: 1, campaignId: 'gift', createdBy: 'admin' },
    NOW,
  );
  const original = repo.set.bind(repo);
  repo.set = async (c, id, v) => {
    if (c === 'redemption_records') throw new Error('simulated storage failure');
    return original(c, id, v);
  };
  await assert.rejects(api.redeem('alice', c.code), /storage failure/);
  assert.equal((await api.grants('alice')).length, 0);
  assert.equal((await repo.get<any>('redemption_codes', c.codeId)).redeemedCount, 0);
});
test('deletion clears registered temporary exports and rejects old export registration', async () => {
  const { api, repo } = await setup();
  const deleted: string[] = [];
  api.options.deleteFiles = async (ids) => {
    deleted.push(...ids);
  };
  await api.registerExport('alice', 'cloud://private/test.json', 0);
  await api.deleteAll('alice');
  assert.deepEqual(deleted, ['cloud://private/test.json']);
  assert.equal((await repo.list('export_files', { userId: 'alice' })).length, 0);
  await assert.rejects(api.registerExport('alice', 'cloud://private/stale.json', 0), /变更/);
});
test('foreign order cannot be paid or refunded; duplicate order id cannot change product', async () => {
  const { api } = await setup();
  const o = await api.createOrder('alice', 'history_access_365d', 'request_secure');
  await assert.rejects(api.confirmMockPayment('bob', o.orderId), /不存在/);
  await assert.rejects(api.refundMock('bob', o.orderId), /不存在/);
  await assert.rejects(
    api.createOrder('alice', 'history_access_lifetime', 'request_secure'),
    /其他商品/,
  );
  assert.equal((await api.grants('alice')).length, 0);
});

test('daily sessions are unlimited in free tier and today trend keeps every group', async () => {
  const { api } = await setup();
  for (let i = 0; i < 64; i++) {
    const s = session(NOW - 3600000 + i * 1000);
    s.sessionId = 'daily_session_' + i;
    await api.sync('alice', s, 0);
  }
  const rows = await api.history('alice', 'today');
  assert.equal(rows.length, 64);
  assert.equal((await api.exportAll('alice')).length, 64);
  assert.equal((await api.access('alice')).type, 'FREE');
});
