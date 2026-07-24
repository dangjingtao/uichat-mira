# Skill Discovery / Directory Exposure Contract

Status: Current
Protocol: V1 Settled
Owner: chat / runtime / desktop
Last verified: 2026-07-24
Layer: raw-source
Module: SKILL
Feature: SkillDiscovery
Doc Type: current-contract
Canonical: true
Related:
  - ./README.md
  - ./skill-context-design.md
  - ./skill-package-runtime-contract.md

## Purpose

本合同定义两件事：

1. **什么目录算一个用户可见 / Agent 可匹配的 Skill Package**；
2. **内部 helper / reference / script 如何保证不会因为存在 `SKILL.md` 而误入 `SkillRegistry`。**

Skill 的业务定义、渐进式披露和 Runtime 边界仍以 `README.md`、`skill-context-design.md`、`skill-package-runtime-contract.md` 为真相源。

---

## 1. Canonical 目录结构

新增 Skill 统一使用两级目录：

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

语义固定：

```text
一级目录 = category / 展示分组
二级目录 = 一个独立 Skill Package
```

因此：

> **一个二级 Skill 目录 = 一个 Catalog 卡片 = 一个可进入 SkillRegistry 的 Skill Manifest。**

对于 canonical 两级目录，一级目录名是分类真相源；`SKILL.md` 里的 `category` 只保留给旧平铺目录兼容。

---

## 2. Package boundary：发现 Skill 后禁止继续向下扫描

一旦 Scanner 在某个目录发现：

```text
<skill-dir>/SKILL.md
```

该目录立即成为完整 Skill Package boundary。

Scanner **不得继续递归扫描这个目录内部的任何 `SKILL.md`**。

例如：

```text
办公效率/
  pptx/
    SKILL.md                   <- 唯一 Skill：pptx
    references/
      pptx-swarm.md            <- Resource，不是 Skill
      internal-helper/
        SKILL.md               <- 即使存在，也不得注册为独立 Skill
```

这条规则直接防止：

- reference 被误显示成 Skill；
- helper 被 Agent Matcher 直接命中；
- scripts/runtime 内部说明污染 Catalog；
- 一个 Skill Package 因内部目录结构产生多个“幽灵 Skill”。

---

## 3. Public exposure gate

进入 `SkillRegistry` 就意味着该 Skill 可能同时进入：

```text
Skills Catalog
+
SkillMatcher / Agent SkillContext
```

因此：

```text
SKILL.md exists
!=
Registry eligible
```

### 用户安装目录

用户通过明确导入 / 安装动作写入：

```text
<user-skills-root>/<category>/<skill-id>/SKILL.md
```

默认视为 public，因为用户已经完成显式安装动作。

用户 Skill 若显式声明：

```yaml
visibility: internal
```

则必须阻断，不得进入 Registry。

### 系统 / 源码 Skill 根目录

新增系统 Skill 必须使用 canonical 两级目录，并满足：

```yaml
visibility: public
```

或属于 `registry.ts` 明确注册的 built-in。

没有 public eligibility 的系统 helper，不得仅因为存在 `SKILL.md` 自动进入 Registry。

---

## 4. Reserved / internal directories

以下目录名永远不参与 Skill discovery：

```text
.<anything>
_<anything>
```

推荐内部包放在：

```text
<skills-root>/_internal/<helper-id>/...
```

即使 `_internal` 下出现：

```text
SKILL.md
visibility: public
```

Scanner 仍必须忽略。

目录边界是第一道安全门，frontmatter 不能绕过目录边界。

---

## 5. Legacy compatibility

V1 为现有数据保留有限兼容，但**不允许继续新增平铺 Skill**。

### 旧用户安装包

```text
<user-skills-root>/<skill-id>/SKILL.md
```

继续可发现。

用户下一次编辑分类时迁移为：

```text
<user-skills-root>/<category>/<skill-id>/SKILL.md
```

