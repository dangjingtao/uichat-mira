---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: PlannerStrengthening
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---

# Agent V1.5 T08：Planner 正向增强与主线收口

## 项目与阶段

- 仓库：https://github.com/dangjingtao/uichat-mira
- 阶段：UIChat Mira Agent V1.5 稳定化
- 目标主线：

```text
Planner
→ Normalize
→ Policy
→ ToolNode / Retrieve
→ Evidence
→ Planner
```

- 本卡是八张稳定化任务中的最后一张。
- 本卡完成后，应能直接判断本轮 Planner 稳定化目标是否达到。
- 不新增第九张补丁卡。

## 全局冻结边界

1. Planner 是唯一语义决策中心；模型侧结构化输出仍只有 `nextAction`。
2. Normalize 只做：
   - exposure membership 校验
   - 参数与 path 规范化
   - schema 校验
   - 冻结 `pendingToolCall`
3. Policy 只做：
   - 权限
   - 审批
   - 风险
   - sandbox / root / workspace 边界
4. ToolNode 只执行冻结调用并产出真实结果。
5. Retrieve 只产出真实检索结果。
6. Evidence 只整理事实、gaps、错误、截断与 raw/artifact 引用。
7. 工具或检索完成后必须进入 Evidence，再回 Planner。
8. Recoverable / Terminal 继续采用既定 C 合同，不得修改。
9. 不新增：
   - intent node
   - task-model selector
   - goal coverage node
   - regex completion engine
   - 工具桥接器
   - Planner action rewrite guard
   - 静态 plan
   - 第二个 completion verdict
10. 不讨论 Agent V2、DAG、多智能体、并发工具、长期记忆、Harness 大改、MCP 市场或前端重做。
11. 禁止“顺手优化宇宙”。

## 前置结果

T01～T07 已合并。

全局审查确认以下主线能力已基本成立：

- Planner 合法 `nextAction` 不再被 selector、bridge 或 guard 改写。
- Normalize / Policy / ToolNode / Evidence 已完成主体职责分离。
- Tool / Retrieve 结果显式进入 Evidence，再回 Planner。
- Read 公共面已收敛为：
  - `read_discover`
  - `read_open`
- ≤20 个可见工具全量暴露；>20 才做 embedding / rerank 候选召回。

但仍有两项必须在 T08 内收口的 SSOT 残留：

1. `toolIntent.toolExposure` 与 `toolExposure` 同时作为运行时来源。
2. `continueIteration / postToolReviewPending / reviewDecision / reviewReason` 等旧控制字段仍残留在 State 或节点写入中。

## 任务目标

在不改变 Agent Graph 主结构的前提下，完成两件事：

### A. 收口剩余状态真相源

确保 Planner 可见工具、风险元数据和运行控制状态只有一个 owner、一个写入源、一个读取关系。

### B. 正向增强 Planner

让 Planner 能基于：

- 完整用户目标
- 与当前任务相关的有限历史
- 当前可见工具合同
- 结构化任务状态
- 最新 Evidence
- 最近调用事实
- recovery / approval / iteration 状态

自主决定：

- answer
- ask_user
- retrieve
- use_tool
- error

不得再依靠外部节点替 Planner 判断任务完成度或下一步。

---

# A. SSOT 收口

## A1. Tool Exposure 单一真相源

最终合同：

- `toolExposure` 是 Planner 当前可见工具集合和工具元数据的唯一运行时真相源。
- PrepareContext 可以构造并写入 `toolExposure`。
- 其他节点只读。
- `toolIntent` 不得再作为 Planner、Policy、Normalize 或 Graph 路由的 fallback 来源。
- `toolIntent` 如需保留，只能用于 trace / diagnostics / UI，不得反向参与执行。

必须完成：

1. 删除 `normalizeToolExposure()` 对 `toolIntent.toolExposure` 的 fallback。
2. Planner 只读取 `state.toolExposure`。
3. Policy 不再从 `toolIntent.toolExposure` 解析工具定义。
4. Policy 优先使用冻结在 `pendingToolCall.toolMeta` 中的定义与风险元数据。
5. 如必须做注册存在性校验，可以查 registry，但 registry 不能替换、扩展或重新选择工具。
6. `toolId / args / inputHash` 必须继续以 `pendingToolCall` 为准。
7. 不允许新建另一组同义字段。

## A2. 删除旧控制字段

检查并删除不再参与真实路由的旧字段及写入点：

- `continueIteration`
- `postToolReviewPending`
- `reviewDecision`
- `reviewReason`

要求：

1. 从 `AgentGraphState`、`AgentNodeState`、Graph input/output 兼容面中删除无真实用途字段。
2. 删除 ToolNode、Retrieve、初始化代码中的死写入。
3. 删除仅服务于这些字段的测试与 trace。
4. 不得用新字段替代旧字段。
5. 机械终止仍只由：
   - pending approval
   - terminal error
   - max iterations
   - recovery exhausted
   控制。

---

# B. Planner 正向增强

