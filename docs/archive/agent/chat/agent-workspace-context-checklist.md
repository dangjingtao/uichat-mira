# Agent Workspace Context Checklist

Status: Planned
Owner: chat / runtime
Last verified: 2026-06-29
Layer: raw-source
Module: Chat
Feature: AgentWorkspaceContext
Doc Type: checklist
Related:
  - agent-workspace-context-system.md
  - agent-runtime-design.md
  - ../architecture/context-budget-runtime.md
  - ../knowledge-base/markdown-workspace-mode.md
  - ../tooling-runtime/project-map-design.md
  - ../tooling-runtime/context-builder-design.md

# Phase Goal

把智能体的 workspace/path 上下文系统做成一条可落地主线。

这条主线只服务当前 `workspaceRoot`，不做全仓库索引，也不把 markdown workspace 变成第二套 RAG。

最终目标是让 Agent 先有 `Project Map`，再有最小 `Context Builder`，最后才考虑 `embedding + rerank`。

# Global Principles

1. 先地图，后检索，最后再加重排。
   - 没有 `Project Map` 之前，不允许先把 embedding 当基础设施。
   - `Context Builder` 只能消费地图，不直接扫整个仓库。

2. 只做当前 workspace。
   - 输入边界是当前 `workspaceRoot`。
   - 不扫描整个 repo。
   - 不把 workspace context 做成全局知识库。

3. 先可解释，再变聪明。
   - 每次命中都要能解释为什么选中。
   - 先保证 module / doc / code chunk 选取稳定，再补 embedding。

4. 复用现有上下文。
   - 复用 `workspaceRoot` / `cwd` / `availableTools`。
   - 复用现成 context budget。
   - 不要重复造一套 agent token budget。

# Scope

本期主链：

- `Project Map` 自动生成。
- `Project Map` 只覆盖当前 workspace root。
- 最小 `Context Builder`。
- `module + doc + code chunk` 三段式上下文。
- 基于 `git diff` 的增量更新。
- 解释性输出：为什么命中这些内容。

本期最后再做：

- `embedding + rerank`。

本期不做：

- 全仓库索引。
- 第二套 RAG。
- 先做 embedding 再补地图。
- 把 context builder 直接焊死到单一检索策略。

# Implementation Checklist

## 1. Boundary Lock

- [ ] 明确上下文系统只接受当前 `workspaceRoot`。
- [ ] 明确只处理 workspace 内路径，不跨边界读整个 repo。
- [ ] 明确 workspace 与 repo 的关系：workspace 是任务边界，不是全局索引边界。
- [ ] 明确 Agent 上下文输入里 `workspaceRoot` 的来源与传递链。

## 2. Project Map

- [ ] 实现 `Project Map` 自动生成器。
- [ ] 输出 `modules`。
- [ ] 输出 `files`。
- [ ] 输出 `symbols`。
- [ ] 输出 `docs`。
- [ ] 输出 `keywords`。
- [ ] 为每个文件生成最小摘要。
- [ ] 为每个模块生成稳定命名规则。
- [ ] 为无法分类内容提供 `misc` / `unknown` fallback。
- [ ] 支持基于目录、文件名、import、symbol、comment 的模块归类。
- [ ] 支持 workspace 级增量更新。

## 3. Project Map Incremental Update

- [ ] 只处理 `git diff` 相关文件。
- [ ] 新增文件进入 map。
- [ ] 修改文件重新解析。
- [ ] 删除文件从 map 移除。
- [ ] 保留上一次 map 的稳定 id / path 关联。
- [ ] 记录 map 的更新时间与变更来源。

## 4. Context Builder Minimal

- [ ] 实现最小 `Context Builder`。
- [ ] 只从 `Project Map` 取候选内容。
- [ ] 只组装 `module + doc + code chunk`。
- [ ] 支持按任务类型做预算偏移。
- [ ] 支持输出 freshness。
- [ ] 支持输出 confidence。
- [ ] 支持输出命中原因。

## 5. Code Chunking

- [ ] 定义 code chunk 的切分规则。
- [ ] 保持 chunk 与 symbol 的关联。
- [ ] 保持 chunk 与 path 的关联。
- [ ] 避免 chunk 过大导致上下文膨胀。
- [ ] 避免只切碎片而丢失局部语义。

## 6. Document Index

- [ ] 对 workspace 文档产出短摘要。
- [ ] 为文档生成 keywords。
- [ ] 文档优先按 workspace 相关性收敛，不做全文硬塞。
- [ ] 保持文档与 module 的关联可解释。

## 7. Ranking Strategy

- [ ] 先做规则与结构召回。
- [ ] 再做最小 context 组装。
- [ ] 最后才引入 embedding。
- [ ] `embedding + rerank` 只做候选重排，不做地图替代。

## 8. Debug / Observability

- [ ] 输出当前 workspaceRoot。
- [ ] 输出命中的 module 列表。
- [ ] 输出命中文档列表。
- [ ] 输出命中的 code chunk 列表。
- [ ] 输出最终选择原因。
- [ ] 输出被丢弃候选的原因。

## 9. Integration

- [ ] 将 `Project Map` 接到 Agent 的上下文准备链。
- [ ] 将 `Context Builder` 接到 Agent 的输入前流程。
- [ ] 保持现有 chat / harness 路径不回退。
- [ ] 不把 workspace context 误接成全局检索入口。

# Unit Test Checklist

## Backend

- [ ] `Project Map` 能只扫当前 workspace root。
- [ ] `Project Map` 能产出 module / file / symbol / doc / keyword。
- [ ] `Project Map` 增量更新只影响 diff 范围。
- [ ] 删除文件会从 map 清理。
- [ ] `Context Builder` 只消费 map，不直接扫全仓库。
- [ ] `Context Builder` 能输出 freshness / confidence / reason。
- [ ] `Context Builder` 在不同任务类型下预算偏移有效。
- [ ] embedding / rerank 未启用时，基础链路仍能工作。

## Integration

- [ ] workspaceRoot 变化后，map 会切换到对应 workspace。
- [ ] 当前 workspace 外文件不会被选入上下文。
- [ ] Agent 输入链能收到 context builder 的结果。
- [ ] 诊断信息能回到 trace / debug 面。

# Developer Verification

- [ ] 运行 `pnpm check`。
- [ ] 跑 `Project Map` 生成与增量更新测试。
- [ ] 跑 `Context Builder` 单测。
- [ ] 跑 workspace boundary 集成测试。
- [ ] 用一个小 workspace 手测：只命中当前 workspace 内容。
- [ ] 手测 `git diff` 更新后 map 是否只刷新变更文件。

# Completion Criteria

- [ ] 当前 workspace 能稳定生成 `Project Map`。
- [ ] `Context Builder` 能基于 map 产出最小上下文包。
- [ ] `module + doc + code chunk` 链路可解释。
- [ ] 增量更新可用。
- [ ] `embedding + rerank` 作为后置增强而不是基础前提。
- [ ] `pnpm check` 通过。
