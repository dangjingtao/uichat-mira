# remote_relay_T002 - Relay 产品配置

Status: In Progress
Owner: runtime
Branch: `feature/remote-relay-backend-v1`
Base: `remote_relay_T001`

## 目标

把 Mira Relay 从环境变量 POC 收敛为用户可操作的远程连接配置：

- Relay 可独立启用/停用。
- 默认使用 Mira 提供的 Relay endpoint。
- 用户可切换为自定义 Relay 地址（含自有域名、自有 workers.dev 或未来自建 Relay）。
- Relay ID / Host token / Client token 由 Desktop 自动生成并持久化，UI 不暴露。
- Tailscale 保留，不改变现有 Serve 行为。
- 页面继续保持极简。

## 允许修改

- `server/src/config/index.ts`
- `server/src/db/repositories/remote-relay-settings.repository.ts`
- `server/src/services/remote-relay-connector.service.ts`
- `server/src/services/remote-relay-connector.service.test.ts`
- `server/src/routes/remote-access.ts`
- `server/src/services/remote-access-pairing.service.ts`：仅允许向 pairing URI 追加可忽略的 Relay endpoint metadata，不改变 V1 `host/challenge/code/version` 语义
- `desktop/src/shared/api/remoteAccess.ts`
- `desktop/src/features/Settings/pages/TailscaleRemoteAccess/**`
- `docs/remote-access/**`
- 本任务卡

## 禁止修改

- Tailscale service/repository/Serve 行为
- `mira_device_*` credential 与 scope 语义
- Mobile 仓库
- Remote Host V1 业务 API
- backend local-only bind
- `pnpm-lock.yaml`

## 产品合同

```text
远程连接

Mira Relay                         [开关]
○ 默认服务
○ 自定义地址
  [ https://relay.example.com ]

Tailscale                          [开关]

已配对设备
```

- 自定义地址仅在选择后出现。
- UI 不展示 Cloudflare、Durable Object、relayId、Host token、Client token。
- 默认 Relay 地址由构建/部署配置提供；仓库不伪造一个不存在的官方域名。
- 自定义地址只接受安全的 HTTPS Relay base URL；Desktop 内部转换为 WSS。

## 验收条件

- [ ] Relay 配置持久化到 Desktop SQLite。
- [ ] Relay identity 自动生成且敏感 token 加密存储。
- [ ] Connector 从持久化配置读取 endpoint/identity，不再要求用户配置 POC 环境变量。
- [ ] 切换 enable / endpoint mode / custom URL 后 Connector 自动重启。
- [ ] 页面提供默认服务 / 自定义地址选择，自定义输入框按需显示。
- [ ] Tailscale 现有功能不回归。
- [ ] pairing URI 在不破坏 V1 Mobile parser 的前提下可携带 Relay endpoint metadata。
- [ ] 相关单测/类型检查有证据；无法执行的验证明确记录。
