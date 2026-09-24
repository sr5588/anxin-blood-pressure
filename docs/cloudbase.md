# CloudBase 接入

当前默认本机 Mock，可直接导入微信开发者工具。没有真实 AppID / 环境 ID 时不会产生云端记录或扣款。

1. 将根目录 `project.config.json` 的 `appid` 换成你的真实小程序 AppID。
2. 在云开发控制台创建环境，在 `miniprogram/config.ts` 设置 `provider: 'cloud'` 和 `cloudEnv`。构建后上传 `cloudfunctions/api`，安装其 npm 依赖。
3. 按 `database-schema.json` 创建全部集合和复合索引。所有集合、小程序端云存储规则设为禁止客户端直接读写，由云函数处理。不要使用“所有用户可读写”。
4. 在可信的云端管理运行环境执行 `scripts/admin.ts seed-products`。管理员脚本绝不能打包进小程序，也不要增加公开调用的管理员 action。环境变量 `CLOUDBASE_ENV_ID` 指向目标环境；管理运行环境使用腾讯云身份凭证，不把密钥放进代码。
5. 云函数默认关闭模拟支付。只在独立开发环境测试时，同时配置 `DEPLOYMENT_STAGE=development`、`ENABLE_MOCK_PAYMENT=true`、`MOCK_USER_ALLOWLIST=测试账号OPENID`。生产环境不要设置这些变量。
6. 根据小程序后台要求声明健康数据用途和隐私保护说明；使用开发者工具与手机验证隐私授权、文件分享、音频静音行为、云函数超时、网络恢复和换机恢复。

## 权限与存储

公开入口从 `cloud.getWXContext().OPENID` 取得身份，不信任事件参数里的 userId、金额、权益或管理员身份。`history` 服务端检查权益，免费用户不能读取长期应用内历史。`export` / `restore` 是明确授权的完整数据通道，不检查付费状态。客户端保留用户自己的本地原始数据，因此不把本地存储当作防篡改 DRM。

原始读数为追加结构，服务端重新校验范围、重算平均和时段。一个 session 文档保存该组的全部 reading，并不只保存平均值。已记录的 reading 不允许覆盖。每个账号有串行修订号；权益、订单、兑换使用事务提交。账号权益流水从独立集合加载后，在事务中校验账号版本，不在事务里使用不受支持的 `where` 查询。

本机每组数据独立写文件，通过临时文件与 rename 提交；文件内保存同步标记，崩溃后能够重建待同步队列。云模式缓存按服务端账号哈希分目录。CloudBase 导出使用私有文件和短期签名 URL，成功下载后即清理；文件清单存入 `export_files`。全部删除会阻止新上传、提高同步代数并删除临时导出文件，失败可以重试。已被用户另存或分享出去的副本不属于应用可控存储。

为清理客户端异常退出后的临时导出文件，在可信后台每日运行 `scripts/admin.ts cleanup-exports`，并给云存储 `exports/` 配置短期生命周期作为兜底。清理脚本只删除到期的导出快照，不删除原始健康记录。

## 兑换管理

```sh
# 仅在可信管理环境
CLOUDBASE_ENV_ID=你的环境 pnpm admin create-code 7
CLOUDBASE_ENV_ID=你的环境 MAX_REDEMPTIONS=100 CAMPAIGN_ID=first-users pnpm admin create-code 30
CLOUDBASE_ENV_ID=你的环境 pnpm admin create-code lifetime
CLOUDBASE_ENV_ID=你的环境 pnpm admin disable-code 码的SHA256
CLOUDBASE_ENV_ID=你的环境 pnpm admin inspect-code 码的SHA256
```

完整码只在创建输出中展示一次；数据库保留哈希与四位前缀。扫码载荷为 `anxin-bp://redeem?token=完整随机码`，这个随机码本身是授权令牌，不包含身份或订单信息。每个码每账号最多一次；活动码可配置总次数。兑换码只用于免费或平台允许的授权场景。

## 真实支付的明确边界

`WechatVirtualPaymentProvider` 当前为关闭状态。尚未实现真实支付签名、官方支付通知验签、订单查询、真实退款对账，不可将本 MVP 当作已接入支付。不要只翻转客户端开关就上线，不要使用 `wx.requestPayment` 出售这些虚拟权益。

官方 `wx.requestVirtualPayment` 文档页在本次网络环境中未能打开，不能据旧文章推定个人主体当前准入和商品模式。接入时需以最新微信官方规则确认个人主体资格、商品映射、订单标识约束、签名算法、发货回执和退款规则，完成官方沙箱验证后再开放购买。现有 Mock 已测试创建订单、服务端定价、幂等发货、时长叠加、永久权益、恢复与退款撤销。

## MVP 容量边界

没有人为的记录次数、年限或付费数据保留限制；平台文件空间、云数据库容量、函数内存/执行时间仍有实际配额。当前云端游标分页读取，但长范围历史与完整导出仍会在函数中汇总；大规模用户上线前应迁移为分页趋势聚合和异步流式导出任务。不能把配额问题包装成购买后才能保留数据。