## B1. Planner 必须获得的输入

### 1. 当前用户请求

必须保留当前用户完整请求，而不是只取模糊摘要。

### 2. 相关历史

将过去 task selector 独占的“最近若干消息”能力迁入 Planner。

要求：

- 只带与当前任务有关的有限历史。
- 不塞入完整无限会话。
- 至少保留最近有效 user / assistant 交互。
- 必须有清晰上限。
- 无关历史应被裁剪或不进入 Planner payload。
- 不得恢复 selector 或增加新的 history decision node。

### 3. Planner-visible tools

Planner 必须看到：

- 稳定 tool ID
- 互斥 description
- input schema
- domain / source
- 风险与审批摘要
- workspace / sandbox 边界摘要

Read 工具合同必须明确互斥：

- `read_discover`
  - 发现对象、目录、路径、关键词或符号位置
  - 不打开正文
- `read_open`
  - 打开已知目标
  - 可使用结构化 selection 局部读取
  - 不负责模糊目标发现

### 4. currentTaskFrame

`currentTaskFrame` 继续只由 PlannerNode 维护。

至少应表达：

- currentGoal
- currentSubtask
- currentBlocker
- confirmedObjects
- completionCriteria
- 尚未覆盖的目标或必要动作
- 当前已覆盖进度

限制：

- 不新增独立 coverage node。
- 不允许 Evidence、ToolNode、Retrieve、Policy 写任务完成度。
- 可以在 PlannerNode 内根据已有输入更新 task frame。
- 不得用正则完成度引擎替代 Planner。

### 5. 最新 Evidence

Planner 至少能看到：

- actionTaken
- facts / proven
- gaps / missing
- error
- status
- truncated
- rawRef / artifact 引用
- toolId
- operation
- candidate paths / content preview 等结构化 data

### 6. 最近调用事实

只作为事实输入：

- toolId
- normalized args
- inputHash
- status
- result summary
- failure kind / failure code
- retry count

不得由外部 guard 决定是否重试或回答。

### 7. 运行约束

必须继续提供：

- iteration / maxIterations
- recovery attempts
- pending approval
- recoverable / terminal 状态

---

## B2. Planner 决策原则

Prompt 和 Planner 合同必须明确：

1. 先判断完整用户目标是否已覆盖，再决定 answer。
2. “某条 evidence 可解释”不等于“整项任务完成”。
3. 多目标只完成一部分时，不得提前 answer。
4. evidence 存在 gaps、missing 或 truncated 时，不得仅因有结果就 answer。
5. 部分覆盖时，继续选择信息增益最高的下一动作。
6. 目标或关键参数确实无法从上下文推断时，才 ask_user。
7. recoverable failure 后可以：
   - 调整参数重试
   - 换可见工具
   - 读取辅助信息
   - 基于失败事实回答
8. 不得假装工具成功。
9. 已有相同调用成功证据且没有新 gap 时，通常应复用 evidence；该判断由 Planner 做。
10. 选择工具时只能从当前 `toolExposure` 中选择。
11. answer 必须基于 Evidence，不得编造工具、检索或文件事实。
12. waiting approval、terminal error、max iteration 仍服从机械边界。

---

## B3. 输出合同

1. 模型结构化输出仍只有：

```ts
type AgentNextAction =
  | { type: "answer"; reason: string }
  | { type: "retrieve"; query: string; reason: string }
  | { type: "use_tool"; toolId: string; args: Record<string, unknown>; reason: string }
  | { type: "ask_user"; question: string; reason: string }
  | { type: "error"; reason: string };
```

2. 不新增第二套 selector 输出。
3. 不新增 completion verdict。
4. Parser / validator 只能：
   - 接受合法输出
   - 拒绝非法输出
5. Parser / validator 不得生成替代 toolId、args 或 action type。
6. Planner 的合法输出必须原样进入 Normalize / Retrieve / Generate 路径。

---

# C. 明确不做

- 不修改主 Graph 结构。
- 不新增语义决策节点。
- 不新增 coverage node。
- 不恢复 task selector。
- 不恢复 bridge / local intent / answer stop / repeat rewrite。
- 不改 Recoverable / Terminal C 合同。
- 不重构整个 Harness。
- 不增加第三个 public Read 工具。
- 不做大型黑盒测试工程。
- 不修 CodeGraph 既有 typecheck 阻断，除非 T08 直接造成新的错误。
- 不处理与 T08 无关的 UI、微应用、MCP 市场或前端问题。

---

# D. 重点检查文件

施工前以当前 `dev` 核实真实路径。

重点包括但不限于：

