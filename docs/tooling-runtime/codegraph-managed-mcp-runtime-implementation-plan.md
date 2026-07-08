---
status: current
owner: docs
last_verified: 2026-07-09
layer: wiki
module: Tool
feature: CodeGraphManagedMcpRuntimeImplementationPlan
doc_type: implementation-plan
canonical: true
related:
  - README.md
  - codegraph-managed-mcp-spike.md
  - codebase-engine-abstraction.md
  - codegraph-wrapper-contract.md
  - harness-runtime-design.md
  - tools-protocol.md
  - ../project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md
  - ../project-control/project-control-ledger.md
---

# CodeGraph Managed MCP Runtime Implementation Plan

## Purpose

这页定义 CodeGraph 如果进入 UIChat Mira runtime，第一阶段应如何以 Managed MCP 形态托管、调用、包装、核验、降级和追踪。

这页是 implementation plan，不是 implementation。

T008 当前只做设计约束，不做 runtime 施工：

- 不接入 runtime
- 不启动 CodeGraph
- 不新增正式 MCP server
- 不写 CodeGraph 安装、启动、托管代码
- 不修改 Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence 主链

这页的输出只作为后续实现任务的设计约束。

后续真正施工必须另开任务卡，例如：

- `code_T009 CodeGraph Managed MCP Runtime Spike`
- `code_T010 CodeGraph Wrapper Runtime Implementation`
- `code_T011 CodeGraph Verification Bridge`
- `code_T012 CodeGraph Trace / Diagnostics`
- `code_T013 CodeGraph Controlled Planner Exposure`

## Stage Positioning

T003 解决的是“第一阶段优先用 Managed MCP process，而不是主进程 library embed”。

T007 解决的是“Planner 只能看到 `codebase_explore`，CodeGraph 原生命令只能藏在 wrapper 内部”。

T008 补的是二者之间真正进入 runtime 前必须先定清的 implementation plan：

- Managed MCP process 怎么托管
- wrapper 怎么挂接 provider
- query 结果怎么核验
- failure 怎么降级
- trace 怎么记
- 怎样避免污染 Agent Runtime 主链

因此这页不代表已经批准接入 runtime，只代表后续实现必须服从这些边界。

## Target Architecture

目标链路如下：

```text
Planner
  -> codebase_explore capability
  -> Harness capability / tool routing
  -> Codebase Explore Wrapper
  -> Managed MCP Client
  -> Managed CodeGraph MCP Process
  -> CodeGraph CLI / MCP internals
  -> normalized CodebaseExploreResult
  -> read_file_slice verification
  -> Evidence candidate / verified Evidence
```

必须固定以下规则：

- Planner 不直接调用 CodeGraph。
- CodeGraph MCP process 不直接写 Evidence。
- CodeGraph result 必须先经过 wrapper 标准化为 `CodebaseExploreResult`。
- 进入 Evidence 前必须经过 `read_file_slice` 或等价原文核验。

## Runtime Layering

`codebase_explore` 第一阶段至少分为四层：

### 1. Capability Exposure Layer

职责：

- 只暴露稳定能力名 `codebase_explore`
- 不暴露 provider 原生命令
- 不让 Planner 感知 `query` / `explore` / `affected`

### 2. Wrapper Layer

职责：

- scope inference
- query normalization
- internal command selection
- result trimming
- candidate normalization
- limitation annotation

这一层完全继承 T007 的 wrapper 合同。

### 3. Provider Layer

职责：

- Managed MCP client
- CodeGraph process manager
- provider status
- provider error mapping

这一层负责“能不能稳定调用”，不负责把结果直接变成 Evidence。

### 4. Verification Layer

职责：

- `followUpReads` generation
- `read_file_slice` verification
- candidate 到 verified evidence 的过渡
- rejected / unverifiable candidate handling

这一层负责“结果有没有被原文证实”，不能被 provider summary 替代。

## Scope And Wrapper Inheritance

runtime plan 完全继承 `code_T007` 的 wrapper 合同：

1. Planner 第一阶段只看到 `codebase_explore`
2. CodeGraph 原生命令 `query / explore / affected` 只能作为 wrapper 内部细节
3. wrapper 必须做 scope 选择
4. wrapper 必须加 include / exclude path
5. wrapper 必须做结果裁剪
6. wrapper 必须输出 `CodebaseExploreResult`
7. 所有 candidate 默认 `verification.required = true`
8. broad explore 不得裸交 Planner
9. CodeGraph 查询失败不得直接回答“没有”

因此后续 runtime 代码即使拆成多模块，也不能绕过这些合同。

## Managed MCP Process Plan

