# Harness 评估与风控

Status: Current
Owner: runtime
Last verified: 2026-07-03
Layer: wiki
Module: Harness
Feature: HarnessAssessment
Doc Type: assessment

## 结论

当前 `Harness` 已经有可用主链，但还不能算功能完备。

更准确地说：

- 基座能力已经成型
- 主路径已经跑通
- 但审批持久化、会话级治理、replay、跨 workspace 调度仍未闭环

同时，当前风控策略偏保守，尤其是对命令行和外部 MCP 的处理。  
更好的方向不是单纯继续加严审批，而是：

- 以沙箱作为第一道控制
- 以 roots / scope 作为边界
- 以审批作为越界兜底

## 成熟度判断

### 已较成熟

- 统一注册入口已落地
- 统一 invocation / event / trace 机制已落地
- `read`、`edit_file`、`web_search`、`terminal_session` 都已接入 Harness
- `web_search` 已有后端持久化配置
- `terminal_session` 已支持 timeout、stdout / stderr、session reuse 和 trace spans

### 部分完成

- approval 已进入统一状态模型，但还不是完整的持久化 grant 编排
- `terminal_session` 的 ephemeral child-process 路径已接入 `SandboxExecutor v0.5`，persistent PTY 路径本期暂保留独立实现
- 外部 MCP 投影能力已有架构位点，但生态层未完全收口
- chat / agent 能消费 Harness，但还不是完全统一的一条执行链

### 未闭环

- thread / session 级 approval grant
- replay / 真正可重放执行
- 多 roots / 多 workspace / debug scope 联动
- 全量 trace UI
- 更细粒度风险分层

## 风控评估

当前规则里，命令行会被归为高风险，因为它的副作用是 `process`。  
这在安全上没错，但在产品上会偏硬：

- 很多命令其实可以在受限沙箱内安全运行
- 并不是所有 `process` 都应该默认强打断用户
- 如果沙箱足够强，审批只需要覆盖越界和敏感动作

## 外部 MCP 专门治理

外部 MCP 不能和内置工具按同一套默认规则处理。

原因不是它一定更危险，而是它有独立的治理面：

- 单独的 server 生命周期
- 单独的 transport
- 单独的 secret
- 单独的免责声明与安装记录
- 单独的 projected capability id

### 外部 MCP 的默认原则

- 默认不静默降级到内置工具
- 默认保留 server 级别审计
- 默认把未知副作用当成需要审批
- `stdio` 远端 capability 默认视为 `process`
- 外部 MCP capability 默认视为 `networkAccess: true`

### 外部 MCP 的治理维度

判断外部 MCP 风险时，除了通用维度，还要额外看：

- server 来源是 registry 还是手动安装
- transport 是 `streamable-http` 还是 `stdio`
- 是否已完成免责声明确认
- 是否已完成连接与 discover
- secret 是否已进入 backend 托管
- capability 是否已投影为本地 harness capability

### 外部 MCP 的建议策略

- 先做 server 级治理，再做 tool 级治理
- 审批默认跟随 capability 副作用和 transport 风险
- 发现结果必须保留 trace 对齐，不能只显示一个工具名
- external MCP 与 internal tool 分开展示、分开审计、分开治理

当前后端已经提供 server 级查询面，可直接读取单个 external MCP server 的治理信息，包括：

- transport 信息
- disclaimer 确认信息
- connection 状态
- remote server info
- remote capability summary
- discovered projected tools

当前代码状态下，这套外部 MCP 风险分层最少已经有回归测试覆盖以下事实：

- projected capability 保持 `domain: external_mcp`
- projected capability 保持 `source: external`
- projected capability 会携带 `mcp`、`external` 和 `serverId` 标签
- 默认能力画像仍按保守策略投影：
  - `sideEffect: network`
  - `requiresApproval: true`
  - `networkAccess: true`
  - `longRunning: true`

## 工具暴露策略

结论：**工具暴露给 LLM 的策略应作为 Harness 内部策略子域收口**，不继续散落在 chat、agent、route 里。

这里说的“工具暴露”不是执行本身，而是：

- 根据语境决定给模型看哪些工具
- 根据线程 / 角色 / 任务阶段收敛工具面
- 根据风险和可用性动态裁剪 allowlist
- 区分内置工具、外部 MCP、Agent 模式、普通聊天

### 为什么要收口

- 这个逻辑已经不是纯执行逻辑，而是“模型可见面”治理
- 如果继续散落在多个入口，规则会很快互相打架
- 工具注册、风险判定、上下文理解、模型可见面应该分层

### 这个策略子域应负责什么