- `server/src/agent/graph/state.ts`
- `server/src/agent/graph/routes.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/types.ts`
- `server/src/agent/nodes/prepare-context.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/prompt.ts`
- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/nodes/policy.ts`
- `server/src/agent/nodes/tool.ts`
- `server/src/agent/nodes/retrieve.ts`
- `server/src/agent/nodes/evidence.ts`
- `server/src/agent/resume.ts`
- Planner、Graph、Normalize、Policy、tool-loop 相关测试

---

# E. 验收标准

## E1. SSOT

- [ ] `toolExposure` 是唯一 Planner-visible tools 运行时真相源。
- [ ] Planner 不再 fallback 到 `toolIntent.toolExposure`。
- [ ] Policy 不再从 `toolIntent` 重新解析工具。
- [ ] Policy 不重新选择、替换或扩展工具定义。
- [ ] `pendingToolCall.toolId / args / inputHash` 继续保持冻结。
- [ ] `continueIteration / postToolReviewPending / reviewDecision / reviewReason` 已从真实运行态删除。
- [ ] 未新增同义状态或兼容决策源。

## E2. Planner 输入

- [ ] Planner 能看到当前请求。
- [ ] Planner 能看到有限、相关的对话历史。
- [ ] Planner 能看到 public tools 的 ID、互斥描述、schema 和风险摘要。
- [ ] Planner 能看到 currentTaskFrame。
- [ ] Planner 能看到 latest Evidence 的 facts / gaps / error / truncated / refs。
- [ ] Planner 能看到最近调用的 normalized args / inputHash / status。
- [ ] Planner 能看到 iteration / recovery / approval 状态。

## E3. Planner 决策

- [ ] 简单单目标在证据充分后 answer。
- [ ] 多目标只完成部分时不提前 answer。
- [ ] truncated / explicit gap 时不提前 answer。
- [ ] discover 后需要正文时，Planner 自主选择 `read_open`。
- [ ] discover 结果已足够时，Planner 可以直接 answer，不被自动 bridge。
- [ ] recoverable failure 可合理恢复。
- [ ] recovery exhausted 按 C 合同 guarded Generate。
- [ ] 相同 tool/args 已有有效 evidence 时，不出现无意义循环。
- [ ] 无 evidence 时不编造执行事实。

## E4. 边界

- [ ] Normalize 只校验、规范化、冻结，不换工具。
- [ ] Policy 只做权限、审批、风险和边界判断。
- [ ] ToolNode / Retrieve 只产出真实结果。
- [ ] Evidence 不判断任务完成度或下一动作。
- [ ] 等待审批、terminal error、max iterations 不继续执行工具。
- [ ] 不存在新 selector、router、bridge、rewrite guard 或 completion engine。

---

# F. 最小测试范围

必须补足，但不得扩成新的大型黑盒工程。

## 1. SSOT

- Planner 仅从 `toolExposure` 读取工具。
- 即使 `toolIntent.toolExposure` 与 `toolExposure` 冲突，也不得影响 Planner。
- Policy 仅按 frozen `pendingToolCall` 和对应 toolMeta / registry existence 做判断。
- 旧控制字段已从 state 和节点写入删除。

## 2. Planner 输入

- 相关历史进入 Planner payload。
- 无关历史被裁剪。
- public tool schema 与风险摘要可见。
- latest Evidence facts / gaps / truncated / error 可见。
- normalized args / inputHash / status 可见。

## 3. Planner 行为

- 单目标充分证据 → answer。
- 多目标部分完成 → continue。
- truncated evidence → continue 或 ask_user，不提前 answer。
- `read_discover → Evidence → Planner → read_open → Evidence → Planner → answer`。
- discover 已足够 → answer，且不自动 open。
- recoverable failure → 合理恢复。
- recovery exhausted → guarded Generate。
- 相同调用成功且无新 gap → 不重复空转。

## 4. 回归

- waiting approval 停止执行。
- terminal failure 不进入 Generate。
- recoverable failure 仍遵守 C 合同。
- Normalize 不替换工具。
- selectedToolId 不进入执行。
- 现有核心 Agent 测试通过。
- `git diff --check` 通过。
- typecheck 如仍仅受既有 CodeGraph 错误阻断，需明确记录。

---

# G. 完工交付物

施工完成后必须提交：

1. commit SHA。
2. `base..head` diff 范围。
3. 实际改动文件清单。
4. 逐条对应验收标准的行为摘要。
5. 新增或修改的测试源码路径。
6. 实际执行的测试命令和原始结果。
7. typecheck 结果。
8. 明确区分：
   - T08 新增失败
   - 既有 CodeGraph / 基线失败
9. 说明是否影响既有 Agent 主线黑盒。
10. 工作区必须干净。
11. 不得提前把任务卡或 ledger 写成“正式评审通过”；本地复审通过可以记录，但最终通过以 PR 评审为准。

---

# H. Codex 施工约束

- 只做 T08。
- 不派生 T09。
- 不修改 T30～T33 合同。
- 不重写 Graph。
- 不为通过测试加入硬编码关键词、文件名特判或 action rewrite。
- 不把 Planner 决策搬到 Evidence、Normalize、Policy、ToolNode 或 wrapper。
- 不把 SSOT 清理演变成大规模类型重构。
- 先核实真实读写链，再施工。
- 如果发现超出本卡才能解决的问题，先停止并报告，不得自行扩张范围。
