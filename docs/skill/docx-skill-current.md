---
status: current
owner: skill-runtime / office-runtime
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: DocxSkill
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - ../microapp/office-runtime-task-contract.md
---

# DOCX Skill 当前实现

## 1. Purpose

本页记录 `docx` Skill Package、Skill-owned SubAgent 和 `office_document` private Runtime 的当前真实边界。

当前链路：

```text
用户 DOCX 目标
  -> primary Skill = docx
  -> progressive SkillContext
  -> forked Skill-owned SubAgent
  -> read_open / read_extract when exposed
  -> office_document private Runtime
  -> Evidence + DOCX Artifact
  -> Parent delivery
```

`office_document` 不是 Main Planner 的全局公开工具，也不因 Skill 命中被 push 进 `state.toolExposure`。

## 2. Package

```text
server/src/skills/docx/
  SKILL.md
  references/office-runtime-reference.md
  runtime/
```

Package 表达：

- 已有 DOCX、内容源、新建文档的路由；
- 非破坏性处理边界；
- native comments / Track Changes 语义；
- 不可安全定位时拒绝有损重写；
- completion / quality contract。

## 3. Execution profile

当前 compatibility profile：

```text
mode = forked-agent
engine = pi-agent-core
allowedHarnessToolIds = [read_open, read_extract]
runtimeBindings = [office_document]
workspaceBound = true
```

Profile 是需求边界，不是授权。真实 read Tool 仍取决于 Harness exposure 与 Policy。

`office_document` 当前状态：

```text
kind = skill-private-runtime
status = ready
```

## 4. Runtime

DOCX 使用 Node / OOXML deterministic runtime，不依赖 `wenshu-office` Python Runtime Pack。

禁止：

- Python fallback；
- `terminal_session` 调 DOCX runtime；
- `PYTHONPATH` / pip / conda；
- 文本工具直接修改 DOCX binary；
- 任意 ZIP / XML blind replacement。

代码锚点：

```text
server/src/microapps/office-suite/create.ts
server/src/microapps/office-suite/document-review.ts
server/src/microapps/office-suite/document.ts
server/src/microapps/office-suite/runtime.ts
server/src/microapps/office-suite/contract.ts
```

## 5. Current capabilities

### Create

- native `.docx` output；
- title；
- semantic paragraph styles：`title / heading1 / heading2 / heading3 / body`；
- paragraph-run bold；
- simple tables；
- workspace-relative output。

### Review

- 输入已有 `.docx`；
- exact visible-text anchor；
- Word native comment；
- Track Changes replacement；
- 默认生成新副本；
- 保留源文件。

## 6. Current limitations

- review 只修改可安全定位的 simple Word text run；
- complex run、field 或 unsupported structure 会拒绝 lossy rewrite；
- 不声明支持任意复杂 DOCX 的无损编辑；
- 读取文档作为内容源与修改 DOCX 是两条不同路线；
- Runtime success 不等于可以夸大格式保真范围。

## 7. Completion

DOCX task 完成至少需要：

- deterministic Runtime 返回成功；
- 请求的输出 Artifact 存在；
- 创建内容或审阅变更由 Evidence 覆盖；
- review 任务的源文件未被覆盖；
- unsupported complex edit 被明确拒绝，而不是静默降级。

Skill-owned SubAgent completed 后，Parent 不得重新生成或复制同一 DOCX，只负责 Evidence 接收和交付。

## 8. Trace

应记录：

```text
primary = docx
execution profile
workspace binding
read tool resolution
office_document readiness
runtime action
artifact path
source preservation
terminal status
```

## 9. Hard Rules

1. DOCX 当前已经接入统一 Skill-owned SubAgent runtime，不再描述为“正式 Agent 集成 deferred”。
2. `office_document` 是 ready private Runtime，不是 Main Planner 全局 Tool。
3. DOCX 不依赖 Python Runtime Pack。
4. Review 默认保留源文件并输出新副本。
5. 复杂结构无法安全局部修改时必须拒绝有损强改。
6. completed Artifact 不由 Parent 重做。
7. Workspace 缺失时必须返回结构化能力缺口。