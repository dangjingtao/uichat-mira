---
id: control-room
displayName: Mira Control Room 运行观察
description: "查询 Mira 组织整体运行、仓库构建与发布、Cloudflare 部署、服务健康、治理和公开 Project，并判断异常、来源状态与数据新鲜度。"
version: 0.1.0
category: operations
visibility: public
source: Mira
status: review
execution.context: fork
execution.agent: subAgent
execution.allowedTools: mcp:mira-control-room:tool:get_overview, mcp:mira-control-room:tool:inspect_engineering, mcp:mira-control-room:tool:inspect_runtime, mcp:mira-control-room:tool:inspect_governance
execution.workspaceBound: false
---

# Mira Control Room Skill V1

这是 Mira 观察组织运行状态的 canonical Skill。

它只负责一件事：当用户想知道 Mira 现在是否正常、哪里异常、哪些仓库/服务/部署/治理项需要关注时，选择最小的 Control Room MCP 能力读取事实，并正确解释来源状态与数据新鲜度。

它不是 Control Room 的第二套数据模型，也不直接实现 GitHub、Cloudflare 或 HTTP 探测。真实数据仍来自 Control Room Public API 的同一只读投影。

## MCP 前提

本 Skill 依赖已配置并允许 Agent 使用的外部 MCP server：

```text
server id: mira-control-room
endpoint: https://uichat-mira-control-room.dangjingtao.workers.dev/mcp
```

对应 Harness projected capability：

```text
mcp:mira-control-room:tool:get_overview
mcp:mira-control-room:tool:inspect_engineering
mcp:mira-control-room:tool:inspect_runtime
mcp:mira-control-room:tool:inspect_governance
```

Skill 命中不代表 MCP 已连接、工具已暴露或权限已满足。若当前 ToolExposure 中没有所需 capability，应如实返回“Control Room MCP 未连接、未启用 Agent，或当前未暴露该能力”，不得改用猜测、网页搜索或另一套 GitHub/Cloudflare 查询冒充 Control Room 结果。

# 什么时候使用

适用于：

```text
Mira 现在整体正常吗？
看看 Control Room。
组织里现在有什么异常？
哪个仓库构建失败了？
Relay / 官网 / Control Room 哪个服务掉了？
最近 Cloudflare 部署和 24 小时请求怎么样？
哪些仓库默认分支没保护？
公开 Project 现在是什么状态？
```

不适用于：

```text
“这个仓库构建失败了，帮我修”
→ 这是具体工程施工，不是组织观察。

“把 Desktop 的 bug 修掉并提 PR”
→ 这是代码执行任务，不由 Control Room Skill 接管。

“读取私有仓库 / 私有 Project / secret”
→ Control Room 公共面不暴露这些数据。

“给我 30 天趋势”
→ V1 没有 D1 历史仓库，不能把 24h 或当前快照外推成长期趋势。
```

# 工具路由

默认选择能回答问题的最小工具，不要一上来调用 `get_overview`。

| 用户意图 | MCP 工具 | 参数 |
| --- | --- | --- |
| 真正跨域的全局状态、同时需要构建 + 服务 + Cloudflare | `get_overview` | 无 |
| 仓库清单 | `inspect_engineering` | `{ "view": "repositories" }` |
| 最新默认分支构建 / Release | `inspect_engineering` | `{ "view": "builds" }` |
| Workers / Pages 部署 | `inspect_engineering` | `{ "view": "deployments" }` |
| 服务在线状态与延迟 | `inspect_runtime` | `{ "view": "services" }` |
| Cloudflare 24h 请求 / 错误 | `inspect_runtime` | `{ "view": "analytics" }` |
| Issues / PR / 默认分支保护 / rulesets | `inspect_governance` | `{ "view": "governance" }` |
| 公开 GitHub Projects | `inspect_governance` | `{ "view": "projects" }` |

## `get_overview` 的使用门槛

只有用户问题确实跨越多个数据域时才使用：

