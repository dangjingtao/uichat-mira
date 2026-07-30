---
status: planned
owner: docs
last_verified: 2026-07-08
layer: wiki
module: Tool
feature: CodeGraphManagedMcpSpike
doc_type: design
canonical: true
related:
  - README.md
  - codebase-understanding-consensus.md
  - codebase-engine-benchmark.md
  - ../harness/README.md
  - ../project-control/tasks/code_T003-codegraph-managed-mcp-spike.md
  - ../project-control/reviews/codebase-understanding-docs-review-index.md
---

# CodeGraph Managed MCP Spike

## Purpose

这页定义 CodeGraph 进入实现前的 Managed MCP spike 设计。

当前阶段只做设计，不做实现：

- 不安装 CodeGraph
- 不新增 MCP server 运行时代码
- 不修改 Agent Runtime、Harness、Planner、Normalize、Policy、ToolNode、Evidence
- 不修改 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`
- 不修改 `package.json` 或 `pnpm-lock.yaml`

目标不是立刻把 CodeGraph 接进主链，而是先把“第一阶段应该怎么部署、怎么管控、怎么和现有基础能力共存”说清楚。

## Deployment Shapes

### Option A: Managed MCP Server

形态：

- 由当前应用自己的 backend / harness 管理一个外部 CodeGraph MCP 进程
- CodeGraph 作为独立 binary 或独立可执行目录存在
- 当前运行时通过 MCP client 与它通信

优点：

- 与当前桌面应用进程边界最清晰
- 便于单独管理启动、停止、重启、日志和索引目录
- 便于把权限、workspace 白名单和 telemetry 策略集中挂在 Harness 外围
- 失败时最容易回退到 `workspace_inventory`、`search_text`、`read_file_slice`

缺点：

- 需要额外进程管理
- 首次安装、版本目录和状态检测需要明确方案
- MCP 握手和索引预热会增加一层启动复杂度

### Option B: Independent Node 22.x Worker

形态：

- 单独起一个 Node 22.x worker 或 sidecar 服务
- CodeGraph 运行在该 worker 进程内，再由 worker 向当前应用暴露协议

优点：

- 如果 CodeGraph 后续强依赖某个 Node 版本，隔离更直接
- 便于后续扩展多 provider 适配层
- 可以把索引任务、watcher、重试策略放在 worker 内部消化

缺点：

- 第一阶段复杂度明显高于 Managed MCP server
- 会引入额外 Node runtime 维护、进程桥接和版本治理
- Windows 打包、诊断和崩溃定位成本更高

### Option C: Main Process Library Embed

形态：

- 直接把 CodeGraph library 嵌入主进程或 backend 进程
- 应用自己负责索引、查询和资源生命周期

优点：

- 理论上少一层进程通信
- 调用链看起来更短

缺点：

- 把第三方代码索引生命周期直接耦合进主进程，风险最大
- 崩溃、泄漏、watcher 阻断、长路径和 telemetry 行为更难隔离
- 第一阶段一旦判断错误，回退成本最高
- 不符合当前阶段“先隔离、再评估、再抽象”的节奏

## Comparison Summary

| Shape | Phase 1 Suitability | Isolation | Windows Packaging Burden | Runtime Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Managed MCP server | 高 | 高 | 中 | 低到中 | 第一阶段推荐 |
| Independent Node 22.x Worker | 中 | 高 | 高 | 中 | 第二阶段再考虑 |
| Main process library embed | 低 | 低 | 中到高 | 高 | 第一阶段不建议 |

## Recommendation

当前建议分两阶段：

### Phase 1

优先采用 Managed MCP server。

原因：

- 最符合当前仓库已经建立的 Harness / MCP 边界。
- 方便把 CodeGraph 视为“强能力候选工具”，而不是运行时主控层。
- 便于把失败影响控制在单独进程，不污染主进程和 Agent 主链。
- 更容易保留现有 `read/search` 基础能力作为原文核验和降级底座。

### Phase 2

如果后续 benchmark 和第一阶段落地都证明：

- Windows 稳定性可接受
- 启动和索引耗时可接受
- MCP 进程治理成本过高
- 需要更强的 provider 扩展能力

再评估独立 Node 22.x Worker。

### Not Recommended In Phase 1

第一阶段不建议直接嵌入主进程 library。

原因不是“绝对做不到”，而是：

- 失败影响面过大
- 生命周期与资源治理复杂
- 不利于快速撤回
- 与当前 docs-only 阶段先行确认边界的目标冲突

## Windows-Only Deployment Plan

第一阶段按 Windows 本地桌面形态设计。

### Binary Layout

建议目录：

```text
<app-data-root>/
  codegraph/
    versions/
      <version>/
        codegraph.exe
        manifest.json
        checksum.sha256
    current -> versions/<version>   # 若 Windows 端不稳定，可改为 manifest 指针文件
    logs/
    indexes/
