Status: Planned
Owner: chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRuntime
Doc Type: checklist
Related:
  - agent-runtime-design.md
  - agent-phase-1-checklist.md
  - chat-execution-trace-design.md
  - ../tooling-runtime/harness-runtime-design.md

# Agent Phase 2 Checklist

## Phase Goal

Phase 2 的目标不是继续补骨架，而是把 Phase 1 已经搭起来的 Agent Runtime 做成**真正可用的功能闭环**。

这里的“可用闭环”指：

- Agent 不再只是“工具执行后机械再看一轮”
- 而是能形成真正的 `plan -> toolCall -> observation -> replan / answer` 闭环
- 工具与 RAG 不再是互斥分流，而是可组合的证据来源
- 最终回答、证据链、终态和错误态都能让用户看懂、敢用

这一期的重点不是再证明“能跑”，而是把它做成**用户实际可用**的 Agent 主线。

## Global Principles

1. 充分复用当前基建。实现前必须先读文档和已有代码。
   - 必读：`agent-runtime-design.md`
   - 必读：`agent-phase-1-checklist.md`
   - 必读：`../tooling-runtime/harness-runtime-design.md`
   - 必读：`../tooling-runtime/terminal-capability-checklist.md`
   - 必读：`../integrations/wecom-chat-tool-integration-plan.md`
   - 先读 Harness risk / invocation / workspace / approval 相关代码，再接入高风险能力。

2. 架构层不允许轻易打兜底，也不允许不明真相。
   - 不允许高风险工具失败后悄悄改走普通回答。
   - 不允许 approval state 只存在 prompt 或前端状态里。
   - 不允许因为 provider 不支持某种 tool-call 格式就静默切换协议。
   - 任何权限、审批、持久化语义不清时，先停下确认设计。

3. 万物可插拔，但不在这一期过度平台化。
   - 二期可以为三期预埋 interface / edge / contract
   - 但不要在二期一次性做完整 planner plugin、memory system、evaluation platform
   - 优先做直接服务“可用闭环”的节点和状态机

4. 严格执行单元测试，并提供项目 owner 手测清单。
   - approval / reject / resume / cancel 必须覆盖测试。
   - 高风险工具必须有“不会绕过审批”的测试。
   - owner 手测只验证产品语义和关键风险体验。

## Scope

本期主链：

- 真正的 `plan / toolCall / observation / replan` 主链闭环。
- observation-aware review，不再只是机械回看。
- 工具路径与 RAG 路径自然组合。
- evidence contract 收口到回答生成与完成判断。
- blocked / failed / approval / no-evidence 等终态语义补齐。
- 用户能看懂的 trace、错误提示和最终回答。

本期继续保持的高风险约束：

- `edit_file`
- `terminal_session`
- 企业微信发送等外部副作用工具

本期可为三期预埋、但不要求完整做完的内容：

- evaluator 的最小可替换接口
- replan / ask_user 的 graph edge 预留
- evidence / termination contract 的稳定类型边界

本期明确不做：

- durable memory 完整系统
- planner / evaluator 完整插件体系
- long-running run / 后台任务平台
- evaluation workbench 全量接入
- 多 Agent 协作
- 无限制后台自治

## Implementation Checklist

### 1. Pre-Read

- [x] 阅读 Phase 1 已完成代码和测试。
- [x] 阅读 `server/src/agent/*`。
- [x] 阅读 `server/src/mcp/tools/edit-file.tool.ts`。
- [x] 阅读 `server/src/mcp/tools/terminal-session.tool.ts`。
- [x] 阅读企业微信相关 tool / integration 代码。
- [x] 阅读 `server/src/mcp/core/invocations.ts`。
- [x] 阅读 `server/src/mcp/harness/environment.ts`。
- [x] 阅读现有 DB schema 和 repository 约定。
- [x] 阅读前端 uchat trace 和 composer 代码。

### 2. Persistence

- [x] `AgentRun` 已可持久化读取与恢复。
- [x] `waiting_approval` 已具备可恢复主链。
- [x] 补齐 run-level 可观测字段在持久化输出中的一致性：
  - `blockedReason`
  - 更清晰的 terminal / policy / approval terminal reason
  - trace / output 的终态语义
