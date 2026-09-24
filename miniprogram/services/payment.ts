import { call } from './api';
import { uid } from './local';
import { AppConfig } from '../config';
import { FeatureFlags } from '../../shared/config';
export interface PaymentProvider {
  purchase(productId: string): Promise<void>;
  restore(): Promise<any>;
}
export class MockPaymentProvider implements PaymentProvider {
  async purchase(productId: string) {
    const o = await call('createOrder', { productId, requestId: uid('purchase') });
    await call('confirmMockPayment', { orderId: o.orderId });
  }
  restore() {
    return call('bootstrap');
  }
}
export class WechatVirtualPaymentProvider implements PaymentProvider {
  // Deliberately fail closed until official personal-subject entitlement, signing,
  // server query/notification verification and refund reconciliation are configured.
  async purchase(productId: string): Promise<void> {
    if (!FeatureFlags.ENABLE_REAL_PAYMENT) throw new Error('真实虚拟支付尚未开通');
    if (!wx.canIUse('requestVirtualPayment')) throw new Error('当前微信版本暂不支持此支付方式');
    const order = await call('createWechatOrder', { productId, requestId: uid('purchase') });
    await new Promise<void>((resolve, reject) =>
      wx.requestVirtualPayment({ ...order.paymentParams, success: () => resolve(), fail: reject }),
    );
    // The client callback is never delivery evidence. Only a verified server
    // order may be acknowledged; no grant is created in this provider.
    const verified = await call('verifyWechatOrder', { orderId: order.orderId });
    if (verified.status !== 'DELIVERED') throw new Error('支付正在确认，请稍后使用恢复权益');
  }
  restore() {
    return call('bootstrap');
  }
}
export const payment: PaymentProvider =
  AppConfig.provider === 'mock' && FeatureFlags.ENABLE_MOCK_PAYMENT
    ? new MockPaymentProvider()
    : new WechatVirtualPaymentProvider();
