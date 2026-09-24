import { Grant, Session, Order, Product } from '../../shared/types';
import {
  getEffectiveHistoryAccess,
  getFreeHistoryStartDate,
  grantWindow,
  visibleSessions,
} from '../../shared/domain';
import { storage, uid } from './local';
// The build generates this fixture from the SERVER catalog. Never used for real payment.
import { mockProducts } from './mock-catalog';
export async function mockCall(action: string, data: any = {}): Promise<any> {
  const now = Date.now(),
    grants = storage.get<Grant[]>('mockGrants', []),
    rows = storage.get<Session[]>('mockBackup', []),
    access = getEffectiveHistoryAccess(grants, now),
    olderCount = rows.filter(
      (s) => !s.deletedAt && s.measuredAt < getFreeHistoryStartDate(now),
    ).length;
  const grant = (
    source: Grant['source'],
    sourceId: string,
    days: number | null,
    lifetime = false,
  ) => {
    const g: Grant = {
      grantId: uid('grant'),
      userId: 'local-demo',
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
    grants.push(g);
    storage.set('mockGrants', grants);
    return g;
  };
  switch (action) {
    case 'bootstrap':
      return {
        access,
        products: mockProducts,
        olderCount,
        trialEligible:
          olderCount > 0 && !storage.get('mockTrialUsed', false) && access.type === 'FREE',
        syncEpoch: storage.get('mockEpoch', 0),
        serverNow: now,
      };
    case 'history':
      if (access.type === 'FREE' && !['today', '7'].includes(data.range))
        throw new Error('长期回顾需要解锁');
      return visibleSessions(rows, access, data.range, now, data.period);
    case 'sync': {
      if (data.epoch !== storage.get('mockEpoch', 0)) throw new Error('数据版本已变更');
      const i = rows.findIndex((s) => s.sessionId === data.session.sessionId);
      if (i >= 0) rows[i] = data.session;
      else rows.push(data.session);
      storage.set('mockBackup', rows);
      return { session: data.session };
    }
    case 'export':
    case 'restore':
      return rows.filter((s) => !s.deletedAt);
    case 'deleteSession':
      storage.set(
        'mockBackup',
        rows.filter((s) => s.sessionId !== data.sessionId),
      );
      return { ok: true };
    case 'deleteAll': {
      storage.set('mockBackup', []);
      storage.set('mockEpoch', storage.get('mockEpoch', 0) + 1);
      return { syncEpoch: storage.get('mockEpoch', 0) };
    }
    case 'startTrial':
      if (!olderCount || storage.get('mockTrialUsed', false) || access.type !== 'FREE')
        throw new Error('当前不能领取体验');
      storage.set('mockTrialUsed', true);
      return grant('trial', 'one-time', 7);
    case 'createOrder': {
      const products = mockProducts as Product[];
      const p = products.find((p) => p.productId === data.productId)!;
      if (!p) throw new Error('商品不存在');
      const orders = storage.get<Order[]>('mockOrders', []);
      const old = orders.find((o) => o.metadata.requestId === data.requestId);
      if (old) return old;
      const o: Order = {
        orderId: uid('order'),
        outTradeNo: uid('trade'),
        userId: 'local-demo',
        productId: p.productId,
        amountFen: p.priceFen,
        currency: 'CNY',
        platform: 'development',
        status: 'CREATED',
        provider: 'mock',
        providerTransactionId: null,
        createdAt: now,
        paidAt: null,
        deliveredAt: null,
        refundedAt: null,
        metadata: {
          requestId: data.requestId,
          durationDays: p.durationDays,
          isLifetime: p.entitlementType === 'lifetime',
        },
      };
      orders.push(o);
      storage.set('mockOrders', orders);
      return o;
    }
    case 'confirmMockPayment': {
      const orders = storage.get<Order[]>('mockOrders', []);
      const o = orders.find((o) => o.orderId === data.orderId);
      if (!o) throw new Error('订单不存在');
      if (o.status === 'DELIVERED') return o;
      if (o.status !== 'CREATED') throw new Error('订单状态无效');
      grant(
        'purchase',
        o.orderId,
        o.metadata.durationDays as number | null,
        o.metadata.isLifetime as boolean,
      );
      o.status = 'DELIVERED';
      o.paidAt = now;
      o.deliveredAt = now;
      storage.set('mockOrders', orders);
      return o;
    }
    case 'refundMock': {
      const orders = storage.get<Order[]>('mockOrders', []);
      const o = orders.find((o) => o.status === 'DELIVERED');
      if (!o) throw new Error('没有可模拟退款的订单');
      o.status = 'REFUNDED';
      o.refundedAt = now;
      grants
        .filter((g) => g.sourceId === o.orderId)
        .forEach((g) => {
          g.status = 'revoked';
          g.revokedAt = now;
          g.revokeReason = 'mock refund';
        });
      let end = 0;
      for (const g of grants
        .filter((g) => g.status === 'active' && !g.isLifetime && g.source !== 'trial')
        .sort((a, b) => a.createdAt - b.createdAt)) {
        g.expiresAt = Math.max(g.createdAt, end) + (g.metadata.durationDays as number) * 86400000;
        end = g.expiresAt;
      }
      storage.set('mockOrders', orders);
      storage.set('mockGrants', grants);
      return o;
    }
    case 'redeem': {
      if (data.code.replace(/[\s-]/g, '').toUpperCase() !== 'AXBP7DAYTEST')
        throw new Error('演示模式仅支持界面提供的测试码');
      if (storage.get('mockRedeemed', false)) return { alreadyRedeemed: true };
      if (access.type === 'LIFETIME') throw new Error('你已经拥有永久长期回顾');
      storage.set('mockRedeemed', true);
      grant('redeem_code', 'demo-free-code', 7);
      return { alreadyRedeemed: false };
    }
    default:
      throw new Error('不支持的操作');
  }
}