- [x] 明确二期闭环所需的 evidence / termination 字段契约，避免三期再改一轮输出语义。

### 3. Planner Loop

- [x] 明确二期 graph 里的 planning loop 语义：
  - `plan`
  - `toolCall / retrieve`
  - `observation review`
  - `replan / stop / answer`
- [ ] `planStep` 不再只是一次性前置步骤，而是能进入后续回路决策。
- [x] 新增或拆分必要节点，把“机械回看”升级为真正的 planner loop。
- [ ] loop guard 与 replan budget 要区分：
  - 工具执行预算
  - 重新规划预算
- [x] 无新 observation / evidence 时，不允许冒充完成了一次有效 replan。

### 4. Evidence And RAG Combination

- [x] 工具结果、retrieval、observations 统一成正式 evidence contract。
- [x] `generate` 不再只依赖最后一次工具结果。
- [x] 工具路径与 RAG 路径支持自然组合，而不是“有工具就不 RAG、没工具才 RAG”。
- [x] retrieval / tool evidence 进入统一上下文压缩和生成输入。
- [x] 历史 assistant 伪工具文本不能污染本轮真实 evidence。

### 5. Approval And Error Semantics

- [x] invocation-level approval 已收口。
- [ ] reject 后主链行为明确：
  - replan
  - 解释给用户
  - 或进入 blocked
- [x] blocked / failed / approval / no-evidence / deny 的终态语义补齐到 output 和 trace。
- [ ] 高风险工具失败不静默改写成成功，不回退成普通聊天式糊弄回答。

### 6. Answer Grounding

- [x] `evaluate` 从 answer-presence check 升级为最小 grounded check。
- [x] 回答必须优先受本轮真实 evidence 约束。
- [x] 没有真实 evidence 时，不能声称“已查看文件 / 网页 / 外部系统”。
- [ ] 工具失败时，回答与 trace 的结论必须一致。

### 7. UI Closed Loop

- [ ] trace 节点与最终回答组合后，用户能看懂“系统为什么这样答”。
- [ ] approval / blocked / failed / no-evidence 文案统一到产品语义。
- [ ] tool input / evidence summary 不撑破 UI。
- [ ] 最终回答和执行过程共存，不互相打架。

## Unit Test Checklist

### Backend

- [x] planner loop tests：
  - tool result -> review -> replan
  - tool result -> review -> stop
  - no new evidence -> no fake replan
- [x] retrieve + tool combination tests。
- [x] grounded answer / no-evidence tests。
- [x] blocked / failed / deny / approval terminal reason tests。
- [ ] reject 后 graph 行为测试。
- [ ] RAG thread 不回退验证补齐。

### Frontend

- [ ] trace 与 final answer 共存测试。
- [ ] blocked / failed / approval / no-evidence 文案展示测试。
- [ ] evidence / tool summary 不撑破 UI。
- [ ] planner loop 过程中多轮节点展示不混乱。

## Developer Verification

- [x] 运行 `pnpm check`。
- [x] 运行新增后端 agent loop / evidence / grounding tests。
- [x] 运行新增前端 trace / terminal state tests。
- [x] 本地验证 planner loop 至少一条完整链路：
  - 工具执行
  - review / replan
  - 再次调用或转回答
- [x] 本地验证 retrieve + tool 组合链路。
- [ ] 本地验证 reject 后不会执行高风险工具，且给出清楚解释。
- [ ] 本地验证 RAG thread 不回退。

## Owner Manual Test List

- [ ] Agent 是否已经形成“真能用”的闭环，而不是只会跑工具。
- [ ] tool + RAG 组合后的回答是否更自然、更可信。
- [ ] 被阻断、被拒绝、无证据、失败时的解释是否让人能接受。
- [ ] trace 是否足够帮助理解，又不会吵。
- [ ] Agent 在多轮回看 / 重新规划时，用户是否还能跟得上。

## Completion Criteria

- [x] `plan / toolCall / observation / replan` 闭环可用。
- [x] tool + RAG 组合可用。
- [x] 回答与 evidence 保持一致。
- [x] blocked / failed / approval / no-evidence 终态可理解。
- [ ] 高风险工具约束不回退。
- [x] `pnpm check` 通过。
