# SKILL 模块总纲

Status: Current
Owner: chat / runtime / docs
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillSystem
Doc Type: overview
Canonical: true
Related:
  - ../tooling-runtime/read-skill-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../chat/agent-runtime-design.md
  - ./skill-memory-poc.md
  - ./catalog/README.md
  - ./roadmap.md

## 单点真相范围

这页只回答一件事：

当前项目语境里，`SKILL` 到底是什么，它和 `Tool`、`MCP`、`MicroAPP`、`Memory` 的边界是什么。

它覆盖：

- `SKILL` 的正式产品定义
- `SKILL` 与 `Tool / MCP / MicroAPP / Memory` 的边界
- 当前项目为什么适合先做 `SKILL`
- `SKILL` 在当前代码结构里的挂载点

它不覆盖：

- 某个具体 skill 的完整提示词
- 某个外部平台的接入细节
- durable memory 的最终数据模型

## 结论先说

`SKILL` 不是：

- 一个外部 MCP server
- 一个 Harness tool
- 一个企业集成微应用
- 一个直接暴露给用户的插件市场条目

`SKILL` 是：

> 一段可复用、可观察、可组合的工作动作定义。

它解决的是：

- 什么时候做一次工作动作
- 动作读取哪些上下文
- 动作写回什么结果
- 结果是否进入后续上下文

## 和相邻模块的边界

### `SKILL` vs `Tool`

`Tool` 是执行器。

例如：

- `read_open`
- `read_locate`
- `web_search`
- `terminal_session`

`SKILL` 不是直接执行器，而是：

- 对一个任务动作的编排定义
- 决定是否需要调用一个或多个 tool
- 决定执行后如何整理结果

一句话：

- `Tool` 回答“怎么执行”
- `SKILL` 回答“为什么现在要做这步，以及结果怎么沉淀”

### `SKILL` vs `MCP`

`MCP` 是能力暴露和接入协议。

它解决：

- 外部 server 怎么被发现
- tool / resource 怎么被调用

`SKILL` 不等于 MCP，也不应该退化成 MCP 市场包装。

一句话：

- `MCP` 是能力接线层
- `SKILL` 是产品动作层

### `SKILL` vs `MicroAPP`

`MicroAPP` 当前属于企业集成域里的业务工作流单元。

它偏向：

- 平台入口绑定
- 标准化外部请求
- 集成场景下的业务工作流

`SKILL` 偏向：

- 个人工作副驾
- chat / topic / memory 里的工作动作
- 面向单个用户的持续工作动作

一句话：

- `MicroAPP` 更像外部入口消费的业务单元
- `SKILL` 更像助手内部复用的工作动作单元

### `SKILL` vs `Memory`

`Memory` 是沉淀出来的对象或上下文。

例如：

- 线程摘要
- 长期偏好
- 主题状态
- 决策记录

`SKILL` 不是记忆本体，但可以制造、更新、回放记忆。

一句话：

- `Memory` 是结果对象
- `SKILL` 是产出和使用这些对象的动作机制

## 当前项目为什么要先做 `SKILL`

当前代码状态下，项目已经具备三类基础：

1. Agent runtime
2. Harness tools / MCP
3. thread request-only context 注入链

但项目还没有完整的 durable memory 对象层，也没有独立 skill runtime。

因此当前最稳的路径不是直接做“大记忆系统”，而是：

1. 先定义几类高价值 skill
2. 让 skill 读写现有 thread / agent / summary 结构
3. 再从这些行为里反推出真正需要的数据结构

## 当前代码挂载点

当前 `SKILL` 最现实的挂载点有四处：

### 1. request-only context

现有链路已经固定为：

```text
Role -> Summary -> Memory -> Agent
```

相关代码：

- `server/src/services/shared-nodes/thread-request-context.node.ts`
- `server/src/services/shared-nodes/thread-request-context-memory.resolver.ts`

这意味着：

- skill 的结果可以先落成 thread-level context
- 然后通过 request-only system message 注入到模型请求

### 2. Agent execution trace

现有 Agent graph 与 execution trace 已经能展示：

- `plan`
- `reason`
- `tool`
- `approval`
- `memory`
- `generate`

相关代码：

- `server/src/agent/graph/build-graph.ts`
- `desktop/src/shared/uchat/ui/executionParsers.ts`

这意味着：

- skill 执行结果可以被做成可观察动作
- 不必先造一套新的 UI 协议

### 3. thread summary 样板

现有线程摘要已经形成：

- 生成
- 持久化
- request-only 注入
- UI 编辑

相关代码：

- `server/src/services/shared-nodes/thread-context-summary.node.ts`
- `server/src/services/thread.service.ts`
- `desktop/src/features/chat/components/ThreadContextSummaryModalContent.tsx`

这意味着：

- 第一批 skill 完全可以复用这条整理路径

### 4. Harness tool surface

现有 tools 已经可通过 Harness 统一调用：

- `read_*`
- `web_search`
- `terminal_session`
- 其它 internal / external MCP tools

相关代码：

- `server/src/harness/registry.ts`
- `server/src/mcp/routes.ts`

这意味着：

- skill 不必自己重复发明执行器

## 第一批建议的 skill 类型

当前最值得尝试的不是外部平台 skill，而是记忆型工作 skill：

- `session_summarize`
- `save_preference`
- `save_decision`
- `resume_topic`
- `attach_artifact`

这些 skill 的共同点是：

- 输入边界清楚
- 对个人工作副驾价值直接
- 可以复用现有 agent / thread / request-context 主链
- 能自然长出记忆对象层

当前 docs-only 基础数据 POC 先只正式整理这 3 张卡：

- `save_thread_memory`
- `save_preference`
- `save_decision`

## 当前阶段的硬规则

1. 先不要把 `SKILL` 做成插件市场。
2. 先不要把 `SKILL` 直接等同于 MCP server。
3. 先不要把 `SKILL` 和企业集成 `MicroAPP` 混成一个模块。
4. 第一批 `SKILL` 优先面向“沉淀、回放、续接上下文”，不要优先做平台连接。
5. 第一批 `SKILL` 的写回对象必须可见、可编辑、可删除，不能静默写黑盒长期记忆。
6. 当前任务只到 `docs-only Phase 0`，不把 catalog、schema、eval 文档直接等同于 runtime 方案批准。

## 当前文档入口

- `catalog/README.md`：第一批 skill card 入口索引
- `schema/skill-card.schema.md`：skill card 最小结构合同
- `skill-memory-poc.md`：当前 POC 的范围与限制
- `roadmap.md`：`Phase 0` 到 `Phase 4` 的演进路线
- `eval/`：选择与边界评估用例

## 推荐阅读顺序

1. `./skill-memory-poc.md`
2. `./catalog/README.md`
3. `./roadmap.md`
4. `../chat/agent-runtime-design.md`
5. `../tooling-runtime/tools-protocol.md`
6. `../microapp/README.md`

## 当前结论

`SKILL` 现在最适合被定义成：

- 产品上：助手内部的工作动作单元
- 代码上：站在 agent、thread context、tools 之上的一层轻编排
- 演进上：从 skill 行为慢慢长出真正的 memory 结构，而不是反过来
