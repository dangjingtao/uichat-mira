# remote_relay_T001 - Mira Relay Backend POC

Status: In Progress
Owner: runtime
Branch: `feature/remote-relay-backend-v1`
Base: `docs/remote-relay-transport-v1`

## 目标

在不改变现有 Tailscale Remote Host V1 业务合同的前提下，完成 Mira Relay 的后端 POC，并在现有 Desktop 远程连接页做最小产品化呈现：

```text
Mobile / test client
  -> Cloudflare Relay
  -> Desktop outbound WebSocket connector
  -> localhost Mira Fastify backend
```

Desktop 页面只呈现 Relay 与 Tailscale 两种通道及其真实状态，不暴露 Cloudflare、relay token 等实现配置。本任务不实现 Mobile UI、自动选路或新 pairing URI。

## 2026-08-09 范围扩展

项目 Owner 明确要求把原“Tailscale 远程连接”更名为“远程连接”，并将本次 Relay 技术方案顺势排布在同一页面；界面保持极简，不增加说明墙或技术配置表单。

## 允许修改

- `packages/remote-relay/**`
- `server/src/remote-relay/**`
- `server/src/services/remote-relay-connector.service.ts`
- `server/src/services/remote-relay-connector.service.test.ts`
- `server/src/routes/remote-access.ts`
- `desktop/src/shared/api/remoteAccess.ts`
- `desktop/src/features/Settings/pages/TailscaleRemoteAccess/**`
- `desktop/src/shared/i18n/index.ts`：仅允许注册 Remote Access feature i18n shard
- `docs/remote-access/**`
- 本任务卡
- `package.json`：仅允许增加 Relay 验证脚本
- `pnpm-workspace.yaml`：仅允许处理 Relay 独立部署目录的 workspace 边界

## 禁止修改

- Mira Mobile 仓库与 Mobile UI
- 其他 Desktop 设置页 / UI
- `server/src/services/tailscale-remote-access.service.ts`
- Tailscale repository 与现有 Serve 行为
- `mira_device_*` credential 格式
- Remote device scope 定义与鉴权语义
- Remote Host V1 manifest 业务语义
- pairing URI version / pairing endpoint 来源
- `pnpm-lock.yaml` 手工编辑
- backend 公网 bind 地址

## Transport 合同

### Relay 职责

Relay 只负责：

- Relay ID 寻址
- Host / Client WebSocket 连接登记
- Relay connection token 验证
- `request / response / chunk / complete / cancel / error` 转发
- 连接断开与取消传播

Relay 不负责：

- Mira 用户、设备 scope 或业务授权判断
- thread / message / agent 业务解释
- 模型调用
- 聊天历史持久化
- Desktop SQLite 读取

### Desktop Connector

- 仅主动出站连接 Relay。
- 本机请求目标固定在 `127.0.0.1:${CONFIG.PORT}`。
- 不修改 backend 原有 local-only bind 契约。
- `Authorization: Bearer mira_device_*` 继续由本机 Mira Server 校验。
- 必须清洗 Host / Forwarded / proxy / connection 等传输级 header。
- Relay cancel 必须映射到本地 `AbortController`。
- WebSocket Client runtime 由已经注册的 `@fastify/websocket` / `ws` runtime 显式注入，不依赖 Node 20 实验性的 global WebSocket。

## Desktop UI 合同

远程连接页保持三块：

```text
Mira Relay
Tailscale
已配对设备
```

约束：

- 页面与侧边导航统一显示“远程连接 / Remote Access”。
- Relay 只显示公网连接状态，不显示 Relay URL、Relay ID、Host Token、Client Token 或 Cloudflare 实现名。
- Tailscale 原有启用、诊断、配对与设备撤销能力继续保留。
- Tailscale 开关必须明确写作“启用 Tailscale”，避免与整个远程能力混淆。
- 不增加额外营销文案、技术原理说明或大块空状态说明。

## POC 配置

POC 使用环境变量，默认关闭：

```text
UI_CHAT_REMOTE_RELAY_ENABLED=1
UI_CHAT_REMOTE_RELAY_URL=https://<relay-host>
UI_CHAT_REMOTE_RELAY_ID=<high-entropy-relay-id>
UI_CHAT_REMOTE_RELAY_HOST_TOKEN=<host-connection-token>
UI_CHAT_REMOTE_RELAY_CLIENT_TOKEN=<client-connection-token>
```

Relay connection token 与 `mira_device_*` credential 必须保持概念和用途分离。

## 验收条件

- [ ] Cloudflare Worker + SQLite-backed Durable Object 可部署在 Free 计划能力范围内。
- [x] Durable Object 使用 hibernation WebSocket 接收 Host / Client。
- [x] DO 持久化仅包含 Relay connection token 哈希，不持久化业务正文。
- [x] Desktop Connector 默认关闭，开启后主动建立 Relay WebSocket。
- [x] Desktop Connector 可把通用 request 转发到 localhost Mira backend。
- [x] JSON / byte stream 可通过 `response + chunk + complete` 返回。
- [x] `cancel` 能终止 Desktop 本地请求。
- [x] Relay status 可通过 Desktop 受保护只读接口读取。
- [x] 现有 Tailscale pairing 与 Serve 代码不修改。
- [x] Relay Connector 有针对 hello、请求转发、header 清洗、stream、cancel、配置错误的单测。
- [x] Cloudflare Worker / Durable Object 源码独立 TypeScript 检查通过。
- [x] Relay protocol + Desktop Connector 源码独立 TypeScript 检查通过。
- [x] Desktop 页面标题与导航名改为“远程连接 / Remote Access”。
- [x] Desktop 页面按 Mira Relay / Tailscale / 已配对设备排布。
- [x] Relay 页面不暴露内部 Relay 配置与 Cloudflare 实现细节。
- [ ] `pnpm check` 通过。
- [ ] Relay Connector Vitest 实际执行通过。
- [ ] Remote Access Desktop Vitest 实际执行通过。
- [ ] Cloudflare 实网 smoke：Host online -> request -> localhost `/health` -> response。

## 验证记录

2026-08-09：

- 在隔离 TypeScript 环境重建 `packages/remote-relay/src/index.ts` 与 runtime declarations，`tsc` 通过。
- 在隔离 TypeScript 环境重建 `server/src/remote-relay/protocol.ts` 与 Desktop Connector，`tsc` 通过。
- 当前执行环境无法解析 GitHub / npm registry，无法取得仓库依赖与 pnpm，因此没有把 `pnpm check` 或 Vitest 标记为通过。
- 尚未部署真实 Cloudflare Worker，因此没有把 Free 计划部署与端到端 smoke 标记为通过。

## 明确延期

以下属于后续任务，不在 T001 内完成：

- Mobile `RelayRemoteTransport`
- Direct -> Relay 自动 fallback
- 同一设备保存多个 endpoint
- pairing 去 Tailscale ready 硬编码
- Relay 用户级零配置凭证签发 / 持久化
- 大文件专用传输
- Relay 多 Host 调度

## 已知 POC 风险

- 公网 Worker 当前以高熵 `relayId` + room token 隔离，尚未加入平台级账户 / 配额 / abuse control；因此只视为受控 POC，不作为开放公共 Relay 的生产合同。
- Relay V1 对请求体、响应累计字节数和并发请求数设置硬上限；大文件场景明确不在本任务范围。
- 实际打包态仍需做一次 Desktop runtime smoke，确认现有 Fastify `ws` runtime 注入在 Electron/Tauri 打包链中保持有效。
