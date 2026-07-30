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
  - AGENT_CURRENT_TRUTH.md
  - ENGINEERING_MEMORY.md
  - VAULT_HOME.md
  - archive/README.md
  - knowledge-system/DOCUMENTATION_STANDARDS.md
---

# UIChat Mira 项目文档入口

这套文档站直接读取主仓库 `dev` 分支的 `docs/`。

它的首要职责不是展示“写了多少文档”，而是让人快速判断：

- 什么是当前真实能力；
- 什么仍在施工；
- 什么只是方案或 POC；
- 什么已经归档；
- 什么尚未核验；
- 当前代码是否偏离 settled contract。

## 先读这四页

1. [[CURRENT_PRODUCT_TRUTH]]：产品能力、边界与稳定迭代阶段；
2. [[AGENT_CURRENT_TRUTH]]：Agent、Harness、SubAgent、终止语义与当前已知漂移；
3. [[ENGINEERING_MEMORY]]：工程共同记忆和不可破坏的合同；
4. [[knowledge-system/DOCUMENTATION_STANDARDS]]：文档如何进入当前、施工、计划或历史区。

## 五类文档

### 当前真相

已经核验的 current-contract、current-snapshot、总纲和稳定参考。

当前真相必须：

- 明确 Owner；
- 有 Last verified；
- 有代码或验证依据；
- 区分 settled contract 与已知实现偏差。

### 施工与验证

正在推进的 checklist、workboard、ledger、implementation notes 和验收记录。

它们说明“正在做什么”，不自动等于产品已经具备什么。

### 方案与实验

design、plan、research、roadmap、draft、POC。

它们保留思路和决策输入，不能被首页、搜索或 Agent 当成当前事实优先使用。

### 历史归档

Historical、Archived、Superseded、Deprecated、Completed，以及 `archive/` 内容。

它们只用于追溯背景。

### 待核验

缺少可信状态、文档类型或核验信息的页面。

待核验不是“默认当前”，而是明确不确定区。

## 当前模块入口

- [[AGENT_CURRENT_TRUTH]]：Agent 总真相；
- [[harness/agentgraph-harness-protocol]]：AgentGraph、Harness、Evidence 与委派技术协议；
- [[skill/README]]：Skill 当前定义与 SubAgent 执行边界；
- [[skill/pi-skill-agent-execution]]：SubAgent 详细参考；
- [[development/agent-observability]]：Agent / SubAgent 观测与诊断；
- [[tooling-runtime/README]]：工具运行时；
- [[provider/README]]：Provider；
- [[knowledge-base/README]]：知识库；
- [[evaluation/README]]：评测；
- [[chat/README]]：Chat 与 Agent UI 入口；
- [[platform/tauri]]：Tauri 平台路径；
- [[microapp/README]]：微应用定义与状态。

## Agent 文档引用规则

Agent 相关内容按以下顺序判断：

```text
current code + repeatable tests
  -> AGENT_CURRENT_TRUTH
  -> agentgraph-harness current contract
  -> Skill / observability current reference
  -> workboard / checklist / review
  -> design / plan / historical
```

发现代码与 settled contract 不一致时，必须写清：

- 目标合同；
- 当前实现；
- 用户影响；
- 修复是否完成。

不得把实现回归包装成新合同，也不得用目标合同假装代码已经正确。

## 工程工作区

[[VAULT_HOME]] 是 Obsidian / 工程资料工作区入口。

它包含地图、概念、施工记录和项目控制资料，因此不等于产品真相首页。进入工作区后仍要遵守生命周期标记。

## 文档站规则

- YAML frontmatter 与旧式 `Status:` 头部都可识别；
- 状态冲突时 Historical / Superseded 优先于 current doc type；
- 缺状态不会自动进入“先读这里”；
- 当前文档超过 90 天未核验会被标记；
- `project-control/` 是施工与决策记录区，不是产品说明书；
- 文档路径不代表可信度，生命周期与验证证据才代表可信度；
- Current 文档发现实现漂移时，必须显式记录，而不是静默改写合同。

## 归档

归档规则见 [[archive/README]]。