# Chat Agent Smoke Summary

- HEAD: `8aa0478304e38f104cc19536aa493964ededf2a3`
- Runtime modified: `No`
- Smoke scope: `server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts`
- Vitest result: `failed` (`4` tests, `2` passed, `2` failed)
- Typecheck result: `passed`
- Approve resume path: `Not passed as acceptance`
- Repeated `waiting_approval` after approve: `No in this smoke run`
- Repeated execution after approve: `Yes, workspace_mutation executed 3 times`

## Coverage Matrix

| Case | Status | Evidence |
| --- | --- | --- |
| S1 普通读工具闭环 | Pass | `/proxy/chat/default` 走 agent 分支；`read_list` 调用 1 次；assistant metadata 带 `runId/traceId/status=completed` |
| S2 需要审批的 workspace mutation | Fail | 首轮进入 `waiting_approval`；`POST /agent/runs/:id/approve` 后返回 `completed`，但 `workspace_mutation` 实际执行了 `3` 次，不满足“只执行一次” |
| S3 approve idempotency | Fail | 第二次 approve 稳定返回 `completed`，但由于第一次 approve 已重复执行 3 次，整条用例仍不满足幂等验收 |
| S4 blocked 和 waiting_approval 前台状态分清 | Pass | waiting assistant metadata 为 `status=waiting_approval` 且保留 `pendingApproval`；reject 后 assistant metadata 变为 `status=blocked` 且清空 `pendingApproval` |
| S5 错误路径不假完成 | Pass | `read_open` 失败时 SSE 返回错误，不生成 assistant 成功消息，不伪装 `completed` |
| S6 测试产物落点规范 | Fail | 新 smoke 自建 sqlite/workspace fixture 落在 `.test-artifact/server/...`；但仓库当前仍存在 `server/tmp-a.sqlite`、`server/tmp-b.sqlite`、`server/tmp-integrations-route.sqlite`、`server/tmp-wecom-route.sqlite` |

## Notes

- 这次只跑了服务端 smoke 和服务端 typecheck，没有跑前端测试。
- `approve -> resume -> completed` 路径可以走通，但当前实现会在审批通过后重复执行同一 `workspace_mutation`，这是 route / agent resume 层的真实缺陷，不是 smoke 夹具问题。
- `repeated waiting_approval` 在这次路径里没有复现；问题表现为 repeated tool execution。
- 详细输出见：
  - `server/test-report/chat-agent-smoke-vitest.txt`
  - `server/test-report/chat-agent-smoke-typecheck.txt`
