---
status: current
owner: skill-runtime / desktop / security
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillDiscovery
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-context-design.md
  - skill-package-runtime-contract.md
---

# Skill Discovery、身份与目录暴露合同

## 1. Purpose

本合同定义：

1. 什么目录构成 Skill Package；
2. package identity、category 与 boundary；
3. visibility / lifecycle 如何影响 Catalog、Matcher 和 execution；
4. duplicate id 如何失败；
5. origin 与 trust 的边界；
6. internal helper/resource 如何在 Registry 前过滤。

Discovery 只发现和校验 Package。它不授予 Tool、private Runtime 或脚本执行权。

## 2. Canonical layout

源码公开 Skill 与新用户导入 Skill统一使用：

```text
<skills-root>/
  <category>/
    <skill-id>/
      SKILL.md
      references/
      templates/
      examples/
      scripts/
      runtime/
```

固定语义：

```text
一级目录 = category
二级目录 = one Skill Package
```

一个合法 package 对应：

```text
one Catalog identity
one Registry Manifest
one primary match identity
one declared execution responsibility
```

不再规定“one package = one SubAgent”。是否创建 Worker 由 `execution.mode` 决定。

## 3. Package boundary

一旦目录存在：

```text
<skill-dir>/SKILL.md
```

该目录即成为完整 package boundary。Scanner 禁止继续把嵌套 `SKILL.md` 注册为顶级 Skill。

以下都属于 package resource/component，不是 public Skill：

```text
references
templates
examples
scripts
runtime
internal handoff
helper
```

## 4. Public eligibility

```text
SKILL.md exists
!= valid package
!= Registry eligible
!= Matcher eligible
!= executable
```

### Source/package roots

非 explicit built-in 的源码 Skill 必须满足：

```text
<category>/<skill-id>/SKILL.md
+ visibility: public
+ valid manifest
+ lifecycle allows discovery
```

### User root

用户新导入使用 canonical 两级目录。若声明：

```yaml
visibility: internal | private | hidden
```

则不得进入 public Registry。

旧目录：

```text
<user-root>/<skill-id>/SKILL.md
```

只保留 read/migration compatibility，不作为新安装格式。

### Flat system compatibility

```text
<system-root>/<skill-id>/SKILL.md
```

只允许 `registry.ts` 明确登记的 built-in identity 使用。普通源码 Skill 禁止通过 flat path 进入 Registry。

## 5. Visibility 与 Lifecycle

目标字段：

```text
visibility
= public | internal | private | hidden

lifecycle
= review | current | deprecated | blocked
```

矩阵：

| 状态 | Catalog | 普通自动 Matcher | Explicit/continuation | Execution |
| --- | --- | --- | --- | --- |
| current + public | 是 | 是 | 是 | 按能力合同 |
| review + public | 开发模式可见 | 否 | 开发测试可选 | 默认禁用 |
| deprecated | 可标记显示 | 否 | compatibility only | 受限 |
| blocked | 否或显示阻断诊断 | 否 | 否 | 否 |
| internal/private/hidden | 否 | 否 | 否 | 仅内部显式绑定 |

当前代码只解析 visibility，`status: review` 等字段可能被忽略。这是已知差距；新规范禁止把未接入 gate 的 lifecycle 字段当作已经生效。

## 6. Reserved directories

```text
.<anything>
_<anything>
```

永远不进入 public discovery。

内部 package/component 推荐放：

```text
<skills-root>/_internal/
```

即使其 frontmatter 声明 public，也不得绕过目录 gate。

## 7. Identity validation

`id` 必须：

```text
^[a-z0-9][a-z0-9_-]{1,63}$
```

并与 package 目录名一致，除非有显式、受审计的 migration alias。

还必须验证：

- SemVer version；
- publisher；
- displayName / description；
- lifecycle；
- execution.mode；
- resource declarations；
- completion contract。

无效 identity/execution/routing 字段必须 fail closed，不能用默认值把有问题的 public package 悄悄变成另一种行为。

## 8. Duplicate id 必须 fail closed

当前 Scanner 使用 `seen` first-wins，重复 id 静默丢弃后者。这不是目标合同。

目标：

```text
same id discovered more than once
-> Registry conflict
-> neither candidate automatically executable
-> diagnostics include roots, publisher, version, digest, trustTier
```

只有显式 Registry policy 能决定替代/升级关系，例如：

```text
same publisher
+ verified version upgrade
+ valid signature
```

禁止依赖：

- root 顺序；
- filesystem/readdir 顺序；
- 第一个先发现；
- package 自称 `source: Mira Lab`。