- 输入：thread / role / agent flag / runtime environment / tool registry / risk metadata
- 输出：当前轮给 LLM 的工具集合
- 规则：可解释、可测试、可回放

### 这个策略子域不应负责什么

- 不执行工具
- 不维护 invocation 生命周期
- 不持有审批最终状态
- 不替代 Harness 的边界控制

### 当前决议

- Harness 继续作为执行与治理中枢
- 工具暴露策略作为 Harness 内部策略子域收口
- 外部 MCP 仍保留专门治理面
- Agent / chat 入口只消费模块输出，不自己拼工具面

当前代码里，这个“工具暴露策略子域”已经不是纯文档概念：

- chat 侧通过 `chat-tool-surface` 统一解析模型可见工具面
- 普通 chat 默认只暴露窄 allowlist
- agent 模式会放宽到内置工具集合
- external MCP projected tool 仍默认不进入普通 chat / agent 的直接可见面
- 这套裁剪规则现在已经有回归单测覆盖

### 当前新增契约

当前更推荐用下面三层来描述 Harness 输出，而不是继续混用：

- `CapabilityMatch`
- `ToolExposure`
- `Invocation`

其中：

- `CapabilityMatch` 是语义匹配结果
- `ToolExposure` 是当前轮暴露给 LLM 的候选工具面
- `Invocation` 是真正执行的工具调用

`preferredToolId` 当前明确只应被视为 hint：

- 可用于排序
- 可用于默认展示顺序
- 可用于 trace 解释
- 不可直接视为 executed tool

### 当前真相修正

前一阶段存在一条外层 route 级 `web_search` 预取旁路。  
这会绕过 Harness 暴露治理，属于越界实现。

当前这条旁路已删除：

- 默认 chat 入口不再在进入主回答前自行执行 `web_search`
- RAG 入口也不再在进入主回答前自行执行 `web_search`
- `web_search` 是否可见，应由 Harness 工具暴露治理决定
- 最终是否调用 `web_search`，应交给编排层

## 更合理的风控分层

### 1. 沙箱优先

先限制：

- 可访问的路径
- 可用环境变量
- 网络出站能力
- 进程生命周期
- 文件写入范围

### 当前决议

沙箱不应继续作为 Harness 内部的一个零散能力点推进，而应**独立成一个大模块**。

原因：

- 它承担的是跨平台执行边界
- 它需要自己的运行时抽象、策略、审计和适配层
- 它不仅服务于 terminal，还会影响 edit、外部 MCP、未来的执行型 capability

因此它的定位应当是：

- 独立模块
- 被 Harness 调用
- 不和 tool registry、invocation state、tool exposure 逻辑混在一起

### 2. roots / scopes 兜底

在授权 root 和 scope 内：

- 可以继续执行
- 但仍保留 trace 与 artifact 观察

### 3. 审批只处理越界与高敏动作

审批更适合用于：

- 逃出 root / sandbox
- 破坏性写入
- 明显高危外部副作用
- 不可收敛的长驻进程

## 当前审批语义真相

当前项目里，审批语义**已经进入 Harness 统一前置 gate**，不再只停留在 Agent 策略层。

这点需要说清楚，否则很容易继续按旧认知理解为“只有 Agent 才会拦截，direct invocation 还是直接执行”。

### 现在已经明确的部分

- `terminal_session` 视为高风险 `process`
- `edit_file` 视为高风险 `local-write`
- external MCP projected capability 默认按需审批处理
- Agent 在命中这些能力时，会稳定进入 `require_approval`
- direct MCP invocation 在命中这些能力时，也会先进入 `awaiting_approval`
- 普通 chat tool loop 在命中这些能力时，会把 `awaiting_approval` 显式向上游返回

### 现在还没完全闭环的部分

- “越出 root / sandbox 时进入审批” 还没有形成统一入口级 gate
- thread / session 级 approval grant 还没有收口成统一授权模型
- direct MCP route 还没有一套正式的 approval grant / resume API，而不是只返回等待态

### 当前判断

这不代表设计已经完成，但它说明**审批语义已经收口到统一执行面，剩下的是授权生命周期和恢复编排**。

因此 1 期文档应把它表述为：

- Agent 审批语义已明确
- tool 风险元数据已明确
- direct MCP invocation 统一审批 gate 已落地
- approval grant / resume 仍是后续收口项

## 风险判定表

| 对象 | 当前判定 | 说明 |
| --- | --- | --- |
| `read_*` | 低风险 | 只读、无副作用 |
| `web_search` | 中风险 | 网络访问，但当前允许自动使用 |
| `edit_file` | 高风险 | 本地写入，需要审批 |
| `terminal_session` | 高风险 | 进程执行，需要审批 |
| 外部 MCP `http` | 中到高风险 | 默认有网络副作用，未知能力需更谨慎 |
| 外部 MCP `stdio` | 高风险 | 默认视为 `process` |

