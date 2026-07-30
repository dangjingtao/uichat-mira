# Agent Workspace Context System

Status: Draft
Owner: chat / runtime
Last verified: 2026-06-29
Layer: design
Module: Chat
Feature: AgentWorkspaceContext
Doc Type: design
Related:
  - agent-runtime-design.md
  - ../architecture/context-budget-runtime.md
  - ../knowledge-base/markdown-workspace-mode.md
  - ../tooling-runtime/project-map-design.md
  - ../tooling-runtime/context-builder-design.md

## 单点真相范围

这页定义“智能体 path / 当前 workspace”上的上下文系统。

它不是全局仓库索引，而是围绕当前选中的 workspace root 构建：

- project map
- document map
- code symbols
- keywords
- 最小上下文包

## 核心目标

Agent 不能直接面对整个仓库或整坨文档。

它必须先拿到当前 workspace 的项目地图，再由 Context Builder 组装最小但充分的上下文。

## 边界

当前系统里的 workspace 边界已经存在：

- backend 通过 `workspaceRoot` / `cwd` 约束路径
- Agent request context 已注入 `workspaceRoot`、`cwd`、`availableTools`
- Markdown workspace 模式已经承认“工作空间文件夹”这个产品形态

所以这里的上下文系统必须只围绕当前 workspace root 工作，不扫描全仓库。

## 推荐落地顺序

### Step 1: Project Map

必须先做。

输入：

- `workspaceRoot`

输出：

- modules
- files
- symbols
- docs
- keywords

### Step 2: Context Builder 最小版

只做：

- module
- doc
- code chunk

### Step 3: embedding + rerank

最后再加，做候选重排，不做基础索引。

## Project Map 的职责

Project Map 要回答：

- 当前任务属于哪个模块
- 相关代码在哪
- 相关 workspace 文档在哪
- 哪些符号最相关

它不是展示用索引，而是给 Agent 用的基础地图。

## Context Builder 的职责

Context Builder 只消费 Project Map。

它负责把：

- 模块
- 文档摘要
- 代码 chunk

组装成适合当前任务的上下文包。

## 实施原则

- 先 Project Map，后 Context Builder，最后 embedding / rerank
- 不要先上 embedding 再补地图
- 不要把全仓库索引塞给 workspace agent
- 不要把 markdown workspace 当成第二套 RAG

## MVP 目标

第一版只要做到：

- 能识别当前 workspace root
- 能生成 workspace project map
- 能基于 map 产出最小上下文包
- 能解释为什么选中这些内容

