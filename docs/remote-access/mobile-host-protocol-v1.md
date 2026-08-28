---
title: Mira Mobile Host Protocol V1 (legacy host contract)
status: reference
doc_type: reference
canonical: false
last_verified: 2026-08-28
canonical_source: uichat-mira-mobile@dev:docs/remote-access/remote-connection-canonical-v1.md
canonical_source_branch: dev
superseded_by: uichat-mira-mobile@dev:docs/remote-access/remote-connection-canonical-v1.md
---

# Mira Mobile Host Protocol V1

> Remote transport and pairing selection are no longer defined here. The
> authoritative contract is the Mobile `dev` document at
> `uichat-mira-mobile@dev:docs/remote-access/remote-connection-canonical-v1.md`,
> synchronized on **2026-08-26**. This page remains a route, credential, and
> scope reference for the existing Host V1 API.

## 1. 目标

`uichat-mira-mobile` 通过 Direct（Tailscale）或 Mira Relay 访问 Mira Desktop Host。Transport 只负责可达性与转发；Mira 继续负责配对、设备凭证、用户归属、能力范围、工具审批、撤销和审计。

V1 不复制一套 Thread、Message、Workspace 或 Agent Runtime。完成配对后，设备凭证只被允许访问一组明确的现有 canonical routes 或 Mobile-safe projection，由 Remote Gateway 在进入业务路由前完成设备认证与 scope 校验。

```text
Mobile
  ├─ Direct / Tailscale / HTTPS
  ├─ Relay / WSS
  ├─ Device Credential
  ▼
Remote Gateway
  ├─ verify credential
  ├─ resolve owner user
  ├─ check method + path + scope
  ▼
Canonical Mira Routes / safe projections
  ├─ Workspace / Thread / Message
  ├─ Persisted Chat Stream
  ├─ Agent Run
  └─ Artifact Read
```

## 2. 协议版本

当前协议版本：`1`。

配对成功后，mobile 可读取：

```http
GET /remote/v1/manifest
Authorization: Bearer <device credential>
```

返回协议版本、设备 ID、授权 scope、可调用 route 和服务端时间。mobile 必须以 manifest 为准，不得根据桌面 UI 猜测能力。

## 3. 配对流程

### 3.1 Desktop 创建挑战

```http
POST /remote/admin/pairing/challenges
Authorization: Bearer <desktop user jwt>
```

Host 在 Tailscale Direct 为 `ready` 或 Mira Relay 为 `connected` 时创建挑战；两者都可用时，二维码同时携带两个 endpoint。响应包含：

- `challengeId`
- 8 位一次性配对码
- `pairingUri`
- `expiresAt`

配对码不以明文持久化；挑战默认 5 分钟过期。

### 3.2 Mobile 领取挑战

```http
POST /remote/pairing/claim
Content-Type: application/json

{
  "challengeId": "...",
  "code": "ABCDEFGH",
  "deviceName": "K70",
  "platform": "android",
  "transport": "relay",
  "publicKey": "optional-device-public-key",
  "requestedScopes": ["threads:read", "messages:read", "messages:write"]
}
```

响应返回 `claimId` 与一次性 `pollToken`。Host 只保存 poll token 的哈希。

`transport` 可选值为 `relay` 或 `direct`，只记录 Mobile 实际选择的申请通道，供 Desktop 配对确认界面展示。它不参与认证、scope、审批或 endpoint 判定；旧 Mobile 不发送该字段时按“未知”展示。

### 3.3 Desktop 确认

Desktop 轮询当前 challenge；收到 claim 后显示设备名称、平台、公钥摘要和请求 scope。用户明确批准或拒绝：

```http
POST /remote/admin/pairing/claims/:claimId/approve
POST /remote/admin/pairing/claims/:claimId/reject
Authorization: Bearer <desktop user jwt>
```

批准时 Desktop 可缩减 scope，不能扩大到未定义 scope。

### 3.4 Mobile 领取凭证

```http
POST /remote/pairing/claims/:claimId/poll
Content-Type: application/json

{ "pollToken": "<one-time poll token>" }
```

批准后，Host 只返回一次完整 device credential；返回后立即清除服务器中的可解密副本，只保留 SHA-256 哈希。mobile 必须把凭证保存到系统安全存储。

## 4. 设备凭证

凭证为 opaque bearer token：

```text
mira_device_<deviceId>.<random-secret>
```

Host 持久化：

- device ID
- owner user ID
- token hash
- device name / platform / optional public key
- scopes
- createdAt / lastSeenAt / revokedAt

Host 不持久化长期可解密凭证明文。撤销后下一次 HTTP 请求立即失败；后续 WebSocket Runtime 接入时，撤销事件还必须主动关闭存量连接。

## 5. Scope

V1 定义以下 scope：

