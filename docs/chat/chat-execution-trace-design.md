# Chat Execution Trace 统一设计草案

Layer: raw-source
Module: Chat
Feature: ExecutionTrace
Doc Type: design
Status: Planned
Owner: chat / runtime
Last verified: 2026-06-26

---

## 1. 背景

当前 chat 界面里已经存在一条稳定的 RAG 实时展示链路：

1. 后端通过 SSE 发出 `data-rag-node`
2. 前端协议层把它转成 `message.parts` 中的 `data` part
3. `ragParsers.ts` 解析这些 `data` part
4. `UChatRagExecutionTrace` 渲染为 assistant 气泡上方的时间线

这条链路已经验证过：

- 可以实时展示
- 与 assistant 回复共存
- 刷新后仍可通过 runtime reconciliation 保留一部分过程态

但工具调用目前走的是另一条链路：

1. 后端 SSE 发出 `data-tool-event`
2. 前端协议层转成 `message:tool`
3. runtime 把结果 patch 到 `message.toolTrace`
4. UI 再读取 `message.toolTrace` 做额外展示

这会造成三个问题：

- Tool 与 RAG 走两套展示机制
- Tool 无法自然复用 RAG 的实时 timeline
- 未来接入 summary / memory / MCP / skill 时，chat UI 会持续分裂

因此需要把现有 RAG trace 提升为通用 execution trace。

---

## 2. 目标

本轮目标不是推翻现有实现，而是在最小破坏下，把 RAG 专属 trace 升级为通用 execution trace。

目标如下：

- 普通聊天、RAG、tool、summary、memory 都能进入同一条请求执行时间线
- assistant bubble 只负责正文、失败结果和来源入口
- 执行过程统一由 timeline 展示
- 前端不再为不同能力单独发明新的过程 UI
- 保持现有 RAG 实时展示不回退
- 保留 `message.toolTrace` 作为兼容和兜底数据，不作为主实时展示源

---

## 3. 非目标

本轮暂时不做：

- 不做 thread 级全局运行图
- 不做 execution trace 入库 schema 重构
- 不删除 `toolTrace`
- 不重写现有 RAG graph
- 不要求普通 chat 和 RAG 立刻共享同一后端编排器
- 不把所有 UI 组件立即重命名

---

## 4. 核心判断

### 4.1 统一的是“执行轨迹”，不是“消息正文”

chat 消息里有两类信息：

- 可见回复正文
- 请求执行过程

正文继续存在于 `message.parts.text`

执行过程应该统一存在于 `message.parts.data`

不要再把 tool 的过程态主要挂在 `message.toolTrace` 上，因为那会把“过程”重新绑回“消息附属字段”，而不是一条可扩展的执行事件流。

### 4.2 RAG 现有链路是正确雏形

RAG 现在最大的价值，不是它叫 RAG trace，而是它已经证明：

- `SSE -> data part -> parser -> timeline UI`

这条路径适合表达请求执行过程。

所以本轮不是重造，而是泛化。

---

## 5. 统一事件模型

建议新增统一 SSE 事件：

```ts
type AssistantExecutionNodeEvent = {
  nodeId: string;
  nodeType:
    | "rewrite"
    | "embed"
    | "retrieve"
    | "rerank"
    | "tool"
    | "generate"
    | "summary"
    | "memory";
  phase: "start" | "done" | "error";
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  environment?: Record<string, unknown>;
};
```

对应 SSE：

```ts
{
  type: "data-execution-node",
  data: AssistantExecutionNodeEvent
}
```

### 5.1 Tool 节点映射

tool 事件不再只发 `data-tool-event`，而是同时映射成 execution node：

```ts
{
  nodeId: callId ?? "tool-web_search-1",
  nodeType: "tool",
  phase: "start",
  label: "web_search",
  summary: "正在调用 web_search",
  details: {
    toolName: "web_search",
    callId,
    input
  }
}
```

完成态：

