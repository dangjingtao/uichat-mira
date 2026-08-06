---
status: current
owner: skill-runtime
last_verified: 2026-08-06
layer: wiki
module: SKILL
feature: SkillSystem
doc_type: current-analysis
canonical: false
related:
  - README.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - skill-runtime-design.md
---

# 当前 Skill 共性与差异（dev）

> 本页是当前能力盘点，不替代 canonical 合同。上位真相以同目录 canonical 文档和当前代码为准。

## 1. 结论

当前 Skill 的共性是统一治理外壳：

```text
发现与匹配
-> 渐进式披露
-> one primary Skill
-> one Skill-owned SubAgent
-> capability intersection
-> Evidence / Artifact / Requirement
-> Parent delivery
```

差异主要来自：

- 是否需要 Harness Tool；
- 是否需要 private Runtime；
- 是否 workspace-bound；
- 是否有专用 Stateful Flow；
- completion truth 来自文本质量、远程回读、构建验证还是 deterministic renderer。

因此当前系统是：

```text
统一治理合同
+ 多种执行家族
+ 不同完成真相源
```

不是“所有 Skill 都是一套同构状态机”。

## 2. 当前 inventory

### Registry built-in

```text
docx
xlsx
pdf
pptx
github-collaboration
wechat-article-layout
```

### 已确认分类目录 public package

```text
github-collaboration
miradocs
deep-interview
black-mirror-writer
product-critic
fertility-assessment
```

`github-collaboration` 以相同 id 合并为一个 identity。当前确认涉及 11 个唯一 Skill identity / definition target。

`wechat-article-layout` 已在 Registry 登记，但 package 文件与构建分发仍需通过代码/构建验证闭环，不能只凭 Registry 条目推导完整可用。

## 3. 统一共性

所有 discovered Skill 当前共享：

1. bounded Manifest scan；
2. single primary match；
3. L1 `SKILL.md` 动态加载；
4. L2 Resource 按需披露；
5. task-context continuation；
6. forked Skill-owned SubAgent profile；
7. capability requirement 与真实 exposure/readiness 分离；
8. Parent 保留 Policy / Approval / terminal / final delivery；
9. structured Evidence / Artifact / Requirement；
10. observable trace；
11. user Skill 不继承系统能力；
12. no nested SubAgent / recursive delegation。

## 4. 执行家族

### A. 规则 / 对话 /创作型

```text
deep-interview
black-mirror-writer
product-critic
```

典型 profile：

```text
allowedTools = []
runtimeBindings = []
workspaceBound = false
```

SubAgent 主要完成局部推理、追问策略、创作或判断。Completion truth 主要来自输出是否满足 Skill 的结构与质量合同。

### B. Remote Tool workflow

```text
github-collaboration
```

依赖 GitHub 领域 Tool。核心完成真相：

```text
current remote facts
+ governed write
+ readback verification
```

### C. Workspace / Terminal / deployment workflow

```text
miradocs
wechat-article-layout
```

MiraDocs 是多阶段站点施工与恢复；公众号排版是 bounded script/artifact flow。两者都不能把终端返回成功直接等同于用户目标完成。

### D. Deterministic private Runtime

```text
docx
pdf
pptx
xlsx
```

共性：workspace-bound、private Runtime、Artifact delivery、deterministic result 优先于模型判断。

底层差异：

| Skill | Runtime | Current truth |
| --- | --- | --- |
| DOCX | Node / OOXML | `office_document=ready` |
| PDF | Python WenShu | `office_pdf=ready` |
| PPTX | Python PPTD renderer | `office_presentation=ready` |
| XLSX inspect/recalc/verify | compatibility runtime | `office_spreadsheet=ready` |
| XLSX XML create/edit/fix | XML-first bridge | `wenshu_xlsx_xml_runtime=pending` |

### E. Stateful business Flow

```text
fertility-assessment
```

当前唯一登记专用 Conversation Flow 的 public Skill。它拥有 phase / round / structured facts / requirements / scoring / report handoff。报告阶段仍属于同一 Skill。

## 5. Workspace 差异

### workspace optional

