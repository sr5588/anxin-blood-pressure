# 安全与凭据

本仓库只保存源代码、构建配置和不含秘密的示例配置。

- 不提交 `AppSecret`、CloudBase 管理凭据、API token、私钥或 `.env` 文件。
- AppSecret 只能放在可信的服务端环境变量或微信后台，不得放进 `miniprogram/`。
- 曾经在聊天或其他公开位置粘贴过的 AppSecret 应立即在微信后台重置，然后只在服务端安全环境中更新。
- GitHub 仓库建议设为 Private，并开启 Secret scanning / push protection。
