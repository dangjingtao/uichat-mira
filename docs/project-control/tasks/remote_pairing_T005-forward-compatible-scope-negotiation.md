---
status: current
priority: P0
owner: remote-runtime
last_verified: 2026-09-07
layer: project-control
module: RemotePairing
feature: ForwardCompatibleScopeNegotiation
doc_type: task-card
canonical: true
task_state: IN_PROGRESS
related:
  - docs/project-control/tasks/remote_pairing_T004-relay-first-transport-display.md
  - docs/remote-access/relay-transport-v1.md
---

# remote_pairing_T005 - 配对 Scope 向前兼容协商

## 背景

Mira Mobile 的 Remote pairing 请求会携带 `requestedScopes`。当前 Desktop / Server 的
`POST /remote/pairing/claim` 在 Fastify schema 层把每个 scope 限定为当前
`REMOTE_DEVICE_SCOPES` enum。

这会把“客户端请求了 Host 尚不认识的未来 scope”变成整单 HTTP 400，并且请求甚至到不了
`RemoteAccessPairingService.normalizeScopes()`。服务层本来已经具备只保留当前 Host
认识 scope 的过滤逻辑，因此 route schema 的强 enum 形成了不必要的跨版本硬耦合。

## 目标

让 Desktop pairing 对未来 Mobile scope 向前兼容，同时保持授权安全边界：

1. claim route 接受有界的字符串 scope 列表，不因未知 scope 整单 400。
2. 服务层继续只持久化当前 Host 明确认识的 `REMOTE_DEVICE_SCOPES`。
3. Desktop 审批只能从该 claim 已保留的已知 scope 中缩减，不能增加未知 scope。
4. 老 Mobile 未发送 `requestedScopes` 时，继续使用既有 legacy 默认 scope，不自动获得 tool scope。
5. 不改变 pairing URI、code、poll token、device credential、Relay frame 或 Agent 合同。

## 允许修改

- `server/src/routes/remote-access.ts`
- `server/src/routes/remote-access.test.ts`
- `server/src/services/remote-access-pairing.service.test.ts`
- 本任务卡与项目总台账

## 禁止修改

- `REMOTE_DEVICE_SCOPES` 的当前定义
- device credential 格式与加密
- approval / poll 一次性交付语义
- Relay Worker / Desktop Connector frame
- Mobile 仓库
- Agent / Harness / Tool Gateway 运行合同

## 验收

- [ ] claim route 对“已知 scope + 未知未来 scope”返回 200，并把原始请求交给 service。
- [ ] service 仅持久化当前 Host 认识的 scope，未知 scope 被安全忽略。
- [ ] Desktop approve 仍不能把未请求或未知 scope 加进设备权限。
- [ ] legacy claim 默认 scope 行为不变，仍不隐式获得 tool scope。
- [ ] pairing 定向测试通过。
