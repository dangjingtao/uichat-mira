# docs/ 索引

Status: Current
Owner: docs
Last verified: 2026-07-23
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: current-contract
Canonical: true
Related:
  - ENGINEERING_MEMORY.md
  - VAULT_HOME.md
  - WIKI_SYSTEM_SCHEMA.md
  - knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md
  - harness/agentgraph-harness-protocol.md

## 这页干什么

`docs/` 的入口页。别把它当说明书，它就是目录。

## 先看

- `ENGINEERING_MEMORY.md`
- `VAULT_HOME.md`
- `WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`
- `architecture/README.md`
- `harness/agentgraph-harness-protocol.md`
- `harness/README.md`
- `tooling-runtime/README.md`
- `concepts/CONCEPT_MCP.md`
- `uchat.md`
- `platform/tauri.md`

## 推荐阅读顺序

1. `../README.md`
2. `ENGINEERING_MEMORY.md`
3. `VAULT_HOME.md`
4. `architecture/README.md`
5. `uchat.md`
6. `harness/agentgraph-harness-protocol.md`
7. `harness/README.md`
8. `tooling-runtime/README.md`
9. `concepts/CONCEPT_MCP.md`
10. `platform/tauri.md`
11. `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`

## 目录

### 文档系统

- `ENGINEERING_MEMORY.md`
- `VAULT_HOME.md`
- `concepts/CONCEPTS_INDEX.md`
- `concepts/CONCEPT_AGENT.md`
- `maps/AREA_MAP_RUNTIME.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`

### 运行时

- `architecture/README.md`
- `architecture/ipc-and-preload.md`
- `architecture/rag-node-development.md`
- `architecture/rag-langgraph-flow.md`
- `architecture/api-response-spec.md`
- `architecture/model-config-api.md`
- `architecture/model-settings-roadmap.md`
- `architecture/context-budget-runtime.md`

### SKILL

- `skill/README.md`（Skill 当前定义与边界）
- `skill/skill-runtime-design.md`（Skill Runtime V1 设计）

### 对话

- `chat/README.md`
- `uchat.md`
- `uchat-internal-maintenance.md`
- `chat/agent-loop-v1.7-construction-plan.md`
- `chat/chat-system-practices.md`
- `chat/agent-frontend-workspace-smoke-method.md`
- `chat/chat-tool-integration-research.md`
- `chat/chat-tool-integration-poc.md`
- `chat/chat-tool-integration-checklist.md`
- `chat/agent-swot-plan.md`
- `chat/agent-runtime-design.md`（历史设计输入，非当前合同）

### 知识库

- `knowledge-base/README.md`
- `knowledge-base/api.md`
- `knowledge-base/backend-schema.md`
- `knowledge-base/markdown-workspace-mode.md`

### 平台

- `build/README.md`
- `build/terminal-dev-runtime.md`
- `build/local-model-packaging.md`
- `platform/tauri.md`
- `platform/tauri-setup.md`
- `CHANGELOG.md`

### 开发支撑

- `development/agent-observability.md`
- `developments/README.md`
- `developments/project-general-cleanup.md`
- `developments/frontend-route-navigation-protocol.md`
- `developments/release-management.md`
- `developments/request-wrapper.md`
- `developments/frontend-i18n.md`
- `developments/coding-standards.md`
- `developments/defect-log.md`
- `developments/product-roadmap-priorities.md`
- `project-control/README.md`
- `project-control/model-settings-workboard.md`

### 集成

- `microapp/README.md`
- `microapp/office-runtime-task-contract.md`（文枢 Office Runtime 当前任务合同）
- `microapp/office-suite-microapp-design.md`
- `microapp/jianxing-webbridge-debug-status.md`
- `microapp/tts-studio-runtime-notes.md`
- `integrations/wecom-admin-setup-checklist.md`
- `integrations/wecom-cloudflare-worker-poc.md`
- `integrations/enterprise-wecom-implementation-checklist.md`
- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/wecom-microapp-interface-design.md`
- `integrations/wecom-instance-capability-design.md`
- `integrations/wecom-instance-capability-implementation-checklist.md`
- `integrations/third-party-integration-backend-design.md`
- `integrations/wecom-robot-phase-1-retrospective.md`
- `integrations/lark-feishu-integration-poc.md`
- `integrations/third-party-integration-architecture.md`
- `integrations/third-party-integration-frontend-design.md`
- `integrations/third-party-integration-consumption-model.md`
- `integrations/wecom-chat-tool-integration-plan.md`
- `integrations/wecom-mcp-wrapper-design.md`
- `integrations/wecom-vs-lark-integration-selection.md`

### 工具运行时

- `tooling-runtime/harness-runtime-design.md`
- `tooling-runtime/read-skill-design.md`
- `tooling-runtime/agent-runtime-t29-t33-ledger.md`
- `tooling-runtime/terminal-capability-checklist.md`
- `tooling-runtime/tools-protocol.md`
- `tooling-runtime/tools-ecosystem-research.md`
- `tooling-runtime/tool-runtime-retrospective-2026-06-27.md`

### Harness / Agent Runtime

- `harness/agentgraph-harness-protocol.md`（Agent 当前运行时单点真相）
- `harness/README.md`
- `development/agent-observability.md`
- `harness/harness-assessment-2026-06-28.md`
- `harness/harness-phase-1-implementation-checklist.md`
- `harness/sandbox-module.md`（历史沙箱资料，不能覆盖当前 Host Runtime 合同）

### 文档系统 schema

- `WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md`
- `knowledge-system/IMPLEMENTATION_ROADMAP.md`

## 当前规则

当前文档系统以 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 为上位参考，优先按三层理解：

- Raw sources
- Wiki
- Schema

同时尽量让每篇活跃文档回答三件事：

- 它属于哪一层
- 它属于哪个模块
- 它是什么文档角色

活跃文档默认看这四个头部字段：

- `Layer`
- `Module`
- `Doc Type`
- `Status`

如果是 current-contract、reference、overview 这类核心页，再补：

- `Owner`
- `Last verified`
- `Canonical`

## 目录说明

- `microapp/`：微应用模块定义、接入点绑定关系、跨平台业务工作流边界
- `skill/`：Skill 当前定义、内部状态、多工具编排、业务语义封装与 Skill Runtime 设计
- `architecture/`：运行时边界、API 契约、实现边界
- `build/`：构建、打包、release 产物与测试报告入包规则
- `platform/`：桌面壳层与平台运行环境
- `developments/`：版本、请求封装、i18n、工程规范、缺陷台账、路线规划
- `project-control/`：任务台账、任务卡、评审、决策与阶段归档
- `role/`：角色系统与 persona 相关文档
- `maps/`：区域阅读地图
- `concepts/`：概念页
- `knowledge-system/`：文档系统 schema、索引、AI 接入与可视化规则
- `archive/`：历史资料，默认不作为当前实现依据

## 阅读顺序

- 先读 `ENGINEERING_MEMORY.md`，再进入具体 current-contract。
- 先读总纲页，再读细页。
- 先把 current-contract 和 reference 页读清，再看 design / plan。
- Agent 相关施工、评审和架构说明必须先读 `harness/agentgraph-harness-protocol.md`。
- `archive/` 和 superseded 文档只在明确需要历史背景时再进。

## 相关页

- `ENGINEERING_MEMORY.md`
- `WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`
- `harness/agentgraph-harness-protocol.md`
