Status: Planned
Owner: chat / runtime / product
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRuntime
Doc Type: checklist
Related:
  - agent-runtime-design.md
  - agent-phase-1-checklist.md
  - agent-phase-2-checklist.md
  - agent-swot-plan.md
  - ../concepts/CONCEPT_AGENT.md

# Agent Phase 3 Checklist

## Phase Goal

Phase 3 的目标是实现适合当前产品的完全版智能体。

这里的“完全版”不是无限自治，而是：

> Agent 具备清晰目标、可插拔计划、可恢复执行、可审批工具、可控记忆、可观察 trace、可评测质量，并能在当前 UI Chat RAG Tester 产品中稳定使用。

Phase 3 要把 Phase 1/2 的 AgentRun 从“可运行”升级成“可长期信任、可扩展、可评估”的智能体系统。

## Global Principles

1. 充分复用当前基建。实现前必须先读文档和已有代码。
   - 必读：`agent-runtime-design.md`
   - 必读：Phase 1 / Phase 2 checklist 和实现代码。
   - 必读：`../concepts/CONCEPT_AGENT.md`
   - 必读：知识库、评测、角色、工具、第三方集成相关文档。
   - 先确认当前实现事实，再决定扩展点。

2. 架构层不允许轻易打兜底，也不允许不明真相。
   - 不允许 memory 静默写入。
   - 不允许 run resume 语义不清。
   - 不允许多 provider 行为差异泄漏到用户体验。
   - 不允许因为工具失败就伪造成功回答。
   - 不允许用“兼容模式”掩盖架构不一致。

3. 万物可插拔。
   - planner 可插拔。
   - evaluator 可插拔。
   - memory store 可插拔。
   - tool policy 可插拔。
   - RAG strategy 可插拔。
   - model/provider adapter 可插拔。
   - trace renderer 可插拔。

4. 严格执行单元测试，并提供项目 owner 手测清单。
   - 完整版 Agent 必须有自动化回归。
   - memory、resume、evaluation、provider adapter、policy 不能只靠人工体验。
   - owner 手测聚焦产品质量、信任感和最终体验。

## Scope

本期主链：

- durable Agent memory。
- 可插拔 planner / evaluator。
- 更完整 LangGraph AgentGraph。
- replan / retry / stop criteria。
- 长任务状态和恢复策略。
- evaluation workbench 接入 Agent trace。
- 多工具组合。
- 角色、知识库、工具策略协同。
- 用户可见的 memory controls。

本期谨慎探索：

- 多 Agent 协作。
- 更复杂 LangGraph checkpoint / interrupt。
- 后台长时间任务。
- 自动化工作流模板。

## Implementation Checklist

### 1. Pre-Read

- [ ] 阅读 Phase 1 和 Phase 2 的代码、测试和已知缺陷。
- [ ] 阅读 `docs/knowledge-base/README.md`。
- [ ] 阅读 evaluation workbench 相关文档。
- [ ] 阅读 role 相关文档。
- [ ] 阅读 provider adapter 相关代码。
- [ ] 阅读全部 Harness capability metadata。
- [ ] 阅读 thread summary / context 相关代码。

### 2. Durable Memory

- [ ] 新增 `docs/chat/agent-memory-design.md`。
- [ ] 定义 memory 类型：
  - short-term run memory
  - thread-level memory
  - user preference memory
  - project fact memory
- [ ] 定义 memory write policy。
- [ ] 定义 memory read policy。
- [ ] 定义 memory delete / disable 机制。
- [ ] memory write 必须进入 trace。
- [ ] memory write 必须有 reason。
- [ ] memory write 必须可被用户查看。
- [ ] durable memory 默认不保存敏感工具输入。

### 3. Planner Plugin System

- [ ] 定义 `AgentPlanner` interface。
- [ ] 支持 rule-based planner。
- [ ] 支持 model-driven planner。
- [ ] 支持 role-aware planner。
- [ ] 支持 knowledge-aware planner。
- [ ] planner 输出必须是结构化 `AgentPlan`。
- [ ] planner 输出必须经过 policy validation。
- [ ] planner 失败不能静默降级为普通 chat。

### 4. Evaluator Plugin System

- [ ] 定义 `AgentEvaluator` interface。
- [ ] 支持规则 evaluator。
- [ ] 支持模型 evaluator。
- [ ] 支持 evaluation workbench evaluator。
- [ ] evaluator 能判断 complete / replan / ask_user / blocked。
- [ ] evaluator 结果进入 trace。
- [ ] evaluator 不能绕过 policy。

