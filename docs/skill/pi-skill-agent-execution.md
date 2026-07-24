# Pi-like Forked Skill Agent 执行架构

Status: Candidate / Pilot
Protocol: Skill V2 Candidate
Owner: chat / agent / skill runtime
Last verified: 2026-07-24
Layer: raw-source
Module: SKILL / Agent Runtime
Feature: PiSkillAgentExecution
Doc Type: architecture-design
Canonical: candidate
Supersedes for `forked-agent` mode:
- `docs/skill/skill-runtime-design.md` 中“不得存在第二 Agent Loop / Parent Planner 逐步控制 Skill 施工”的约束

> 本文只新增一种 **forked-agent Skill execution mode**。现有 `inline` SkillContext 模式继续保留，直到迁移完成。

---

## 0. 核心结论

Mira 的 Skill 不再只能是“给主 Agent 注入说明书”。

对于需要真实施工、持续补证据、运行专业 Runtime、生成 Artifact 的任务型 Skill，新增：

```text
Main Agent
  -> match primary Skill
  -> delegate(goal, skill)
  -> fork Pi-like Skill Agent
       -> Skill instructions / references
       -> Skill-scoped tools
       -> Skill runtime
       -> workspace-bound execution
       -> plan / act / observe / recover
  -> SkillExecutionResult
  -> Main Agent / recovery semantics
  -> Generate
  -> user
```

一句话：

> **Skill 是专业执行 Agent 的编译模板；Pi Agent Core 是执行内核；Main Agent 保留对话与最终交付权。**

---

## 1. 为什么升级

当前 `inline` 路径是：

```text
Skill match
-> SKILL.md / references 注入 Main Agent
-> Main Planner 理解 Skill
-> Main Planner 选择工具并施工
```

它把通用主 Agent 同时变成：

- 对话 Agent；
- Planner；
- Skill 解释器；
- 专业施工 Agent；
- Runtime 调用者；
- Completion 判断者。

文枢已经暴露出该模式的脆弱性：Skill 写的是“调用 bundled runtime”，主 Agent 可能把它错误翻译成任意 shell / Python 调用。

forked-agent 模式的目标不是增加一个随意的“模型步骤”，而是明确转移专业任务的执行所有权。

---

## 2. 两种 Skill execution mode

### 2.1 inline

保持现状：

```text
SkillContext
-> Main Planner
```

适合：

- 简单规则；
- 写作规范；
- 搜索策略；
- 少量上下文增强；
- 不需要独立工具循环的任务。

### 2.2 forked-agent

```text
SkillContext + Goal + ExecutionProfile
-> isolated Pi-like Agent instance
-> bounded result
-> Parent resumes
```

适合：

- DOCX / PDF / PPTX / XLSX 等文档生产；
- 多步工具施工；
- 需要持续补证据；
- 需要专业 Runtime；
- 需要 Artifact；
- Main Agent 不应亲自掌握细节的专业任务。

V2 Pilot 同一时刻最多一个 active forked Skill Agent，不做 nested Skill Agent。

---

## 3. 执行权边界

一旦 Main Agent 委托 forked Skill：

```text
Main Agent owns:
- user conversation
- Skill routing / delegation
- approval / global policy boundary
- final Generate
- final delivery

Skill Pi Agent owns:
- task-local planning
- tool loop
- observation
- evidence coverage
- repair / retry
- artifact construction
- task-local completion judgment
```

禁止双重控制：

```text
Pi Agent 做一步
-> Main Planner 决定下一步
-> Pi Agent 再做一步
```

正确方式：

```text
Main Agent delegate
-> Pi Agent owns execution until terminal/upthrow state
-> Parent resumes
```

---

## 4. Skill 是 Pi Agent 的 Execution Profile

forked Skill 编译成：

```ts
type SkillAgentExecutionContext = {
  skillId: string
  skillVersion: string
  goal: string

  instructions: string       // SKILL.md
  resources: SkillResource[] // references/templates/examples/scripts metadata

  toolExposure: SkillToolExposure
  runtime: SkillRuntimeBinding
  workspace: SkillWorkspaceBinding

  modelPolicy: SkillModelPolicy
  completion: SkillCompletionContract
}
```

### 4.1 SKILL.md

是执行宪法 / procedural plan source，不是固定 JSON step list。

它定义：

- 什么必须完成；
- 哪些步骤/方法优先；
- 哪些做法禁止；
- 何时读取 references；
- 什么算完成。

Pi Agent 根据 `Goal + SKILL.md + Evidence` 动态形成实际 plan。

### 4.2 references

references 是 Pi Agent 的私有专业上下文，可按需读取。

它们不是 Main Agent 的全量上下文，也不是静态工作流 DSL。

---

## 5. ToolExposure：Skill 默认 deny

forked Pi Agent **不得继承 Main Agent 全量 ToolExposure**。

定义：

```text
PiSkillAgent.tools
=
Skill declared/allowed tools
∩ environment available capabilities
∩ policy allowed capabilities
```

默认 deny：Skill 未声明/未允许的能力，Pi Agent 看不见。

例如 PPTX Skill 不应自动获得：

- Gmail；
- 企业微信；
- GitHub；
- 任意 MCP；
- 通用系统控制能力。

工具可分两类：

```text
1. Harness-facing capability
   - read / search / workspace operations 等

2. Skill-private runtime capability
   - pptx renderer
   - pdf runtime
   - xlsx runtime
   - docx runtime
```

第二类不注册成全局 Harness Tool，不出现在用户工具列表。

---

