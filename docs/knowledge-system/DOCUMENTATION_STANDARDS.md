# 文档规范

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: current-contract
Canonical: true
Related:
  - ../WIKI_SYSTEM_SCHEMA.md
  - DIRECTORY_AND_CLASSIFICATION_RULES.md
  - IMPLEMENTATION_ROADMAP.md

## 单点真相范围

这份文档定义项目文档应该如何组织和书写，目标是同时服务两类读者：

- 人类开发者
- 会读取 markdown 作为上下文的 AI 工具

当前文档系统改造还额外受这条上位约束驱动：

- 文档构造原则参考 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

也就是说，后续文档系统默认要尽量靠近：

- markdown 作为真相源
- 可互链
- 可长期积累
- AI 天然更容易理解而不是只能靠临时检索猜

## 适合什么时候读

当你准备做下面这些事时，先读这篇：

- 在 `docs/` 下新增文档
- 大幅重写已有文档
- 把内容从活跃区迁到 `archive/`
- 判断某个主题应该放在哪一层

## 当前规则

- `README.md` 是文档总入口。
- `docs/README.md` 是当前文档区导航入口。
- `docs/archive/` 里的内容默认只算历史参考，不能直接当现状依据。
- 必须和源码一起演进的说明文档，仍然可以放在源码旁边。

当前还要额外遵守三条核心约束：

1. 文档构造应尽量对齐 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 这类 LLM Wiki / markdown wiki 思路
2. 分类规则首先要让 AI 天然知道“这是哪个模块、哪种文档”
3. 文档站与可视化层只消费这套结构，不反过来绑架文档本体

## 文档类型

每篇文档尽量只承担一个主类型。

| 类型 | 目标 | 典型位置 |
| --- | --- | --- |
| 总览 | 解释一个子系统是什么、应该从哪读起 | `README.md`、区域 `README.md` |
| 架构 | 记录稳定边界、运行契约、归属关系 | `docs/architecture/` |
| 操作指南 | 记录安装、排障、构建、运行步骤 | `docs/platform/`，未来也可扩成 `docs/how-to/` |
| 参考 | 记录接口、schema、规则、字段说明 | API / schema / 标准类文档 |
| 功能说明 | 解释某个产品域或子系统的行为与语义 | 如 `docs/uchat.md` |
| 历史 | 保留旧设计、废弃方案、历史记录 | `docs/archive/` |

如果一篇文档同时承担多种角色，优先拆分。拆不动时，至少在顶部明确“主类型”和“主用途”。

## 必要头部

活跃文档默认要带这组头部字段：

```md
# 标题

Status: Current
Owner: runtime
Last verified: 2026-06-24
```

字段含义：

- `Status: Current`
  当前有效事实或当前有效契约
- `Status: Planned`
  已确认方向，但尚未成为现状
- `Status: Historical`
  历史材料，不应默认驱动当前实现

`Owner` 用简短域名表示，例如：

- `runtime`
- `chat`
- `role`
- `platform`
- `knowledge-base`
- `docs`

`Last verified` 表示这篇文档最后一次和代码或当前决策核对的时间。

后续文档系统继续演进时，推荐逐步补齐更明确的机器可读字段，例如：

- `Module`
- `Doc Type`
- `Tags`
- `Canonical`

当前还没有全量强制，但这是后续最重要的演进方向之一。

## 推荐结构

大多数活跃文档建议按这个顺序组织：

1. `Purpose`
2. `When To Read`
3. `Current Truth` 或 `Current Contract`
4. `Constraints`
5. `Implementation Notes` 或 `Examples`
6. `Code Anchors`
7. `Related Docs`

不是每篇都必须把这七节写满，但文档开头至少要回答三件事：

- 这篇为什么存在
- 它写的是现状、计划，还是历史
- 真实依据落在代码还是别的文档里

## 书写规则

- 先写结论，再写背景。
- 记录契约时，优先用短规则句，不要埋在大段散文里。
- 严格区分“已实现行为”和“设计意图”。
- 同一个概念在不同文档里尽量用同一个词。
- 如果某个概念已经有单点真相页，别在别处重新定义一版。
- 只要结论依赖实现，就尽量给代码锚点。

更好的写法：

- Development renderer requests use `/api/...`.
- Backend routes never include `/api`.
- Production renderer requests use `window.desktopApi.backendUrl`.

不够好的写法：

- 前端开发态大概会走代理。
- 后端一般不带 `/api`。

## 代码锚点

只要文档描述的是活行为，就推荐加 `Code Anchors` 段。

示例：

```md
## Code Anchors

- `desktop/vite.config.ts`
- `desktop/src/shared/lib/request.ts`
- `electron/main.cjs`
- `server/src/config/index.ts`
```

代码锚点的意义是让人和 AI 都能顺着实现核实，而不是靠猜。

## 什么情况下归档

满足下面任一条件，就应考虑移入 `docs/archive/`：

- 设计已被代码和新文档替代
- 文档描述的是失败方案或废弃方案
- 内容仅用于历史排障或背景回看

迁入归档时，如果有新的替代文档，最好在顶部顺手指一下。

## 命名和层级

- 新的跨团队技术文档，优先用英文文件名。
- 文件名要稳定且语义明确，例如 `provider-proxy-api.md` 比 `proxy-notes.md` 好。
- 同一主题下有多篇文档时，优先进同一个目录。
- 只有在“文档必须和代码一起演进”时，才放源码邻接文档。

## 面向 AI 的习惯

- 一个重要概念只保留一个主定义入口。
- 明确标记 `Status`，避免把规划误读成现状。
- 不要把历史内容混进主契约段。
- 例子尽量短、直接、可执行。
- 同类文档的段名尽量稳定。
- 不要只靠目录名和标题让 AI 猜模块归属。
- 后续每篇活跃文档都应尽量能回答两件事：
  - 它属于哪个模块
  - 它是什么文档角色，例如 `plan`、`design`、`checklist`、`current-contract`

## 后续元数据方向

为了更接近 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 这类可长期积累的 AI 可读文档系统，后续建议逐步补到“双轴元数据”：

- 第一轴：模块归属
  - 例如 `chat`、`role`、`runtime`、`knowledge-base`、`platform`、`docs-system`
- 第二轴：文档角色
  - 例如 `current-contract`、`reference`、`design`、`plan`、`checklist`、`draft`、`historical`

这样 AI 不需要只靠目录和上下文猜，就能更稳定判断：

- 这篇文档在讲哪个模块
- 这篇文档写的是现状、设计、计划还是执行清单

## 当前强约束

从现在开始，活跃文档不要再只写“感觉上的分类”，要尽量在头部同时写明：

- `Layer`
- `Module`
- `Doc Type`
- `Status`

如果文档属于当前真相页、总纲页、入口页或 reference 页，最好再补：

- `Owner`
- `Last verified`
- `Canonical`

## 分类决策顺序

当你在两个模块之间犹豫时，按这个顺序决定：

1. 这篇文档主要服务哪个稳定功能域
2. 这篇文档主要回答哪个问题
3. 这篇文档是否更像总纲、参考、计划还是排障
4. 如果还是混，优先选更稳定、更新频率更低的主模块，把动态边界放进 `Related`

不要为了“面面俱到”把一篇文档写成多个主模块。

## 轻量模板

```md
# 标题

Status: Current
Owner: <area>
Last verified: YYYY-MM-DD

## Purpose

## When To Read

## Current Truth

## Constraints

## Code Anchors

## Related Docs
```
