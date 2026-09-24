"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockCall = mockCall;
const domain_1 = require("../shared/domain");
const local_1 = require("./local");
// The build generates this fixture from the SERVER catalog. Never used for real payment.
const mock_catalog_1 = require("./mock-catalog");
async function mockCall(action, data = {}) {
    const now = Date.now(), grants = local_1.storage.get('mockGrants', []), rows = local_1.storage.get('mockBackup', []), access = (0, domain_1.getEffectiveHistoryAccess)(grants, now), olderCount = rows.filter((s) => !s.deletedAt && s.measuredAt < (0, domain_1.getFreeHistoryStartDate)(now)).length;
    const grant = (source, sourceId, days, lifetime = false) => {
        const g = {
            grantId: (0, local_1.uid)('grant'),
            userId: 'local-demo',
            entitlementKey: 'history_access',
            grantType: lifetime ? 'lifetime' : source === 'trial' ? 'trial' : 'time',
            source,
            sourceId,
            ...(0, domain_1.grantWindow)(grants, days, lifetime, now),
            status: 'active',
            createdAt: now,
            updatedAt: now,
            revokedAt: null,
            revokeReason: null,
            metadata: { durationDays: days },
        };
        grants.push(g);
        local_1.storage.set('mockGrants', grants);
        return g;
    };
    switch (action) {
        case 'bootstrap':
            return {
                access,
                products: mock_catalog_1.mockProducts,
                olderCount,
                trialEligible: olderCount > 0 && !local_1.storage.get('mockTrialUsed', false) && access.type === 'FREE',
                syncEpoch: local_1.storage.get('mockEpoch', 0),
                serverNow: now,
            };
        case 'history':
            if (access.type === 'FREE' && !['today', '7'].includes(data.range))
                throw new Error('长期回顾需要解锁');
            return (0, domain_1.visibleSessions)(rows, access, data.range, now, data.period);
        case 'sync': {
            if (data.epoch !== local_1.storage.get('mockEpoch', 0))
                throw new Error('数据版本已变更');
            const i = rows.findIndex((s) => s.sessionId === data.session.sessionId);
            if (i >= 0)
                rows[i] = data.session;
            else
                rows.push(data.session);
            local_1.storage.set('mockBackup', rows);
            return { session: data.session };
        }
        case 'export':
        case 'restore':
            return rows.filter((s) => !s.deletedAt);
        case 'deleteSession':
            local_1.storage.set('mockBackup', rows.filter((s) => s.sessionId !== data.sessionId));
            return { ok: true };
        case 'deleteAll': {
            local_1.storage.set('mockBackup', []);
            local_1.storage.set('mockEpoch', local_1.storage.get('mockEpoch', 0) + 1);
            return { syncEpoch: local_1.storage.get('mockEpoch', 0) };
        }
        case 'startTrial':
            if (!olderCount || local_1.storage.get('mockTrialUsed', false) || access.type !== 'FREE')
                throw new Error('当前不能领取体验');
            local_1.storage.set('mockTrialUsed', true);
            return grant('trial', 'one-time', 7);
        case 'createOrder': {
            const products = mock_catalog_1.mockProducts;
            const p = products.find((p) => p.productId === data.productId);
            if (!p)
                throw new Error('商品不存在');
            const orders = local_1.storage.get('mockOrders', []);
            const old = orders.find((o) => o.metadata.requestId === data.requestId);
            if (old)
                return old;
            const o = {
                orderId: (0, local_1.uid)('order'),
                outTradeNo: (0, local_1.uid)('trade'),
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
            local_1.storage.set('mockOrders', orders);
            return o;
        }
        case 'confirmMockPayment': {
            const orders = local_1.storage.get('mockOrders', []);
            const o = orders.find((o) => o.orderId === data.orderId);
            if (!o)
                throw new Error('订单不存在');
            if (o.status === 'DELIVERED')
                return o;
            if (o.status !== 'CREATED')
                throw new Error('订单状态无效');
            grant('purchase', o.orderId, o.metadata.durationDays, o.metadata.isLifetime);
            o.status = 'DELIVERED';
            o.paidAt = now;
            o.deliveredAt = now;
            local_1.storage.set('mockOrders', orders);
            return o;
        }
        case 'refundMock': {
            const orders = local_1.storage.get('mockOrders', []);
            const o = orders.find((o) => o.status === 'DELIVERED');
            if (!o)
                throw new Error('没有可模拟退款的订单');
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
                g.expiresAt = Math.max(g.createdAt, end) + g.metadata.durationDays * 86400000;
                end = g.expiresAt;
            }
            local_1.storage.set('mockOrders', orders);
            local_1.storage.set('mockGrants', grants);
            return o;
        }
        case 'redeem': {
            if (data.code.replace(/[\s-]/g, '').toUpperCase() !== 'AXBP7DAYTEST')
                throw new Error('演示模式仅支持界面提供的测试码');
            if (local_1.storage.get('mockRedeemed', false))
                return { alreadyRedeemed: true };
            if (access.type === 'LIFETIME')
                throw new Error('你已经拥有永久长期回顾');
            local_1.storage.set('mockRedeemed', true);
            grant('redeem_code', 'demo-free-code', 7);
            return { alreadyRedeemed: false };
        }
        default:
            throw new Error('不支持的操作');
    }
}