```text
“Mira 现在整体怎么样？”
“告诉我今天哪里坏了。”
“给我当前 Control Room 总览。”
```

如果问题只问构建，不要顺手探测服务；只问治理，不要触发全局 overview。Control Room 的 focused read 本来就是为了避免无关探测和无意义消耗。

# 如何解释结果

## 1. `connected` 不等于“一切健康”

`connected` 只表示对应数据源读取成功。某个 build 仍可以失败，某个 service 仍可以 offline。

回答时要把“数据源可读”与“业务对象健康”分开。

## 2. `degraded` / `partial` / `unavailable` / `unconfigured`

```text
degraded
  数据源发生降级或上游失败，但 Control Room 可能仍保留可用投影或 stale snapshot。

partial
  只完成了部分字段或部分对象读取。不能把缺失字段当成正常。

unavailable
  当前无法取得该数据。必须说明未知，不能补猜。

unconfigured
  该来源没有配置。不能描述成“0 个资源”或“运行正常”。
```

`null`、缺字段和 `unknown` 不是 `false`，也不是 `0`。

## 3. 新鲜度

始终关注 payload 中的时间字段：

```text
generatedAt
analytics.from / analytics.to
lastPush / workflow timestamps / deployment timestamps
```

服务状态在 `get_overview` 或 `inspect_runtime { view: "services" }` 时是实时 HTTP probe；GitHub、Cloudflare 和 governance 使用各自缓存节奏。

不要把缓存快照称为“实时”，也不要因为数分钟前正常就保证现在仍正常。

## 4. 构建语义

Control Room 的 build 是每个公开仓库**最新默认分支 workflow run**。

它不代表：

- 所有 feature 分支；
- 所有 workflow；
- 本地构建；
- 尚未进入 GitHub Actions 的工作。

因此“Build passing”只能按这个边界解释。

## 5. Governance 语义

Governance 是公共安全投影，并且刷新节奏比核心工程事实慢。

- Issues / PR 数量来自公开仓库；
- branch protection / rulesets 读取失败时可能是 partial；
- Project 只暴露公开组织 Project；
- Project 是组织视图，不替代 Issue 作为工程事实 SSOT。

若 governance roster 与当前 repo roster 短暂不一致，应优先解释为缓存时差，再判断是否真有组织异常。

# 回答策略

## 没有明显异常

压缩回答，不重复整张仪表盘：

```text
当前没有发现明显运行异常。GitHub / Cloudflare 数据源可读，关键服务在线；数据时间为 <generatedAt>。
```

只补用户真正关心的 1–3 个指标。

## 有异常

按下面顺序给：

```text
异常事实
→ 影响对象 / 范围
→ 当前证据与时间
→ 数据源是否 connected / degraded / partial
→ 最小的下一步检查
```

不要仅因为发现异常就自动修改仓库、重跑 CI、改 Cloudflare、改 branch protection 或创建 Issue。本 Skill 是观察能力，不是修复能力。

# 失败与降级

MCP 调用失败时：

1. 保留准确的 capability / tool 名称；
2. 区分 MCP 未连接、tool 未暴露、HTTP 失败、Rate Limit、Control Room source degraded；
3. 若 `429`，遵守 `Retry-After`，不要高频重试；
4. 不并行轰炸四个工具来“碰运气”；
5. 现有成功结果若带 stale / degraded 标记，必须原样保留这个语义。

Control Room Public API 与 MCP 共用 public-read 限额，默认 `30 requests / 60 seconds / source IP`。不要用 MCP 与 REST 交替请求绕过配额。

# 完成标准

一次 Control Room 观察任务完成时，应满足：

```text
使用了最小足够的 MCP 工具
回答覆盖了用户真正问的数据域
异常与正常状态没有混淆
source status 被保留
时间 / freshness 被保留
unknown / null 没有被猜成正常
没有越权进入修复或写操作
```

如果证据不足，就明确说“当前 Control Room 无法确认”，而不是用常识填空。
