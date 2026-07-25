# Mira 多 Agent 执行真相

Status: Current
Owner: agent-runtime
Last verified: 2026-07-25
Layer: wiki
Module: Agent Runtime / Skill Runtime
Feature: MultiAgentExecution
Doc Type: current-contract
Canonical: true
Related:
  - ../harness/agentgraph-harness-protocol.md
  - ../skill/pi-skill-agent-pilot-status.md
  - ../development/agent-observability.md
  - ../chat/agent-runtime-design.md

## 这页回答什么

这页记录 Mira 当前已经落地的多 Agent 执行关系、所有权边界、审批恢复语义和已知限制。

它不是未来的 Agent Swarm 设计，也不是把所有 Skill 都描述成独立 Agent。评审、施工和产品说明中，涉及“主 Agent、Skill Agent、审批恢复、私有 Runtime、Parent recovery”时，以本页和代码为准。

## 一句话结论

Mira 当前实现的是一个**受 Parent 治理的主从式多 Agent 执行模型**：

- Main Agent 负责用户目标、治理、审批、恢复策略、Evidence 收口和最终回答；
- 命中执行 Profile 的 Skill 可以 fork 一个隔离 Pi Skill Agent；
- Pi Skill Agent 在自己的受限工具面内完成任务局部施工；
- 完成后把 Evidence / Artifact 交回 Parent，而不是让 Main Planner 重做一遍。

它不是：

- 任意 Agent 之间自由对话；
- 自动创建大量线程；
- 多 Agent 投票或群体协作；
- 共享无限上下文或共享全局记忆；
- Main Planner 对 Skill Agent 每一步工具调用进行遥控。

## 当前真实执行链

### 普通 Main Agent 任务

```text
User
  -> AgentRun
  -> AgentGraph stable facade
  -> Pi Loop
  -> Planner
  -> Normalize
  -> Policy / Approval
  -> Tool or Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

### Profiled Skill 任务

```text
User
  -> Main Agent PrepareContext
  -> Skill Match
  -> Skill execution profile
  -> forked Pi Skill Agent
       -> Skill context
       -> scoped Harness read tools
       -> Skill-private Runtime tools
       -> local tool loop
  -> Skill Evidence / Artifact
  -> Parent finalization packet
  -> Main Generate
  -> Finalize
```

关键区别：Skill Agent 完成 task-local execution 后，Main Planner 不再接管施工。Parent 只负责治理与交付。

## 角色与所有权

| 角色 | 当前职责 | 不负责什么 |
| --- | --- | --- |
| Main Agent / Parent | 识别用户目标、准备上下文、审批、用户补问、恢复策略、Evidence 收口、最终回答 | 不应在 Skill Agent 已完成后重新制作同一产物 |
| Main Planner | 普通任务的滚动下一步决策；recoverable 路径的 Parent recovery | 不直接调用 Skill-private Runtime；不遥控 Skill Agent 每一步 |
| Forked Pi Skill Agent | 在 Skill 合同与受限工具面中完成局部任务 | 不直接向用户发言；不拥有最终交付和全局治理 |
| Harness | 工具注册、公开 tool exposure、Policy、执行和 Evidence 边界 | Skill 匹配本身不会给 Main Planner扩展私有工具权限 |
| Skill-private Runtime | 提供 DOCX/PDF/PPTX/XLSX 等领域执行能力 | 不进入 Main Planner 的 canonical `toolExposure` |
| Generate | 基于已提交 Evidence 组织最终用户回答 | 不应根据模型臆测宣布产物成功 |

## Skill 命中不等于多 Agent 执行

只有同时满足以下条件，才进入 forked Skill Agent：

1. SkillContext 匹配到 primary Skill；
2. 该 Skill 存在 `SkillAgentExecutionProfile`；
3. Profile 中至少有可用的 scoped Harness 工具或 `ready` private Runtime binding；
4. 当前执行经过 `prepareContextWithForkedSkillAgentNode -> forkedSkillAgentNode`。

Skill 内容只提供领域方法和约束。它本身不是权限，也不把 `office_document`、`office_pdf` 等工具加入 Main Planner 的公开工具面。

## Skill Agent 的工具边界

当前 Office Skill Profile 的基本形态是：

```text
Skill Agent tools
  = skill_read_resource
  + profile.allowedHarnessToolIds
  + ready Skill-private Runtime bindings
