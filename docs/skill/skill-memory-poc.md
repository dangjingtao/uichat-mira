# Skill 驱动记忆 POC

Status: Planned
Owner: chat / runtime / docs
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillMemoryPOC
Doc Type: design
Canonical: true
Related:
  - README.md
  - catalog/README.md
  - roadmap.md
  - schema/skill-card.schema.md
  - ../chat/agent-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../architecture/README.md

## 单点真相范围

这页只回答一件事：

结合当前项目状态，如果要先把 `SKILL` 驱动记忆的基础数据整理成可评审文档，第一版 POC 应该怎样定义边界。

它覆盖：

- 外部实现参考
- 当前 docs-only POC 的目标
- 第一批 skill card 的范围
- 为什么当前先做 docs-only `Phase 0`

它不覆盖：

- runtime 实现
- 数据库 schema
- UI 入口
- AgentGraph / Harness / MCP / Planner / Policy 改造
- 最终 durable memory 产品交互全貌

## 外部参考结论

截至 `2026-07-06`，可参考的公开实现大致有这几类：

### 1. OpenAI Codex

公开做法是把长期上下文拆成多种显式载体：

- `AGENTS.md`
- skills
- local memories
- durable markdown/project truth

可借鉴点：

- 先让动作显式
- 先让记忆对象可管理
- 不急着上黑盒长期记忆

### 2. Anthropic Claude

公开 memory tool 更接近“文件型持久记忆”。

可借鉴点：

- 不是全量保留消息
- 而是压缩、保留、回放真正有用的上下文

### 3. LangChain / LangGraph

公开口径偏向：

- short-term memory
- long-term memory
- semantic / episodic / procedural 区分

可借鉴点：

- memory 必须分层
- execution graph 与 memory 写入应分开

### 4. Zep

公开口径偏向：

- graph memory
- facts / episodes
- 自动写入 + 显式查询混合

可借鉴点：

- 自动记忆和显式记忆最好分开
- 先做显式写入更稳

## 当前 docs-only Phase 0 的现实判断

当前项目已经有足够的产品与文档背景，能先把 skill card 作为基础数据整理清楚，但还没有批准任何 runtime 方案。

因此当前更稳的路径是：

```text
先统一 skill card 命名和字段
-> 先明确三张卡的触发边界、确认规则、写回对象
-> 先补 catalog / eval / roadmap
-> 把 POC 固定在 docs-only Phase 0
-> 后续再决定是否进入 runtime Phase 1
```

## POC 目标

第一版 POC 只验证文档层面的 4 件事：

1. skill card 命名、字段和入口索引是否统一
2. 三张卡的触发边界和确认规则是否清楚
3. thread-level memory POC 的写回对象要求是否说清楚
4. roadmap 是否明确当前只停留在 `docs-only Phase 0`

当前不验证：

- 自动长期学习
- 隐式人格建模
- 多主题知识图谱
- 跨平台同步
- 任意 runtime 落地

## 第一版 skill 范围

当前 docs-only `Phase 0` 只整理这 3 个：

### 1. `save_thread_memory`

作用：

- 把一轮或多轮讨论沉成线程长期记忆文本

当前关键规则：

- 覆盖、追加、改写现有 memory 前都必须先生成合并草案
- 默认不直接覆盖
- 只有用户明确确认覆盖时，才允许覆盖现有 memory

### 2. `save_preference`

作用：

- 把明确表达的偏好沉成短条目

当前关键规则：

- 当前 POC 只支持把偏好条目以可见文本形式并入 thread-level memory
- 用户可以手动编辑或清空整段 memory
- 逐条编辑 / 逐条删除属于 `Phase 2`

### 3. `save_decision`

作用：

- 把当前线程里已经明确的判断沉成短决策

当前关键规则：

- 只有决策已明确时才进入草案
- 先并入 thread-level memory 可见对象
- 必须先确认，不能把讨论中的倾向误写成已定结论

## 第一版文档结构

当前 `Phase 0` 先固定这组文档：

1. `schema/skill-card.schema.md`
2. `catalog/*.skill.md`
3. `catalog/README.md`
4. `eval/*.md`
5. `roadmap.md`

## POC 的产品形态

第一版不要做 skill 市场，也不要把文档偷换成实现承诺。

建议先把这两件事讲清楚：

### 1. 聊天内建议动作

例如：

- “要不要记住这条偏好”
- “要不要把这轮讨论沉成长期记忆”
- “要不要保存这条决策”

### 2. 线程级可见对象

至少先把文档边界说清：

- 查看已沉淀 memory
- 手动编辑整段 memory
- 清空整段 memory
- 对已有 memory 先生成合并草案再确认

这样做能先把产品动作边界说清，再决定后面要不要进入实现。

## 为什么当前先做 docs-only Phase 0

因为按当前项目状态：

- skill / memory / tool / MCP 的产品边界已经值得先固定
- 但 runtime、写回契约、UI 入口、对象模型都还不该在这次任务里拍板
- 先把文档合同收清，后续评审才不会一边讨论命名一边讨论实现

如果现在直接进入实现，风险是：

- 文档口径还没统一
- 阶段边界容易混乱
- 很容易把 docs-only POC 写成 runtime 改造任务

而先做 docs-only `Phase 0`，收益是：

- 先统一基础数据
- 先验证评审对象是否明确
- 再决定 `Phase 1` 进入哪一种实现路径

## Recommendation

当前项目最稳的路径应是：

```text
先做 3 张记忆型 skill card
-> 统一命名和 schema
-> 补 catalog / eval / roadmap
-> 明确当前只到 docs-only Phase 0
-> 评审通过后再决定是否进入 runtime Phase 1
```

一句话结论：

> 当前项目已经适合把“skill 驱动记忆”的基础数据先收成 docs-only `0.1`，但这还不是 runtime 方案批准。
