---
status: current
owner: skill-runtime / runtime-pack / security / desktop
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillPackageDistribution
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-runtime-design.md
  - ../microapp/wenshu-skill-runtime.md
---

# Skill Package、Capability Grant 与 Runtime 合同

## 1. 必须分开的层

```text
Skill Package
  identity / routing / instructions / resources

SkillContext
  current task domain context

Execution responsibility
  context-only / delegated-worker / stateful-flow

Capability request
  package 声明希望使用什么

Capability grant
  产品明确允许该 package 使用什么

Environment readiness
  Tool / adapter / Runtime Pack 当前是否健康

Policy / Approval
  exact invocation 是否允许
```

任何一层存在都不能推导后一层已经成立。

## 2. Skill Package

Package 是发现、展示和分发单位，可以包含：

- `SKILL.md`；
- references / templates / examples；
- script metadata；
- version / publisher / source / license；
- routing；
- execution responsibility；
- completion contract；
- capability requirements；
- optional Flow binding metadata。

Package 本身：

- 不授予 Tool；
- 不授予 private Runtime；
- 不执行 script；
- 不安装依赖；
- 不绕过 approval；
- 不创建第二 Agent loop。

## 3. Origin 与 Trust

当前 origin：

```text
built-in | user | external
```

当前不足：origin 同时被部分代码拿来做执行信任判断，但 `external` 同时可能表示产品源码内 public Skill 和真正第三方包。

目标必须拆分：

```text
origin
= built-in | bundled | user | external

trustTier
= system | signed-first-party | user-authored | untrusted-third-party
```

规则：

- `source: Mira Lab` 只是文本，不能提升 trust；
- trust 绑定 package digest/signature；
- user/external 声明已知 Runtime id 仍不得获得 Runtime；
- 同 id 不同 publisher/digest 不是同一个可授权 package。

## 4. Capability request

Package 只能声明：

```text
requestedTools
requestedRuntimes
route requirements
```

这些字段回答“正确执行需要什么”，不是 permission grant。

无效或未知 requirement 应 fail closed，并进入 package diagnostics。

## 5. Capability Grant Registry

目标新增独立产品真相源：

```text
(skill id + version + publisher + package digest)
-> granted Harness tools
-> granted private Runtime bindings
-> route limits
-> workspace constraints
```

Grant Registry：

- 由产品代码/签名安装流程管理；
- 不从 Markdown 文本直接生成；
- 不因 Runtime id 已知自动授予；
- 可以为受信任 delegated-worker 创建 Child-local capability envelope；
- 不修改 Parent `state.toolExposure`；
- 必须进入 Trace。

最终能力：

```text
grant
∩ route requirement
∩ adapter registered
∩ environment healthy
∩ workspace
∩ Policy / exact Approval
```

当前 Grant 逻辑分散在：

```text
server/src/skills/registry.ts
server/src/skills/agent/profiles.ts
server/src/skills/agent/tool-adapters.ts
scanner origin branches
```

`LEGACY_OFFICE_EXECUTION` 只是迁移兼容，不是长期 Grant Registry。

## 6. Harness Tool

Harness Tool：

- 有统一 definition / implementation；
- 经过 environment registry；
- invocation 经过 Policy / Approval；
- 产生 Evidence / Artifact / Trace。

受信任 Skill Worker 可以通过 Grant 获得 Child-local Tool，不要求把 Tool 推入 Parent exposure；但必须明确：

```text
childCapabilityGrant != SkillContext mutation
childCapabilityGrant != Parent ToolExposure mutation
```

user / untrusted Skill 默认没有 Child Tool grant。

## 7. Private Runtime binding

Private binding 是 Worker 可调用的语义适配器：

```text
semantic action
-> binding id
-> managed adapter / launcher
-> deterministic result
```

它：

- 只对获得 grant 的 active Worker 可见；
- 不暴露给 Parent Planner；
- 不作为普通用户 Tool；
- 不允许模型决定 executable、PYTHONPATH、shell、pip、conda；
- readiness 必须来自真实 adapter/environment probe；
- 绑定 package identity/version/digest。

当前静态登记标签：

```text
office_document            ready
office_pdf                 ready
office_presentation        ready
office_spreadsheet         ready
wenshu_xlsx_xml_runtime    pending
```

这些标签当前主要表示 profile/adapter 状态，不足以证明环境健康。目标应显示：

