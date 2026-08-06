---
status: current
owner: skill-runtime / desktop / security
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillPackageLifecycle
doc_type: current-contract
canonical: true
related:
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-discovery-layout-contract.md
  - skill-package-runtime-contract.md
  - skill-context-design.md
---

# Skill Package、发布与执行生命周期合同

## 1. 四种生命周期必须分开

```text
Package existence
= package 文件是否存在且可验证

Publication lifecycle
= review | current | deprecated | blocked

User enablement
= enabled | disabled（仅产品支持时）

Execution readiness
= grant + route capability + environment + workspace 是否满足
```

禁止把它们压成一个 `installed/ready` 布尔值。

## 2. Catalog presence

```text
Catalog visible
= Package exists and presentation policy allows display
```

它不表示：

- Runtime ready；
- Grant active；
- 当前 route 可执行；
- 当前任务已激活；
- 用户已批准 side effect。

当前 Catalog 不是 Marketplace，不建立持续的：

```text
added / not-added
```

UI 不显示“已添加”Tab 或 Badge。

## 3. Publication lifecycle

```text
review
current
deprecated
blocked
```

### review

- package 正在开发/验收；
- 开发模式可展示；
- 生产普通 Matcher 不自动命中；
- 默认不执行，除非显式开发测试开关。

### current

- schema、routing、grant、安全、completion 与 package build 验收已通过；
- 可以进入普通 Matcher；
- 仍需按 route 检查 readiness。

### deprecated

- 不参与普通新任务匹配；
- 仅 explicit compatibility / continuation；
- UI 标记替代方案；
- 新 checkpoint 不应绑定 deprecated 版本，除非恢复旧任务所必需。

### blocked

- package 缺失、签名/摘要不合法、P0 安全问题、关键 route 不可诚实执行或被管理员禁用；
- 不进入 Matcher/Execution；
- 可以在诊断 UI 显示阻断原因。

当前代码尚未完整解析/gate lifecycle。`status: review` 当前可能只是装饰字段，这是已知不合规。

## 4. Origin 与 Trust

```text
origin
= built-in | bundled | user | external
```

Origin 说明来源，不是生命周期，也不是信任等级。

目标 trustTier：

```text
system
signed-first-party
user-authored
untrusted-third-party
```

规则：

- `origin=built-in` 不等于所有 route ready；
- `origin=external` 不得自动获得 private Runtime；
- publisher 文本不能提升 trust；
- package 更新导致 digest 变化时 Grant/签名重新验证。

## 5. Built-in / Bundled Package

```text
shipped Package
-> exists while product ships verified files
-> no user delete action
```

但它仍可能：

- lifecycle=review/blocked；
- Runtime Pack not-installed；
- binding pending；
- 某些 route disabled；
- environment health failed。

“随产品分发”不能替代 build/package verification。

## 6. User Package import

导入完成只表示：

```text
package files copied
+ schema / boundary validation passed
```

默认：

```text
trustTier = user-authored
Capability Grant = empty
execution responsibility = context-only unless governed binding exists
```

导入反馈使用“已导入”，不是持续“已添加”。

如果 manifest 无效、重复 id、资源缺失或 package boundary 不合法：

```text
import failed
或 lifecycle=blocked in quarantine
```

不得让半成品进入普通 Matcher。

## 7. User enable / disable

若产品提供：

```text
enabled
disabled
```

它只控制 package 是否参与用户侧 discovery/matching。

Disabled：

- 不等于 deleted；
- 不改变 origin/publisher；
- 不删除 Runtime Pack；
- 不保留 active execution；
- 已存在 checkpoint 的恢复需明确拒绝或要求重新启用。

## 8. User deletion

```text
Delete user Skill
-> cancel/block active package execution
-> physically delete whole managed package directory
-> invalidate Registry/Loader/Matcher cache
-> revoke package-specific Grant
```

不得：

