# Skill 驱动记忆 POC

Status: Planned
Owner: chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillMemoryPOC
Doc Type: design
Canonical: true
Related:
  - README.md
  - ../chat/agent-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../architecture/README.md

## 单点真相范围

这页只回答一件事：

结合当前项目代码现状，如果要先用 `SKILL` 模拟记忆行为，第一版 POC 应该怎么做。

它覆盖：

- 外部实现参考
- 当前仓库可复用基础
- 第一版 POC 的目标
- 建议的最小数据结构
- 为什么当前先做 skill，而不是直接做完整 memory subsystem

它不覆盖：

- 最终 durable memory 产品交互全貌
- 所有 skill 的完整 prompt 文本
- 多平台同步和外部 SaaS 深集成

## 外部参考结论

截至 `2026-07-06`，可参考的公开实现大致有这几类：

### 1. OpenAI Codex

公开做法是把长期上下文拆成多种显式载体：

- `AGENTS.md`
- skills
- local memories
- durable markdown/project truth

参考：

- [Codex Skills](https://developers.openai.com/codex/skills)
- [Codex Memories](https://developers.openai.com/codex/memories)
- [AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md)

可借鉴点：

- 先让动作显式
- 先让记忆对象可管理
- 不急着上黑盒长期记忆

### 2. Anthropic Claude

公开 memory tool 更接近“文件型持久记忆”。

参考：

- [Claude Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

可借鉴点：

- 不是全量保留消息
- 而是压缩、保留、回放真正有用的上下文

### 3. LangChain / LangGraph

公开口径偏向：

- short-term memory
- long-term memory
- semantic / episodic / procedural 区分

参考：

- [LangChain Memory Overview](https://docs.langchain.com/oss/python/concepts/memory)
- [LangGraph Memory](https://docs.langchain.com/oss/python/deepagents/memory)

可借鉴点：

- memory 必须分层
- execution graph 与 memory 写入应分开

### 4. Zep

公开口径偏向：

- graph memory
- facts / episodes
- 自动写入 + 显式查询混合

参考：

- [Zep Graph Overview](https://help.getzep.com/graph-overview)
- [Zep Architecture Patterns](https://help.getzep.com/architecture-patterns)

可借鉴点：

- 自动记忆和显式记忆最好分开
- 先做显式写入更稳

## 结合当前代码的现实判断

当前项目已经有这些基础：

### 1. Agent runtime 已经成立

当前已有：

- `agent_runs` 持久化
- graph / planner / policy / tool / resume
- execution trace

相关代码：

- `server/src/agent/`
- `server/src/db/schema.ts`
- `server/src/db/repositories/agent-run.repository.ts`

这意味着：

- skill 可以作为 agent 内的一类动作来观察与审计

### 2. request-only memory 插槽已经存在

当前已有：

- `resolveMemoryContext`
- `memory` execution node
- `Role -> Summary -> Memory -> Agent` 固定顺序

相关代码：

- `server/src/services/shared-nodes/thread-request-context.node.ts`
- `server/src/services/shared-nodes/thread-request-context-memory.resolver.ts`

这意味着：

- 一旦有真实 memory 内容，注入链立刻可复用

### 3. 线程摘要闭环已经成立

当前已有：

- LLM 生成线程摘要
- 持久化到 thread
- request-only 注入
- 前端编辑入口

相关代码：

- `server/src/services/shared-nodes/thread-context-summary.node.ts`
- `server/src/services/thread.service.ts`
- `desktop/src/features/chat/components/ThreadContextSummaryModalContent.tsx`

这意味着：

- 第一批记忆型 skill 可以先沿用 thread-level 持久化思路

## 当前真正的缺口

当前还没有这些东西：

1. 独立的 skill runtime
2. 真正落库的 `memoryContext`
3. `topic / decision / preference` 这类独立记忆对象表
4. Agent graph 内的真实 memory write node

因此现在不适合直接宣称：

- “我们已经有记忆层”
- “我们已经有 skill 平台”

更合理的表述是：

- 当前代码已经足够支撑第一版 skill-driven memory POC

## POC 目标

第一版 POC 只验证四件事：

1. skill 可以在对话中显式触发
2. skill 可以把结果写回可见对象
3. 写回结果能在后续请求里作为 request-only memory 注入
4. 用户可以确认、修改、清空这些结果

当前不验证：

- 自动长期学习
- 隐式人格建模
- 多主题知识图谱
- 跨平台同步

## 第一版 skill 范围

建议只做这 3 个：

### 1. `save_thread_memory`

作用：

- 把一轮或多轮讨论沉成线程长期记忆文本

输出：

- `memoryContext`
- `memoryContextUpdatedAt`

为什么先做它：

- 路径最短
- 能直接打通现有 resolver 插槽

### 2. `save_preference`

作用：

- 把明确表达的偏好沉成短条目

示例：

- 优先给结论
- 回答要简洁
- 先谈产品边界，少谈代码

第一版可先把它并入 `memoryContext`，不急着单独建表。

### 3. `save_decision`

作用：

- 把当前线程里已经明确的判断沉成短决策

示例：

- 当前阶段先做 skill，不先做飞书 / Notion 深接
- 先用 skill 驱动记忆，不先做完整 memory subsystem

第一版也可以先并入 `memoryContext`，后续再独立成 `decision_memory`

## 第一版建议的数据结构

### POC Phase 1

先只补线程级字段：

在 `threads` 表新增：

```text
memory_context
memory_context_updated_at
```

对应 service / API / 前端也补齐同名字段。

这样能最快跑通：

```text
skill 执行
-> 更新 thread.memoryContext
-> request-only memory resolver 注入
-> 后续轮次消费
```

### POC Phase 2

如果第一批 skill 被证明有用，再拆独立对象：

#### `thread_memory_entries`

建议字段：

- `id`
- `thread_id`
- `type`
- `content`
- `confirmed`
- `created_at`
- `updated_at`

类型先只允许：

- `summary`
- `preference`
- `decision`

这样做的意义是：

- 先保留对象粒度
- 再决定是否要 topic 级聚合

### 暂不建议现在就上

- `topic_memory`
- `decision_memory`
- `user_preferences`
- 图谱关系表

不是这些方向不对，而是当前代码阶段太早。

## POC 的产品形态

第一版不要做 skill 市场。

建议只做两种露出：

### 1. 聊天内建议动作

例如：

- “要不要记住这条偏好”
- “要不要把这轮讨论沉成长期记忆”
- “要不要保存这条决策”

### 2. 线程级编辑入口

类似当前 `ThreadContextSummary`：

- 查看已沉淀 memory
- 手动编辑
- 清空
- 再生成

这样做能最快闭环，也最符合你们当前 UI 结构。

## 对当前代码的最小改造建议

### 必做

1. `threads` 表补 `memory_context` 字段
2. `threadService` 补 `memoryContext` 读写
3. thread API schema 与前端协议补 `memoryContext`
4. 在 chat thread UI 增加一个和 `contextSummary` 同级的 memory 编辑入口
5. 增加一个最小 skill action 服务，先别抽象成完整 runtime

### 暂缓

1. skill marketplace
2. 通用 skill registry
3. 独立 topic graph
4. 自动全量 memory extraction
5. MCP-based skill packaging

## 为什么现在先做 skill，不先做完整 memory

因为按当前代码现状：

- 已经有 request-only memory 插槽
- 已经有 thread summary 闭环
- 已经有 agent trace 与持久化

但还没有：

- 独立记忆对象层
- 稳定的 skill runtime
- 足够清晰的长期数据模型

所以现在直接做 memory subsystem，风险是：

- 模型很大
- 数据结构容易拍脑袋
- 产品入口不清楚

而先做 skill-driven memory，收益是：

- 先验证动作价值
- 先验证哪些内容值得留下
- 再反推真正需要的数据结构

## Recommendation

当前项目最稳的路径应是：

```text
先做 3 个记忆型 skill
-> 先写回 thread.memoryContext
-> 先走 request-only resolver 注入
-> 跑通 UI 可见 / 可改 / 可删闭环
-> 再决定是否拆成 topic / decision / preference 独立表
```

一句话结论：

> 当前代码已经足够支撑“skill 驱动记忆”的第一版 POC，但还不适合直接扩成完整 memory 平台。