```

当前 Office pilot 默认只向子 Agent 提供受限读取工具，例如：

- `read_open`
- `read_extract`

领域施工由 private Runtime 完成，例如：

- DOCX -> `office_document`
- PDF -> `office_pdf`
- PPTX -> `office_presentation`
- XLSX diagnostics -> `office_spreadsheet`

这些 private Runtime 按设计不出现在 Main Planner 的 canonical `toolExposure` 中。

因此，Main Planner 报告“没有 office_document”并不代表绑定不存在；它通常意味着任务错误地回落到了 Parent 施工路径。

## 审批的真实恢复语义

审批必须绑定冻结的具体调用，而不是绑定“某个工具以后都可以执行”。

当前冻结信息至少包括：

- `toolCallId`
- `toolId`
- 完整输入参数
- `inputHash`
- Skill id
- Pi transcript checkpoint
- 已累计 Evidence / Artifact / tool call ledger

### 首次暂停

```text
Pi Skill Agent
  -> private Runtime invocation
  -> Runtime returns approval requirement
  -> save Pi messages and exact pending invocation
  -> Parent pendingApproval
  -> pause
```

### 批准后恢复

```text
Parent approval
  -> validate exact toolId + inputHash + checkpoint invocation
  -> execute the frozen invocation once
  -> replace approval placeholder with real ToolResult
  -> Agent.continue() from saved Pi transcript
```

批准后不得重新 `prompt(original goal)` 创建一个全新的 Pi Agent 再猜同一调用。那种行为不是 resume，会造成重复审批、参数漂移和副作用重放。

Approval 是一次性授权：同一 exact invocation 执行一次后，后续再次调用必须重新审批。

## 完成、补问、恢复与失败

### completed

```text
Skill Agent completed
  -> commit Skill observation into Evidence
  -> freeze Parent finalization packet
  -> Generate
  -> Finalize
```

Main Planner 不再重做产物。

### needs_input

Skill Agent 只返回结构化 requirements。Parent 负责把 requirements 组织成用户问题，并进入 `ask_user / waiting_user`。

Skill Agent 不是用户对话发言者。

### insufficient_evidence / recoverable failure

仍遵守 Main Agent C contract，进入 Parent recovery。

为了避免 Parent 绕开 Skill Runtime 自己施工，profiled Skill 的 recovery tool exposure 会收窄到该 Profile 允许的 Harness 工具面。Office Skill recovery 不应自动获得 `terminal_session`、代码生成或任意编辑能力。

### terminal failure

```text
Skill Agent terminal failure
  -> Graph.status = failed
  -> finishReason = error
  -> Generate does not run
