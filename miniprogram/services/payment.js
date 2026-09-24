"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payment = exports.WechatVirtualPaymentProvider = exports.MockPaymentProvider = void 0;
const api_1 = require("./api");
const local_1 = require("./local");
const config_1 = require("../config");
const config_2 = require("../shared/config");
class MockPaymentProvider {
    async purchase(productId) {
        const o = await (0, api_1.call)('createOrder', { productId, requestId: (0, local_1.uid)('purchase') });
        await (0, api_1.call)('confirmMockPayment', { orderId: o.orderId });
    }
    restore() {
        return (0, api_1.call)('bootstrap');
    }
}
exports.MockPaymentProvider = MockPaymentProvider;
class WechatVirtualPaymentProvider {
    // Deliberately fail closed until official personal-subject entitlement, signing,
    // server query/notification verification and refund reconciliation are configured.
    async purchase(productId) {
        if (!config_2.FeatureFlags.ENABLE_REAL_PAYMENT)
            throw new Error('真实虚拟支付尚未开通');
        if (!wx.canIUse('requestVirtualPayment'))
            throw new Error('当前微信版本暂不支持此支付方式');
        const order = await (0, api_1.call)('createWechatOrder', { productId, requestId: (0, local_1.uid)('purchase') });
        await new Promise((resolve, reject) => wx.requestVirtualPayment({ ...order.paymentParams, success: () => resolve(), fail: reject }));
        // The client callback is never delivery evidence. Only a verified server
        // order may be acknowledged; no grant is created in this provider.
        const verified = await (0, api_1.call)('verifyWechatOrder', { orderId: order.orderId });
        if (verified.status !== 'DELIVERED')
            throw new Error('支付正在确认，请稍后使用恢复权益');
    }
    restore() {
        return (0, api_1.call)('bootstrap');
    }
}
exports.WechatVirtualPaymentProvider = WechatVirtualPaymentProvider;
exports.payment = config_1.AppConfig.provider === 'mock' && config_2.FeatureFlags.ENABLE_MOCK_PAYMENT
    ? new MockPaymentProvider()
    : new WechatVirtualPaymentProvider();
