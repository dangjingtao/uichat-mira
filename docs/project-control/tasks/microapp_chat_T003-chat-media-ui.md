---
status: current
priority: P1
owner: chat / ui
last_verified: 2026-07-15
layer: project-control
module: Chat
feature: ChatMediaIntegration
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/chat/uchat-governance/boundary-contract.md
  - desktop/src/shared/uchat/ui/UChatThreadView.tsx
  - desktop/src/features/chat/components/UChatThread.tsx
task_state: DONE
---

# microapp_chat_T003 Chat Media UI

## Target

在现有聊天消息界面承载 TTS 播放和生图结果，不改变现有文本、附件、RAG 来源和执行 trace 展示。

## Prerequisite

- `microapp_chat_T001` 的媒体读取接口可用。
- `microapp_chat_T002` 的线程开关和媒体状态已接入。

## Core Principles

- 不得为了通过测试、截图或手工验收而修改已有业务核心逻辑。
- 不得触碰既定的 AgentGraph、RAG、Chat、Role 业务边界。
- UI 只能展示和触发已经由 chat integration 判定的媒体能力，不能在展示层自行改变 Role/RAG/Chat 规则。
- 如果现有 UI contract 不足以承载媒体展示，必须新增明确的展示接口，不得修改核心消息语义来绕过问题。

## Allowed Changes

- `desktop/src/shared/uchat/ui/**` 中与消息媒体展示和操作承载直接相关的文件
- `desktop/src/features/chat/components/UChatThread.tsx`
- `desktop/src/features/chat/**` 中媒体按钮的产品装配文件
- 聊天相关 i18n、UI 测试和本任务卡

## Forbidden Changes

- `desktop/src/shared/uchat/core/**` 的消息 part、runtime 和发送协议
- AgentGraph、RAG、Chat、Role 核心逻辑
- TTS Studio、Image Generation Studio 详细配置界面
- 在 renderer 中直接调用 Node API 或读取绝对本地路径
- 把输出图片写入现有用户输入 `image part`
- 新增 `audio` `ChatMessagePart`

## Acceptance Criteria

1. 生图结果显示在对应助手文字下方。
2. TTS 只在消息操作区显示播放按钮，不显示独立音频卡片。
3. TTS 按钮在 chat、RAG、RP、RP + RAG 中显示。
4. 图片按钮仅在 RP 且无知识库时渲染；RP + RAG 时完全不渲染。
5. 已有成功音频且文件仍存在时直接播放；不存在时显示生成状态并请求 TTS。
6. 图片/TTS 的 loading、failed、retry 状态不会覆盖文字回复。
7. 刷新线程后图片和 TTS 关联状态仍可恢复。
8. 图片和音频通过 backend 受控 URL/响应访问，前端不直接使用数据库绝对路径。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run <chat media UI tests>`
- desktop typecheck
- 手工检查 chat、RAG、RP、RP + RAG 四种显示状态
- `git diff --name-only` 检查 forbidden area

## Verification Evidence

- 2026-07-15: `pnpm --filter @ui-chat-mira/desktop typecheck` passed.
- 2026-07-15: `pnpm --filter @ui-chat-mira/desktop exec vitest run src/shared/uchat/ui/UChatThreadView.test.tsx src/features/chat/components/UChatThread.test.tsx src/features/chat/adapters/chatMediaOrchestration.test.ts src/features/chat/components/roleChatState.test.ts` passed: 4 files, 39 tests.
- 2026-07-15: `$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm check` passed across desktop, server, and workspace packages.
- 2026-07-15: UI tests cover generated image placement below assistant text, RP/no-knowledge-base image action gating, TTS request when no completed audio exists, and retry action suppression for RP + RAG.
- 2026-07-15: P1 regression fixed and covered: when a persisted succeeded TTS media record returns an unreadable/404 artifact, the next play attempt requests TTS regeneration instead of repeating the failed media read.
- 2026-07-15: P0 image-generation path fixed and covered: chat now consumes the saved ComfyUI flow and connection configuration, submits workflow payloads, polls queued/running jobs to terminal status, and only associates a completed local artifact.
- 2026-07-15: Media content is loaded through the existing controlled thread media preview API; renderer code does not read persisted absolute paths.
- 2026-07-15: Forbidden-area audit found no changes under `desktop/src/shared/uchat/core/**`.