```

不得用一段“尽力而为”的生成回答掩盖 terminal runtime failure。

## 当前 Office Skill 执行矩阵

| Skill | 子 Agent private Runtime | 当前状态 | 备注 |
| --- | --- | --- | --- |
| DOCX | `office_document` | Ready | Node / OOXML deterministic Runtime；创建与受限审阅 |
| PDF | `office_pdf` | Ready | WenShu managed Python Runtime；创建后执行内容校验 |
| PPTX | `office_presentation` | Ready | WenShu managed Runtime；当前模板质量仍较基础 |
| XLSX | `office_spreadsheet` | Partial | `inspect` / `verify` 为只读直通；`recalc` 需要审批 |
| XLSX create/edit | `wenshu_xlsx_xml_runtime` | Pending | XML-first create/edit bridge 尚未完成，不得宣称已支持完整创建和编辑 |

## 已验证的当前行为

截至 2026-07-25 的真实桌面 dev 烟测：

| 场景 | 结果 |
| --- | --- |
| DOCX 创建、单次审批、checkpoint resume、真实产物 | 通过 |
| PDF 结构化正文和表格生成、产物内容校验 | 通过 |
| PPTX 两页创建、private Runtime ownership | 通过 |
| XLSX inspect / verify 无审批只读执行 | 通过 |
| Workspace 越界写入阻断 | 通过 |
| Skill Agent ownership：无 Main Planner terminal/codebase fallback | 通过 |
| 正式验收报告缺参时由 Parent 补问 | 初始补问通过；多轮续接内容约束仍需继续收紧 |

这些结果是手工黑盒烟测事实，不等同于所有自动化测试与发布环境均已覆盖。

## 当前已知限制

### 1. Trace 仍不够友好

UI 可能先显示“Pi Skill Agent completed”，后显示审批和恢复节点。节点列表的展示顺序不应被当成底层执行时间线的唯一真相。

后续需要让 Skill Agent 内部的：

- planning
- tool request
- approval pause
- checkpoint resume
- artifact verification

以更清晰的语义顺序进入 trace。

### 2. 文档内容与视觉质量不是 Agent 所有权问题

当前可能出现：

- DOCX 标题重复；
- 字体和段落样式普通；
- PPTX 模板简单；
- 用户给出“其它随便写”后，模型生成过于泛化的业务内容。

这些属于 Skill prompt、Runtime spec、模板和内容校验问题，不代表多 Agent 执行链未生效。

### 3. 多轮 needs_input 续接仍需收紧

当前已有部分确定性缺参守卫，但 continuity match 后，用户含糊授权“其它随便写”仍可能让子 Agent生成通用甚至偏题内容。

未来应把缺失字段、用户已确认字段和允许推断范围存入可恢复的 Skill execution state，而不是只依赖最新一句用户文本。

### 4. 当前不是通用 Agent 工厂

现阶段只有明确 Profile 的 Skill 可以 fork。系统还没有：

- 任意动态角色 Agent；
- Agent 间消息总线；
- 群体协作调度器；
- 通用子 Agent 生命周期管理；
- 跨任务共享的子 Agent 记忆。

不要把当前 Office Skill pilot 对外描述成完整 Agent Swarm 平台。

## 不变量

后续修改多 Agent 执行时，不得破坏：

1. Main Agent C contract；
2. exact invocation approval；
3. checkpoint-based true resume；
4. private Runtime 不进入 Main Planner canonical tool exposure；
5. completed 直接进入 Evidence / Finalization，不回 Main Planner 重做；
6. needs_input 由 Parent 向用户发问；
7. recoverable failure 可回 Parent，但不能绕开 Skill 工具边界施工；
8. terminal failure 不运行 Generate；
9. Artifact 成功必须由 Runtime Evidence 与真实文件支持；
10. UI trace 不能反向成为执行合同。

## 代码锚点

主运行时：

- `server/src/agent/pi-loop/index.ts`
- `server/src/agent/nodes/prepare-context-with-forked-skill.ts`
- `server/src/agent/nodes/forked-skill-agent.ts`
- `server/src/agent/nodes/next-action-planner.ts`

Skill Agent：

- `server/src/skills/agent/profiles.ts`
- `server/src/skills/agent/wenshu-pilot.ts`
- `server/src/skills/agent/pi-core.ts`
- `server/src/skills/agent/tool-adapters.ts`
- `server/src/skills/agent/types.ts`

Office Runtime：

- `server/src/mcp/tools/office-document.tool.ts`
- `server/src/mcp/tools/office-pdf.tool.ts`
- `server/src/mcp/tools/office-presentation.tool.ts`
- `server/src/mcp/tools/office-spreadsheet.tool.ts`
- `server/src/microapps/office-suite/`

验证：

- `server/src/agent/nodes/prepare-context-with-forked-skill.test.ts`
- `server/src/agent/nodes/forked-skill-agent.approval.test.ts`
- `server/src/agent/pi-loop/forked-skill-finalization.test.ts`
- `server/src/skills/agent/pi-core.approval-resume.test.ts`
- `server/src/skills/agent/tool-adapters.approval.test.ts`
- `server/src/skills/agent/wenshu-pilot.needs-input.test.ts`