```ts
{
  nodeId: callId ?? "tool-web_search-1",
  nodeType: "tool",
  phase: "done",
  label: "web_search",
  summary: "web_search 已完成",
  details: {
    toolName: "web_search",
    callId,
    input,
    output
  }
}
```

失败态：

```ts
{
  nodeId: callId ?? "tool-web_search-1",
  nodeType: "tool",
  phase: "error",
  label: "web_search",
  summary: "web_search 调用失败",
  details: {
    toolName: "web_search",
    callId,
    input,
    errorMessage
  }
}
```

### 5.2 RAG 节点兼容

RAG 原来的 `data-rag-node` 先继续保留。

前端协议层做兼容归一：

- `data-rag-node` -> `message.parts.data(name: "execution-node")`
- `data-execution-node` -> `message.parts.data(name: "execution-node")`

这样 UI 不再区分来源。

---

## 6. 前端数据模型

### 6.1 主实时展示源

主实时展示源统一为：

- `message.parts` 中的 `data` part
- `name === "execution-node"`

### 6.2 兼容兜底

`message.toolTrace` 暂时保留，只承担：

- 旧消息兼容
- runtime patch 兜底
- 刷新未持久化时的辅助恢复

但 timeline UI 不应优先读它。

### 6.3 Parser 演进

当前：

- `ragParsers.ts`
- `getRagProgressFromRenderableParts`

目标：

- 文件短期可不改名
- 内部先支持 `execution-node`
- 长期建议改为：
  - `executionParsers.ts`
  - `getExecutionProgressFromRenderableParts`

---

## 7. UI 统一策略

### 7.1 主展示

统一使用现有 timeline 形态：

- assistant 气泡上方
- 可折叠
- 节点顺序展示
- 每个节点可查看 detail drawer

### 7.2 assistant bubble 内的职责

assistant bubble 主要保留：

- 正文
- 失败提示
- 来源入口

不再持续堆叠独立的 process 卡片。

### 7.3 Tool 节点详情

tool 节点详情建议复用现有 detail drawer 的结构，不新造单独 modal：

- 工具名
- callId
- input
- output
- error

如果 detail drawer 当前字段命名过于 RAG 化，再做第二轮收口。

---

## 8. 实施分阶段

### Phase 1. 最小兼容迁移

- 后端新增 `data-execution-node`
- tool loop 在 requested/running/succeeded/failed 时同步发 execution node
- 前端协议层支持把 `data-rag-node` 和 `data-execution-node` 都映射到 `execution-node`
- parser 支持 `tool` 节点
- timeline UI 先显示 tool 节点

### Phase 2. 命名收口

- `UChatRagExecutionTrace` -> `UChatExecutionTrace`
- `ragParsers.ts` -> `executionParsers.ts`
- detail drawer 文案去 RAG 化

### Phase 3. 持久化与历史回放

- 决定 execution node 是否写入 message parts 持久化
- 决定 `toolTrace` 是否降级为只读兼容字段

---

## 9. 风险与取舍

### 9.1 风险较低

- 协议层增加新事件类型
- parser 支持一个新 nodeType
- timeline 文案支持 tool

### 9.2 中风险

- 现有 RAG detail drawer 的字段语义偏 RAG，tool 节点接入后可能显得别扭
- 若其他后端路径只会发 `data-rag-node`，需要兼容保留更久

### 9.3 本轮避免的高风险

- 直接删除 `toolTrace`
- 一次性大范围重命名所有组件和文件
- 强行把普通 chat 和 RAG graph 编排器合并

---

## 10. 建议结论

建议立即按 Phase 1 开始，不等待完整命名收口。

原因：

- 实时展示缺失的根因已经明确
- 现有 RAG trace 已经是可复用基础设施
- 先打通 execution node，比继续加 Tool 专属 UI 更稳

---

## 11. 关联文档

- `docs/chat/chat-tool-integration-research.md`
- `docs/chat/chat-tool-integration-checklist.md`
- `docs/uchat.md`
- `docs/role/rag-integration-checklist.md`
