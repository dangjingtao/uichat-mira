# Chat Execution Trace 实施清单

Doc Type: checklist
Status: active
Last Updated: 2026-06-26

---

## 1. 目标

本清单用于把现有 RAG 专属 trace 升级为通用 execution trace，并优先打通 tool 的实时展示。

完成后应满足：

- Tool 与 RAG 共用同一条实时 timeline
- assistant typing 阶段即可看到 tool 节点开始运行
- assistant bubble 不再依赖独立 tool 专属过程 UI
- 现有 RAG 展示和来源行为不回退

---

## 2. 实施范围

本轮包括：

- 后端 SSE execution node 事件
- 前端协议层 execution node 适配
- parser 泛化
- timeline UI 支持 tool 节点

本轮不包括：

- execution node 入库
- 删除 `toolTrace`
- 全量重命名全部 RAG 相关文件

---

## 3. Checklist

### A. 后端事件层

- [x] 在 `server/src/services/chat-stream-events.ts` 新增 `data-execution-node` SSE 构造器
- [x] 定义统一 execution node payload 类型
- [x] 明确 `nodeType`、`phase`、`label`、`summary`、`details`、`environment` 字段约束
- [x] 保留现有 `data-tool-event`，不立即删除

### B. Tool Loop 接入

- [ ] 在 `server/src/routes/proxy-provider/chat-tool-loop.ts` 中，把 tool 的 `requested` 映射为 execution node
- [x] 把 tool 的 `running` 映射为 execution node
- [x] 把 tool 的 `succeeded` 映射为 execution node
- [x] 把 tool 的 `failed` 映射为 execution node
- [x] `nodeId` 对同一次 tool 调用保持稳定
- [x] `details` 中携带 `toolName` / `callId` / `input`
- [x] 成功态补充 `output`
- [x] 失败态补充 `errorMessage`

### C. 前端协议层

- [x] 在 `desktop/src/features/chat/core/protocol.ts` 支持 `data-execution-node`
- [x] 把 `data-execution-node` 统一映射到 `message.parts.data`
- [x] 把旧 `data-rag-node` 也统一映射到 `message.parts.data(name: "execution-node")`
- [x] 保留现有 `data-tool-event -> message:tool` 兼容逻辑
- [x] 增加协议层单测，覆盖 `data-execution-node`

### D. 前端 Parser

- [x] 在现有 parser 中支持解析 `execution-node`
- [x] 保留对旧 `rag-node` 的兼容
- [x] 为 `tool` 节点增加显示 label 规则
- [x] 为 `tool` 节点增加 summary 规则
- [x] 为 `tool` 节点 detail 提供稳定结构

### E. UI 共用层

- [x] 现有 timeline 组件支持展示 `tool` 节点
- [x] `tool` 节点在运行中显示 loading 态
- [x] `tool` 节点完成后显示 done 态
- [x] `tool` 节点失败后显示 error 态
- [x] 点击 `tool` 节点可查看输入/输出/错误详情
- [x] assistant typing 阶段也能看到 timeline 中的 tool 节点

### F. 兼容与兜底

- [ ] 保留 `message.toolTrace`
- [ ] 明确 `toolTrace` 仅作为兼容/兜底，不作为主实时展示源
- [ ] 确认刷新后没有 execution node 持久化时，旧消息不会直接崩

### G. 验证

- [x] 单测：protocol 可解析 `data-execution-node`
- [ ] 单测：runtime 接收到 execution node 后不会破坏现有消息状态
- [x] 单测：timeline 可展示 tool 节点
- [x] 单测：旧 `data-rag-node` 行为保持不变
- [x] 单测：`message.toolTrace` 兼容仍在
- [x] 单测：detail drawer 可承载 tool 输入/输出 payload

### H. 手测

- [ ] 普通聊天触发 `web_search` 时，assistant 还未出正文前即可看到 timeline 节点
- [ ] 节点完成后可展开查看 tool input / output
- [ ] tool 失败时 timeline 显示失败态
- [ ] 纯 RAG 聊天仍正常显示 rewrite / retrieve / rerank / generate
- [ ] Role + RAG + Tool 共存时，timeline 顺序仍可读
- [ ] 不绑定知识库的普通聊天不因 execution trace 改造而异常

---

## 4. 验收标准

以下条件同时满足，才算本轮完成：

- [ ] Tool 已进入与 RAG 共用的实时 timeline
- [ ] assistant typing 阶段可见 tool 过程
- [ ] 现有 RAG trace 未回退
- [ ] 没有新增独立的 tool 专属主展示 UI
- [ ] 前端和后端都有测试覆盖本轮新增链路

---

## 5. 下一阶段

本清单完成后，再评估：

- [ ] 是否把 `UChatRagExecutionTrace` 重命名为 `UChatExecutionTrace`
- [ ] 是否把 `ragParsers.ts` 重命名为 `executionParsers.ts`
- [ ] 是否把 execution node 落库
- [ ] 是否让 summary / memory 节点也统一进入 timeline

---

## 6. 关联文档

- `docs/chat-execution-trace-design.md`
- `docs/chat-tool-integration-checklist.md`
- `docs/chat-tool-integration-research.md`
- `docs/uchat.md`