```

如果 Windows 环境下符号链接不稳定，则不要依赖 `current` symlink，改用：

- `current.json` 记录当前启用版本目录
- backend 读取 manifest 决定启动路径

### Version Directory

每个版本目录至少保存：

- `codegraph.exe` 或等价二进制
- `manifest.json`
- `checksum.sha256`
- 可选默认配置模板

`manifest.json` 至少记录：

- version
- build date
- supported protocol version
- default startup args
- checksum file name

### Checksum

每次安装或升级都要核对 checksum。

最低要求：

- 安装前校验下载包 checksum
- 解压后校验目标 binary checksum
- 启动前如 manifest 与 binary 不一致，拒绝启动并上报状态

### Startup Args

第一阶段建议显式传入：

- `--workspace <workspaceRoot>`
- `--index-path <indexRoot>`
- `--log-path <logFile>`
- `--telemetry=0`，如果上游支持

如果上游没有 `--telemetry=0` 参数，则必须通过环境变量关闭 telemetry。

### Environment Variables

建议只传最小白名单环境变量，不透传完整宿主环境。

最低要求：

- `CODEGRAPH_TELEMETRY=0`
- `CODEGRAPH_WORKSPACE_ROOT=<workspaceRoot>`
- `CODEGRAPH_INDEX_ROOT=<indexRoot>`
- `CODEGRAPH_LOG_ROOT=<logRoot>`

如果上游使用等价环境变量名，也必须在本地设计文档里明确映射关系。

### Log Path

建议目录：

```text
<app-data-root>/codegraph/logs/
  codegraph-stdout.log
  codegraph-stderr.log
  codegraph-manager.log
```

最低要求：

- 区分 stdout / stderr / manager 侧日志
- 单文件达到阈值后滚动
- 日志保留按数量或总大小裁剪
- 日志路径不写入 workspace 目录

### Index Path

建议目录：

```text
<app-data-root>/codegraph/indexes/
  <workspace-hash>/
    <codegraph-version>/
