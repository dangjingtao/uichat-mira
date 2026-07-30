---
status: current
owner: docs
last_verified: 2026-07-30
layer: schema
module: Docs
feature: DocsSystem
doc_type: current-contract
canonical: true
related:
  - CURRENT_PRODUCT_TRUTH.md
  - ENGINEERING_MEMORY.md
  - VAULT_HOME.md
  - archive/README.md
  - knowledge-system/DOCUMENTATION_STANDARDS.md
---

# UIChat Mira 项目文档入口

这套文档站直接读取主仓库 `dev` 分支的 `docs/`。

它的首要职责不是展示“写了多少文档”，而是让人能快速判断：

- 什么是当前真实能力；
- 什么仍在施工；
- 什么只是方案或 POC；
- 什么已经归档；
- 什么尚未核验，不能直接相信。

## 先读这三页

1. [[CURRENT_PRODUCT_TRUTH]]：当前产品能力、边界与稳定迭代阶段；
2. [[ENGINEERING_MEMORY]]：工程共同记忆和不可破坏的运行时合同；
3. [[knowledge-system/DOCUMENTATION_STANDARDS]]：文档如何进入当前、施工、计划或历史区。

## 五类文档

### 当前真相

已经核验的 `current-contract`、`current-snapshot`、总纲和稳定参考。

它们可以作为当前实现依据，但仍需要：

- 明确 Owner；
- 有 Last verified；
- 与代码和真实验证一致。

### 施工与验证

正在推进的 checklist、workboard、ledger、implementation notes 和验收记录。

它们说明“现在正在做什么”，不自动等于“产品已经具备什么”。

### 方案与实验

design、plan、research、roadmap、draft、POC。

它们用于保留思路和决策输入，不能被首页、搜索或 Agent 当成当前事实优先使用。

### 历史归档

Historical、Archived、Superseded、Deprecated、Completed，以及 `archive/` 目录中的内容。

它们只用于追溯背景。

### 待核验

缺少可信状态、文档类型或核验信息的页面。

待核验不是“默认当前”，而是明确的不确定区。

## 当前模块入口

- [[harness/agentgraph-harness-protocol]]：Agent 与 Harness 当前协议；
- [[skill/README]]：Skill 当前定义与边界；
- [[tooling-runtime/README]]：工具运行时；
- [[provider/README]]：Provider；
- [[knowledge-base/README]]：知识库；
- [[evaluation/README]]：评测；
- [[chat/README]]：对话系统；
- [[platform/tauri]]：Tauri 平台路径；
- [[microapp/README]]：微应用定义与当前状态。

## 工程工作区

[[VAULT_HOME]] 是 Obsidian / 工程资料工作区入口。

它包含地图、概念、施工记录和项目控制资料，因此不等于产品真相首页。进入工作区后仍要遵守文档生命周期标记。

## 文档站规则

- YAML frontmatter 与旧式 `Status:` 头部都可被索引器识别；
- 状态冲突时，Historical / Superseded 优先于 current doc type；
- 缺状态不会再自动进入“先读这里”；
- 当前文档超过 90 天未核验会被标记；
- `project-control/` 是施工与决策记录区，不是产品说明书；
- 文档路径不代表可信度，生命周期与验证证据才代表可信度。

## 归档

归档规则见 [[archive/README]]。
