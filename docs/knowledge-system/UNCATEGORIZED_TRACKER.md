# 待归类文档追踪

Status: Current
Owner: docs
Last verified: 2026-06-27
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: checklist

## 目的

这页专门追踪当前仍然停留在根目录兜底区、但还没有被完全收进稳定阅读结构的文档。

它回答两件事：

- 哪些页面仍然属于“待归类”
- 这些页面后续更可能往哪个模块或状态区块收

## 使用原则

- 这里不是新的长期分类
- 这里只是治理过渡区
- 一旦某页已经能稳定归入模块或状态入口，就应从这里移出

## 当前待归类关注页

### 已迁出的集成专题

下面这批页面已经物理迁入 `integrations/`，不再属于根目录待归类页：

- `integrations/wecom-chat-tool-integration-plan.md`
- `integrations/third-party-integration-architecture.md`
- `integrations/third-party-integration-consumption-model.md`
- `integrations/third-party-integration-frontend-design.md`
- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/enterprise-wecom-implementation-checklist.md`
- `integrations/lark-feishu-integration-poc.md`
- `integrations/wecom-admin-setup-checklist.md`
- `integrations/wecom-cloudflare-worker-poc.md`
- `integrations/wecom-mcp-wrapper-design.md`
- `integrations/wecom-vs-lark-integration-selection.md`

当前不再把它们视为“根目录兜底区”。

### 已迁出的 Chat / Tool 页

下面这批页面已经有稳定目录，不再属于根目录待归类页：

- `chat/chat-tool-integration-checklist.md`
- `chat/chat-tool-integration-poc.md`
- `chat/chat-tool-integration-research.md`
- `tooling-runtime/terminal-capability-checklist.md`

### 已迁出的开发支撑页

下面这批页面已经物理迁入 `developments/`，不再属于根目录待归类页：

- `developments/release-management.md`
- `developments/request-wrapper.md`
- `developments/frontend-i18n.md`
- `developments/coding-standards.md`
- `developments/defect-log.md`
- `developments/product-roadmap-priorities.md`

当前根目录对应文件仅保留为历史兼容入口。

### 仍需继续判断的根目录补充页

- `CHANGELOG.md`

建议去向：

- `CHANGELOG.md` 应长期视为按需材料，而不是默认阅读入口

## 治理动作

- [x] 第一批集成专题页已从根目录迁出
- [x] 继续减少根目录散页数量
- [x] 为仍无稳定入口的主题补 area 入口页
- [x] 把已经稳定归并的页面从本页移除
- [ ] 保证文档站中的“待归类”区块持续缩小

## 完成标准

- 待归类只剩少量真正还在判断中的页面
- 人类不再需要通过“专题文档”理解主阅读路径
- AI 不再依赖根目录散页集合来猜业务模块
