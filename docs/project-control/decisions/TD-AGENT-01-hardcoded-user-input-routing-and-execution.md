---
status: current
owner: project-owner
last_verified: 2026-07-10
layer: project-control
module: ProjectControl
feature: AgentNodeInputContractDebt
doc_type: decision
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T001-next-action-planner-node.md
  - docs/project-control/tasks/agent_node_T016-local-tool-routing-and-schema-guard.md
  - docs/project-control/tasks/agent_node_T038-task-intent-required-work-extractor.md
  - server/src/agent/task-intent.ts
  - server/src/agent/planner/coverage-transition.ts
  - server/src/agent/planner/node.ts
---

# TD-AGENT-01 严禁把用户输入硬编码进 Agent 决策与执行链

## Decision

登记一项高优先级 Agent 技术债，并从现在开始作为硬约束执行：

- 严禁把用户原始输入通过关键词、正则、拼接或局部规则，直接硬编码成所谓“智能”决策结果
- 严禁把用户原始输入或其局部片段，未经模型判定或未经过对象确认，就直接落成执行参数，例如 `targetPath`、`path`、`command`、`destinationPath`、`content`
- 严禁把“看起来像目标”的自然语言对象直接当成 workspace 路径、文件名、命令或结构化执行对象

这里的“硬编码用户输入”包括但不限于：

- 用规则把用户一句话直接改写成工具参数
- 用局部正则从用户原话里抽字串，然后直接作为 `workspace_mutation.targetPath`
- 用关键词把问题强路由成固定工具，再把原话残片塞进工具参数
- 在 Agent 节点里把用户自然语言翻译成 shell command、文件路径、文件内容或 rename / move 目标

## Why This Debt Exists

当前 Agent 链路里仍存在一个危险倾向：

- 上游节点试图用局部规则“理解”用户输入
- 中间节点再把这个局部规则结果包装成 coverage target 或执行对象
- 下游 planner / tool 节点把它当成已确认事实继续推进

这会导致一个典型错误：

- 用户说的是自然语言目标
- 系统却把它误当成真实路径或真实执行对象
- 最终在执行层报 `targetPath does not exist`、误审批、误调用，或者更糟的是命中错误对象

这类问题不是“工具不够聪明”，而是运行时边界被错误设计了：

- 把“理解用户意图”
- “确认目标对象”
- “生成执行参数”
- “执行高风险动作”

混成了一条由局部规则硬推出来的伪智能链。

## Impact

这项技术债直接影响：

- `nextActionPlannerNode`
- `task intent / required work / coverage target` 提取链
- `coverage-transition`
- `toolCallNormalize`
- `workspace_mutation`
- `terminal_session`
- 任何会把用户原话转换成结构化执行参数的 Agent 节点

如果不收掉，后续会持续出现：

- 自然语言标题被误当路径
- 模糊对象被误当文件
- 用户描述范围词被误当目标名
- 局部规则绕过 task model，形成假智能主链
- 高风险工具收到错误但“形式合法”的参数

## Hard Rules From Now On

从现在开始，AgentNodes 相关任务一律遵守下面这些规则：

1. 用户原话不是执行对象真相。
2. 自然语言目标在确认前，只能视为候选对象，不能直接落成 `path / targetPath / command / content`。
3. 任何高风险动作的执行参数，都必须来自可审计的确认步骤，而不是本地硬编码规则。
4. 局部规则只能做非常窄的规范化，不能承担对象识别主职责。
5. 如果对象没有确认，优先走 `ask_user`、`read_locate`、或 task model 明确要求的下一步，而不是继续猜。
6. 不允许在 Agent 节点里用正则把自然语言直接“翻译”为 shell command。
7. 不允许把“当前空间下的、关于、介绍、那个文件、这个文档”之类范围词和描述词，静默洗成路径参数。

## Allowed Alternatives

后续类似需求，允许的处理方式只有这些：

### 1. 交给 task model 做对象判定

由 task model 明确输出：

- 当前要做的动作类型
- 当前对象是否已经可确认
- 若不可确认，下一步是 locate、ask_user 还是 answer with limitation

不要让本地规则直接替代这个判断。

### 2. 先确认对象，再生成执行参数

例如删除、移动、覆盖、执行命令这类动作，应该先经过：

- task model 决定下一步
- locate / read / ask_user 获取对象证据
- 再把已确认对象落成结构化参数

而不是反过来先猜参数再执行。

### 3. 只保留窄范围规范化

允许的本地规则应只限于：

- `/workspace` 这类明确 sentinel 的归一化
- 已确认路径的 boundary normalize
- 已冻结参数的 schema 校验

不允许做“看起来像文件名”“像标题”“像命令”的自由猜测。

### 4. 用提示词示范，而不是代码硬编码

如果确实想让模型更稳定，优先做：

- planner prompt 增加负面示范
- planner prompt 增加对象未确认时的行为合同
- task model 输出 schema 增加“对象是否已确认”字段

不要在节点代码里偷偷补一层自然语言猜测。

## Prompt Guidance Example

下面是允许采用的提示词方向示范，不是运行时代码：

```text
当用户请求删除、移动、覆盖、读取或执行命令时：

1. 不要把自然语言标题、描述词、范围词直接当成路径、命令或其他执行参数。
2. 只有当目标对象已经是明确、可确认的 workspace 对象时，才可以输出 use_tool。
3. 如果目标对象仍然是自然语言描述，优先输出：
   - use_tool: read_locate
   - ask_user
   - 或说明当前对象尚未确认
4. 不要把“当前空间下的”“关于”“介绍”“那个文件”之类词直接写进 targetPath/path/command。
5. 不要假装对象已经确认。
```

## Rejected Alternatives

- 继续在 `task-intent`、`coverage-transition`、`toolCallNormalize` 里补更多正则特判
- 继续把局部规则包装成“智能 fallback”
- 遇到对象不清楚时，默认选第一个像路径的片段继续执行
- 让高风险工具层替上游猜测兜底
- 只在聊天里口头提醒，不形成正式债务文档

## Follow-up

- 所有新的 `agent_node_` 任务，在设计对象识别、参数冻结、planner prompt、mutation 执行前，必须优先阅读本技术债
- 后续若修这类问题，优先考虑：
  - task model 输出合同升级
  - planner prompt 负面示范
  - 对象确认步骤显式化
  - “未确认对象不得进入高风险执行参数”的统一合同
- 在这项债务关闭前，不要把任何“基于用户输入局部规则提取执行对象”的实现描述为智能能力
