# remote_pairing_T004 - Relay 优先配对与通道展示

Status: Implemented (verification exception recorded)
Owner: runtime
Branch: `codex/relay-first-pairing`
Base: `dev`

## 目标

修正双 Transport 配对选择与 Desktop 展示合同：

- 配对二维码继续携带当前可用的 Direct / Relay endpoint。
- Mobile 在 Relay endpoint 可用时优先探测 Relay。
- Relay 在 claim 前不可达时才回退 Tailscale Direct。
- Mobile 在 claim 中上报实际选用的 `relay` / `direct`，仅供 Desktop 展示与诊断。
- claim 发出后不得因响应不确定而跨 Transport 自动重发。

## 允许修改

- `docs/remote-access/**`
- `docs/project-control/tasks/remote_pairing_T004-relay-first-transport-display.md`
- `server/src/routes/remote-access.ts`
- `server/src/services/remote-access-pairing.service.ts` 及测试
- `server/src/db/repositories/tailscale-remote-access.repository.ts`
- `desktop/src/shared/api/remoteAccess.ts`
- `desktop/src/features/Settings/pages/TailscaleRemoteAccess/RemoteDevicePairingModal.tsx` 及测试
- Mobile 仓库的 Remote pairing / transport 协议、实现、测试与对应文档

## 禁止修改

- `mira_device_*` 格式与 Remote device scopes
- Remote Gateway route allowlist
- Tailscale Serve 管理
- Relay frame / Worker / Desktop Connector 转发协议
- Agent / Harness / approval 合同
- backend local-only bind
- 两仓 lockfile

## 合同

### Transport 选择

```text
Relay endpoint 存在
  -> Relay /health preflight
  -> success: 只通过 Relay claim
  -> Relay transport failure: 再探测 Direct

Relay endpoint 不存在
  -> 使用 Direct
```

`claim` 是一次性副作用。回退只允许发生在 claim 发送前；claim 已发出但响应不确定时，不跨 Transport 重发。

### 展示字段

Mobile claim 可增加：

```json
{ "transport": "relay" }
```

该字段只用于 Desktop 配对确认界面和诊断记录：

- 不参与 code、poll token、device credential 或 scope 校验；
- 不授予任何权限；
- 旧 Mobile 未发送时显示“未知”，保持协议兼容。

## 验收

- [x] Relay + Direct 同时存在时，Mobile 先探测并选择 Relay。
- [x] Relay preflight 网络失败时，Mobile 在 claim 前回退 Direct。
- [x] Relay claim 已开始后不自动改走 Direct 重发。
- [x] Desktop 持久化并展示 Mobile 上报的申请通道。
- [x] 缺少 `transport` 的旧 Mobile 仍可完成配对。
- [x] 两仓定向测试与 typecheck 有真实结果。

## 验证记录

- Desktop / Server 定向测试：5 个测试文件、26 个测试通过。
- Desktop typecheck：通过。
- Mobile typecheck：通过。
- Mobile lint：0 error，保留仓库既有 warning。
- Mobile 全量 Jest：10 个 suite、44 个测试通过。
- Server typecheck：仍被本任务前已存在的 `remote-relay-connector.service.ts:515` Buffer / `BodyInit` 类型错误阻断；本任务未越界修改该核心转发实现。
