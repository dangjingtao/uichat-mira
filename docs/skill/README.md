---
status: current
owner: skill-runtime
last_verified: 2026-07-30
layer: wiki
module: SKILL
feature: SkillSystem
doc_type: current-contract
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - pi-skill-agent-execution.md
  - skill-context-design.md
  - skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md
---

# Skill 模块当前合同

> Skill 的本体、匹配、披露和执行必须分开理解。旧的“Skill 只把说明书注入 Main Planner、Parent 始终亲自施工”已经不是完整现状。

## 1. Skill 本体是什么

Skill 是一个可复用的领域能力包：

```text
Manifest
+ SKILL.md
+ optional Resources
+ optional Execution Manifest
+ optional Runtime requirements
```

它通过渐进式披露告诉 Agent：

- 这类事情应该怎样做；
- 哪些规则必须遵守；
- 哪些 references / templates / examples 可以继续读取；
- 什么算完成；
- 执行需要哪些工具或私有 Runtime。

Skill 不是：

- Tool；
- MCP server；
- 权限授予；
- 全局 Tool Registry；
- 自动可用的 Runtime；
- 必然存在的状态机。

## 2. 四个必须分开的真相源

```text
SkillContext
= 当前任务应掌握的领域知识与执行约束

ExecutionProfile
= 该 Skill 希望以什么执行模式、工具面和 Runtime 运行

ToolExposure / Runtime availability
= 当前环境真正提供什么能力

Policy / Approval
= 本次 exact invocation 是否允许执行
```

因此：

```text
Skill match
!= Tool registration
!= Tool exposure
!= Runtime ready
!= Permission granted
```

Skill 声明能力需求，不凭声明获得能力。

## 3. 渐进式披露

```text
L0 Manifest
  -> match
L1 SKILL.md
  -> task rules and completion contract
L2 Resource
  -> reference / template / example / script metadata
Execution Boundary
  -> governed tool / managed private runtime
```

### L0 Manifest

只保留发现所需轻量信息，例如：

- id；
- name；
- description；
- version；
- entry；
- source / license；
- execution / runtime requirements。

启动扫描不得预加载全部正文和 references。

### L1 SKILL.md

命中任务后加载，主要表达：

- routing；
- domain rules；
- execution strategy；
- capability boundary；
- quality rules；
- completion criteria；
- 可按需读取的 Resource URI。

### L2 Resource

Reference / Template / Example 默认只建立目录，按需披露，不全量塞进 Main Agent 上下文。

## 4. 当前匹配与连续性

当前自动激活最多一个 primary Skill。

匹配优先级包括：

```text
explicit trigger
  -> attachment / MIME / extension
  -> exact semantic hint
  -> lightweight semantic match
  -> embedding / task-model fallback
```

同一任务自然续轮可以继承最近有效 primary Skill：

```text
本轮明确命中新 Skill
  -> 使用新 primary

本轮没有新 Skill
+ 明显是补参数 / 继续 / 修改同一任务
  -> continuation

明确新任务 / 换话题 / 取消
  -> 不继承旧 Skill
```

这是 task-context continuity，不代表每个 Skill 都需要 Stateful Runtime。

## 5. 当前执行模式

### 5.1 Context-only / inline use

对于只需要规则、写作规范、搜索策略或轻量上下文增强的任务，SkillContext 可以由 Main Planner 消费，不要求独立执行循环。

这时 Skill 不生成 invocation，也不扩大 ToolExposure。

### 5.2 Forked SubAgent

任务型 Skill 可以声明：

```text
execution.context = fork
execution.agent = subAgent
```

当前 built-in Office Skills 与通用 discovered Skill execution profile 已支持该模式。

```text
SkillContext + Goal + ExecutionProfile
  -> isolated SubAgent
  -> Skill-scoped tools / Runtime
  -> structured Evidence / Artifact / Requirement
  -> Parent governance and delivery
```

SubAgent 负责 task-local execution，Parent 保留 global goal、approval、recovery、Evidence 与最终交付。

### 5.3 Stateful Skill Flow

真实需要多阶段持久状态、结构化 requirements、checkpoint 或 reducer 的 Skill，可以使用 Stateful Skill Flow。

当前合同不是“再叠一层自由模型”：

```text
Stateful Skill Flow / Reducer
= 该 Skill 的单一确定性 SubAgent controller
```

Flow 可以：

- 维护 phase / round；
- 返回 structured requirements；
- 判断 delivery ready；
- 暂停等待用户输入；
- 生成冻结交付。

它是可选增强层，不是所有 Skill 的入场门槛。

## 6. Skill-owned SubAgent 的执行权边界

Parent owns：

- 用户对话；
- global goal；
- Skill routing；
- Policy / Approval；
- checkpoint governance；
- Evidence 接收；
- terminal contract；
- Generate 与最终交付。

Skill-owned SubAgent owns：

- task-local planning；
- local tool loop；
- observation；
- evidence coverage；
- repair / retry；
- managed Runtime action；
- Artifact construction；
- task-local completion。

禁止双重施工控制：

```text
SubAgent 做一步
  -> Main Planner 接管领域下一步
  -> SubAgent 再做一步
```

正确边界：

```text
Parent delegates
  -> SubAgent owns the bounded execution
  -> structured terminal / upthrow state
  -> Parent governs delivery or recovery
```

## 7. 返回结果合同