第一阶段推荐 Managed MCP Process，不推荐主进程 library embed。

Node 22.x Worker 只作为第二阶段候选，不在 T008 或 T009 直接采用。

推荐原因：

- 能把 CodeGraph 进程与 Agent Runtime 主链隔离
- 便于单独治理安装、启动、索引、日志、telemetry 和 crash recovery
- 失败时更容易降级到基础读取能力

CodeGraph process 崩溃不能影响 Agent Runtime 主链。

CodeGraph 不可用时，runtime 必须退回基础读取能力，而不是拖垮 Planner 或 Tool routing。

### Managed MCP Process Manager Responsibilities

后续实现必须设计 `ManagedMcpProcessManager`，至少包含以下职责：

1. install / detect
2. start
3. health check / MCP handshake
4. stop
5. restart
6. crash recovery
7. duplicate start guard
8. workspace switch
9. index stale detection
10. cleanup / uninstall

### Install / Detect

最小职责：

- 检测 binary 或 package 是否存在
- 检测版本信息是否可读
- 检测 checksum 或版本校验是否通过
- 检测 telemetry 关闭策略是否可配置
- 检测 app data 目录、日志目录、索引目录是否可用

如果 detect 失败：

- provider 状态进入 `unavailable` 或 `blocked`
- 不允许进入 `ready`
- 允许继续 Agent 主链，但只能走降级链

### Start

最小流程：

1. 校验 workspace 权限
2. 校验版本与 checksum
3. 校验 telemetry 关闭策略
4. 创建或确认日志目录与索引目录
5. 启动 Managed CodeGraph MCP process
6. 执行 MCP handshake
7. 根据索引状态进入 `indexing`、`ready` 或 `stale`

### Health Check / MCP Handshake

握手阶段至少要确认：

- 进程已启动
- MCP transport 可通信
- provider version 可读
- workspace 与索引目录绑定正确
- telemetry policy 已应用或已验证

任何一项失败都不能标记为 `ready`。

### Stop

要求：

- 先走正常退出
- 超时后才做强制终止
- 记录退出码、耗时、最后一次健康状态

### Restart

允许触发 restart 的典型情况：

- provider 配置变化
- workspace 切换
- 索引目录损坏
- handshake 失效
- 进程卡死但主链仍存活

### Crash Recovery

要求：

- 记录 crash time、exit code、stderr 摘要
- 进入 `degraded` 或 `failed`
- 限流自动重启，防止 crash loop
- 连续失败达到阈值后停止自动拉起
- 继续保留基础读取能力

### Duplicate Start Guard

同一 `workspaceHash + providerVersion + indexRoot` 只允许一个 manager 持有运行主权。

重复启动请求只能：

- 复用现有健康进程
- 或返回已运行状态

不允许并发拉起多个互相竞争的 CodeGraph 进程。

### Workspace Switch

切换 workspace 时必须：

- 停止继续使用旧 workspace 的索引
- 重新绑定新的 `workspaceHash`
- 重新评估索引是否存在、是否 stale
- 失败时退回基础读取能力

不允许使用错误 workspace 的旧索引回答新仓库问题。

### Index Stale Detection

至少要能识别：

- index 不存在
- workspace mismatch
- version mismatch
- index timestamp 明显落后
- include / exclude policy 变化后旧索引失效

`stale` 不等于 `failed`，但也不能继续当作高置信 provider。

### Cleanup / Uninstall

允许的清理范围：

- 未使用的版本目录
- 当前 workspace 对应的旧索引目录
- 超过保留上限的日志

不允许：

- 默认清空整个 app data
- 默认清理用户 repo
- 静默删除用户未确认的重要工作区数据

## Windows-Only Deployment Boundary

第一阶段明确按 Windows-only 本地桌面方案设计。

### Binary / Package Detection

必须记录：

- binary 或 package 的探测路径
- 当前启用版本
- binary 存在性
- manifest 是否可读

### Version Recording

至少记录：

- `providerVersion`
- build metadata
- expected MCP protocol version
- install source 或 manifest pointer

### Checksum Or Version Validation

启动前必须完成至少一种校验：

- checksum 校验
- 或带签名/版本锁的 manifest 校验

如果校验失败：

- provider 状态只能是 `unavailable` 或 `blocked`
- 不允许进入 `ready`

### App Data Directory Layout

建议目录形态：

```text
<app-data-root>/
  codegraph/
    versions/<version>/
    logs/
    indexes/<workspace-hash>/<version>/
```

必须说明：

- 安装目录在 app data 下
- 日志目录在 app data 下
- 索引目录在 app data 下
- 目录按 `workspace-hash` 和 `version` 隔离

