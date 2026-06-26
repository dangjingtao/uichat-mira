# Wiki System Schema

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: schema
Module: docs-system
Doc Type: current-contract

## 单点真相范围

这篇文档定义当前项目文档系统的上位 schema。

它明确三层：

- Raw sources
- Wiki
- Schema

本 schema 参考：

- [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

目标不是把所有 markdown 都做成同一种东西，而是让文档系统像一个可长期维护的 LLM Wiki：

- 原始资料保真
- Wiki 层持续整理
- Schema 层定义维护规则

## 适合什么时候读

这些场景先读这篇：

- 准备新增一篇文档
- 想判断某份材料该进 raw sources 还是 wiki
- 想让 AI 按稳定规则 ingest 新资料
- 想知道文档站和知识库消费哪一层

## 三层定义

### 1. Raw sources

Raw sources 是原始资料层。

这一层放的是：

- 真实接口文档
- 架构说明
- 设计草稿
- bugfix 记录
- checklist
- changelog
- 评审记录
- 任何仍然作为事实来源的原始材料

这一层的原则：

- 是 source of truth
- 默认不可被 AI 随意改写成总结腔
- 只允许做归档、索引、引用、标注
- 不要求它们长得统一，但要求它们可追溯

这一层适合回答：

- 事实是什么
- 设计原文怎么写
- 某次决策当时到底说了什么

### 2. Wiki

Wiki 是 LLM 维护的知识层。

这一层放的是：

- 模块总览
- 概念页
- 比较页
- 综述页
- 阅读路径
- 交叉引用
- 结构化 synthesis

这一层的原则：

- 由 LLM 生成、更新和维护
- 面向人类可读，也面向 AI 可持续消费
- 可以重写，但要保留和 raw sources 的溯源关系
- 允许把多份 source 合成为一篇更好读的知识页

这一层适合回答：

- 这个模块是什么
- 这里相关的概念有哪些
- 从哪里开始读最省脑子
- 几份原始资料合起来能得到什么判断

### 3. Schema

Schema 是维护规则层。

这一层不是内容本身，而是告诉 LLM：

- wiki 该怎么长
- 新资料该怎么 ingest
- 哪些文档能改，哪些只能引用
- 哪些场景要生成新 wiki 页
- 哪些场景只更新已有页
- 哪些结论应该标成 historical

这一层的原则：

- 是整套系统的纪律来源
- 负责约束写法、分类、工作流和维护边界
- 应同时被人和 LLM 维护
- 要比单篇文档更稳定

这一层适合回答：

- 新资料进来时怎么处理
- AI 回答问题时优先读哪层
- LLM 什么时候该写 wiki，什么时候不该动 source

## 三层关系

推荐的处理顺序是：

1. 先读 raw sources
2. 再维护 wiki
3. 最后由 schema 约束整个流程

也就是说：

- raw sources 提供事实
- wiki 提供整理后的知识
- schema 提供维护秩序

## 核心边界

### Raw sources 不做什么

- 不承担整库导航
- 不承担概念总结
- 不承担大规模 synthesis
- 不承担长期阅读路径维护

### Wiki 不做什么

- 不冒充原始事实
- 不抹掉自己的来源
- 不和 raw sources 混成一层

### Schema 不做什么

- 不写具体业务事实
- 不替代 source
- 不替代 wiki 页面本身

## 推荐目录模型

当前可先按逻辑层组织，后续再决定是否物理搬目录。

推荐逻辑目录：

```text
docs/
  sources/
  wiki/
  schema/
```

如果暂时不搬目录，也至少要在元数据里明确：

- `layer: raw-source`
- `layer: wiki`
- `layer: schema`

## 推荐元数据

每篇文档至少应尽量能回答这几个问题：

- 属于哪个模块
- 属于哪一层
- 属于哪种文档角色
- 是否可由 LLM 直接维护
- 是否是当前真相

### 活跃文档最小要求

所有仍在活跃维护区的文档，建议至少明确补齐这四项：

- `Layer`
- `Module`
- `Doc Type`
- `Status`

如果一篇文档还承担事实依据或索引用途，最好再补：

- `Owner`
- `Last verified`
- `Canonical`
- `Derived from`
- `Related`

### Module 判定优先级

当一篇文档可能跨多个主题时，不要平均分配模块。优先按下面顺序选主模块：

1. 这篇文档主要服务哪个稳定产品域
2. 这篇文档主要描述哪条运行链路或契约
3. 这篇文档主要由哪个团队/责任域维护
4. 如果仍然说不清，才暂归 `docs-system`、`planning` 或 `bugfix`

建议的主模块口径如下：

| Module | 主要含义 | 典型文档 |
| --- | --- | --- |
| `docs-system` | 文档系统、schema、索引、阅读规则 | `WIKI_SYSTEM_SCHEMA.md`、`DOCUMENTATION_STANDARDS.md` |
| `runtime` | 运行时、请求链路、后端执行边界 | `architecture/README.md`、`rag-langgraph-flow.md` |
| `chat` | 聊天产品域、线程、消息、会话体验 | `uchat.md`、`chat-system-practices.md` |
| `role` | 角色系统、persona、role API | `role.md`、`role-api.md` |
| `knowledge-base` | 知识库内容、导入、检索、workspace | `knowledge-base/api.md`、`knowledge-base/markdown-workspace-mode.md` |
| `provider` | 模型提供商、代理、接线、接口标准 | `provider-api-standards.md`、`provider-proxy-api.md` |
| `platform` | 桌面壳、Tauri、Electron、打包与环境 | `platform/tauri.md`、`版本管理.md` |
| `evaluation` | 评测工作台、数据集、评测流程 | `evaluation/workbench.md` |
| `tooling-runtime` | MCP、工具运行时、读取与暴露机制 | `tooling-runtime/read-skill-design.md`、`external-mcp-marketplace.md` |
| `planning` | 路线图、规划、待办、设计草案 | `product-roadmap-priorities.md` |
| `bugfix` | 缺陷记录、修复清单、回归排查 | `defect-log.md`、`chat-remediation-checklist.md` |

### 重叠文档怎么收

如果一篇文档明显跨模块：

- 只给一个 `Module` 作为主归属
- 其他相关模块放进 `Related`
- 不要为了“看起来都沾一点”而写多个主模块

判断规则很简单：

- 文档回答“它主要在讲谁”，那是 `Module`
- 文档回答“它是啥性质的页”，那是 `Doc Type`
- 文档回答“它属于哪层”，那是 `Layer`

## Allowed Values

为了避免不同文档各自发明命名，当前 schema 先固定一版推荐值表。

### Allowed `Layer`

- `raw-source`
- `wiki`
- `schema`

### Allowed `Module`

当前项目先固定这些模块值：

- `docs-system`
- `runtime`
- `chat`
- `role`
- `knowledge-base`
- `provider`
- `platform`
- `evaluation`
- `tooling-runtime`
- `bugfix`
- `planning`

说明：

- `bugfix` 先作为工作流型模块存在，便于聚合缺陷与修复资料
- `planning` 先作为项目级规划模块存在，便于承载跨功能域路线文档

### Allowed `Doc Type`

当前项目先固定这些文档角色：

- `current-contract`
- `reference`
- `overview`
- `design`
- `plan`
- `checklist`
- `draft`
- `implementation-notes`
- `historical`
- `how-to`

一句话规则：

- `Module` 回答“这篇在讲谁”
- `Doc Type` 回答“这篇是干什么的”
- `Layer` 回答“它属于哪一层”

推荐字段：

```yaml
layer: raw-source | wiki | schema
module: docs-system | runtime | chat | role | knowledge-base | provider | platform | evaluation | tooling-runtime | bugfix | planning
doc_type: current-contract | reference | overview | design | plan | checklist | draft | implementation-notes | historical | how-to
status: current | planned | active | historical
owner: runtime
llm_editable: true | false
canonical: true | false
derived_from: [...]
related: [...]
```

## 工作流

### Ingest

新资料进来时：

1. 判断它属于 raw source、wiki 还是 schema
2. 记录 module 和 doc_type
3. 标注是否需要新建 wiki 页
4. 标注是否影响已有页面

### Maintain

维护 wiki 时：

- 用 raw sources 作为依据
- 用 schema 作为规则
- 不要让 wiki 反过来替代 source

### Answer

AI 回答问题时：

- 优先读 wiki 的总览和概念页
- 必要时回 raw sources 核对
- 不把历史材料误当成当前事实

## 判定规则

如果一篇文档主要在做事实记录，它更像 raw source。  
如果一篇文档主要在做知识整理，它更像 wiki。  
如果一篇文档主要在约束维护流程，它更像 schema。

一句话记忆：

- source 负责“原来是什么”
- wiki 负责“现在怎么理解”
- schema 负责“以后怎么维护”

## 相关文档

- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_FULL_PLAN.md`