## 6. Runtime inheritance

Skill Agent 可以决定：

```text
“我要调用哪个 Skill runtime action”
```

但不能决定：

```text
- 用哪个 Python executable
- 自己拼 PYTHONPATH
- python -m xxx
- pip / conda install
- 绕过 Runtime Pack
```

执行链：

```text
Pi Skill Agent
-> semantic runtime action
-> SkillRuntimeBinding
-> Mira-managed launcher
-> Skill Runtime / Runtime Pack
-> deterministic result
```

文枢 Python Runtime 必须继续由统一 WenShu launcher 管理解释器和 Runtime Pack 环境。

确定性代码执行结果不得由 LLM 兜底解释成成功。

---

## 7. Workspace binding

Skill runtime 与 Workspace 是两个独立真相源：

```text
skillRoot
= Skill package / references / scripts 来源

runtimeRoot
= managed runtime / dependencies

workspaceRoot
= 当前用户任务的真实文件世界
```

Pi Skill Agent 的实际文件操作与 Artifact 输出必须绑定当前 Workspace。

推荐运行上下文：

```text
skillRoot      read-only package resources
runtimeRoot    managed runtime resources
tempRoot       current Skill execution temp
workspaceRoot  current selected workspace
```

禁止把用户产物默认写入 SkillRoot 或 RuntimeRoot。

---

## 8. Evidence 不足与上抛

Pi Skill Agent 是 executor，不是最终 spokesperson。

统一结果：

```ts
type SkillAgentExecutionResult =
  | {
      status: "completed"
      evidence: SkillEvidence[]
      artifacts: SkillArtifactRef[]
      summary?: string
    }
  | {
      status: "insufficient_evidence"
      evidence: SkillEvidence[]
      missingEvidence: SkillEvidenceGap[]
      artifacts?: SkillArtifactRef[]
    }
  | {
      status: "needs_input"
      requirements: SkillRequirement[]
      partialEvidence?: SkillEvidence[]
      artifacts?: SkillArtifactRef[]
    }
  | {
      status: "failed"
      recoverable: boolean
      error: string
      evidence?: SkillEvidence[]
      artifacts?: SkillArtifactRef[]
    }
```

原则：

```text
证据不足
-> Pi Agent 先在自己允许的能力面内继续补证据
-> 无法补齐则结构化上抛
-> Parent/C contract 决定 recover / ask / guarded Generate
-> Generate 负责最终对用户表达
```

Pi Skill Agent 不得因为证据不足自行编造完成结果。

---

## 9. Model ownership

Pi Agent Core 负责：

- agent loop；
- tool calling；
- state；
- event lifecycle。

Mira 负责：

- Model Gateway / Provider resolution；
- model policy；
- tool allowlist；
- runtime binding；
- workspace binding；
- approval / policy；
- evidence/result projection；
- Generate。

Skill 不硬编码 Provider，也不直接保存 API Key。

---

## 10. Pi Core 版本策略

Pilot 使用：

```text
@earendil-works/pi-agent-core@0.74.1
```

原因：

- 使用当前官方 `@earendil-works/*` scope；
- `0.74.1` 支持 Node >=20；
- Mira 当前 root engine 仍是 Node >=20；
- Pi `0.75+` 已提升最低 Node 到 22.19，升级前必须先统一 Mira Runtime Node 基线。

不使用已 deprecated 的 `@mariozechner/*` scope。

---

## 11. 文枢首批 Pilot

首批绑定：

```text
docx
pdf
pptx
xlsx
```

目标链：

```text
Main Agent
-> primary Skill match
-> resolve WenShu SkillAgentExecutionProfile
-> fork Pi Agent
-> load SKILL.md / selected references
-> expose only Skill-scoped tools + private runtime
-> bind current workspace
-> execute until completed / upthrow
-> result/evidence/artifacts
-> Parent
-> Generate
```

### DOCX

```text
runtime = WenShu DOCX domain runtime
workspace = current workspace
```

### PDF

```text
runtime = WenShu PDF runtime via managed WenShu launcher
workspace = current workspace
```

### PPTX

```text
runtime = WenShu launcher
-> pptx_runtime.py
-> bundled kimi_ppt_dsl
-> checker
-> Converter
```

禁止 Pi Agent 自行 `python -m kimi_ppt_dsl`。

### XLSX

```text
runtime = XLSX Skill package/runtime binding
workspace = current workspace
```

保持 XML-first / deterministic validation 的现有 Skill 合同；不恢复 `office_spreadsheet` 为全局工具。

---

## 12. 与现有 Tool Registry 的关系

继续保持：

```text
DOCX / PDF / PPTX / XLSX
= 四个 Skill
```

以下旧 wrapper 不再作为全局 Tool 暴露：

```text
office_document
office_pdf
office_presentation
office_spreadsheet
```

它们的实现若仍有复用价值，可以作为 **Skill-private runtime adapter** 使用，但不能因此重新进入全局 Harness Tool Registry。

---

## 13. Pilot 实施顺序

```text
P0 文档冻结边界
P1 安装 Pi Agent Core
P2 建立 SkillAgentExecutionProfile
P3 建立 PiSkillAgentExecutor
P4 文枢四 Skill 绑定 profile/runtime/workspace
P5 单独 smoke，不默认接管主 Agent
P6 接通 Parent delegation + result projection
P7 验证 evidence upthrow / Generate
P8 再决定是否迁移其他任务型 Skill
```

第一阶段不删除 inline SkillContext，不推翻现有 C contract，不允许 nested Skill Agent。
