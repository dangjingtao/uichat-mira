# Role + RAG 接入清单

Layer: raw-source
Module: role
Doc Type: checklist

Status: Accepted
Owner: role / rag / runtime
Last verified: 2026-06-25

## 单点真相范围

这份清单只跟踪一件事：

- 让 `Role` 在 RAG 聊天链路里真正生效

它不覆盖：

- Role CRUD
- 普通聊天已完成的 request-only 注入
- 线程 `roleId` 持久化本身

这些内容继续以 `migration-checklist.md` 和相关设计文档为准。

## 当前现状

当前系统里：

- 普通聊天已经能在请求发送前 prepend `Role + contextSummary` request-only system messages
- RAG 入口现在会单独传递 `requestContextMessages`
- RAG graph 会把它们传到 `generate` 节点
- `generate` 节点会按 `Role -> Summary -> RAG guardrail` 的顺序合并 system prompt

所以今天的真实状态是：

- `Role` 对普通聊天生效
- `Role` 已对 RAG 生成阶段生效
- `rewrite / embed / retrieve / rerank` 仍不感知 `Role`

## 目标边界

本轮先做最小正确版：

- `Role` 只接入 RAG 的 `generate` 阶段
- 不改 `rewrite / embed / retrieve / rerank` 的职责
- 不把 `Role` 写入可见聊天消息
- 不把 `Role` 降格成普通 `conversationHistory`

## 必做清单

- [x] 在 RAG 入口显式传递线程 request context  
  验收：`rag-thread.ts` 不再只传 `question / conversationHistory / knowledgeBaseId`

- [x] 为 RAG pipeline 输入新增 `requestContextMessages` 或等价字段  
  验收：`rag-pipeline.ts` 不再只依赖单个 `systemPrompt?: string`

- [x] 为 RAG graph state 增加 request context 承载位  
  验收：`rag-graph.ts` state 中可稳定传递 Role / Summary / future memory

- [x] 在 `generate.service.ts` 合并 Role 上下文与 RAG guardrail  
  验收：最终生成请求同时具备：
  - 角色身份与语气
  - 知识库优先回答规则
  - 检索片段上下文

- [x] 明确 Role 与 RAG 默认 system prompt 的拼接顺序  
  验收：顺序有测试，不能靠人工记忆

## 本轮明确不做

当前状态说明：

- [x] 不让 `Role` 进入 `rewrite` 节点
- [x] 不让 `Role` 进入 `retrieve` / `rerank` 节点
- [x] 不把 `Role` 直接塞回 `conversationHistory`
- [x] 不把 `Role` 改造成知识库 document / chunk

验证：

- `rag-graph.test.ts` 已证明 request-only `Role` 不会传入 `rewrite`，而是仅在 `generate` 节点消费
- `rag-graph.test.ts` 已证明 `retrieve` / `rerank` 输入中不携带 `requestContextMessages`
- `chat.routes.test.ts` 已证明即使 RAG 请求自带可见历史，`conversationHistory` 仍只保留非 system 的可见消息，Role 仅存在于 `requestContextMessages`
- `rag-graph.test.ts` 已证明最终 `retrievedChunks / rerankedChunks / sources` 只来源于检索链路，Role 不会被降格成 document / chunk

## 测试清单

- [x] 单测：RAG 分支会把线程 request context 传到 generate 之前  
  验收：能证明 Role request context 没在中途丢失

- [x] 单测：无 Role 时 RAG 现有行为保持不变  
  验收：老用例继续通过

- [x] 单测：Role + Summary 顺序稳定  
  验收：角色骨架先于线程动态摘要

- [x] 单测：RAG 默认 guardrail 没被 Role 覆盖掉  
  验收：仍保留“优先依据知识库、无命中则拒答”的规则

- [x] 路由测试：线程绑定 Role 的 RAG 请求能进入正确链路  
  验收：`proxy-provider` 的 thread + knowledge base + role 组合路径覆盖

## 已完成实现

