---
status: current
priority: P1
owner: chat
last_verified: 2026-07-15
layer: project-control
module: Chat
feature: ChatMediaIntegration
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/chat/uchat-governance/boundary-contract.md
  - desktop/src/shared/uchat/core/types.ts
  - desktop/src/shared/uchat/core/runtime.ts
  - desktop/src/features/chat/core/runtimePolicies.ts
  - desktop/src/features/chat/components/UChatThread.tsx
task_state: DONE
---

# microapp_chat_T002 Thread Media Capabilities And Orchestration

## Target

在不修改 ChatRuntime 核心实现的前提下，接入线程媒体开关和助手消息完成后的 TTS/生图任务。优先复用现有 `ChatSendLifecyclePolicy.afterSendSuccess`。

## Prerequisite

- `microapp_chat_T001` 已提供媒体持久化和读取/清理接口。
- TTS 与生图微应用已有配置和可调用服务。

## Core Principles

- 不得为了通过测试、冒烟或类型检查而修改已有业务核心逻辑。
- 不得触碰或改变既定的 AgentGraph、RAG、Chat、Role 业务边界。
- 如果现有 ChatRuntime、流式协议、RAG 或 Role 行为与本卡目标冲突，必须记录冲突并停止扩大范围，不得通过修改核心逻辑解决。
- 媒体任务只能在既有助手消息完成后接入，不能反向参与文本生成、RAG 检索或 Role prompt 编排。

## Allowed Changes

- `desktop/src/features/chat/core/runtimePolicies.ts`
- `desktop/src/features/chat/components/UChatThread.tsx`
- `desktop/src/features/chat/components/roleChatState.ts` 或同层的媒体状态解析辅助文件
- `desktop/src/features/chat/adapters/**` 中聊天媒体 API 适配
- `desktop/src/shared/api/**` 中已有 TTS/生图 API 的聊天侧调用封装
- `server/src/routes/thread/**` 中线程媒体开关所需的最小协议调整
- 直接相关的 desktop/server tests 和本任务卡

## Forbidden Changes

- `desktop/src/shared/uchat/core/**` 的 canonical message、runtime、send protocol 改造
- AgentGraph
- RAG rewrite/retrieve/rerank/generate
- Chat 文本发送、SSE/流式协议和历史上下文核心逻辑
- Role 数据模型、prompt 注入和请求编排
- TTS/生图微应用详细配置页面、provider/model/voice/图片参数选择

## Behavior Contract

- TTS 开关在 chat、RAG、RP、RP + RAG 中都可用。
- 图片按钮只在 `roleId && !knowledgeBaseId` 时显示。
- RP 且无知识库时，图片能力默认开启并在助手回复完成后自动生成。
- RP + RAG 时图片按钮不显示，不发起生图请求。
- provider、模型和详细参数由微应用配置解析，聊天侧不选择。
- 媒体任务只消费已完成的助手消息和现有 Role/RAG 状态，不进入图编排或文本生成过程。

## Acceptance Criteria

1. 线程开关在欢迎态 draft 和已创建线程之间正确传递并持久化。
2. 切换 Role/知识库时按钮状态符合上述规则。
3. 助手文本完成后触发媒体任务，不影响文本消息完成、RAG 来源和执行 trace。
4. 媒体任务完成后能把任务结果绑定回对应助手消息。
5. TTS 和生图请求均使用微应用当前配置，不新增聊天侧详细配置。
6. 不修改 `ChatRuntime`、AgentGraph、RAG、Chat、Role 核心逻辑。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/features/chat/components/UChatThread.test.tsx src/features/chat/components/roleChatState.test.ts src/features/chat/adapters/chatMediaOrchestration.test.ts`：20 tests passed；覆盖 GPT 专用调用、服务端 `refAudioId`、未绑定拒绝和不读取 IndexedDB
- `pnpm --filter @ui-chat-mira/server exec vitest run src/microapps/tts/index.test.ts src/routes/thread/threads.routes.test.ts src/services/chat-media.service.test.ts`：27 tests passed；覆盖 Provider 配置 `serverRefAudioId`、服务端参考音频元数据唯一匹配并持久化绑定、绑定解析、稀疏配置补齐、明确失败、GPT 调用路径及 `refAudioId/refAudioPath` 任务审计字段
- T001 全量回归：`pnpm --filter @ui-chat-mira/server exec vitest run src/services/chat-media.service.test.ts src/db/repositories/image-generation-jobs.repository.test.ts src/routes/thread/threads.routes.test.ts src/services/thread.service.test.ts src/routes/microapps/index.test.ts`：5 files、44 tests passed
- `pnpm --filter @ui-chat-mira/desktop typecheck`：passed
- `pnpm --filter @ui-chat-mira/server typecheck`：passed
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm check`：passed（默认 Node 堆上限运行曾因 Windows OOM 中止，无类型诊断）
- `git diff --check`：passed
- Forbidden area check：未修改 `desktop/src/shared/uchat/core/**`、AgentGraph、RAG 核心或 Role prompt 编排
- 并发媒体失败修复：TTS/生图使用 `Promise.allSettled` 和按媒体类型的最新 metadata 合并；能力缺失分别记录为 `failed`，不会覆盖另一媒体的成功记录
- GPT-SoVITS 调用证据：聊天侧只调用 `GET /microapps/tts/providers/gpt_sovits/ref-audio` 取得服务端 ID，随后调用 `POST /microapps/tts/gpt-sovits/syntheses`，不使用通用 TTS 路由或最近任务兜底
- 服务端映射：新增 `tts_ref_audio_bindings`，由设置页在取得 `serverRefAudioId` 后绑定 `selectedRefAudioId`；未完成绑定返回“GPT-SoVITS 参考音频未完成服务端绑定”
- Forbidden area 审计：本次 GPT 修复未修改 `desktop/src/shared/uchat/core/**`、AgentGraph、RAG 核心、ChatRuntime canonical core 或 Role prompt 编排；工作区既有 `server/src/agent/**` 改动属于其他任务并未触碰
- 真实桌面复测：重载聊天页面后点击已有助手消息喇叭，数据库新增 GPT-SoVITS synthesis job `1bf9ea3763f9efacadb7a1d93a2ff120`，状态 `succeeded`；请求审计包含 `refAudioId=094dec0a71beb4e5998040c2c4af6700`、`refAudioPath=/microapps/tts/ref-audios/094dec0a71beb4e5998040c2c4af6700`、`serviceUrl=http://127.0.0.1:9872`。Provider 配置和 `tts_ref_audio_bindings` 同步写入该服务端 ID，未 fallback 到通用 TTS。
- 配置复用修复：GPT-SoVITS Provider 配置新增权威 `serverRefAudioId`；设置页保存配置或直接合成时会确保参考音频入库、建立绑定并写回该字段，聊天端优先读取并校验该服务端 ID，不读取 IndexedDB ID，也不从最近任务猜测。