规则型、访谈型、GitHub 远程协作通常不要求本地 workspace。

### operation-dependent

MiraDocs 根据 local / GitHub / build 阶段决定是否需要 workspace 和 staging。

### workspace required

DOCX / XLSX / PDF / PPTX artifact execution 需要有效 workspace。

`skillRoot`、`runtimeRoot`、`workspaceRoot` 不得混用。

## 6. Completion truth 差异

| Family | Completion truth |
| --- | --- |
| 规则 / 创作 | 输出满足领域结构、边界和用户目标 |
| GitHub | 当前远程事实 + 写入后回读 |
| MiraDocs | staged phases + build / Actions / Pages verification |
| 公众号排版 | final HTML artifact + smoke/preview contract |
| DOCX | deterministic runtime + native artifact + source preservation |
| PDF | runtime success + readable artifact + route-specific structure |
| PPTX | checker / renderer success + editable artifact |
| XLSX | exact required binding ready + deterministic operation + validation |
| Fertility | structured state + deterministic scoring + report delivery |

## 7. 已完成的文档对齐

本分支已把以下旧叙事改为当前真相：

- “部分 Skill inline、部分才 fork” -> 当前所有 discovered Skill 都 fork 一个 Skill-owned SubAgent；
- “Stateful Runtime 仍 Planned” -> 当前 Flow controller 已落地，现有登记为 `fertility-assessment`；
- “Office capability 由 Main Planner 直接调用” -> Office 使用 Skill-private Runtime；
- “Runtime Pack ready 等于能力 ready” -> Pack 与 binding readiness 分离；
- “DOCX 正式 Agent 集成 deferred” -> `office_document` private binding 当前 ready；
- “XLSX XML-first 已完整可用” -> XML write binding 当前 pending；
- built-in inventory 仅四个 Office -> Registry 当前六个 built-in；
- execution frontmatter 多套写法 -> 新文档统一 `execution.*` canonical 字段。

## 8. 仍需代码验证 / 修复的项

### P0 — XLSX XML binding

需要明确选择并落实：

```text
A. 接通 wenshu_xlsx_xml_runtime
or
B. 收缩 XLSX 对外支持范围
```

文档已经诚实标记 pending，但 capability gap 仍是代码事实。

### P0 — wechat package closure

验证：

- 实际 `SKILL.md` 是否存在于正确 source/package path；
- Scanner 是否能发现；
- build 是否打包；
- script 是否通过受治理执行边界工作。

### P1 — frontmatter migration

Scanner 仍保留兼容字段。现有 package 应逐步迁移到：

```yaml
execution.agent
execution.allowedTools
execution.runtimeBindings
execution.workspaceBound
```

迁移完成前兼容解析不能被误认为 canonical。

### P1 — generated capability matrix

建议由以下真相源生成 Matrix：

```text
Registry
+ Scanner manifests
+ SubAgent profiles
+ Flow Registry
+ Runtime binding readiness
```

不要再维护独立手写列表作为第五份真相。

## 9. 设计判断

当前“一套治理外壳，多种执行家族”的方向正确。真正应该统一的是：

- Manifest / disclosure；
- one primary；
- one Child ownership；
- capability intersection；
- Evidence / Artifact / Requirement；
- approval / resume；
- terminal semantics；
- trace。

不应强行统一的是：

- 每个 Skill 都有同样的 Tool；
- 每个 Skill 都要 workspace；
- 每个 Skill 都要 Stateful Flow；
- 每个 Skill 都用同一个 renderer；
- 每个任务都用同一种 completion proof。

## 10. 当前 Hard Rules

1. 所有 discovered Skill 当前统一 fork 一个 Skill-owned SubAgent。
2. SkillContext、ExecutionProfile、ToolExposure、Runtime readiness、Approval 分离。
3. Stateful Flow 只在真实业务需要时启用。
4. Deterministic Runtime failure 不能被模型判断覆盖。
5. `wenshu_xlsx_xml_runtime` 当前 pending。
6. 用户 Skill 不获得系统 capability。
7. Parent 不重做 completed Child artifact。
8. Inventory 与 readiness 应逐步改为代码生成，而不是人工同步。