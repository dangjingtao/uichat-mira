---
status: current
owner: skill-runtime / desktop
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillPackageLifecycle
doc_type: current-contract
canonical: true
related:
  - skill-discovery-layout-contract.md
  - skill-package-runtime-contract.md
  - skill-context-design.md
---

# Skill Package 生命周期合同

## 1. Catalog presence is existence

进入当前 Skills Catalog 的 Skill Package 已经存在于 Mira 的 Skill 世界中：

```text
Catalog visible
= Skill Package exists
```

当前 Catalog 不是 Marketplace，不建立持续的：

```text
added / not-added
package installed / package not-installed
```

UI 不显示“已添加”Tab 或 Badge。

## 2. Origin 是身份，不是生命周期状态

```text
origin = built-in | user | external
```

- `built-in`：随产品分发；
- `user`：位于受管 user Skill root；
- `external`：其它允许发现的 package root。

Origin 不表示 Runtime ready，也不表示当前任务已经激活 Skill。

## 3. Built-in Skill

```text
built-in Package
-> product content
-> always exists when shipped
-> no delete action
```

Built-in Skill 可以存在且其 Runtime requirement 尚未满足。

## 4. User Skill deletion

用户删除 Skill：

```text
Delete Skill
-> physically delete the whole managed package directory
-> invalidate registry / loader / matcher caches
```

不得只删除 `SKILL.md`、隐藏 Registry 条目或留下 references/scripts 残骸。

删除空 package 后可以清理空 category 目录，但不得影响同分类其它 Skill。

删除 user Skill 默认不删除共享 Runtime Pack。

## 5. User Skill enable / disable

若产品提供 enable / disable，它只影响 user Package 是否参与 discovery / matching，不改变：

- 文件来源身份；
- Tool 权限；
- Runtime binding；
- 共享 Runtime Pack。

Disabled 不等于 deleted；UI 和 API 必须清楚区分。

## 6. Runtime lifecycle 独立

Skill 可声明：

```text
runtimeRequirements
```

Runtime Pack 状态：

```text
not-required
not-installed
installing
available
broken
unknown
```

Private binding 状态另行表达：

```text
ready
pending
unavailable
```

因此以下状态完全合法：

```text
built-in Package visible
+ Runtime Pack available
+ one required private binding pending
```

当前 XLSX 就存在这种情况：`wenshu-office` 可以存在，但 `wenshu_xlsx_xml_runtime` 仍为 pending。

## 7. “去使用”语义

```text
Go use
-> inspect runtimeRequirements
-> prepare missing Runtime Pack if needed
-> re-evaluate exact private binding readiness
-> enter Chat or MicroAPP surface
```

“去使用”不是添加 Package，也不能因为安装成功就把所有 binding 标为 ready。

## 8. UI contract

Skills 页面：

```text
全部技能
精选技能
<动态分类>
```

卡片可以展示：

- 名称；
- 来源；
- 描述；
- Runtime requirement / readiness（有信息价值时）。

详情操作：

```text
origin=user
  -> 编辑
  -> 启用 / 停用（若支持）
  -> 删除
  -> 去使用

origin=built-in
  -> 去使用
  -> 按需准备 Runtime
  -> 不显示删除
```

导入完成反馈使用“已导入”，不是持续“已添加”状态。

## 9. API contract

Canonical catalog API：

- list payload 保持轻量；
- `origin` 与 `runtimeRequirements` 分离；
- 不提供 `packageStatus=added`；
- detail 按需列 package files；
- file content 按需读取；
- 非 user origin 的删除请求必须拒绝。

## 10. Hard Rules

1. Catalog 可见表示 Package 存在，不表示 Runtime ready 或 Skill active。
2. Origin 是身份，不是 added / installed 状态。
3. Built-in Package 不可删除。
4. User Skill 删除必须物理删除完整受管目录。
5. Disabled 与 deleted 必须分开。
6. 删除 Package 不隐式删除共享 Runtime Pack。
7. Runtime Pack 状态与 private binding readiness 分开。
8. “去使用”只准备执行依赖，不改变 Package 存在语义。
9. UI 不显示统一“已添加”Badge。
10. Runtime 安装成功不能伪造 pending binding 为 ready。