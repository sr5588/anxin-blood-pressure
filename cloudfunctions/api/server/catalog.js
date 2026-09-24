"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedProducts = void 0;
// Server-only suggested launch catalog. Production reads the products collection.
exports.seedProducts = [
    {
        productId: 'history_access_365d',
        displayName: '一年长期回顾',
        description: '365天的长期历史与趋势',
        priceFen: 1290,
        entitlementType: 'time',
        durationDays: 365,
        isActive: true,
        sortOrder: 1,
        badge: '按年安心回顾',
        platformConfig: {},
        createdAt: 0,
        updatedAt: 0,
    },
    {
        productId: 'history_access_lifetime',
        displayName: '永久长期回顾',
        description: '一次解锁，长期陪伴',
        priceFen: 2990,
        entitlementType: 'lifetime',
        durationDays: null,
        isActive: true,
        sortOrder: 2,
        badge: '长久陪伴',
        platformConfig: {},
        createdAt: 0,
        updatedAt: 0,
    },
];
