Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: Develoments
Feature: RagFlow
Doc Type: reference

# RAG LangGraph 调用流程

## 目的

本文档描述当前项目中 RAG 调用链的实际实现方式，重点说明：

- 请求从哪里进入
- `ragPipeline`、`ragGraph`、`rag-nodes` 各自承担什么职责
- 非流式和流式两条链路分别如何工作
- 当前 LangGraph 接入点在哪里

本文档基于当前代码实现整理，主要对应以下文件：

- `server/src/routes/chat-rag.ts`
- `server/src/services/rag-pipeline.ts`
- `server/src/services/rag-graph.ts`
- `server/src/services/rag-runables.ts`
- `server/src/services/rag-nodes/*.ts`

## 入口接口

RAG 相关后端入口当前分为两类：

1. `POST /proxy/chat/default`
   桌面聊天 UI 的实际默认入口。当线程 `rag_enabled = 1` 且本次消息可提取出有效用户问题时，路由会切到 `ragPipeline.assistantStream(...)`。
2. `POST /chat/rag`
   返回非流式最终结果。
3. `POST /chat/rag/stream`
   返回 SSE 流式结果。
4. `POST /chat/rag/retrieve`
   仅执行检索与重排，不执行生成。

## 分层职责

### `rag-nodes`

`server/src/services/rag-nodes/` 是最底层的能力节点，负责单步动作：

- rewrite
- embed
- retrieve
- rerank
- generate

这一层只关心单节点能力，不负责完整流程编排。

### `rag-graph`

`server/src/services/rag-graph.ts` 是当前 RAG 流程的编排核心。

它使用 `@langchain/langgraph` 的 `StateGraph` 来定义：

- 图状态
- 节点顺序
- 条件分支
- graph 原生流式输出

### `rag-pipeline`

`server/src/services/rag-pipeline.ts` 是对外服务层。

它的职责不是再次定义流程，而是：

- 非流式时调用 `ragGraph.run()`
- 流式时调用 `ragGraph.streamEvents()`
- 将 graph 事件转换成当前前端兼容的 SSE 格式

## 当前设计的优点

- 流程编排只有一份，避免多份实现漂移
- 非流式和流式都复用同一条 LangGraph 主流程
- 可以自然扩展 checkpoint、interrupt、fallback、trace
- 保留现有前端 SSE 协议，不要求 UI 立刻跟着重写

## 当前设计的边界

目前仍有一层“graph 事件 -> SSE 协议”的转换逻辑存在于 `rag-pipeline.ts`。

这意味着：

- graph 已经是主编排层
- 但 HTTP 流协议还不是 LangGraph 原生协议

这是当前为了兼容现有前端做的折中，而不是最终极形态。

## 相关文档

- `architecture/README.md`
- `../provider/README.md`
- `../evaluation/evaluation-workbench.md`