```

原因：

- 避免把索引产物写进业务仓库
- 避免多个 workspace 互相污染
- 便于按 workspace 和版本清理

### Uninstall / Cleanup

卸载或清理策略至少包括：

- 删除未使用版本目录
- 删除对应 workspace hash 下的索引目录
- 删除超过保留上限的日志
- 如果进程仍在运行，先停止再清理

禁止做法：

- 把索引写回仓库源码目录
- 无确认地清空整个 app data 根目录

## Process Lifecycle

### Install / Detect

启动前先检测：

- binary 是否存在
- checksum 是否匹配
- manifest 是否可读
- 版本是否受当前运行时允许

如果检测失败：

- 不进入图谱调用
- 状态上报为 `unavailable`
- 保留 `workspace_inventory`、`search_text`、`read_file_slice`

### Start

启动步骤建议：

1. 校验 workspaceRoot 和 indexRoot
2. 校验 binary / manifest / checksum
3. 创建日志目录
4. 传入最小参数与环境变量启动进程
5. 等待 health 或 MCP handshake 成功
6. 成功后状态上报为 `ready`

### Stop

停止时要求：

- 先发正常退出信号
- 超时后再做强制终止
- 记录退出码、耗时和最后状态

### Restart

以下情况允许重启：

- 版本切换
- 配置变更
- index 路径损坏
- 进程无响应

重启前必须避免并发重复启动。

### Crash Recovery

如果进程崩溃：

- 记录 crash time、exit code、stderr 摘要
- 状态切到 `degraded`
- 限流重启，避免 crash loop
- 连续失败达到阈值后停止自动重启
- 回退到基础读取能力

### Index Interruption

如果索引中断：

- 保留部分进度状态
- 明确区分 `indexing`、`ready`、`failed`、`stale`
- 不中断基础 `read/search`
- 不把半成品索引结果伪装成可用 Evidence

### Duplicate Start Guard

必须有重复启动保护：

- 同一 `workspace + version + indexRoot` 只允许一个 manager 持有运行主权
- 第二次启动请求只能复用现有进程或返回已运行状态

### Workspace Switch

workspace 切换时：

- 旧 workspace 查询应停止继续复用错误索引
- 新 workspace 应绑定新的 `workspace-hash` 索引目录
- 切换期间状态可短暂进入 `switching`
- 切换失败时回到基础读取能力，而不是继续使用旧索引回答新仓库问题

### Log Collection

需要采集：

- manager 侧启动日志
- CodeGraph stdout / stderr
- 最后一条失败摘要
- 最近一次索引状态

### Status Reporting

建议最小状态集合：

- `unavailable`
- `installing`
- `starting`
- `indexing`
- `ready`
- `stale`
- `degraded`
- `failed`
- `stopped`

这些状态最终应能被 Harness diagnostics、调试面板或 trace 查询消费。

## Telemetry Policy

telemetry 默认关闭。

第一阶段最小要求：

- 进程启动时强制设置 `CODEGRAPH_TELEMETRY=0`
- 如果上游还有其他 telemetry 开关，也要显式关闭
- 文档、日志和状态页都要能看出 telemetry 是关闭态

没有明确关闭策略前，不应进入实现。

## Workspace Permission Boundary

CodeGraph 只能索引当前被 Harness 允许的 workspace。

最低边界：

- 只允许当前 workspace root
- 不允许跨 workspace 读取
- 不允许通过索引结果绕过现有路径权限
- 不允许把用户 home、系统目录或其他仓库默认纳入索引

图谱能力是增强层，不是权限豁免层。

## Exclusion Rules

第一阶段建议默认排除：

- `node_modules/`
- `.git/`
- `release/`
- `.artifacts/`
- `.test-artifact/`
- 大型二进制目录
- 构建产物目录

是否排除 `dist/`、`coverage/`、临时缓存目录，应由 workspace policy 明确给出。

排除规则必须：

- 可观测
- 可解释
- 可复现

不能让 Agent 在不知道排除规则的情况下，把“没索引到”误判成“仓库没有”。

## Source Verification Rule

CodeGraph 返回结果默认只是候选事实，不是最终 Evidence。

进入 Evidence 前必须满足：

1. 有 source path
2. 有 line range 或可映射到原文范围
3. 能回到 `read_file_slice` 或同等原文读取能力
4. 原文核验通过

如果图谱结果无法回到原文，就只能作为探索线索，不能作为已证实结论。

## Non-Removable Baseline Tools

无论是否接入 CodeGraph，以下能力都不可删除：

- `workspace_inventory`
- `search_text`
- `read_file_slice`

CodeGraph 只能增强它们，不能替换它们。

原因：

- 原文核验依赖它们
- CodeGraph 不可用时需要降级
- 索引中断、结果无行号、权限不足时需要兜回真实文件读取

## Trace And Evidence Integration

第一阶段至少预留两个接入点。

### Trace

Trace 侧至少记录：

- 是否调用 CodeGraph
- provider / version
- workspace hash
- 查询类型
- 返回结果数量
- 是否触发原文核验
- 是否触发降级
- 失败摘要

### Evidence

Evidence 侧只接收经过原文核验的结果。

建议保存：

- verified source path
- verified line range
- 与任务相关的最小必要摘录
- 图谱结论与原文结论是否一致
- 如果不一致，记录为 rejected candidate，而不是静默覆盖

## Phase 1 Success Bar

只有同时满足以下条件，才适合把 Managed MCP server 进入实现任务：

- benchmark 证明 CodeGraph 对真实仓库问题有明显增益
- Windows 本地启动、索引、停止、重启可控
- telemetry 可明确关闭
- workspace 权限和排除规则能被 Harness 管住
- Trace / Evidence / 原文核验路径说得清
- `workspace_inventory`、`search_text`、`read_file_slice` 保持可用

## Out Of Scope

这页明确不做：

- 直接给 Planner 暴露 CodeGraph 原生接口
- 让图谱结果绕过原文核验直接进入 Evidence
- 第一阶段就切主进程嵌入
- 第一阶段就强制引入独立 Node 22.x worker
- 修改当前 MCP runtime、server 启动链、Agent Graph 主链
