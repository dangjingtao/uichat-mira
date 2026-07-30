---
status: archived
owner: docs / runtime
last_verified: 2026-07-30
layer: historical
module: MicroAPP
feature: MicroAppArchive
doc_type: archive
canonical: true
related:
  - ../../MICROAPP_CURRENT_TRUTH.md
  - ../../microapp/README.md
  - ../README.md
---

# MicroApp 历史归档

> 这里保存 MicroAPP 从“统一业务工作流候选”到当前多形态产品能力中心的演进资料。它们解释过去，不定义当前运行时。

## 当前真相入口

1. [[MICROAPP_CURRENT_TRUTH]]：MicroApp 当前总真相；
2. [[microapp/README]]：当前模块入口；
3. [[TOOL_CURRENT_TRUTH]]：进入 Agent 的 Tool / Harness 真相；
4. [[skill/README]]：Skill 与 private Runtime 边界。

## 本次保存的历史快照

### 旧模块总纲

- `microapp-module-overview-20260723.md`
  - 原 `docs/microapp/README.md`；
  - 把 Integration MicroAPP、Studio、未来候选和独立业务入口混在同一套定义下；
  - 当时有助于形成 Platform / Instance / AccessPoint / MicroAPP 子模型，但不再足以描述整个产品中心。

### Image Generation 实现前设计

- `image-generation-microapp-poc.md`；
- `image-generation-debug-workspace-interaction-spec.md`。

它们仍写着 docs-only、未批准 Runtime 和第一版原型。当前代码已经拥有任务、实时进度、Artifact、Provider adapter、ComfyUI connection / flow 和桌面入口。

### Computer Use 实现前设计

- `computer-use-microapp-poc.md`；
- `computer-use-feature-design.md`。

它们记录了隔离浏览器、观察先于操作和审批等重要约束，但“无自然语言模型执行 / Runtime 尚未实现”的描述已经被当前代码推翻。

### Office Suite 早期设计

- `office-suite-microapp-design.md`。

它记录了“一个产品入口、三个 Office 领域”的正确方向，但仍把 Chat → Skill → Office Runtime 写成未来路线。当前文枢 Skill-owned execution 和 `office-runtime.v1` 已经成立。

### News / Mail Tool 实现前设计

- `news-and-mail-mcp-design.md`。

它保留 News Hub、Mail Center 与 Tool / MCP 分层的决策来源，但“相关能力尚未实现”的口径已经过期。当前公共工具分别是 `news_search` 与 `mail_query`。

### GitHub 迁移前合同

- `github-capability-design-pre-implementation.md`。

它定义了四领域工具目标，但正文仍把旧四个只读工具写成当前过渡实现。当前公开面已经完成迁移。

## 为什么原路径仍保留

这些页面被历史任务、评审、博客和搜索结果引用。原路径因此改为轻量兼容页：

- 标记 `superseded / historical / canonical:false`；
- 指向当前真相；
- 指向本历史索引；
- 不继续展示会被误读为现状的长正文。

GitHub 当前合同例外：原路径继续承载 current contract，迁移前全文只在归档中保留。

## 不在本次归档范围

- 当前 Office Runtime 合同；
- 当前文枢 Skill Runtime；
- TTS Runtime 与 GPT-SoVITS 当前接入；
- Image Generation / Computer Use 真实 smoke guide；
- 问策当前边界；
- Notion 部分实现与后续方案；
- `project-control/tasks`、reviews、testEvidence；
- 当前缺陷和验收记录。

## 阅读规则

历史资料可以回答“为什么曾经这样设计”，不能回答：

- 当前页面是否可用；
- 当前 Runtime 是否 ready；
- 当前是否可绑定外部 AccessPoint；
- 当前是否进入 Agent；
- 当前下一步施工应遵守哪份合同。