### 判定维度

判断一个 tool 或 MCP capability 风险，不能只看名字，要看这几个维度：

- `sideEffect`
- `requiresApproval`
- 是否越出 root
- 是否越出 sandbox
- 是否需要网络
- 是否会写入本地
- 是否会拉起进程
- 是否是外部 MCP projected tool

其中：

- `sideEffect` 适合做初筛
- sandbox / root 才是最终边界
- approval 是兜底，不是唯一的风控手段

## 对命令行的判断

命令行不应简单地一刀切成“低风险”或“高风险”。

更准确的说法是：

- 裸命令行：高风险
- 沙箱内受限命令行：可控风险
- 越界命令行：高风险并需要审批

## 生命周期结束后的清理策略

生命周期结束后，不应该把所有中间产物一律清掉。

更合理的是分两类处理：

### 1. 要清理的东西

- 子进程
- PTY / terminal session
- 临时文件
- socket / 句柄
- 只服务于当前 invocation 的短期缓存

这类资源应在 invocation 结束、失败、取消或审批中断后尽快回收，避免资源泄漏和状态串扰。

### 2. 要保留的东西

- invocation record
- trace
- spans
- artifact
- error / approval 记录

这些属于审计和排障资产，尤其在失败场景下更不应该清掉。

### 3. 可选的延迟回收

对于较大的日志、文件或其他中间结果，可以再加一层 TTL / 配额策略：

- 普通调用短期保留
- 大对象截断或分段保留
- 敏感内容按策略脱敏或不落盘

## GC / Retention 现状

从代码角度看，当前 **已经有一套轻量 Harness retention 机制**，但还不是完整的后台 GC 系统。

现在实际存在的是：

- JS / V8 自带 GC
- 显式清理入口
- retention + sweeper
- 手动 reset / clear 逻辑

### 现有清理方式

- `terminal_session` 依赖 `removeTerminalSession` / `clearTerminalSessions`
- `invocation` 依赖 `clearInvocations`
- `trace` 依赖 `clearInvocationTraces`
- `agent run` 依赖 `agentRunStore.clear()`
- registry 依赖 `clearRegistry()`
- `invocationMap` / `traceMap` / `agentRunStore` 已补 `TTL + maxEntries + lazy sweep`

当前 retention 配置已接入后端统一配置入口：

- `UI_CHAT_HARNESS_RETENTION_MAX_ENTRIES`
- `UI_CHAT_HARNESS_RETENTION_TTL_MS`

### 当前问题

现在大量状态仍然挂在内存 `Map` 里：

- invocation record
- trace record
- agent run
- terminal session

虽然 retention 已经能压住无限累积，但还没有独立后台 sweeper、分级 TTL 和更细粒度的 artifact 策略。

### 建议

应该补的是 **有保留策略的资源回收**，不是“自动抹掉一切”。

推荐优先级：

- 短生命周期资源：自动清理
  - terminal session
  - 临时进程
  - 临时文件
  - 失败 / 取消后的会话句柄
- 审计资产：保留 + TTL
  - invocation record
  - trace
  - artifact
  - approval / error 记录
- 长寿命内存表：加 retention / sweeper
  - `invocationMap`
  - `traceMap`
  - `agentRunStore`

## 1期边界决议

### Persistent PTY

当前 1 期决议：

- ephemeral child-process 路径纳入 `SandboxExecutor v0.5`
- persistent PTY 路径继续保留现有独立实现
- 后续再决定是否把 persistent PTY 也并入 Sandbox 执行边界

这样做的原因是：

- 1 期先优先收口最容易失控的非持久进程执行面
- 避免在同一轮把 PTY 交互语义和 Sandbox 边界一起重写

### External MCP

当前 1 期决议：

- external MCP 继续保留专门治理
- 不在 1 期把 external MCP 的真实执行统一并入 `SandboxExecutor`
- 但其风险、审计、transport 和 projected capability 边界继续留在 Harness 真相内

这样做的原因是：

- external MCP 的问题不只是命令执行，还包括 server 生命周期、secret、transport 和 disclaimer
- 1 期应先稳住内置执行面，再推进 external MCP 与 Sandbox 的衔接

## 建议

Harness 未来的风控不要继续向“更严格审批”单向演进，而应改成：

- 更强沙箱
- 更清晰边界
- 更少默认打断
- 更强 trace 与审计

这样既能保安全，也不会把可用性压得太死。
