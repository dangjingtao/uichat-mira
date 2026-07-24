# Skill Package Lifecycle Contract

Status: Current
Protocol: V1 Settled
Owner: chat / runtime / desktop
Last verified: 2026-07-24
Layer: raw-source
Module: SKILL
Feature: SkillPackageLifecycle
Doc Type: current-contract
Canonical: true
Related:
  - ./skill-discovery-layout-contract.md
  - ./skill-package-runtime-contract.md
  - ./skill-context-design.md

## Purpose

本合同定义 Skill Package 在 Skills 页面中的存在语义、用户导入 Skill 的删除语义，以及 built-in Skill 与 Runtime Pack 的生命周期边界。

## 1. Catalog presence is existence

进入当前 Skills Catalog 的 Skill Package 已经真实存在于 Mira 的 Skill 世界中。

因此：

```text
Catalog visible
= Skill Package exists
```

当前 Catalog 不是 Marketplace，不存在：

```text
visible but not added
```

所以 V1 不定义用户可见的：

```text
added / not-added
package installed / package not-installed
```

状态。

UI 不得显示：

```text
已添加
```

作为 Skill 卡片 Badge、详情 Badge 或筛选 Tab。

Skills 页面默认集合使用：

```text
全部技能
```

`packageStatus` 不属于 canonical Skill presentation API。

## 2. Origin is identity, not lifecycle state

Skill Package 只保留来源语义：

```text
origin = built-in | user | external
```

含义：

- `built-in`：随 Mira 产品分发的内置 Skill；
- `user`：位于受管用户 Skill 根目录中的用户导入 Skill；
- `external`：其它被允许发现的外部来源 Skill。

`origin` 不表示“是否添加”。

## 3. User Skill deletion

用户导入 Skill 的删除语义是：

```text
Delete Skill
-> physical delete whole Skill Package directory
```

例如：

```text
<user-skills-root>/内容创作/my-skill/
  SKILL.md
  references/
  scripts/
  templates/
```

删除 `my-skill` 必须物理删除整个：

```text
my-skill/
```

不能只：

- 从 Registry 隐藏；
- 标记 disabled；
- 删除 `SKILL.md` 而留下 resources；
- 保留一个“未添加”卡片。

删除后必须 invalidate Skill discovery/context cache，使它退出 Catalog 与 Agent Matcher 候选。

如果删除后 `<category>/` 已为空，可以删除空分类目录；不得删除仍包含其它 Skill 的分类目录。

用户 Skill 删除默认**不删除共享 Runtime Pack**。Skill Package 生命周期与 Runtime Pack 生命周期分离。

## 4. Built-in Skill lifecycle

Built-in Skill 是 Mira 产品内容：

```text
built-in Skill
-> always exists
-> always discoverable when product ships it
-> no delete action
```

因此不存在：

```text
删除 built-in Skill
卸载 built-in Skill Package
```

UI 不得为 `origin = built-in` 提供删除入口。

服务端删除 API 也必须拒绝非 `origin = user` 的 Skill。

## 5. Runtime dependency lifecycle is separate

Skill 可以声明：

```text
runtimeRequirements
```

例如：

```text
xlsx/pdf/pptx
-> wenshu-office@1.0.0
```

Runtime 状态独立表达：

```text
not-required
not-installed
available
broken
unknown
```

因此：

```text
built-in Skill visible
+ runtime not-installed
```

是完全合法状态。

用户点击「去使用」时，可以按需安装 Runtime Pack；这不改变 Skill Package 的“存在”状态。

Runtime Pack 卸载能力可以后续实现；在实现前不得用“卸载 Skill”代替这个概念。

## 6. UI contract

Skills 页面：

```text
全部技能
精选技能
<动态分类...>
```

卡片可展示：

```text
名称
来源
描述
Runtime 状态（仅有信息价值时）
```

不得展示统一的：

```text
已添加
```

因为所有当前可见 Skill 都已经存在。

详情操作：

```text
origin=user
  -> 编辑
  -> 删除
  -> 去使用

origin=built-in
  -> 去使用
  -> 按需准备 Runtime
  -> 不显示删除
```

导入完成后的动作反馈使用：

```text
已导入
```

而不是把“已添加”建模成持续状态。

## 7. Hard Rules

1. Catalog 可见即表示 Skill Package 已存在，不建立 `added/not-added` 展示状态。
2. canonical presentation API 不提供 `packageStatus`。
3. 用户 Skill 删除必须物理删除整个受管 Skill Package。
4. 最后一个 Skill 删除后允许清理空分类目录，但不得影响同分类其它 Skill。
5. 用户 Skill 删除不得隐式删除共享 Runtime Pack。
6. Built-in Skill 不可删除，也不存在“卸载 Skill Package”。
7. Runtime 安装/未来卸载只操作 Skill 声明的执行依赖，不改变 built-in Skill 卡片存在性。
8. UI 不显示“已添加”Tab 或 Badge。
9. 非 `origin=user` 的 Skill 必须被服务端删除 API 拒绝。
10. Runtime 卸载能力属于后续实现，不在本次合同中伪装完成。
