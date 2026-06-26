# Terminal Capability Checklist

Layer: raw-source
Module: tooling-runtime
Doc Type: checklist

Status: In Progress
Owner: runtime
Last verified: 2026-06-26

## 目标

把 `terminal_session` 做成正式 harness capability，而不是单个“跑命令”的临时入口。

原则：

- 运行边界由 harness 持有
- 执行状态由 harness 统一观察
- capability 实现与自动化测试同一变更交付
- 在 chat 接入前，先把手动 workbench 调试链路做扎实

## 当前状态

截至 `2026-06-25`：

- `terminal_session` 已存在最小实现
- 已接入工具注册与流式事件
- 但还没有完全按 harness environment 驱动的 capability runtime 收口
- 测试覆盖仍然偏薄

## Phase 1

- [x] 建立 terminal runtime 主链
- [x] `terminal_session` 改成薄 tool 壳，执行逻辑迁移到 runtime
- [x] terminal capability 从 harness environment 读取，不在 tool 层散落硬编码
- [x] workspace 内 `cwd` 解析与拒绝越界
- [x] `env` 过滤为字符串键值
- [x] 流式 stdout 事件透出
- [x] 退出码写入结果
- [x] terminal log artifact 标准化
- [x] 补齐单元测试

Phase 1 最低测试：

- [x] 成功执行并返回输出
- [x] 发出 stdout 流事件
- [x] 非零退出码可观测
- [x] `cwd` 正常解析
- [x] 越界 `cwd` 拒绝
- [x] `env` 非字符串值被过滤
- [x] 空命令拒绝
- [x] abort 时会清理 session

## Phase 2

- [x] approval wait state 进入 harness 统一状态模型
- [x] timeout 策略进入 runtime
- [x] cancel / abort 语义和事件模型补齐
- [x] session reuse / attach 语义明确
- [x] stderr / stdout 更清晰分流
- [x] 前端执行观察面补齐

Phase 2 最低测试：

- [x] timeout 退出
- [x] cancel 退出
- [x] approval wait / resume
- [x] session cleanup

Phase 2 当前实现说明：

- `timeoutMs` 已进入 `terminal_session` 协议
- `attachSessionId` 已支持复用已有 terminal session
- `approvalMode: "require"` + `approvalGranted` 已可触发 harness 级 `awaiting_approval`
- 当前 approval 仍是显式调用占位，不是最终持久化审批系统
- `child_process` 路径保留 `stdout / stderr` 分流
- `pty` 路径明确暴露 `streamMode: "merged"` 与 `stderrSeparated: false`
- workbench 已补充 terminal 执行观察面：
  - `sessionId`
  - `cwd`
  - `streamMode`
  - `stderrSeparated`
  - approval / timeout / reused session 状态

## Phase 3

- [x] trace span 暴露
- [ ] 与 debug scope、multiple workspace 结合
- [ ] 更细的命令风险分层

Phase 3 当前实现说明：

- invocation runtime 已引入统一 trace recorder
- `terminal_session` 已接入 terminal-specific spans：
  - `strategy_selection`
  - `session_acquire`
  - `process_spawn`
  - `command_execution`
  - `artifact_emit`
  - `result_normalization`
- 已暴露查询路由：
  - `GET /mcp/invocations/:id/trace`
- 当前还没有做真正的 replay 执行，只先把 trace 记录链收口

## 非目标

当前 checklist 明确不做：

- [ ] chat 自动工具调用
- [ ] 长驻交互终端产品化体验
- [ ] shell 市场化配置面
- [ ] 复杂任务编排