```text
declared
granted
adapter_registered
runtime_pack_available
health_verified
route_eligible
```

## 8. Runtime Pack

Runtime Pack 是受管本地依赖集合，例如：

```text
wenshu-office@1.0.0
```

状态：

```text
not-required
not-installed
installing
available
broken
unknown
```

`available` 只表示依赖包存在并通过相应健康检查，不代表某个 Skill 已获 grant，也不代表某条 route ready。

安装：

- staging；
- dependency/module verification；
- manifest/digest；
- atomic promote；
- 失败不写 installed 真值；
- 不污染用户全局 Python/Node 环境。

## 9. WenShu 当前边界

```text
docx
-> Node / OOXML
-> no Python Runtime Pack
-> office_document

pdf / pptx / xlsx compatibility routes
-> wenshu-office Runtime Pack
```

XLSX：

```text
office_spreadsheet
-> inspect / recalc / verify compatibility

wenshu_xlsx_xml_runtime
-> create / edit / fix
-> pending
```

两个 binding 禁止互相替代。

## 10. Route-specific readiness

禁止：

```text
Skill 有多个 binding
+ 任意一个 ready
-> 整个 Skill ready
```

目标：

```yaml
routes:
  inspect:
    requiredAll: [office_spreadsheet]
  create:
    requiredAll: [wenshu_xlsx_xml_runtime]
```

- route 选择后计算 eligibility；
- 当前 route required capability 缺失即阻断；
- 其它 route 缺失不应阻断；
- readiness 和 missing capability 进入 Trace。

## 11. Script Runtime

Package script 是 Resource，不是 Terminal 权限。

目标 managed Script Runtime：

```text
skill id
+ resource URI
+ package/resource digest
+ structured args
-> managed launcher
-> deterministic result
```

禁止：

- materialize 后默认交给 `terminal_session`；
- 把脚本文本拼成行内 shell；
- 由模型选择 Python executable / environment；
- untrusted script 自动执行。

`wechat-article-layout` 应使用此模型，而不是通用 Terminal 充当 Python generator launcher。

## 12. Package inventory

Package inventory 应由 build/package boundary 自动生成：

```text
relative path
resource kind
bytes
digest
license/provenance when applicable
```

当前 built-in Registry 手写 `packageFiles` 与真实 references 已出现漂移。该字段在自动生成前不能作为完整安装/安全真相。

Build acceptance：

- SKILL.md 存在；
- Manifest schema 通过；
- declared resource URI 存在；
- script digest 固定；
- required license/provenance 存在；
- bundled output 可重新 Scanner/Loader；
- missing file 使 package blocked，不只打印 warning。

## 13. User Skill

当前 user package 会被清空 Tool/Runtime execution 声明。该默认安全方向保留。

未来显式绑定流程必须：

- 展示 requested capability；
- 明确用户批准的是 package + version + digest；
- 限定 Tool/Runtime/route/workspace；
- 可撤销；
- 进入 Trace；
- package 更新后重新确认。

在此之前：

```text
user package
= context-only instructions by default
```

不能因为 package 带 scripts 就自动获得 Terminal。

## 14. Lifecycle

```text
Package exists
!= Runtime installed
!= Grant active
!= Route ready
```

Catalog 可以分别展示：

- lifecycle；
- origin/publisher；
- runtime dependency；
- environment health；
- enabled routes；
- blocked reason。

`review` / `blocked` 必须影响 Matcher 和 execution；不能只是 frontmatter 装饰。

## 15. Trace

至少记录：

```text
package id/version/publisher/digest
origin/trustTier
requested capabilities
grant source/granted capabilities
adapter registration
runtime pack status/health
selected route/eligibility
workspace
approval
result/completion evaluator
```

## 16. Hard Rules

1. Package requirement 不等于 grant。
2. Runtime id known 不等于 Skill owns Runtime。
3. origin 与 trust 分离。
4. Grant 绑定 id/version/publisher/digest。
5. user/external private Runtime deny by default。
6. Child grant 不修改 Parent ToolExposure。
7. Runtime Pack available 不等于 route ready。
8. route readiness 必须按 operation 计算。
9. script resource 不等于 Terminal execution permission。
10. package inventory/digest 必须自动验证。
11. legacy profile union 迁移后必须删除。
12. Capability、readiness、approval 和 completion 全部可追踪。