迁移必须移动整个 Skill Package 目录，不能只移动 `SKILL.md`，避免丢失 references/templates/scripts。

### 旧系统 built-in

`registry.ts` 已明确注册的 built-in（DOCX / XLSX / PDF / PPTX）允许继续使用旧平铺结构：

```text
<system-skills-root>/<skill-id>/SKILL.md
```

### 旧系统用户可见 Skill

历史上已经存在一批平铺的用户可见 Skill，例如带完整展示信息的 Mira Lab Skill。

为避免本次安全修正把这些现有 Skill 一起隐藏，Scanner 只兼容满足以下完整公共 manifest 特征的旧平铺包：

```text
id
+ displayName/title
+ category
```

同时：

```yaml
visibility: internal
```

永远优先阻断。

这条兼容只用于旧数据迁移期。**新增系统 Skill 不得依赖该兼容规则，必须改用两级目录 + `visibility: public`。**

`pptx-swarm` 这类只有 `name + description` 的内部 helper 不满足旧公共 manifest 条件，因此不会进入 Registry。

---

## 6. PPTX / pptx-swarm 修正

`pptx-swarm` 不是独立用户 Skill。

正确语义：

```text
pptx
  SKILL.md
  reference/pptx-swarm.md
```

```text
普通 PPT
  -> primary Skill = pptx

20+ 页 / 多份 / 批量 PPT
  -> primary Skill 仍然 = pptx
  -> 按需披露 pptx-swarm reference
```

不得同时存在两个顶级可匹配 Skill：

```text
pptx
pptx-swarm
```

否则会造成 Catalog 重复、Matcher 竞争，以及内部执行策略绕过 `pptx` 主合同直接暴露给 Agent。

---

## 7. Agent exposure invariant

必须保持：

```text
Filesystem content
  != Public Skill

SKILL.md exists
  != Registry eligible

Registry eligible
  -> Catalog visible
  -> Matcher eligible
```

安全边界必须发生在：

```text
SkillScanner
  ↓ public eligibility
SkillRegistry
  ↓
Catalog + Matcher
```

**内部 Skill / helper 必须在进入 Registry 之前被过滤。**

禁止依赖前端隐藏卡片解决 Agent 暴露问题；前端隐藏不改变 `SkillMatcher` 的候选集合。

---

## 8. Current implementation anchors

- `server/src/skills/context/scanner.ts`
  - 两级目录发现；
  - Package boundary 不递归；
  - `_` / `.` internal directory exclusion；
  - system public eligibility gate；
  - legacy flat compatibility。
- `server/src/skills/user-skills.ts`
  - 新导入写入 `<category>/<skill-id>`；
  - 分类修改移动整个 package；
  - legacy user package 编辑时自然迁移。
- `server/src/skills/registry.ts`
  - 明确 built-in Skill 集合。
- `server/src/skills/context/provider.ts`
  - Agent 只从 `SkillRegistry.listAvailable()` 获取匹配候选。

---

## 9. Hard Rules

1. 新增公开 Skill 使用 `<category>/<skill-id>/SKILL.md`。
2. 一个二级 Skill 目录 = 一个 Catalog 卡片 = 一个 Registry Manifest。
3. Skill Package 内部禁止递归发现新的顶级 Skill。
4. reference/template/example/script/runtime 内部文件不得自动进入 Registry。
5. `_` / `.` 开头目录永远是非公开发现区域。
6. 新增系统源码 Skill 必须显式 `visibility: public` 或属于明确 built-in。
7. 旧平铺公共 manifest 兼容只用于迁移，不得作为新规范。
8. 用户显式安装的 Skill 默认 public，但 `visibility: internal` 必须优先阻断。
9. 前端隐藏不是安全边界；内部 Skill 必须在 Scanner -> Registry 之前过滤。
10. `pptx-swarm` 只能作为 `pptx` 的按需 reference，不得作为独立顶级 Skill。
