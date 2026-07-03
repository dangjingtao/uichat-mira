# Project Map 自动生成器

Status: Draft
Owner: runtime
Last verified: 2026-06-29
Layer: design
Module: Tool
Feature: ProjectMap
Doc Type: design
Related:
  - README.md
  - harness-runtime-design.md
  - harness-assessment-2026-06-28.md

## 单点真相范围

这页定义 Harness Step 1：Project Map 自动生成器。

它的目标不是“理解整个仓库”，而是先把仓库变成：

```text
modules + files + symbols + docs + keywords
```

后续 Context Builder 只能在这张地图上工作。

如果没有 Project Map，后面的检索都会变成瞎检索。

## 核心目标

Project Map 要回答：

- 这个问题属于哪个模块
- 应该看哪些文件
- 应该读哪些文档
- 哪些函数最相关

它不是展示面，而是给 LLM 用的基础索引层。

## 输入 / 输出

### 输入

- project root path

### 输出

```json
{
  "project": "my-app",
  "modules": [
    {
      "name": "model-provider",
      "paths": ["src/main/providers", "src/db/provider"],
      "docs": ["docs/model-provider.md"],
      "keywords": ["provider", "apiKey", "baseUrl"],
      "files": [
        {
          "path": "src/main/providers/openai.ts",
          "symbols": ["createClient", "sendChat"],
          "type": "code"
        }
      ]
    }
  ]
}
```

## 模块划分规则

### 目录优先

- `src/main/providers` -> `model-provider`
- `src/renderer/pages/ModelConfig` -> `model-ui`
- `src/main/rag` -> `rag-system`

### 关键词聚类

扫描来源：

- 文件名
- import
- function name
- comment

示例：

- `provider` / `apiKey` / `baseUrl` -> `model-provider`
- `embedding` / `rerank` / `vector` -> `rag-system`
- `chat` / `message` / `conversation` -> `chat-system`

### Fallback

无法分类时：

- `misc`
- `unknown-module`

## 文件分析

每个文件至少要产出：

```ts
type FileSummary = {
  path: string;
  module: string;
  type: "ui" | "server" | "db" | "service" | "util";
  symbols: string[];
  keywords: string[];
};
```

### symbols 提取

优先从 AST 提取：

- function
- class
- const handler
- export function
- React component
- store methods

## 文档处理

docs 不做全文 embedding 起步。

先做：

- 3 ~ 8 行 summary
- keywords

示例：

- Model Provider 文档
  - 定义 provider 生命周期
  - 支持 openai / anthropic / local model
  - 统一 chat-completions adapter
  - keywords: provider, api, model, adapter

## 增量更新

不要全量重建。

用 git diff，只处理：

- 新增文件
- 修改文件
- 删除文件

## 最小实现

MVP 只要求：

- 能扫目录
- 能分类 module
- 能提 symbol
- 能生成 JSON

## 推荐架构

```text
scanFiles()
  ↓
parseAST()
  ↓
extractSymbols()
  ↓
assignModule()
  ↓
buildDocIndex()
  ↓
buildProjectMap()
  ↓
save sqlite / json
```