## 9. Origin 与 Trust

当前 origin：

```text
built-in | user | external
```

目标增加独立 trustTier：

```text
system
signed-first-party
user-authored
untrusted-third-party
```

规则：

- directory origin 不能自动授予 trust；
- publisher 文本不能提升 trust；
- trust 绑定 package digest/signature；
- user/external package 不继承 built-in metadata、Grant 或 Runtime；
- external package 声明一个已知 private Runtime id 仍必须 deny；
- Capability Grant 在 Discovery 之后独立解析。

## 10. 当前 built-in inventory

`server/src/skills/registry.ts` 当前登记：

```text
docx
xlsx
pdf
pptx
github-collaboration
wechat-article-layout
```

当前判断：

- DOCX/XLSX/PDF/PPTX 使用 flat built-in compatibility；
- `github-collaboration` 同时有分类 package 与 built-in fallback，需要最终收敛为一个 package truth；
- `wechat-article-layout` Registry 条目未在当前 branch 验证到预期 SKILL.md/script 闭环，应视为 blocked，而不是仅凭 Registry 显示 ready。

## 11. 当前分类 public package

已确认：

```text
development/
  github-collaboration/
  miradocs/

内容创作/
  deep-interview/
  black-mirror-writer/

工程研发/
  product-critic/

健康/
  fertility-assessment/
```

目录 `development` 当前展示归一化为“工程研发”。展示 label 可以归一化，但 package identity/category 真相不能分裂为两套互相覆盖的数据。

## 12. Internal stage 不是新 Skill

```text
fertility-assessment
-> internal report handoff
```

不得注册 `fertility-report`。

```text
pptx
-> pptx-swarm reference
```

不得注册 `pptx-swarm`。

同理，Flow phase、renderer、validator、helper 不因有独立文件/模块成为 public Skill。

## 13. Canonical target frontmatter

```yaml
id: example-skill
displayName: 示例技能
description: ...
version: 1.0.0
publisher: Mira Lab
category: 工程研发
visibility: public
lifecycle: current

routing:
  aliases: [示例]
  intents: [example_task]

execution:
  mode: context-only
  workspaceBound: false
  requestedTools: []
  requestedRuntimes: []

completion:
  kind: parent-answer
```

当前 flat parser 暂时接受 `execution.agent`、`execution.allowedTools` 等兼容字段；这些字段不是目标 schema，也不能继续扩散。

## 14. Execution normalization

Discovery 必须保留合法的 `execution.mode`，不得静默将：

```text
context-only
-> delegated-worker
```

当前 resolver 对普通 Skill 一律 fork，是已知兼容实现，不应在 Scanner/Manifest 里伪装成 authoring 真相。

用户/untrusted package 默认：

```text
execution.mode = context-only
Capability Grant = empty
```

即使其 Markdown 声明 Tool/Runtime/script，也不获得执行能力。

## 15. Package inventory / build verification

Package inventory 应自动生成：

```text
path
kind
size
digest
license/provenance
```

Build 必须验证：

- SKILL.md 存在；
- schema 合法；
- declared resources 存在；
- scripts/digests 存在；
- packageFiles 与实际 package 一致；
- bundle 后 Scanner/Loader 可重新读取；
- missing required file -> lifecycle blocked。

Registry 手写 `packageFiles` 在自动 inventory 前不能作为完整真相。

## 16. Implementation anchors

```text
server/src/skills/context/scanner.ts
server/src/skills/context/loader.ts
server/src/skills/context/matcher.ts
server/src/skills/registry.ts
server/src/skills/user-skills.ts
server/src/skills/user-skill-migration.ts
```

## 17. Hard Rules

1. Canonical public layout 为 `<category>/<skill-id>/SKILL.md`。
2. 一个 package boundary 只产生一个 identity，不等于必须产生 Worker。
3. 非 built-in source package 必须 public + valid + lifecycle eligible。
4. Package 内部禁止递归发现 public Skill。
5. `_` / `.` 目录永不公开。
6. Flat system compatibility 仅限 explicit built-in。
7. Duplicate id fail closed，禁止 first-wins。
8. Root order 不是 identity/trust policy。
9. Origin 与 trust 必须分离。
10. user/external 不继承 private Runtime/Grant。
11. lifecycle 必须影响 Catalog/Matcher/execution。
12. internal handoff/helper/reference 不成为影子 Skill。
13. execution.mode 必须保留，不得静默强制 fork。
14. package inventory/digest 必须由 build 验证。
15. 前端隐藏不是安全边界；过滤和阻断发生在 Scanner/Registry/Matcher 之前。