SubAgent 返回：

- `completed`；
- `insufficient_evidence`；
- `needs_input`；
- `failed`，并标记 recoverable 与否；
- Evidence；
- Artifacts；
- Requirements；
- bounded trace。

Parent 行为：

| 结果 | Parent 行为 |
| --- | --- |
| completed | Evidence 提交后冻结交付，直接 Generate，不重做领域施工 |
| needs_input | 根据 structured user_input requirement 向用户提问 |
| insufficient_evidence | 在 active Skill 允许能力面内继续恢复或如实报告缺口 |
| recoverable failed | 回 Parent 恢复，工具面收窄到 active Skill 声明范围 |
| terminal failed | Main Agent failed，Generate 不运行 |
| approval required | 保存 exact invocation 与 transcript checkpoint，等待 Parent 审批 |

## 8. Tool 与 Runtime 边界

SubAgent 可使用两类执行能力。

### Harness-facing tools

例如：

- `read_open`；
- `read_extract`；
- 其他当前已注册、已暴露且 profile 允许的具体工具。

实际可见工具面是：

```text
Skill declared tools
∩ current environment registered tools
∩ active exposure / binding
∩ policy boundary
```

### Skill-private Runtime

例如：

- `office_document`；
- `office_pdf`；
- `office_presentation`；
- `office_spreadsheet`。

Private Runtime：

- 不注册成 Main Planner 的全局工具；
- 不出现在普通用户工具列表；
- 通过 managed runtime adapter 执行语义 action；
- 不能让模型决定 Python executable、PYTHONPATH、pip 或任意 launcher；
- readiness 与 Skill match 分离；
- pending binding 不能伪装为 ready；
- 仍受 Parent 治理、审批、workspace 与审计边界约束。

当前 `wenshu_xlsx_xml_runtime` 仍是 pending binding，不能描述成已完成能力。

## 9. Workspace

`skillRoot`、`runtimeRoot` 与 `workspaceRoot` 是三个独立边界：

```text
skillRoot
= Skill package / references / scripts

runtimeRoot
= managed runtime / dependencies

workspaceRoot
= 用户当前任务的真实文件世界
```

workspace-bound Skill 没有 active workspace 时必须失败并返回结构化 Evidence，不能偷偷写到 SkillRoot 或 RuntimeRoot。

Artifact 默认交给宿主 Artifact contract，不应由 Main Planner再次复制或重建。

## 10. Approval 与 Resume

SubAgent 请求审批时必须同时返回：

- tool id；
- tool call id；
- input hash；
- input；
- resumable transcript checkpoint。

Parent 保存 frozen `pendingToolCall` 与 pending approval。

恢复时：

- checkpoint 必须属于同一个 Skill；
- frozen invocation 必须与 checkpoint 一致；
- 只回放当前 exact approval；
- 旧 approval 不可复用；
- 不重新从原始目标启动一遍 Child。

持久化字段 `origin: skill_agent` 是历史兼容标记；产品与运行时术语统一使用 SubAgent。

## 11. Generic SubAgent 不是 Skill 自动匹配

Main Planner 的 `delegate_task` 会动态构造内置 `mira.generic-task` SkillContext，用于一个通用、有明确验收边界的工作包。

它与领域 Skill 的区别：

| Generic delegation | Skill-owned delegation |
| --- | --- |
| 由 Main Planner 显式选择 `delegate_task` | 由 primary Skill execution profile 触发 |
| 使用当前 Main exposure 的受控子集 | 使用 Skill declared tools / private runtime |
| completed 后回 Main Planner验收 | completed 后可冻结交付并直达 Generate |
| 不拥有领域私有 Runtime | 可以绑定 managed Skill-private Runtime |

两者都禁止递归委派。

## 12. Trace

Skill 生效和 SubAgent 执行必须有明确 trace，不允许从回答风格猜测。

当前可观察：

- primary Skill id / name / version；
- match source / reason / score；
- disclosed resources；
- execution profile；
- allowed Harness tool ids；
- runtime bindings / readiness；
- workspace binding；
- SubAgent run id；
- working state；
- tool calls；
- requirements；
- artifacts；
- approval boundary；
- resume state；
- terminal status。

Observability 失败不能变成第二控制平面。

## 13. 当前 Hard Rules

1. Skill 本体不等于 Tool、权限或 Runtime。
2. SkillContext、ExecutionProfile、ToolExposure、Runtime readiness 与 Approval 必须分开。
3. 自动激活最多一个 primary Skill。
4. Resources 默认按需披露，不全量注入。
5. Context-only Skill 不生成 invocation、不扩大 ToolExposure。
6. Task Skill 可以把局部施工交给一个 forked SubAgent。
7. Stateful Flow 是可选确定性 controller，不是所有 Skill 的默认状态机。
8. Parent 始终保留 global goal、Policy、Approval、terminal contract 与最终交付。
9. SubAgent 只拥有 task-local execution。
10. Skill-private Runtime 不暴露给 Main Planner。
11. V1 禁止 nested SubAgent 和 recursive `delegate_task`。
12. completed Artifact / Evidence 不得被 Main Planner 无意义重做。
13. requirements 必须结构化上抛，不能由 Child 编造用户问题。
14. terminal failure 不进入 Generate。
15. 运行时实现与本页不一致时，先记录偏差，不得用旧 V1 叙事覆盖代码。