### Repo Pollution Boundary

第一阶段不默认把索引写入用户 repo。

不允许：

- 默认索引用户 home
- 默认索引系统目录
- 默认索引其它 workspace
- 跨 workspace 复用错误索引
- 静默污染 repo

如果 CodeGraph 当前只能写 `.codegraph/`：

- 必须记为 Phase 1 风险
- 后续 wrapper / process manager 实现必须显式处理或显式提示用户
- 在风险未处理前，不应假装“已经满足不污染 repo”

## Telemetry Policy

telemetry 默认关闭。

启动前必须执行或验证关闭策略。

至少记录：

- telemetry status
- telemetry config path
- 是否成功关闭

如果无法验证 telemetry 已关闭：

- CodeGraph 状态只能是 `unavailable` 或 `blocked`
- 不能进入 `ready`

Trace / diagnostics 中应能看到 telemetry policy 状态，但不能暴露敏感路径之外的用户隐私内容。

## Permissions Boundary

必须明确以下边界：

1. CodeGraph 只能访问当前被 Harness 允许的 workspace。
2. CodeGraph 查询结果不能绕过 workspace path permission。
3. wrapper 需要复用或服从现有 workspace path validation。
4. 不允许索引系统目录、用户 home、其它项目目录。
5. 不允许用户未授权时自动启动索引。
6. 不允许 Agent 因为 CodeGraph 结果推断未授权文件内容。

CodeGraph 是增强 provider，不是权限豁免通道。

## Trace Plan

第一阶段必须预留结构化 trace 字段，至少包含：

- `capabilityId: codebase_explore`
- `provider: codegraph`
- `providerVersion`
- `runtimeShape: managed_mcp`
- `workspaceHash`
- `selectedScope`
- `includePaths`
- `excludePaths`
- `originalQuery`
- `normalizedQuery`
- `internalCommand: query / explore / affected / mixed`
- `resultCount`
- `truncated`
- `limitations`
- `fallbackUsed`
- `fallbackReason`
- `verificationRequired`
- `verificationReadCount`
- `status: ok / partial / degraded / failed`
- `durationMs`
- `indexStatus`
- `telemetryStatus`

必须明确：

- Trace 记录的是诊断摘要，不应塞入大量源码
- 原文摘录应由 `read_file_slice` / Evidence 管理
- CodeGraph raw output 不应完整进入 Trace，避免上下文和日志膨胀

## Evidence Plan

CodeGraph candidate 默认不能直接进入 Evidence。

接入规则如下：

1. CodeGraph candidate 只能先进入 Evidence 前候选事实池。
2. 只有经过 `read_file_slice` 或等价原文核验后，才能形成 `EvidenceItem`。
3. `EvidenceItem` 必须记录：
   - verified path
   - verified line range
   - minimal excerpt
   - verified summary
   - provider trace pointer
   - mismatch / rejected candidate if any
4. 如果原文核验失败：
   - candidate 标记为 `rejected` 或 `unverifiable`
   - 不得静默丢弃
   - 不得把 provider summary 当事实

CodeGraph MCP process 不直接写 Evidence。

## Failure Degradation Matrix

失败降级主链必须明确为：

```text
CodeGraph unavailable / failed / noisy / no line range
-> scoped search_text
-> workspace_inventory
-> read_file_slice if path known
-> guarded answer or continue planning
```

### Failure Scenarios

| Scenario | Runtime Status | Fallback Method | Trace Record | Allow Agent Mainline | Allow Evidence |
| --- | --- | --- | --- | --- | --- |
| CodeGraph 未安装 | `unavailable` | `search_text -> workspace_inventory -> read_file_slice` | `fallbackUsed=true`, `fallbackReason=provider_unavailable` | 允许 | 不允许 |
| telemetry 未能关闭 | `blocked` | `search_text -> workspace_inventory -> read_file_slice` | `telemetryStatus=blocked` | 允许 | 不允许 |
| MCP handshake 失败 | `failed` | `search_text -> workspace_inventory -> read_file_slice` | `status=failed`, `fallbackReason=handshake_failed` | 允许 | 不允许 |
| 索引不存在 | `indexing` 或 `stale` | `search_text -> workspace_inventory` | `indexStatus=missing` | 允许 | 不允许 |
| 索引 stale | `stale` | `search_text` 优先，必要时 `read_file_slice` | `indexStatus=stale` | 允许 | 仅核验后允许 |
| workspace mismatch | `failed` 或 `blocked` | `workspace_inventory -> search_text` | `fallbackReason=workspace_mismatch` | 允许 | 不允许 |
| CodeGraph 返回无 line range | `degraded` | `search_text` 定位行号，再 `read_file_slice` | `fallbackReason=no_line_range` | 允许 | 仅核验后允许 |
| broad explore 结果过噪 | `degraded` | 缩小 scope，必要时 `search_text` | `limitations` 标记 noisy result | 允许 | 不允许直接进入 |
| result 超过裁剪上限 | `partial` | 裁剪后继续；必要时 follow-up read | `truncated=true` | 允许 | 仅裁剪后候选再核验 |
| CodeGraph process crash | `degraded` 或 `failed` | `search_text -> workspace_inventory -> read_file_slice` | `fallbackReason=process_crash` | 允许 | 不允许 |
| path permission denied | `blocked` | `workspace_inventory` 说明权限边界 | `fallbackReason=path_permission_denied` | 允许 | 不允许 |
| candidate 原文核验失败 | `ok` 或 `degraded` | 拒绝 candidate，继续读其它候选 | `verificationRequired=true`, `status=partial` | 允许 | 不允许该 candidate 进入 |

