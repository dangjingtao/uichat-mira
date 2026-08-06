---
status: current
owner: skill-runtime / desktop
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillDiscovery
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-context-design.md
  - skill-package-runtime-contract.md
---

# Skill Discovery 与目录暴露合同

## 1. Purpose

本合同定义：

1. 哪个目录算一个可发现 Skill Package；
2. category 与 package boundary；
3. built-in / external / user 的优先级；
4. internal helper 如何在进入 Registry 前被过滤；
5. discovery 如何生成安全 execution manifest。

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

一个二级 Skill 目录对应：

```text
one Catalog item
one Registry Manifest
one primary match identity
one Skill-owned SubAgent profile
```

## 3. Package boundary

一旦目录存在：

```text
<skill-dir>/SKILL.md
```

该目录立即成为完整 package boundary。Scanner 不再向下把任何嵌套 `SKILL.md` 注册为顶级 Skill。

references / templates / examples / scripts / runtime 都属于同一 package，不是可独立匹配 Skill。

## 4. Public eligibility

```text
SKILL.md exists
!= Registry eligible
```

### Source/package roots

非 registered built-in 的源码 Skill 必须满足：

```text
<category>/<skill-id>/SKILL.md
+ visibility: public
```

### User root

用户新导入使用 canonical 两级目录。用户明确导入的 package 默认可发现；若声明：

```yaml
visibility: internal
visibility: private
visibility: hidden
```

则不得进入 Registry。

旧用户目录：

```text
<user-root>/<skill-id>/SKILL.md
```

仅保留 legacy read/migration compatibility，不作为新安装格式。

### Flat system compatibility

```text
<system-root>/<skill-id>/SKILL.md
```

只允许 `registry.ts` 明确登记的 built-in identity 使用。普通源码 Skill 不得靠平铺目录进入 Registry。

## 5. Reserved directories

以下目录永远不参与 discovery：

```text
.<anything>
_<anything>
```

内部 helper 推荐放入：

```text
<skills-root>/_internal/
```

即使内部文件写了 `visibility: public`，也不得绕过目录 gate。

## 6. Root priority 与身份保护

Scanner 按以下原则扫描：

```text
system / package roots
-> user root
```

同一 `id` 只接受第一个合法 Manifest。用户 package 不能通过复用 built-in / external id shadow 系统身份。

用户 root 下的 package 永远保持 `origin=user`，即使 id 与 built-in 相同；它不能继承 built-in metadata、private Runtime 或系统来源。

## 7. 当前 built-in inventory

`server/src/skills/registry.ts` 当前登记：

```text
docx
xlsx
pdf
pptx
github-collaboration
wechat-article-layout
```

其中：

- DOCX/XLSX/PDF/PPTX 当前允许 flat built-in compatibility；
- `github-collaboration` 同时存在分类目录 public package，并由同一 id 合并为一个 identity；
- `wechat-article-layout` 的 Registry 条目必须与实际 package 文件和构建分发持续对账，Registry 条目本身不替代 package existence 验证。

## 8. 当前分类目录 public Skill

已确认的分类 package 包括：

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

目录名 `development` 当前在展示层归一化为“工程研发”。目录仍是 discovery category 来源；展示归一化不能制造第二套 package identity。

## 9. Internal stage 不是新 Skill

### fertility report

```text
fertility-assessment
  -> internal report handoff
```

不得注册独立 public `fertility-report`。

### pptx swarm

长演示策略属于 `pptx` package 的 L2 Resource，不得注册独立 `pptx-swarm`。

## 10. Canonical frontmatter

公开源码 Skill 至少使用：

```yaml
id: example-skill
displayName: 示例技能
description: ...
version: 1.0.0
source: Mira Lab
category: 工程研发
visibility: public
```

需要 execution metadata 时统一使用：

```yaml
execution.agent: subAgent
execution.allowedTools: read_open, github_repository
execution.runtimeBindings: office_document
execution.workspaceBound: true
```

当前 Scanner 会统一把 discovered Skill 规范化为 `context=fork`、`agent=subAgent`。`executionContext` 不是 canonical 字段。

## 11. User Skill execution normalization

用户 package 即使声明 Tool/Runtime，也被规范化为：

```text
allowedTools = []
runtimeBindings = []
workspaceBound = false
```

Discovery 只确认 package identity，不授予 execution capability。

## 12. Implementation anchors

```text
server/src/skills/context/scanner.ts
server/src/skills/context/loader.ts
server/src/skills/context/matcher.ts
server/src/skills/registry.ts
server/src/skills/user-skills.ts
server/src/skills/user-skill-migration.ts
```

## 13. Hard Rules

1. Canonical public layout 是 `<category>/<skill-id>/SKILL.md`。
2. 一个 package boundary 只生成一个 Registry Manifest。
3. 非 built-in 源码 Skill 必须 `visibility: public`。
4. Package 内部不递归发现顶级 Skill。
5. `_` / `.` 目录永远不公开。
6. Flat system compatibility 只属于 registered built-in。
7. System/package roots 优先，user Skill 不能 shadow 系统 id。
8. User package 永远不继承 built-in capability。
9. Internal report / helper / swarm 不得变成第二个 public Skill。
10. 新 execution metadata 使用 `execution.*` canonical 字段。
11. Registry inventory 与实际 package/build 分发必须持续对账。
12. 前端隐藏不是安全边界；过滤必须发生在 Scanner -> Registry 之前。