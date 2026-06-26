# 文档总入口

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: schema
Module: docs-system
Doc Type: current-contract

## 单点真相范围

这页是当前 `docs/` 目录的总导航入口。

它主要回答：

- 先读哪几篇最划算
- 各类文档现在分别放在哪
- 哪些是当前契约，哪些只是补充或历史材料

如果你准备改运行时、聊天、平台、知识库或文档系统本身，先从这页进。

## 推荐阅读顺序

1. `../README.md`
2. `VAULT_HOME.md`
3. `architecture/README.md`
4. `uchat.md`
5. `platform/tauri.md`
6. `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`

## 核心入口

### 文档系统与阅读导航

- `VAULT_HOME.md`
- `concepts/CONCEPTS_INDEX.md`
- `maps/AREA_MAP_RUNTIME.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`

### 运行时与架构

- `architecture/README.md`
- `architecture/ipc-and-preload.md`
- `architecture/rag-node-development.md`
- `architecture/api-response-spec.md`
- `architecture/model-config-api.md`

### 对话系统

- `uchat.md`
- `uchat-internal-maintenance.md`
- `chat-system-practices.md`
- `chat-tool-integration-research.md`
- `chat-tool-integration-poc.md`
- `chat-tool-integration-checklist.md`

### 知识库

- `knowledge-base/README.md`
- `knowledge-base/api.md`
- `knowledge-base/backend-schema.md`
- `knowledge-base/markdown-workspace-mode.md`

### 平台与打包

- `platform/tauri.md`
- `platform/tauri-setup.md`
- `版本管理.md`
- `CHANGELOG.md`

### 第三方集成与扩展

- `enterprise-wecom-integration-poc.md`
- `lark-feishu-integration-poc.md`
- `wecom-vs-lark-integration-selection.md`

### 文档系统 schema

- `WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md`
- `knowledge-system/IMPLEMENTATION_ROADMAP.md`

## 当前分类规则

当前文档系统以 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 为上位参考，优先按三层理解：

- Raw sources
- Wiki
- Schema

同时还要尽量让每篇活跃文档回答三件事：

- 它属于哪一层
- 它属于哪个模块
- 它是什么文档角色

从现在开始，活跃文档的默认要求可以直接理解成四个头部字段：

- `Layer`
- `Module`
- `Doc Type`
- `Status`

如果是 current-contract、reference、overview 这类核心页，再尽量补：

- `Owner`
- `Last verified`
- `Canonical`

## 目录说明

- `architecture/`：运行时边界、API 契约、实现边界
- `platform/`：桌面壳层、构建、打包与环境
- `role/`：角色系统与 persona 相关文档
- `maps/`：区域阅读地图
- `concepts/`：概念页
- `knowledge-system/`：文档系统 schema、索引、AI 接入与可视化规则
- `archive/`：历史资料，默认不作为当前实现依据

## 阅读原则

- 先读总纲页，再读细页。
- 先把 current-contract 和 reference 页读清，再看 design / plan。
- `archive/` 只在明确需要历史背景时再进。

## 相关文档

- `WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/KNOWLEDGE_SYSTEM_INDEX.md`