这里的“允许 Agent 主链继续”意思是：可以继续规划或给出受保护回答，不等于可以把失败 provider 的摘要当成事实。

## Provider State Machine

后续实现必须定义以下 provider 状态：

### `unavailable`

含义：未安装、未检测到、版本不可用或基础探测失败。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：provider 不可用、原因摘要、可否安装

### `blocked`

含义：telemetry 未关闭、权限不满足、workspace 不允许、关键策略未满足。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：阻塞原因和解锁条件

### `installing`

含义：正在安装或准备 provider。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：安装中、当前步骤、失败可见

### `installed`

含义：安装完成，但尚未启动或尚未通过握手。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：已安装、待启动

### `starting`

含义：进程已拉起，正在做 health check / MCP handshake。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：启动中、握手中

### `indexing`

含义：provider 可运行，但索引尚未完成。

- 是否允许 query：谨慎，默认否或仅内部诊断
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：索引中、workspaceHash、版本、进度摘要

### `ready`

含义：握手通过、telemetry 已验证关闭、workspace 与索引状态都满足条件。

- 是否允许 query：是
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：是，但默认仍需核验
- 用户 / diagnostics 可见：ready、providerVersion、indexStatus、telemetryStatus

### `stale`

含义：索引可读，但 freshness 或 workspace/version 约束不满足。

- 是否允许 query：谨慎，默认只允许低信任探索
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：可以进候选池，但必须强制核验且默认低优先级
- 用户 / diagnostics 可见：stale 原因、建议重建索引

### `degraded`

含义：provider 部分可用，但结果噪声大、缺少 line range、刚经历 crash 恢复或部分子能力失效。

- 是否允许 query：有条件允许
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：仅限可核验候选
- 用户 / diagnostics 可见：degraded 原因、已触发的降级链

### `failed`

含义：启动、握手、查询或关键内部流程失败。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：失败摘要、最近错误、是否可重试

### `stopped`

含义：provider 已被显式停止。

- 是否允许 query：否
- 是否允许 fallback：是
- 是否允许进入 Evidence candidate pool：否
- 用户 / diagnostics 可见：已停止、是否可重新启动

## Follow-On Task Split

后续实现建议拆成以下任务，不在 T008 内实现：

### `code_T009 CodeGraph Managed MCP Runtime Spike`

范围：

- 只做最小 process manager + health check
- 不暴露给 Planner
- 不进入 Evidence

### `code_T010 Codebase Explore Wrapper Runtime`

范围：

- 实现 `codebase_explore` wrapper
- 只允许内部测试调用
- 不默认开启

### `code_T011 CodeGraph Verification Bridge`

范围：

- 串接 `followUpReads` + `read_file_slice` 原文核验
- 建立 candidate -> verified evidence 过渡

### `code_T012 CodeGraph Trace / Diagnostics`

范围：

- 补 trace 字段、状态面、失败诊断

### `code_T013 CodeGraph Controlled Planner Exposure`

范围：

- 在通过前面验证后，才允许 Planner 看到 `codebase_explore`

必须固定以下前后依赖：

- T009 之前不得让 Planner 看到 CodeGraph
- T011 之前不得把 CodeGraph candidate 接入 Evidence
- T013 之前不得默认启用给普通 Agent

## Out Of Scope

T008 当前明确不做：

- runtime 接入
- CodeGraph 启动
- 正式 MCP server 新增
- Planner 暴露面变更
- Evidence 接线实现
- CodeGraph wrapper runtime 代码
- CodeGraph 安装、启动、进程托管代码

因此这页只回答“后续该怎么做”，不回答“现在已经做到哪一步实现”。
