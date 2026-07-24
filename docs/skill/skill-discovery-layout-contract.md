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

本合同定义：

1. 什么目录算一个用户可见 / Agent 可匹配的 Skill Package；
2. Skill 如何按分类组织；
3. internal helper / reference / script 如何保证不会误入 `SkillRegistry`。

## 1. Canonical 目录结构

新增和现有源码侧用户 Skill 统一使用：

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
一级目录 = category / 展示分组
二级目录 = 一个独立 Skill Package
```

因此：

> **一个二级 Skill 目录 = 一个 Catalog 卡片 = 一个 Registry Manifest。**

canonical 两级目录下，一级目录名是分类真相源。`SKILL.md` 中的 `category` 作为展示元数据保留，但不得制造另一套目录分类真相。

## 2. Package boundary

一旦 Scanner 在某个 Skill 目录发现：

```text
<skill-dir>/SKILL.md
```

该目录立即成为完整 Skill Package boundary，Scanner 不得继续把其内部任何 `SKILL.md` 注册成新的顶级 Skill。

例如：

```text
办公效率/
  pptx/
    SKILL.md                  <- 唯一 Skill：pptx
    reference/
      pptx-swarm.md           <- Resource，不是 Skill
      internal-helper/
        SKILL.md              <- 即使存在，也不得成为独立 Skill
```

这条边界防止：

- reference/helper 误显示成 Skill；
- internal helper 被 Agent Matcher 直接命中；
- scripts/runtime 说明文件污染 Catalog；
- 一个 Package 因内部目录产生多个“幽灵 Skill”。

## 3. Public exposure gate

进入 `SkillRegistry` 意味着该 Skill 可能同时进入：

```text
Skills Catalog
+
SkillMatcher / Agent SkillContext
```

必须保持：

```text
SKILL.md exists != Registry eligible
```

### 源码侧 Skill

非 built-in 的源码 Skill 必须同时满足：

```text
<category>/<skill-id>/SKILL.md
+
visibility: public
```

源码根目录下的平铺包：

```text
<skills-root>/<skill-id>/SKILL.md
```

只允许 `registry.ts` 明确注册的 built-in Skill 使用兼容路径。

**普通源码用户 Skill 不再允许通过平铺目录或“完整 manifest 看起来像公开 Skill”进入 Registry。**

### 用户安装目录

新导入统一写入：

```text
<user-skills-root>/<category>/<skill-id>/SKILL.md
```

用户明确导入的 Skill 默认 public；若 frontmatter 显式声明：

```yaml
visibility: internal
```

或 `private / hidden`，则不得进入 Registry。

旧版本已经存在的：

```text
<user-skills-root>/<skill-id>/SKILL.md
```

仅保留本地升级兼容读取，不作为新安装格式。编辑/迁移时必须整体移动 Package 到 canonical 两级目录，references/templates/scripts 一并迁移。

## 4. Reserved / internal directories

以下一级或二级目录名永远不参与 Skill discovery：

```text
.<anything>
_<anything>
```

推荐内部包统一放：

```text
<skills-root>/_internal/<helper-id>/...
```

即使内部文件写了 `visibility: public`，也不得绕过目录边界进入 Registry。

## 5. 当前源码 Skill 迁移状态

2026-07-24 已将现有非 built-in 用户可见源码 Skill 迁入 canonical 两级目录：

```text
内容创作/
  black-mirror-writer/
  deep-interview/

工程研发/
  product-critic/

健康/
  fertility-assessment/
```

这些 Skill 的公开 manifest 均显式声明：

```yaml
visibility: public
```

`fertility-assessment` 的报告生成属于同一个 Skill 的内部阶段：

```text
健康/fertility-assessment/
  SKILL.md
  references/
    assessment-framework.md
    report-contract.md
```

不得再创建独立公开 `fertility-report` Skill。

## 6. Built-in 兼容边界

当前明确 built-in：

```text
docx
xlsx
pdf
pptx
```

它们由 `registry.ts` 明确注册，因此 V1 允许暂时保留源码根目录平铺结构。

该兼容只属于明确 built-in，不扩展给普通用户 Skill 或 helper。

## 7. PPTX / pptx-swarm

`pptx-swarm` 不是独立用户 Skill。

正确结构：

```text
pptx/
  SKILL.md
  reference/
    pptx-swarm.md
```

普通 PPT 与 20+ 页 / 多份 / 批量 PPT 都保持：

```text
primary Skill = pptx
```

需要长演示策略时按需披露 `pptx-swarm` reference。

不得同时存在两个顶级可匹配 Skill：

```text
pptx
pptx-swarm
```

## 8. Agent exposure invariant

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

安全边界发生在：

```text
SkillScanner
  ↓ layout + public eligibility
SkillRegistry
  ↓
Catalog + Matcher
```

**内部 Skill / helper 必须在进入 Registry 之前被过滤。**

禁止依赖前端隐藏卡片解决 Agent 暴露问题；前端隐藏不会改变 `SkillMatcher` 候选集合。

## 9. Current implementation anchors

- `server/src/skills/context/scanner.ts`
  - canonical 两级目录发现；
  - Package boundary 不递归；
  - `_` / `.` internal directory exclusion；
  - source public eligibility gate；
  - 仅 built-in + legacy user install 保留 flat compatibility。
- `server/src/skills/user-skills.ts`
  - 新导入写入 `<category>/<skill-id>`；
  - 分类修改移动整个 package；
  - legacy 本地用户包编辑时迁移。
- `server/src/skills/registry.ts`
  - 明确 built-in Skill 集合。
- `server/src/skills/context/provider.ts`
  - Agent 只从 `SkillRegistry.listAvailable()` 获取匹配候选。

## 10. Hard Rules

1. 源码用户 Skill 必须使用 `<category>/<skill-id>/SKILL.md`。
2. 一个二级 Skill 目录 = 一个 Catalog 卡片 = 一个 Registry Manifest。
3. 源码非 built-in Skill 必须显式 `visibility: public` 才能进入 Registry。
4. Skill Package 内部禁止递归发现新的顶级 Skill。
5. reference/template/example/script/runtime 内部文件不得自动进入 Registry。
6. `_` / `.` 开头目录永远是非公开发现区域。
7. 源码平铺兼容只属于 `registry.ts` 明确 built-in。
8. 用户新安装 Skill 必须写入 `<user-skills-root>/<category>/<skill-id>`。
9. 用户 `visibility: internal/private/hidden` 必须优先阻断。
10. 前端隐藏不是安全边界；内部 Skill 必须在 Scanner -> Registry 之前过滤。
11. `pptx-swarm` 只能作为 `pptx` 的按需 reference。
12. `fertility-report` 只能作为 `fertility-assessment` 的内部报告阶段，不得作为独立公开 Skill。
