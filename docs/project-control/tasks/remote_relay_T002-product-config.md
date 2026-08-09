# remote_relay_T002 - Relay 产品配置

Status: Implemented, verification pending
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
- `server/src/services/remote-relay-config.service.ts`
- `server/src/services/remote-relay-config.service.test.ts`
- `server/src/routes/remote-access.ts`
- `server/src/services/remote-access-pairing.service.ts`：仅允许向 pairing URI 追加可忽略的 Relay endpoint metadata，不改变 V1 `host/challenge/code/version` 语义
- `server/src/services/remote-access-pairing.relay.test.ts`
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

- [x] Relay 配置持久化到 Desktop SQLite：`remote-relay-settings.repository.ts` 建立单行配置表。
- [x] Relay identity 自动生成且敏感 token 加密存储：Relay ID 自动生成，Host / Client token 使用现有 `encryptSecret`。
- [x] Connector 从持久化配置读取 endpoint/identity：生产路由注入 `resolvePersistedRemoteRelayConnectorConfig`，不再要求用户填写 POC 环境变量。
- [x] 切换 enable / endpoint mode / custom URL 后 Connector 自动重启：配置 PUT 成功后调用 Connector `restart()`。
- [x] 页面提供默认服务 / 自定义地址选择，自定义输入框按需显示。
- [x] Tailscale 实现未修改：本任务 diff 未触及 Tailscale service/repository/Serve 文件。
- [x] pairing URI 保留 V1 `host/challenge/code/version` 并只追加可忽略的 `relay/relayId`；已核对当前 Mobile V1 parser 只读取既有四个字段。
- [ ] `pnpm check` 通过。
- [ ] Relay 配置后端测试实际执行通过。
- [ ] Remote Access 页面测试实际执行通过。

## 验证记录

2026-08-09：

- 已核对 `uichat-mira-mobile/dev/src/protocol/remoteHostV1.ts`：当前 `parsePairingUri()` 只读取 `version`、`host`、`challenge`、`code`，会忽略新增 query 参数，因此本次追加 Relay metadata 不破坏现有 V1 解析。
- 已新增 Relay 配置后端测试、Pairing URI 兼容测试和远程连接页面测试。
- 当前执行环境无法解析 GitHub / npm registry，无法取得仓库依赖，因此本轮没有把 `pnpm check` 或 Vitest 标记为通过。

## 明确延期

- Relay-only pairing。
- Mobile `RelayRemoteTransport`。
- Client Relay credential 的安全下发与保存。
- Direct -> Relay 自动 fallback。
- 同一设备多 endpoint 持久化。
