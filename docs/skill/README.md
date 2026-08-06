---
status: current
owner: skill-runtime
last_verified: 2026-08-06
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
  - skill-runtime-design.md
  - ../harness/agentgraph-harness-protocol.md
---

# Skill 模块当前合同

> 本页是当前 Skill 模块的上位真相。Skill 的本体、上下文披露、执行 profile、真实能力、审批和可选业务 Flow 必须分开理解。

## 1. Skill 本体

Skill 是可复用的领域能力包：

```text
Manifest
+ SKILL.md
+ optional Resources
+ optional Execution Manifest
+ optional Runtime requirements
+ optional Conversation Flow binding
```

它表达：

- 这类任务如何路由；
- 哪些领域规则必须遵守；
- 哪些 references / templates / examples 可按需读取；
- 希望使用哪些 Harness Tool 或私有 Runtime；
- 什么算完成。

Skill 不是：

- Tool；
- MCP server；
- 权限授予；
- Runtime Pack；
- 全局 Tool Registry；
- 任意脚本执行许可；
- 必然存在的状态机。

## 2. 五个独立真相源

```text
SkillContext
= 当前任务应掌握的领域知识与约束

ExecutionProfile
= Skill-owned SubAgent 希望使用的最大能力边界

ToolExposure / Runtime binding
= 当前环境真正提供的能力

Policy / Approval
= 本次 exact invocation 是否允许执行

Optional Conversation Flow
= 该 Skill 是否有确定性的业务状态控制器
```

因此：

```text
Skill match
!= Tool registration
!= Tool exposure
!= Runtime ready
!= Permission granted
!= Stateful Flow active
```

Skill 只声明需求，不凭声明获得能力。

## 3. 渐进式披露

```text
L0 Manifest
  -> match
L1 SKILL.md
  -> task rules and completion contract
L2 Resource
  -> reference / template / example / script metadata
Execution Boundary
  -> governed Harness Tool / managed private Runtime
```

Scanner 启动时只读取有限 frontmatter，不预加载全部正文和 references。当前自动激活最多一个 primary Skill；L2 Resource 默认按需读取。

## 4. 当前统一执行模型

当前实现中，**每个被发现并命中的 Skill 都解析为一个 Skill-owned SubAgent profile**：

```text
SkillContext + ExecutionProfile + Goal
  -> one forked SubAgent
  -> task-local execution or reasoning
  -> Evidence / Artifact / Requirement
  -> Parent governance and delivery
```

即使一个规则型 Skill 没有声明 Tool 或 Runtime，它仍通过同一 SubAgent 外壳执行，只是能力面为空：

```text
allowedHarnessToolIds = []
runtimeBindings = []
workspaceBound = false
```

当前不存在“部分 discovered Skill 由 Main Planner inline 执行、另一部分才 fork”的双重默认模型。未来若重新引入 context-only inline mode，必须先形成新的显式合同和测试，不能仅靠文档描述。

## 5. Parent 与 Skill-owned SubAgent 的所有权

Parent owns：

- 用户对话；
- global goal；
- primary Skill routing；
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
-> SubAgent owns bounded execution
-> structured terminal / interruption state
-> Parent governs delivery or recovery
```

## 6. 可选 Stateful Conversation Flow

某些业务 Skill 需要多轮结构化状态、phase、requirements、checkpoint 或确定性 reducer。当前模型是：

```text
Conversation Flow / Reducer
= 该 Skill 的单一确定性 SubAgent controller
```

它不是再叠一层自由模型，也不是所有 Skill 的入场门槛。

当前 `server/src/skills/flow/registry.ts` 只登记：

```text
fertility-assessment
```

其报告阶段通过内部 directive handoff 完成，仍属于同一个公开 Skill，不注册第二个可发现 Skill。

## 7. Tool 与 Runtime 边界

### Harness-facing tools

真实可见能力为：

```text
Skill declared tools
∩ current environment registered tools
∩ active exposure / binding
∩ Policy / Approval
```

### Skill-private Runtime

私有 Runtime：

- 只提供给 active Skill-owned SubAgent；
- 不暴露给 Main Planner；
- 不出现在普通用户工具列表；
- 通过 managed adapter 执行语义 action；
- 不能让模型决定 Python executable、PYTHONPATH、pip、conda 或任意 launcher；
- readiness 与 Skill match 分离；
- pending binding 不能伪装为 ready。

当前登记状态：

```text
office_document            ready
office_pdf                 ready
office_presentation        ready
office_spreadsheet         ready
wenshu_xlsx_xml_runtime    pending
```

`office_spreadsheet` 的 ready 不得被解释为 XLSX XML-first create/edit binding 已完成。

## 8. Built-in、外部与用户 Skill

系统/package roots 先于 user root 扫描，用户 Skill 不能通过复用 id 覆盖系统 Skill 身份。

用户导入 Skill 当前会被规范化为：

```text
context = fork
agent = subAgent
allowedTools = []
runtimeBindings = []
workspaceBound = false
```

导入的 Markdown 是执行说明，不是能力授权。后续若要给用户 Skill 绑定 Tool 或 Runtime，必须走独立、受治理的显式绑定流程。

## 9. Workspace

```text
skillRoot
= Skill package / references / scripts