| Scope | 能力 |
| --- | --- |
| `threads:read` | 列出和读取当前用户 Thread；读取用于组织 Thread 的 Mobile-safe Workspace 元数据 |
| `messages:read` | 读取 Thread Message |
| `messages:write` | 通过 persisted default chat stream 发送消息；兼容 0.2.0 已配对设备执行当前用户 Thread 删除 |
| `agent:read` | 读取 Agent Run |
| `agent:approve` | 批准或拒绝 pending approval |
| `agent:control` | 取消 Agent Run |
| `artifacts:read` | 读取已归属 Thread 的媒体 / Artifact |

默认批准 scope：

```text
threads:read
messages:read
messages:write
agent:read
agent:approve
agent:control
artifacts:read
```

Workspace V1 不新增独立 scope。`GET /remote/v1/workspaces` 是 `threads:read` 下用于解析 `thread.workspaceId` 的只读元数据投影，不提供 Workspace 创建、编辑、删除能力。

`DELETE /threads/:id` 在 V1 继续复用 `messages:write`，目的是让已经完成 0.2.0 配对的设备无需重新授权即可恢复会话列表原有的删除交互。该兼容映射只覆盖删除当前 owner user 可访问的 Thread；它不放开 `POST /threads`、`PATCH /threads/:id` 或其他 Thread 写接口。后续若引入独立 `threads:write` scope，应通过新协议版本或显式迁移处理，而不是静默扩大旧 scope。

## 6. Canonical route allowlist

Device credential 不获得整个后端权限。Remote Gateway 只允许：

```text
GET    /remote/v1/manifest
GET    /remote/v1/workspaces
GET    /threads
GET    /threads/:id
DELETE /threads/:id
GET    /threads/:id/messages
POST   /proxy/chat/default
GET    /agent/runs/:runId
POST   /agent/runs/:runId/approve
POST   /agent/runs/:runId/reject
POST   /agent/runs/:runId/cancel
GET    /threads/:id/media/:mediaId/content
```

`GET /remote/v1/workspaces` 返回当前用户的 active / archived ChatWorkspace，但只投影：

```text
id
name
isDefault
status
createdAt
updatedAt
```

Host 本机 `rootPath` 永远不进入该 Remote response。Mobile 通过 `id` 与 Thread 的 `workspaceId` 关联，不维护另一套 Project / Workspace 真相源。

所有其他 route 返回 `403`，即使 owner user 是管理员也不例外。

`POST /proxy/chat/default` 继续使用现有 persisted stream contract，因此 mobile 与 desktop 共享同一个 User Message 持久化、RAG / Agent 分支、Assistant Message、审批和 SSE 事件真相。

## 7. 重连语义

V1 不伪造尚未存在的 durable event journal。重连采用 canonical state replay：

1. 重新读取 `/remote/v1/manifest`，确认凭证和 scope 仍有效。
2. 重新读取 Workspace、Thread 与 Message。
3. 若最后一条 Assistant metadata 含 `agent.runId`，读取对应 Agent Run。
4. 只有 Agent Run 仍处于 `waiting_approval` 且 approval ID 未变化时，才允许显示原审批操作。
5. mobile 为每次发送生成稳定 `messageId`，重连后不得以新 ID 重发同一 User Message。

`eventCursor` 与主动撤销存量 WebSocket 属于 V2；在 durable journal 落地前，文档和 UI 不得宣称支持无损事件续传。

## 8. 安全边界

- 配对 public endpoints 只接受一次性 challenge / poll token，不接受通用业务调用。
- 配对码、poll token 与 device credential 均使用 timing-safe 哈希比较。
- Desktop 必须显示真实请求设备与 scope，不能自动批准。
- 同处 Tailnet 不等于通过 Mira 应用授权。
- Device credential 不能调用账号设置、Provider、Knowledge Base 写操作、Terminal 或任意非 allowlist route。
- Thread 删除仍经过 owner user 约束；paired device 不能借删除 route 操作其他用户的 Thread。
- Workspace Remote projection 不返回 `rootPath`，不允许 Workspace 写操作。
- Agent 审批仍使用现有 exact invocation 与 checkpoint；Remote Gateway 不改变 Harness 合同。

## 9. V1 验收

- 未启用或不可访问的 Tailscale Serve 不能创建配对挑战。
- 错误或过期配对码不能 claim。
- 一个 challenge 只允许一个 claim。
- 未经 Desktop 批准，mobile 永远拿不到 device credential。
- device credential 只返回一次，数据库只保存哈希。
- 撤销设备后，manifest 和 canonical route 均返回未授权。
- scope 不足返回 `403`，而不是把请求转交业务路由。
- `threads:read` 设备可读取 Mobile-safe Workspace 列表并通过 `workspaceId` 与 Thread 稳定关联。
- `messages:write` 设备可删除当前 owner user 的 Thread；没有该 scope 时 `DELETE /threads/:id` 返回 `403`。
- Workspace 列表包含 active / archived 状态且不返回 `rootPath`。
- mobile 使用 device credential 调用 persisted default chat stream 时，仍按 owner user 的 Thread 权限和 Agent 审批合同执行。
