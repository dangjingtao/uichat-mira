# remote_relay_T003 - Pairing 去 Tailscale 硬依赖与 Mobile RelayTransport

Status: Implemented - Pending E2E
Owner: runtime
Branch: `feature/remote-relay-mobile-v1`
Base: `dev`

## 目标

在完整保留现有 Tailscale 能力的前提下，让 Mira Relay 成为真正可独立完成配对与远程访问的第二条 Transport：

- Mira 内置默认 Relay endpoint 固定为 `https://relay.tomz.io`。
- Desktop 创建配对挑战时不再要求 Tailscale 必须 ready。
- Tailscale ready 时继续把 Direct endpoint 放进二维码。
- Relay connected 时把 Relay endpoint / relayId / Client relay token 放进二维码。
- 至少 Direct 或 Relay 一条可用时允许创建配对挑战。
- Desktop “配对新设备”入口使用同一双 Transport 可用性条件，不再由 Tailscale 单独锁死。
- Mobile Remote Host V1 支持 Direct + Relay endpoints，并优先 Direct、网络不可达时回退 Relay。
- Mira 业务授权仍由 Desktop 的 `mira_device_*` credential + scopes 决定。

## 允许修改（主仓）

- `server/src/config/index.ts`
- `server/src/routes/remote-access.ts`
- `server/src/services/remote-access-pairing.service.ts`
- Relay/pairing 相关测试
- `desktop/src/features/Settings/pages/TailscaleRemoteAccess/**`：仅允许调整配对入口的双 Transport 可用性与相关测试/极简提示，不改 Tailscale Serve 行为
- `docs/remote-access/**`
- 本任务卡

## 禁止修改（主仓）

- Tailscale service / repository / Serve 行为
- `mira_device_*` credential 与 scope 语义
- Remote Host V1 业务 routes
- backend local-only bind
- Agent / Provider / KB / Tool 等无关模块
- `pnpm-lock.yaml`

## Mobile 对应范围

`dangjingtao/uichat-mira-mobile` 的 `feature/remote-relay-v1`：

- pairing URI / endpoint contract
- secure credential storage schema（向后兼容旧 Direct-only credential）
- Relay WebSocket transport
- RemoteMiraHostClient transport selection
- 真实 deep-link pairing 入口与现有 App API facade 接线
- 相关测试与文档

不得复制 Desktop 业务授权逻辑到 Mobile。

## 安全合同

Relay Client token 只解决“能否进入 Relay room”，不是 Mira 业务凭据。二维码本身已含一次性 pairing code，因此新增 `relayToken` 后整体必须继续视为敏感短时配对材料；Mobile 配对成功后放入平台安全存储。业务接口仍必须携带并由 Desktop 校验 `mira_device_*` credential。

## Transport 选择

- Direct 可用时优先 Direct。
- 仅 Direct 的网络层失败允许回退 Relay。
- HTTP 401/403、业务错误和协议解析错误不触发跨 Transport 兜底。
- Direct 网络失败后允许短暂冷却使用 Relay，随后再探测 Direct，避免每个请求重复等待不可达的 Tailnet。
- Tailscale 恢复后不需要重新配对。

## 验收

- [x] 默认服务解析为 `https://relay.tomz.io`。
- [x] Tailscale ready + Relay connected 时二维码携带两条 endpoint。
- [x] Tailscale 不可用但 Relay connected 时仍能创建配对二维码。
- [x] Desktop 配对按钮在 Relay connected / Tailscale unavailable 时仍可用。
- [x] 两者都不可用时明确拒绝创建配对挑战。
- [x] Relay token 不出现在 Desktop 设置 UI / 普通状态 API。
- [x] Mobile deep link 实际进入 Relay-aware pairing 入口，而不是旧 Host 登录页。
- [x] Mobile Relay pairing claim / poll / manifest 代码链已接通并有协议/transport 单测覆盖。
- [x] Mobile JSON API 支持 Direct -> Relay fallback。
- [x] Mobile SSE 支持 Relay streaming 与 cancel，实际聊天停止按钮走统一 facade。
- [x] Tailscale 现有 Direct/JWT 登录与 Direct Remote Host 路径保留。
- [ ] 主仓 `pnpm check`：当前 PR workflow 仅运行 Branch Policy，尚无整仓 check 证据。
- [x] Mobile final head Typecheck / Lint / Jest 全部通过。
- [ ] Android / iOS final-head native build：当前 CI 仍在执行。
- [ ] 真机 E2E：Desktop 开 Relay -> Mobile 扫码 -> Desktop 批准 -> Relay manifest/chat/stream/cancel 尚未实测。

## 已知 V1 边界

- Relay-only 模式的 artifact/media 读取尚未接入 Relay；当前该请求仍要求 Direct endpoint。
- Remote device scope 当前没有 `threads:write`，因此 Mobile 在配对设备模式隐藏创建/重命名/删除会话能力，不擅自扩权。
