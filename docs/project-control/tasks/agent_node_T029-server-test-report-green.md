---
status: current
priority: P0
owner: agent-runtime
last_verified: 2026-07-07
layer: project-control
module: AgentRuntime
feature: ServerTestReportGreen
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/agent-runtime-t29-t33-ledger.md
  - server/test-report/test-report.json
task_state: TODO
---

# agent_node_T029 Server Test Report Green

## Target

让 `server` 级测试报告恢复全绿，并更新可审阅的测试结果记录。

本任务只处理当前仓库 `server` 测试红灯，不扩展 Agent、Harness 或其他产品面任务。

## Source Task Pack

- External task id: `T29`
- External title: `server/test-report 全绿`

## Allowed Changes

- 重新运行 `server` 测试
- 检查 `server/test-report/test-report.json` 或当前测试输出
- 修复导致 `server` 测试失败的最小问题
- 如果失败来自环境假设、fixture、测试隔离、bootstrap 或 env 行为，做最小修复
- 更新测试报告或提供可审阅的测试结果摘要

## Forbidden Changes

- 不重写 bootstrap 或 env 系统
- 不顺手改 Agent 或 Harness 主链
- 不新增大规模黑盒测试矩阵
- 不删除测试、不跳过测试、不降低断言来伪造全绿
- 不引入新的全局依赖
- 不把 `T30`、`T31`、`T32`、`T33` 的语义变更混进本任务

## Acceptance Criteria

1. `server` 测试结果为全绿。
2. 没有新增跳过测试。
3. 没有 Agent 或 Harness 主链重构。
4. 没有引入大规模黑盒。
5. 改动只聚焦当前红灯归因与修复。

## Verification

1. 先运行或读取当前 `server` 测试报告，列出所有失败 suite 和 test。
2. 按失败原因分组，不逐个盲改。
3. 修复后重新运行相关测试。
4. 最后运行 `server` 测试范围，确认全绿。
5. 输出：
   - 修改文件列表
   - 根因说明
   - 测试命令
   - 测试结果摘要
   - 是否更新 `test-report`

## Notes

- 合并顺序要求：`T29` 必须最先通过；`T30`、`T31`、`T32`、`T33` 不得早于本任务合并。
