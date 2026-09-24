# 安心血压

原生微信小程序 MVP。TypeScript + WXML + WXSS，轻量原生 Canvas 图表，CloudBase 云函数，无第三方 UI 框架。

## 立即运行

用微信开发者工具导入**本目录**，选择编译即可。当前工程已绑定正式 AppID，但默认仍为本机 Mock，只有完成 CloudBase 环境配置后才会启用云端备份。

密钥、AppSecret、CloudBase 管理凭据和本地环境文件不会提交到 Git。请复制 `.env.example` 到私有部署环境中填写；AppSecret 不应放进小程序客户端。

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

本机若 PATH 没有 Node，可使用已配置的 Codex Node 路径运行 `scripts/build.mjs`；详见 `scripts/dev.sh`。

## 已实现

- 今天 / 趋势 / 日历 / 我的四个主页面；明亮浅色与柔和深色主题，默认跟随系统，可手动切换。
- 按季节轮换每日暖心问候，配置化节日文案。农历节日使用年度配置，过期年份回退季节问候，不拿旧日期重复套用。
- 三列原生滚轮；中心字号与渐隐层级、原创轻刻度音、停止时轻触感；尊重系统静音，音效可关闭。滚动后直接保存，未滚动时一次明确“确认并保存”，没有额外勾选步骤。
- 首次极简准备页；30～60秒复测；任一血压差 ≥10 建议第三次；全部原始读数保留。未完成组可保留。异常症状与高低读数安全提示永久免费。
- 每日记录不限次数、永久免费保存全部原始读数；最近7个自然日、每日多次组均值、时间段筛选、长期权益锁定；完整 JSON / CSV 导出永久免费。
- 包含嵌入中文字体的多页 PDF 医生报告；7日免费、长期范围由权益控制。
- 文件级本地保存、持久化同步队列、账号隔离、备份/恢复、删除及防止旧副本重新上传。
- 权益流水、主动领取一次7×24小时体验、服务器商品目录、年权益叠加、永久权益、幂等模拟订单和退款。
- 安全随机兑换码、哈希保存、服务端事务、次数限制、绑定账号、幂等、防试码限流和管理员脚本。

## 工程结构

| 目录 | 内容 |
| --- | --- |
| `miniprogram/pages` | 原生页面 TypeScript / WXML / WXSS |
| `miniprogram/services` | 本地存储、同步、主题、音效和支付 Provider |
| `shared` | 类型、集中医学配置、时间边界、权益、导出与报告 |
| `server` | CloudBase 数据适配、事务业务、公开云函数入口 |
| `cloudfunctions/api` | 独立可上传产物，运行 `build` 自动更新 |
| `tests` | 业务边界、并发与持久化回归 |
| `scripts` | 构建、管理、微信模拟器 E2E 与字体子集工具 |
| `docs` | 云端接入、数据规则与验证记录 |

只修改 TS 源文件；`pnpm build` 同时生成小程序 JS 和云函数 JS。JS 保留在工程内，微信工具无需额外构建插件即可导入。

## 测试与运行限制

`pnpm test` 包含服务端与客户端存储回归。Mac 安装微信工具后，`python3 scripts/check-templates.py` 使用微信原生 WXML/WXSS 编译器校验全部页面。`scripts/e2e.cjs` 使用官方 miniprogram-automator 测试真实模拟器；只用于本机 Mock，会重置演示权益并新增测试读数，不可对真实账号运行。

真实 AppID、CloudBase 部署、跨设备恢复和正式支付尚需实际环境验证。模拟器不能证明真机触觉与扬声器效果一致。真实支付保持关闭；具体限制与部署方法见 [CloudBase 接入](docs/cloudbase.md)。医疗提醒是安全分流，不是疾病诊断。

字体：Noto Sans SC 子集，SIL Open Font License，许可在 `assets/fonts/OFL.txt`。源字体来自 Google Fonts 官方仓库；音效为程序原创合成，不包含 Apple 系统音频。