- 只隐藏卡片；
- 只删 SKILL.md；
- 留下 scripts/references；
- 保留基于旧 digest 的 Grant。

删除 user Package 默认不删除共享 Runtime Pack，但必须删除该 package 的私有配置、Grant 与可恢复执行索引。

空 category 可以清理，但不得影响同分类其它 package。

## 9. Runtime Pack lifecycle

```text
not-required
not-installed
installing
available
broken
unknown
```

Runtime Pack 生命周期独立于 Package publication。

例如：

```text
xlsx package = current
wenshu-office = available
inspect route = eligible
XML create route = blocked because binding pending
```

这是合法状态。

## 10. Capability Grant lifecycle

Grant 至少区分：

```text
none
active
revoked
stale-package-digest
policy-blocked
```

Grant 绑定：

- package id/version/publisher/digest；
- Tool/Runtime ids；
- allowed routes；
- workspace/side-effect constraints；
- issuer；
- created/revoked time。

Package 更新、删除、publisher 变化或 signature 失效必须使 Grant stale/revoked。

## 11. Route execution readiness

每次执行重新计算：

```text
publication current
+ enabled
+ valid package digest
+ execution responsibility supported
+ active grant when needed
+ selected route requirements
+ adapter/environment health
+ workspace
+ Policy/Approval
```

Readiness 不是长期缓存的 Package 属性。

UI 可展示：

```text
可对话
可检查
可创建
可编辑
需安装依赖
等待能力接线
已阻断
```

不要只显示一个模糊的“可用”。

## 12. “去使用”语义

```text
Go use
-> validate lifecycle / package digest
-> resolve target route or entry surface
-> inspect Grant and runtime requirements
-> optionally prepare Runtime Pack
-> re-evaluate exact route readiness
-> enter Chat / MicroAPP
```

它不是：

- 添加 Package；
- 自动授予 private Runtime；
- 把 pending binding 标为 ready；
- 跳过 approval。

## 13. Active execution 与版本变化

Worker checkpoint / Flow session 必须绑定：

```text
skill id
skill version
package digest
runtime/flow version
```

Package 更新时：

- 新任务使用新 package；
- 旧 checkpoint 不能静默加载新正文/Grant；
- compatible migration 必须显式；
- 无 migration 时阻断恢复并说明原因。

Package deprecated/blocked/deleted 后，active session 的继续策略必须明确，禁止默默从头启动新版本。

## 14. UI contract

Skills 页面可以展示：

- 名称/描述；
- publisher/origin；
- lifecycle；
- enabled/disabled；
- trust/签名状态（适用时）；
- Runtime Pack 状态；
- route readiness；
- blocked reason。

操作：

```text
user package
-> 编辑
-> 启用/停用
-> 删除
-> 管理授权（未来）
-> 去使用

shipped package
-> 去使用
-> 准备 Runtime
-> 查看受支持 route
-> 不提供删除
```

## 15. API contract

Catalog list 保持轻量，但必须区分：

```text
lifecycle
origin
publisher
version/digest
runtime requirements
route readiness summary
blocked diagnostics
```

禁止返回一个混合语义的 `packageStatus=ready/installed`。

删除 API：

- 仅 user-managed package；
- 校验 package root；
- revoke Grant；
- invalidate cache；
- active session 有明确结果。

## 16. Hard Rules

1. Package existence、publication、enablement、Grant、Runtime 与 route readiness 分开。
2. Catalog visible 不等于 executable。
3. lifecycle 必须影响 Matcher/Execution。
4. review 不得在生产普通自动匹配。
5. blocked 不得执行。
6. Origin 不等于 trust。
7. User import 默认无 Capability Grant。
8. Delete 必须删除完整 package 并 revoke Grant。
9. Runtime Pack available 不等于 binding/route ready。
10. “去使用”不自动授权或伪造 readiness。
11. Package digest 变化使旧 Grant/checkpoint stale。
12. UI/API 禁止用一个 installed/ready 字段混合全部状态。
