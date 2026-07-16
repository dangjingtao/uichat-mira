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
  - docs/chat/uchat-governance/ambiguity-log.md
  - docs/project-control/tasks/microapp_chat_T001-media-persistence-and-lifecycle.md
  - docs/project-control/tasks/microapp_chat_T002-thread-media-capabilities-and-orchestration.md
  - docs/project-control/tasks/microapp_chat_T003-chat-media-ui.md
task_state: DONE
---

# microapp_chat_T004 Integration Acceptance

## Target

验证聊天 TTS/生图接入在现有 chat、RAG、Role 链路上的行为，并确认实现没有越过硬边界。

## Prerequisite

- `microapp_chat_T001`、`microapp_chat_T002`、`microapp_chat_T003` 已完成并提供定向证据。

## Core Principles

- 测试、冒烟和验收用于验证既定业务边界，不得为了让结果通过而修改已有业务核心逻辑。
- 不得把测试中的失败伪装成通过，不得新增默认 mock、silent fallback、硬编码路径或兼容分支掩盖真实问题。
- 不得扩大本次任务范围去修复 AgentGraph、RAG、Chat、Role 的既有问题。
- 发现任务外核心逻辑缺陷时，应记录准确的失败位置、影响和证据，保持本任务结论诚实。

## Allowed Changes

- 聊天媒体集成测试、验收脚本和测试证据
- `.test-artifact/**` 下的临时验证产物
- 本任务卡和必要的验收文档

## Forbidden Changes

- AgentGraph 及其节点、状态、工具循环、审批逻辑
- RAG rewrite/retrieve/rerank/generate
- Chat 文本请求、流式协议和历史上下文核心逻辑
- Role 数据模型、prompt 注入和请求编排
- TTS/生图微应用详细配置
- 为通过验收而新增 fallback、mock 默认值或硬编码本地路径

## Acceptance Criteria

1. chat + TTS 可生成、保存、刷新后读取并播放。
2. RAG + TTS 可生成并且不改变 RAG 来源和执行展示。
3. RP 且无知识库时图片按钮显示，回复完成后自动生成并显示在文字下方。
4. RP + RAG 时图片按钮不存在，且没有生图请求。
5. 已有音频直接复用，不重复发起 TTS 请求。
6. 重新生成时旧图片和音频文件、记录均被清理，新消息产生新的媒体关联。
7. 清理消息分支、删除消息和删除线程后，不残留媒体记录和文件。
8. 服务重启后已持久化的任务和媒体仍可恢复。
9. 定向测试、两端 typecheck 和 `pnpm check` 按仓库要求完成；若整仓检查被任务外问题阻断，必须记录准确阻断项。
10. 变更文件审计证明没有修改 AgentGraph、RAG、Chat、Role 核心逻辑。

## Evidence Requirements

- 四种聊天场景的行为证据
- TTS 复用和重新生成清理证据
- 生图自动触发、路径持久化和清理证据
- `git diff --name-only` 边界审计
- 定向测试、typecheck、`pnpm check` 输出

## Verification Evidence

- 2026-07-15: 服务端媒体回归通过：`pnpm --filter @ui-chat-mira/server exec vitest run src/services/chat-media.service.test.ts src/db/repositories/image-generation-jobs.repository.test.ts src/routes/thread/threads.routes.test.ts src/services/thread.service.test.ts src/routes/microapps/index.test.ts src/microapps/tts/index.test.ts`，6 files、62 tests passed。
- 2026-07-15: 桌面媒体回归通过：`pnpm --filter @ui-chat-mira/desktop exec vitest run src/shared/uchat/ui/UChatThreadView.test.tsx src/features/chat/components/UChatThread.test.tsx src/features/chat/adapters/chatMediaOrchestration.test.ts src/features/chat/components/roleChatState.test.ts src/features/chat/adapters/desktopRuntimePolicies.test.ts`，5 files、50 tests passed。
- 2026-07-15: 已有 T003 前台烟测通过；本轮重新打开本地聊天页面检查到 Role 且无知识库场景的“生成图片”按钮、助手文字下方图片和“播放助手音频”按钮。页面中已有失败任务按失败状态展示，未被当作成功。
- 2026-07-15: 四态规则由桌面集成测试和前台烟测共同确认：Chat/RAG 保留 TTS；Role 且无知识库显示图片按钮并允许自动生图；Role + RAG 完全不渲染图片按钮，且媒体编排层返回 `image: false`，不发起生图请求。RAG 来源和执行展示不由媒体适配层修改。
- 2026-07-15: TTS 已有成功媒体时直接使用受控媒体接口；文件不可读时覆盖回归测试会重新请求。GPT-SoVITS 测试确认聊天使用微应用配置绑定的服务端 `refAudioId`，不读取 IndexedDB 音频 ID，也不使用通用 TTS fallback。
- 2026-07-15: T001 生命周期回归确认重新生成、分支裁剪、删除消息和删除线程会删除旧文件、`chat_media` 记录及消息 `metadata.media`；新的助手消息可以建立新的媒体关联。
- 2026-07-15: 生图任务和产物重启恢复回归通过，HTTP 查询和受控 artifact content 接口均可在数据库客户端/服务重建后读取；数据库保存绝对路径，renderer 只访问受控接口。
- 2026-07-15: `pnpm --filter @ui-chat-mira/desktop typecheck`、`pnpm --filter @ui-chat-mira/server typecheck` 通过；`$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm check` 通过；`git diff --check` 通过。
- 2026-07-15: T004 本身只修改任务卡和项目台账。工作区中的 `server/src/agent/**`、Computer Use 及其他并行文件不归因于 T004；未修改 AgentGraph、RAG、Chat、Role 核心逻辑。生图尺寸未保存到服务商配置仍是独立技术债，不纳入本卡。

## Conclusion

T004 验收完成，状态为 `DONE`。本卡没有新增产品代码，也没有为了通过测试改变既有业务核心逻辑或既定业务边界。