### 5. Advanced AgentGraph

- [ ] 增加 replan edge。
- [ ] 增加 retry budget。
- [ ] 增加 stop criteria。
- [ ] 增加 ask_user path。
- [ ] 增加 memory read / memory write node。
- [ ] 增加 tool selection node。
- [ ] 增加 provider adapter node。
- [ ] 增加 graph-level trace summary。
- [ ] 明确 LangGraph checkpoint / interrupt 是否进入正式路径。

### 6. Tool Ecosystem

- [ ] 工具按 domain / risk / mode / owner 分类。
- [ ] 支持 per-role tool policy。
- [ ] 支持 per-thread tool policy。
- [ ] 支持 external MCP projection 的可控接入。
- [ ] 支持工具调用预算。
- [ ] 支持工具结果摘要。
- [ ] 支持工具失败重试策略。
- [ ] 支持工具禁用和用户级偏好。

### 7. Long-Running Runs

- [ ] 定义 long-running run 状态。
- [ ] 定义后台执行边界。
- [ ] 定义 app 关闭/重启后的恢复策略。
- [ ] 定义超时和取消策略。
- [ ] 定义用户可见进度摘要。
- [ ] 定义 run 历史入口。

### 8. Evaluation

- [ ] evaluation workbench 支持 AgentRun dataset。
- [ ] 支持基于 trace 的评测。
- [ ] 评测维度包含：
  - 是否正确规划
  - 是否正确检索
  - 是否正确调用工具
  - 是否正确审批
  - 是否正确停止
  - 最终回答质量
- [ ] 支持 Agent regression fixtures。
- [ ] 支持导出 Agent evaluation report。

### 9. UI Full Experience

- [ ] Agent 按钮支持更多状态。
- [ ] Agent trace 支持折叠和摘要。
- [ ] Agent run 历史可查看。
- [ ] Memory controls 可查看和管理。
- [ ] Tool policy / capability 提示可查看。
- [ ] 长任务进度可恢复。
- [ ] 错误和 blocked 状态可理解。

## Unit Test Checklist

### Backend

- [ ] memory write policy tests。
- [ ] memory read policy tests。
- [ ] memory delete / disable tests。
- [ ] planner plugin contract tests。
- [ ] evaluator plugin contract tests。
- [ ] replan path tests。
- [ ] retry budget tests。
- [ ] stop criteria tests。
- [ ] ask_user path tests。
- [ ] long-running status tests。
- [ ] provider adapter consistency tests。
- [ ] tool budget tests。
- [ ] external MCP policy tests。
- [ ] evaluation dataset generation tests。
- [ ] Agent regression fixture tests。

### Frontend

- [ ] Agent trace folding tests。
- [ ] Agent run history tests。
- [ ] memory controls tests。
- [ ] long-running resume UI tests。
- [ ] blocked state UI tests。
- [ ] tool policy visibility tests。
- [ ] evaluation report UI tests。

## Developer Verification

- [ ] 运行 `pnpm check`。
- [ ] 运行完整 Agent backend test suite。
- [ ] 运行完整 Agent frontend test suite。
- [ ] 运行 evaluation fixture。
- [ ] 本地验证 memory 写入和删除。
- [ ] 本地验证 replan。
- [ ] 本地验证 ask_user。
- [ ] 本地验证 long-running run 恢复。
- [ ] 本地验证 provider 切换后行为不破。
- [ ] 本地验证 external MCP tool policy。

## Owner Manual Test List

项目 owner 需要手测的内容：

- [ ] Agent 是否真的像产品里的智能体，而不是工具调用器。
- [ ] Agent 按钮和后续状态是否形成稳定心智。
- [ ] Memory controls 是否可信。
- [ ] 长任务恢复是否符合预期。
- [ ] 多工具组合是否让人放心。
- [ ] Agent 遇到阻塞时是否解释清楚。
- [ ] Agent 最终回答质量是否达到当前产品完全版要求。
- [ ] Trace 详细程度是否适中。

## Completion Criteria

- [ ] AgentRun 完整持久化和可恢复。
- [ ] AgentGraph 支持 replan / retry / ask_user / memory。
- [ ] 高风险工具审批稳定。
- [ ] durable memory 可控、可见、可删。
- [ ] evaluation workbench 可评测 Agent。
- [ ] 多工具组合可控运行。
- [ ] 产品 UI 形成完整 Agent 体验。
- [ ] `pnpm check` 通过。
