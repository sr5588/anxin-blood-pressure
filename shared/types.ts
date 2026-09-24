export type Period = 'morning' | 'daytime' | 'evening' | 'bedtime';
export interface Reading {
  readingId: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  measuredAt: number;
}
export interface Context {
  arm?: 'left' | 'right';
  posture?: 'sitting' | 'standing';
  medication?: 'before' | 'after';
  symptoms: string[];
  irregularHeartbeat: boolean;
}
export interface Session {
  sessionId: string;
  readings: Reading[];
  measuredAt: number;
  period: Period;
  context: Context;
  average: { systolic: number; diastolic: number; pulse: number };
  status: 'in_progress' | 'complete' | 'partial';
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  schemaVersion: 1;
}
export type GrantSource =
  'purchase' | 'trial' | 'redeem_code' | 'promotion' | 'support' | 'admin' | 'migration';
export interface Grant {
  grantId: string;
  userId: string;
  entitlementKey: 'history_access';
  grantType: 'time' | 'lifetime' | 'trial';
  source: GrantSource;
  sourceId: string;
  startsAt: number;
  expiresAt: number | null;
  isLifetime: boolean;
  status: 'active' | 'revoked';
  createdAt: number;
  updatedAt: number;
  revokedAt: number | null;
  revokeReason: string | null;
  metadata: Record<string, unknown>;
}
export interface Access {
  type: 'FREE' | 'TRIAL' | 'TIME_LIMITED' | 'LIFETIME';
  startsAt: number | null;
  expiresAt: number | null;
  source: GrantSource | null;
  remainingTime: number | null;
}
export interface Product {
  productId: string;
  displayName: string;
  description: string;
  priceFen: number;
  entitlementType: 'time' | 'lifetime';
  durationDays: number | null;
  isActive: boolean;
  sortOrder: number;
  badge: string;
  platformConfig: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
export interface Order {
  orderId: string;
  outTradeNo: string;
  userId: string;
  productId: string;
  amountFen: number;
  currency: 'CNY';
  platform: string;
  status:
    'CREATED' | 'PAYING' | 'PAID' | 'DELIVERED' | 'FAILED' | 'CANCELLED' | 'REFUNDING' | 'REFUNDED';
  provider: 'mock' | 'wechat';
  providerTransactionId: string | null;
  createdAt: number;
  paidAt: number | null;
  deliveredAt: number | null;
  refundedAt: number | null;
  metadata: Record<string, unknown>;
}
export interface RedemptionCode {
  codeId: string;
  codeHash: string;
  codePrefix: string;
  campaignId: string;
  entitlementType: string;
  durationDays: number | null;
  isLifetime: boolean;
  validFrom: number;
  validUntil: number;
  maxRedemptions: number;
  redeemedCount: number;
  perUserLimit: number;
  boundUserId: string | null;
  status: 'active' | 'disabled';
  createdAt: number;
  createdBy: string;
  notes: string;
}
export interface RedemptionRecord {
  redemptionId: string;
  codeId: string;
  userId: string;
  grantId: string;
  redeemedAt: number;
  status: 'success';
}
export interface Account {
  userId: string;
  revision: number;
  trialStartedAt: number | null;
  trialExpiresAt: number | null;
  syncEpoch: number;
  deletionPending: boolean;
  createdAt: number;
}
export type Range = 'today' | '7' | '30' | '90' | '180' | '365' | 'all';