- [x] 普通聊天通过线程 request context 注入 `Role + contextSummary`
- [x] RAG 聊天通过独立 `requestContextMessages` 把线程上下文传到 `generate`
- [x] `Role` 不进入 `rewrite / retrieve / rerank`
- [x] `Role` 不进入可见聊天消息
- [x] `Role -> Summary -> RAG guardrail` 顺序已固定并有测试保护
- [x] 后端相关单测、路由测试、coverage 入口已通过

## 人工验收

- [x] 同一线程绑定 Role 后发起普通聊天，角色行为生效
- [x] 同一线程绑定 Role 后发起 RAG 聊天，角色语气与身份也生效
- [x] RAG 回答仍然保留知识库引用和拒答边界
- [x] 切换 Role 后再次发起 RAG，请求行为跟随变化

手测结论：

- `Role + 非空知识库 + 高命中问题`：通过
- `Role + 非空知识库 + 低命中问题`：通过
- `仅 Role，无知识库`：通过
- `关闭知识库后继续同线程普通聊天`：通过
- `刷新 / 重进线程后 Role 展示恢复`：通过
- `附件消息`：通过
- `线程内解绑 Role`：通过

本轮不纳入阻塞的说明：

- 空知识库入口已经在产品上禁选，本轮不再单独作为人工验收项
- 解绑 `Role` 后若仍感觉有少量“旧线程气味”，当前默认归因于 `contextSummary` 仍保留并继续作为 request-only context 注入，这属于现有设计，不视为本轮阻塞缺陷

### 点验步骤

1. 在聊天欢迎态选择一个有明显语气特征的 Role。
2. 绑定一个非空知识库，发送首条消息创建线程。
3. 确认线程创建后：
   - 线程 metadata 带上 `roleId`
   - 聊天头部和输入框旁显示选中的 Role 标签
   - 助手头像替换为 Role 头像
4. 在该线程下发起一次普通聊天，确认回复语气受 Role 影响。
5. 在同一线程绑定知识库后发起 RAG 聊天，确认：
   - 回答语气仍受 Role 影响
   - 回答仍遵守知识库优先与无命中拒答边界
6. 在同一线程切换到另一个 Role，再次提问，确认回复风格发生变化。
7. 刷新或重新进入该线程，确认 `roleId`、头像、标签、typing label 正常恢复。

## 风险提醒

- [ ] 把 Role 误接到 rewrite，导致检索 query 被人设污染
- [ ] 只在 route 层硬拼字符串，没有进入统一 graph / node 输入
- [ ] Role system prompt 覆盖了 RAG guardrail
- [ ] 后续 memory / tool policy 继续沿用临时字符串拼接，破坏扩展位
- [x] `contextSummary` 在解绑 Role 后仍会继续生效
  说明：这是当前保留设计，不自动联动清空；它可能带来轻微的“旧线程气味”，但不代表 Role 解绑失败

## 下一阶段

- [ ] 收口 RAG 历史窗口策略  
  当前 `rewrite` 只看最近 6 条，但 `generate` 仍会吃完整历史；后续需要统一成“最近窗口 + summary + memory + role”

- [ ] 接入 role-level memory resolver  
  目标：让一个 Role 能跨线程复用稳定记忆，而不是只靠当前线程历史

- [ ] 接入 tool policy / tool constraints resolver  
  目标：Role 不只是“说话像谁”，还要约束“怎么用工具”

- [ ] 增加 request-only 调试视图  
  目标：能在调试时看到本次请求实际吃到的 `Role / Summary / Memory / Tool policy`

## 完成条件

以下条件同时满足，才算这一轮 RAG 接 Role 完成：

- [x] Role 在普通聊天和 RAG 聊天中都生效
- [x] Role 不出现在可见聊天消息列表中
- [x] RAG 检索与重排行为不被 Role 干扰
- [x] generate 节点稳定吃到 Role + Summary + retrieval context
- [x] server 相关测试通过
- [x] 关键桌面端联调路径点验通过

## 相关文档

- [[role/README]]
- [[role/chat-integration]]
- [[role/prompt-injection-design]]
- [[role/migration-checklist]]
