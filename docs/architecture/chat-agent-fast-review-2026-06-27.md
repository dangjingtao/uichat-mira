# Chat / Agent 快速架构审查（2026-06-27）

Status: Current
Owner: chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentArchitectureReview
Doc Type: implementation-notes

## 单点真相范围

这份文档记录一次快速架构审查的结论，用来回答三件事：

- 当前聊天系统哪些设计应继续保留
- 哪些地方必须继续收口
- 哪些更大改动暂时不该现在做

它不是完整设计方案，而是当前阶段的决议页。

相关文档：

- [[uchat]]
- [[chat-tool-integration-checklist]]
- [[chat-execution-trace-design]]
- [[role/prompt-injection-design]]
- [[architecture/README]]

## 当前审查对象

本轮快审覆盖：

- 普通聊天
- RAG 聊天
- Agent request-only 注入
- Harness 内置工具接入
- execution trace
- 线程级 Role / Summary / Agent 上下文

## 保留

### 1. request-only 注入层

当前 `Role / Summary / Agent` 统一走线程级 request-only 注入层，这个方向正确，应继续保留。

原因：

- 避免把隐藏上下文混进可见消息
- 后续接 Memory / Preference / Tool policy 时有稳定落点
- provider adapter 不需要理解 Role 领域对象

### 2. 聊天层编排，执行层下沉

当前总体原则基本正确：

- chat 层负责路由和编排
- shared node 负责请求前上下文装配
- Harness 负责工具执行
- provider adapter 负责模型协议适配

这条边界应继续保留，不要把工具执行再塞回聊天 UI 或 provider adapter。

### 3. execution trace 统一方向

当前已经把 RAG trace 逐步提升为通用 execution trace，这个方向正确。

应继续坚持：

- tool
- request-only context
- RAG node
- 后续 memory / summary

都尽量走同一套 timeline，而不是继续分裂新 UI。

### 4. 可见消息与请求态分离

当前三层分离方向正确：

- 普通消息：user / assistant 可见内容
- request-only context：Role / Summary / Agent / 搜索预取
- trace：tool / rag / context 执行轨迹

这条边界必须继续保留。

## 要改

### 1. Agent runtime context 还不够结构化

当前 Agent 更多还是依赖一段自然语言提示词。

问题：

- 模型仍可能误判当前 OS / shell
- 容易继续生成 Linux 风格命令
- tool availability 只在逻辑上存在，没有完整体现在模型上下文中

结论：

- 必须继续把 `platform / shell / workspace / cwd / available tools` 收口为更稳定的 runtime context
- 不要只停留在“智能体模式已启用”的提示层

### 2. tool loop 收口还不够硬

当前工具链已可运行，但仍出现：

- 工具做完后未及时形成最终回答
- 多次连续工具调用后撞上 `Tool loop exceeded maximum step limit`

结论：

- 要继续区分：
  - 工具决策上下文
  - 工具执行结果上下文
  - 最终回答上下文
- 不能只靠粗粒度 step limit 收口

### 3. 聊天入口层仍偏重

`chat.routes.ts` 当前承担的职责仍偏多：

- 普通聊天 / RAG 分流
- request context 收集
- realtime search prefetch
- tool loop 触发
- 持久化流封装

结论：

- 现在先不大拆
- 但后续新增能力必须优先下沉到 orchestration / shared-node 层
- 不允许继续把新分支直接堆进 route handler

### 4. terminal capability 的平台适配仍需继续稳

当前已经确认：

- Windows shell 解析不能只写死 `powershell.exe`
- Agent 必须知道当前 shell 语义

但这只是第一步。

仍需继续补：

- shell resolver 的 fallback 策略
- persistent / ephemeral session 的命令语义说明
- chat 侧针对 Windows shell 的回归用例

## 暂缓

### 1. 现在不做聊天主链大重构

虽然入口编排已经偏厚，但当前项目节奏下，不适合立即做大规模架构重写。

结论：

- 先按现有骨架做增量收口
- 等 Memory / MCP / Planner 边界更稳定后，再决定是否抽统一 orchestration layer

### 2. 现在不强行统一整条 RAG 图和普通聊天图

当前更合理的做法是：

- 共用 shared nodes
- 共用 execution trace
- 共用工具执行面

但不必现在就强行把普通聊天和 RAG 合并成同一张总图。

### 3. 现在不把 request context 扩展成全量环境对象

虽然 Agent 需要更多执行环境信息，但 request-only context 不能无限膨胀。

结论：

- 只放模型决策真正需要的最小信息
- 不把完整 runtime snapshot 原样塞进 prompt

## 当前高风险点

- Agent prompt 仍有自然语言约束过强、结构信息不足的问题
- tool loop 对“该停止并总结回答”的判断还不稳定
- terminal runtime 的平台适配仍需要继续压测
- request context 类型有膨胀风险
- `chat.routes.ts` 若继续累积逻辑，后续维护成本会明显上升

## 当前建议优先级

1. 先修 tool loop 收口，让“工具完成后尽快输出最终回答”稳定下来
2. 再继续结构化 Agent runtime context
3. 然后把未来 Memory 接入同一套 request-only resolver
4. 最后再考虑更高层的 chat orchestration 抽象

## 进度表

| 序号 | 项目 | 状态 | 最新进展 |
| --- | --- | --- | --- |
| 1 | tool loop 收口 | 已完成（第一轮） | 超过工具步数后不再直接报 `max step`，改为强制进入一次“只总结、不再调工具”的最终回答阶段；已补单测验证 |
| 2 | Agent runtime context 结构化 | 已完成（第一轮） | 后端已统一构造最小 `executionEnvironment` contract，并把 `platform / shell / workspace / cwd / available tools` 注入到 Agent request-only 上下文；下一步再继续压缩 prompt 形态 |
| 3 | Memory 接入同一套 request-only resolver | 已完成（骨架） | 已新增独立 `Memory resolver`，并把注入顺序固定为 `Role -> Summary -> Memory -> Agent`；当前仅提供 request-only 插槽，尚未接入向量记忆数据源 |
| 4 | 更高层 chat orchestration 抽象 | 暂缓 | 当前仍以增量收口为主，不做主链大重构 |

## 一句话结论

当前聊天系统不是“架构方向错了”，而是“主骨架已基本正确，但入口编排、Agent runtime context 和 tool loop 收口还不够硬”。

所以当前阶段的正确策略是：

- 保留既有骨架
- 严控新增分支
- 继续做增量收口