runtimeRoot
= managed runtime / dependencies

workspaceRoot
= 用户当前任务的真实文件世界
```

三者不可混用。`workspaceBound=true` 的 Skill 没有有效 workspace 时必须返回结构化能力缺口，不能偷偷写入 SkillRoot 或 RuntimeRoot。

## 10. Result contract

SubAgent 统一返回：

- `completed`；
- `insufficient_evidence`；
- `needs_input`；
- `failed`，并标记 recoverable；
- Evidence；
- Artifacts；
- Requirements；
- missing evidence；
- bounded trace / checkpoint。

Parent 行为：

| 结果 | Parent 行为 |
| --- | --- |
| completed | Evidence 提交后冻结交付，直接 Generate，不重做领域施工 |
| needs_input | 根据 structured requirement 组织用户追问 |
| insufficient_evidence | 在 active Skill 能力面内恢复，或如实报告缺口 |
| recoverable failed | 回 Parent 恢复，工具面仍受 active profile 限制 |
| terminal failed | Main Agent failed，Generate 不运行 |
| approval required | 保存 exact invocation 与 transcript checkpoint，等待审批 |

## 11. Approval 与 Resume

审批 checkpoint 必须绑定：

- Skill id；
- tool id / tool call id；
- input hash 与 frozen input；
- resumable transcript checkpoint。

恢复时只回放当前 exact approval。旧 approval 不可复用，也不能从原始目标重新启动 Child。

## 12. Trace

Skill 生效与 SubAgent 执行必须可观察：

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
- approval / resume；
- terminal status。

Observability 只能记录事实，不能成为第二控制平面。

## 13. Generic delegation 与 Skill-owned execution

Main Planner 的 `delegate_task` 动态构造 `mira.generic-task`，用于通用、有明确验收边界的工作包。它与 Skill-owned execution 不同：

| Generic Task SubAgent | Skill-owned SubAgent |
| --- | --- |
| Main Planner 显式选择 `delegate_task` | primary Skill 自动触发 execution profile |
| 使用 Main exposure 的受控子集 | 使用 Skill declared tools / private runtime |
| completed 后回 Main Planner验收 | completed 后可冻结交付并直达 Generate |
| 无领域私有 Runtime | 可绑定 managed private Runtime |

两者都禁止递归委派。

## 14. 当前 Hard Rules

1. Skill 不等于 Tool、权限、Runtime Pack 或 Stateful Flow。
2. SkillContext、ExecutionProfile、ToolExposure、Runtime readiness、Approval 必须分开。
3. 自动激活最多一个 primary Skill。
4. Resources 默认按需披露。
5. 当前每个 discovered Skill 都通过一个 forked Skill-owned SubAgent 执行。
6. Stateful Flow 是可选确定性 controller，不是默认自由 Agent loop。
7. Parent 保留 global goal、Policy、Approval、terminal contract 与最终交付。
8. SubAgent 只拥有 task-local execution。
9. Skill-private Runtime 不暴露给 Main Planner。
10. 用户 Skill 不因 frontmatter 声明获得 Tool 或 Runtime。
11. V1 禁止 nested SubAgent 和 recursive `delegate_task`。
12. completed Artifact / Evidence 不得被 Main Planner 无意义重做。
13. requirements 必须结构化上抛，不能由 Child 越权决定全局对话。
14. terminal failure 不进入 Generate。
15. 文档与实现冲突时，以当前代码和验证证据为准，并立即修正文档。