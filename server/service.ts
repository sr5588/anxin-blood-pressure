import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { Repository, Store } from './repository';
import {
  Account,
  Grant,
  Order,
  Product,
  RedemptionCode,
  RedemptionRecord,
  Session,
  Range,
} from '../shared/types';
import { DAY_MS } from '../shared/config';
import {
  getEffectiveHistoryAccess,
  grantWindow,
  getFreeHistoryStartDate,
  normalizeSession,
  visibleSessions,
} from '../shared/domain';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const normalizeCode = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();
const newAccount = (userId: string, now: number): Account => ({
  userId,
  revision: 0,
  trialStartedAt: null,
  trialExpiresAt: null,
  syncEpoch: 0,
  deletionPending: false,
  createdAt: now,
});
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export class HealthService {
  constructor(
    public repo: Repository,
    public options: {
      allowMockPayment: boolean;
      now?: () => number;
      deleteFiles?: (ids: string[]) => Promise<void>;
    },
  ) {}
  now() {
    return this.options.now?.() ?? Date.now();
  }
  async grants(userId: string) {
    return this.repo.list<Grant>('entitlement_grants', { userId });
  }
  async access(userId: string) {
    return getEffectiveHistoryAccess(await this.grants(userId), this.now());
  }
  async account(userId: string) {
    return (await this.repo.get<Account>('users', hash(userId))) || newAccount(userId, this.now());
  }
  private async mutate<T>(
    userId: string,
    fn: (tx: Store, account: Account, grants: Grant[]) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await this.account(userId),
        grants = await this.grants(userId);
      try {
        return await this.repo.transaction(async (tx) => {
          const account =
            (await tx.get<Account>('users', hash(userId))) || newAccount(userId, this.now());
          if (account.revision !== before.revision) throw new ApiError('CONFLICT', '请重试');
          const result = await fn(tx, account, grants);
          account.revision++;
          await tx.set('users', hash(userId), account);
          return result;
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'CONFLICT') || attempt === 4) throw e;
      }
    }
    throw new Error('请重试');
  }
  private makeGrant(
    userId: string,
    id: string,
    source: Grant['source'],
    sourceId: string,
    grants: Grant[],
    days: number | null,
    lifetime: boolean,
  ): Grant {
    const now = this.now();
    return {
      grantId: id,
      userId,
      entitlementKey: 'history_access',
      grantType: lifetime ? 'lifetime' : source === 'trial' ? 'trial' : 'time',
      source,
      sourceId,
      ...grantWindow(grants, days, lifetime, now),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
      revokeReason: null,
      metadata: { durationDays: days },
    };
  }
  async bootstrap(userId: string) {
    const [access, account, products, rows] = await Promise.all([
      this.access(userId),
      this.account(userId),
      this.repo.list<Product>('products', { isActive: true }),
      this.repo.list<Session>('sessions', { userId }),
    ]);
    const olderCount = rows.filter(
      (s) => !s.deletedAt && s.measuredAt < getFreeHistoryStartDate(this.now()),
    ).length;
    return {
      access,
      products: products.sort((a, b) => a.sortOrder - b.sortOrder),
      olderCount,
      trialEligible: olderCount > 0 && account.trialStartedAt === null && access.type === 'FREE',
      syncEpoch: account.syncEpoch,
      deletionPending: account.deletionPending,
      userScope: hash(userId),
      serverNow: this.now(),
    };
  }
  async history(userId: string, range: Range, period = 'all') {
    if (
      !['today', '7', '30', '90', '180', '365', 'all'].includes(range) ||
      !['all', 'morning', 'daytime', 'evening', 'bedtime'].includes(period)
    )
      throw new ApiError('INVALID', '范围无效');
    const access = await this.access(userId);
    if (access.type === 'FREE' && !['today', '7'].includes(range))
      throw new ApiError('HISTORY_LOCKED', '你的数据一直都在，长期回顾需要解锁');
    return visibleSessions(
      await this.repo.list<Session>('sessions', { userId }),
      access,
      range,
      this.now(),
      period,
    );
  }
  async exportAll(userId: string) {
    const a = await this.account(userId);
    if (a.deletionPending) throw new ApiError('DELETING', '正在删除健康数据，请稍后重试');
    return (await this.repo.list<Session>('sessions', { userId })).filter((s) => !s.deletedAt);
  }
  async sync(userId: string, input: Session, epoch: number) {
    const session = normalizeSession(input, this.now());
    return this.mutate(userId, async (tx, a) => {
      if (a.deletionPending || a.syncEpoch !== epoch)
        throw new ApiError('RESET_REQUIRED', '数据版本已变更，请先恢复云端状态');
      const id = hash(userId + ':' + session.sessionId),
        old = await tx.get<Session>('sessions', id);
      if (old?.deletedAt) throw new ApiError('DELETED', '该记录已删除');
      if (old) {
        if (session.readings.length < old.readings.length)
          throw new ApiError('CONFLICT', '云端已有更新记录');
        for (let i = 0; i < old.readings.length; i++)
          if (JSON.stringify(old.readings[i]) !== JSON.stringify(session.readings[i]))
            throw new ApiError('IMMUTABLE', '已保存的原始读数不可覆盖');
        if (old.status === 'complete' && session.status !== 'complete')
          throw new ApiError('CONFLICT', '已完成测量不能退回');
      }
      await tx.set('sessions', id, {
        ...session,
        userId,
        createdAt: old?.createdAt ?? session.createdAt,
      });
      return { session, syncEpoch: a.syncEpoch };
    });
  }
  async deleteSession(userId: string, sessionId: string) {
    return this.mutate(userId, async (tx) => {
      const id = hash(userId + ':' + sessionId),
        s = await tx.get<Session>('sessions', id);
      if (s)
        await tx.set('sessions', id, {
          sessionId,
          userId,
          deletedAt: this.now(),
          measuredAt: s.measuredAt,
          updatedAt: this.now(),
        });
      return { ok: true };
    });
  }
  async deleteAll(userId: string) {
    // Mark account before batch deletion: interrupted runs are safe and resumable.
    await this.mutate(userId, async (_tx, a) => {
      if (!a.deletionPending) a.syncEpoch++;
      a.deletionPending = true;
    });
    const rows = await this.repo.list<Session>('sessions', { userId });
    for (const s of rows) await this.repo.remove('sessions', hash(userId + ':' + s.sessionId));
    const exports = await this.repo.list<{ fileID: string }>('export_files', { userId });
    for (const file of exports) {
      if (this.options.deleteFiles) await this.options.deleteFiles([file.fileID]);
      await this.repo.remove('export_files', hash(file.fileID));
    }
    return this.mutate(userId, async (_tx, a) => {
      a.deletionPending = false;
      return { syncEpoch: a.syncEpoch };
    });
  }
  async registerExport(userId: string, fileID: string, epoch: number) {
    return this.mutate(userId, async (tx, a) => {
      if (a.deletionPending || a.syncEpoch !== epoch)
        throw new ApiError('RESET_REQUIRED', '数据已发生变更，请重新导出');
      await tx.set('export_files', hash(fileID), {
        userId,
        fileID,
        createdAt: this.now(),
        expiresAt: this.now() + 3600000,
      });
    });
  }
  async startTrial(userId: string) {
    const old = (await this.exportAll(userId)).some(
      (s) => s.measuredAt < getFreeHistoryStartDate(this.now()),
    );
    if (!old) throw new ApiError('NOT_ELIGIBLE', '有第8天以前的记录后即可申请体验');
    return this.mutate(userId, async (tx, a, grants) => {
      if (a.trialStartedAt !== null) throw new ApiError('TRIAL_USED', '此账号已领取过体验');
      if (getEffectiveHistoryAccess(grants, this.now()).type !== 'FREE')
        throw new ApiError('HAS_ACCESS', '当前已有长期回顾权益');
      const grant = this.makeGrant(
        userId,
        hash(userId + ':trial'),
        'trial',
        'one-time-trial',
        [],
        7,
        false,
      );
      a.trialStartedAt = this.now();
      a.trialExpiresAt = this.now() + 7 * DAY_MS;
      await tx.set('entitlement_grants', grant.grantId, grant);
      return grant;
    });
  }
  async createOrder(userId: string, productId: string, idempotencyKey: string) {
    if (!/^[\w-]{8,80}$/.test(idempotencyKey)) throw new ApiError('INVALID', '订单请求标识无效');
    if (!this.options.allowMockPayment)
      throw new ApiError('PAYMENT_NOT_CONFIGURED', '真实支付尚未配置');
    const product = await this.repo.get<Product>('products', productId);
    if (!product?.isActive || !Number.isInteger(product.priceFen) || product.priceFen < 0)
      throw new ApiError('PRODUCT_UNAVAILABLE', '商品暂不可用');
    const id = hash(userId + ':order:' + idempotencyKey);
    return this.mutate(userId, async (tx) => {
      const old = await tx.get<Order>('orders', id);
      if (old) {
        if (old.productId !== productId) throw new ApiError('CONFLICT', '请求标识已经用于其他商品');
        return old;
      }
      const order: Order = {
        orderId: id,
        outTradeNo: id,
        userId,
        productId,
        amountFen: product.priceFen,
        currency: 'CNY',
        platform: 'development',
        status: 'CREATED',
        provider: 'mock',
        providerTransactionId: null,
        createdAt: this.now(),
        paidAt: null,
        deliveredAt: null,
        refundedAt: null,
        metadata: {
          durationDays: product.durationDays,
          isLifetime: product.entitlementType === 'lifetime',
        },
      };
      await tx.set('orders', id, order);
      return order;
    });
  }
  async confirmMockPayment(userId: string, orderId: string) {
    if (!this.options.allowMockPayment) throw new ApiError('FORBIDDEN', '模拟支付未启用');
    return this.mutate(userId, async (tx, _a, grants) => {
      const order = await tx.get<Order>('orders', orderId);
      if (!order || order.userId !== userId || order.provider !== 'mock')
        throw new ApiError('NOT_FOUND', '订单不存在');
      if (order.status === 'DELIVERED') return order;
      if (!['CREATED', 'PAYING', 'PAID'].includes(order.status))
        throw new ApiError('ORDER_STATE', '订单不能发货');
      const grantId = hash('purchase:' + order.orderId);
      const grant = this.makeGrant(
        userId,
        grantId,
        'purchase',
        order.orderId,
        grants,
        order.metadata.durationDays as number | null,
        order.metadata.isLifetime === true,
      );
      await tx.set('entitlement_grants', grantId, grant);
      order.status = 'DELIVERED';
      order.providerTransactionId = 'mock_' + order.orderId;
      order.paidAt = this.now();
      order.deliveredAt = this.now();
      await tx.set('orders', orderId, order);
      return order;
    });
  }
  async refundMock(userId: string, orderId: string) {
    if (!this.options.allowMockPayment) throw new ApiError('FORBIDDEN', '模拟退款未启用');
    return this.mutate(userId, async (tx, _a, grants) => {
      const o = await tx.get<Order>('orders', orderId);
      if (!o || o.userId !== userId || o.provider !== 'mock')
        throw new ApiError('NOT_FOUND', '订单不存在');
      if (o.status === 'REFUNDED') return o;
      if (o.status !== 'DELIVERED') throw new ApiError('ORDER_STATE', '未发货订单不能退款');
      const g = grants.find((g) => g.sourceId === orderId && g.source === 'purchase');
      if (g) {
        g.status = 'revoked';
        g.revokedAt = this.now();
        g.updatedAt = this.now();
        g.revokeReason = 'mock refund';
        await tx.set('entitlement_grants', g.grantId, g);
        // Rebase subsequent stacked grants so revoking an earlier purchase does not leave its duration behind.
        const later = grants
          .filter(
            (x) =>
              x.grantId !== g.grantId &&
              x.status === 'active' &&
              !x.isLifetime &&
              x.source !== 'trial',
          )
          .sort((a, b) => a.createdAt - b.createdAt || a.grantId.localeCompare(b.grantId));
        let end = 0;
        for (const x of later) {
          const days = x.metadata.durationDays as number;
          x.expiresAt = Math.max(x.createdAt, end) + days * DAY_MS;
          end = x.expiresAt;
          x.updatedAt = this.now();
          await tx.set('entitlement_grants', x.grantId, x);
        }
      }
      o.status = 'REFUNDED';
      o.refundedAt = this.now();
      await tx.set('orders', orderId, o);
      return o;
    });
  }
  async redeem(userId: string, raw: string) {
    const now = this.now(),
      key = hash(userId + ':redeem-rate');
    const allowed = await this.repo.transaction(async (tx) => {
      const r = await tx.get<{ count: number; until: number }>('rate_limits', key);
      const next =
        !r || r.until <= now
          ? { count: 1, until: now + 600000 }
          : { count: r.count + 1, until: r.until };
      await tx.set('rate_limits', key, next);
      return next.count <= 5;
    });
    if (!allowed) throw new ApiError('RATE_LIMIT', '尝试次数较多，请10分钟后再试');
    const code = normalizeCode(raw);
    if (!/^[A-HJ-KM-NP-Z2-9]{12}$/.test(code)) throw new ApiError('INVALID_CODE', '兑换码无效');
    const codeId = hash(code),
      recordId = hash(userId + ':' + codeId);
    return this.mutate(userId, async (tx, _a, grants) => {
      const previous = await tx.get<RedemptionRecord>('redemption_records', recordId);
      if (previous) return { alreadyRedeemed: true, grantId: previous.grantId };
      const c = await tx.get<RedemptionCode>('redemption_codes', codeId);
      if (
        !c ||
        c.status !== 'active' ||
        c.validFrom > now ||
        (c.boundUserId && c.boundUserId !== userId)
      )
        throw new ApiError('INVALID_CODE', '兑换码无效');
      if (c.validUntil <= now) throw new ApiError('CODE_EXPIRED', '兑换码已过期');
      if (c.redeemedCount >= c.maxRedemptions)
        throw new ApiError('CODE_EXHAUSTED', '兑换码已达到使用次数');
      if (c.perUserLimit !== 1) throw new ApiError('INVALID_CODE', '兑换码配置无效');
      if (getEffectiveHistoryAccess(grants, now).type === 'LIFETIME')
        throw new ApiError('HAS_LIFETIME', '你已经拥有永久长期回顾，无需重复兑换');
      const g = this.makeGrant(
        userId,
        hash('redeem:' + recordId),
        'redeem_code',
        codeId,
        grants,
        c.durationDays,
        c.isLifetime,
      );
      c.redeemedCount++;
      await tx.set('redemption_codes', codeId, c);
      await tx.set('entitlement_grants', g.grantId, g);
      await tx.set('redemption_records', recordId, {
        redemptionId: recordId,
        codeId,
        userId,
        grantId: g.grantId,
        redeemedAt: now,
        status: 'success',
      } satisfies RedemptionRecord);
      return { alreadyRedeemed: false, grantId: g.grantId };
    });
  }
}
export async function createCode(
  repo: Repository,
  input: {
    days: number | null;
    maxRedemptions: number;
    validDays: number;
    campaignId: string;
    boundUserId?: string;
    createdBy: string;
  },
  now = Date.now(),
) {
  if (input.days !== null && ![7, 30, 90, 365].includes(input.days))
    throw new Error('不支持的权益天数');
  if (
    !Number.isInteger(input.maxRedemptions) ||
    input.maxRedemptions < 1 ||
    !Number.isInteger(input.validDays) ||
    input.validDays < 1 ||
    !input.createdBy ||
    !input.campaignId
  )
    throw new Error('创建参数无效');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let raw = '';
  while (raw.length < 12) {
    for (const b of randomBytes(24)) {
      if (b < Math.floor(256 / alphabet.length) * alphabet.length && raw.length < 12)
        raw += alphabet[b % alphabet.length];
    }
  }
  const codeHash = hash(raw);
  const code: RedemptionCode = {
    codeId: codeHash,
    codeHash,
    codePrefix: raw.slice(0, 4),
    campaignId: input.campaignId,
    entitlementType: input.days === null ? 'HISTORY_LIFETIME' : `HISTORY_${input.days}D`,
    durationDays: input.days,
    isLifetime: input.days === null,
    validFrom: now,
    validUntil: now + input.validDays * DAY_MS,
    maxRedemptions: input.maxRedemptions,
    redeemedCount: 0,
    perUserLimit: 1,
    boundUserId: input.boundUserId ?? null,
    status: 'active',
    createdAt: now,
    createdBy: input.createdBy,
    notes: '',
  };
  await repo.set('redemption_codes', codeHash, code);
  return { code: raw.match(/.{4}/g)!.join('-'), codeId: codeHash };
}
