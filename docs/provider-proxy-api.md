# Provider Proxy API

## Overview

The backend exposes a provider-agnostic proxy layer for chat and embeddings.
The public proxy route metadata is centralized in `server/src/config/public-api.ts`
and mounted into Swagger through the Fastify route schemas.

Swagger UI is available at `/docs` in non-production mode and can be accessed
without a bearer token.

- Chat stream endpoint: `POST /proxy/chat/:provider`
- Embeddings endpoint: `POST /proxy/embeddings/:provider`

Supported `:provider` values:

- `default`
- `ollama`
- `lmstudio`
- `openai`

`default` resolves to the current default model config for the corresponding role:

- `llm` for chat
- `embedding` for embeddings

## Chat

`POST /proxy/chat/:provider`

桌面聊天当前只允许一套请求协议。前端会在发送前把运行时消息显式投影为
应用自有协议，然后后端再将这套协议归一化为 provider 可消费的
`NormalizedChatMessage[]`。

相关实现：

- 前端发送侧：`desktop/src/app/layouts/BaseLayout/chatRuntime.tsx`
- 前端图片附件：`desktop/src/features/chat/core/protocol.ts`
- 后端协议层：`server/src/services/provider-proxy.message-protocol.ts`
- 后端路由 schema：`server/src/routes/proxy-provider/schemas.ts`

Request body:

```json
{
  "messages": [
    {
      "id": "optional-client-message-id",
      "role": "user",
      "parts": [
        { "type": "text", "text": "请描述这张图片" },
        {
          "type": "image",
          "image": "/attachments/7df1....webp",
          "filename": "image.webp"
        }
      ]
    }
  ]
}
```

Rules:

- Only `messages[].parts[]` is accepted.
- Accepted part types are `text`, `image`, and `file`.
- `image` and `file` parts are both normalized by the desktop runtime before
  reaching the backend.
- Legacy mixed shapes such as top-level `content` or `content.parts` are
  intentionally not supported.
- The renderer is responsible for always sending the canonical shape.
- The backend route schema rejects extra fields in each part item.

Attachment notes:

- The desktop renderer converts uploaded images to WebP before upload.
- Uploaded images are stored through `POST /attachments`.
- Chat messages only persist the internal attachment URL, not inline base64.
- Before invoking a provider, the backend resolves internal attachment URLs
  into provider-usable image payloads.

Current protocol boundary:

- The current chat send path uploads attachments only when `send()` starts.
- Selecting a file in the composer does not immediately create a persisted
  server-side attachment record.
- Removing a not-yet-sent attachment is therefore a frontend-only action today
  and does not require an attachment deletion API.
- `POST /attachments` currently accepts image uploads only. The file picker and
  paste handling in the desktop UI should enforce the same rule on the client.

Response:

- `text/event-stream`
- Uses the SSE format consumed by the current desktop chat runtime.
- `provider=default` may branch into the RAG pipeline when the current thread
  has a bound `knowledgeBaseId`.

Thread metadata:

- `id` in the request body is the current remote thread id.
- `messageId` in the request body is the latest user message id.
- These fields are injected by the frontend transport layer so the backend can
  align RAG persistence, regenerate, and title generation with the active
  thread.

## Thread and message protocol

Current desktop chat depends on the following thread-side contracts:

- `GET /threads` returns lightweight thread summaries only.
- `GET /threads/:id` returns the full thread detail with canonical `messages[]`.
- `messages[].parts[]` is the only accepted replay shape for message content.
- The desktop renderer no longer reconstructs message attachments from legacy
  metadata on the client side.
- `PATCH /threads/:id` is currently used for mutable thread-level fields such as
  `title` and `knowledgeBaseId`.
- `DELETE /messages/:id` already exists and can remove one persisted message,
  but the current desktop `uchat` runtime has not yet been wired to expose that
  capability in the UI.

### Legacy compatibility status

The backend still accepts some legacy read-side compatibility behavior for
historical records, but new writes should stay on the canonical message shape:

- `parts` is the primary message content source.
- `assistantUi` is a compatibility/display aid only.
- New assistant/user message writes should not introduce fresh semantic
  dependence on `assistantUi`.
- Historical payloads that only exist in old storage may still be reconstructed
  through compatibility readers until the migration is complete.

### Current limitations

The current public thread/message protocol is sufficient for:

- create thread on first send
- normal non-RAG message persistence
- RAG/non-RAG branching by `knowledgeBaseId`
- thread title refresh and message replay
- image attachment replay through canonical `parts`

It is not yet sufficient as an explicit public contract for full `uchat`
branching abilities such as regenerate, edit-message, and branch navigation.

### Confirmed follow-up protocol work

The following protocol changes are now considered expected follow-up work for
the `uchat` core ability expansion:

1. Expose stable message lineage in thread detail

- `GET /threads/:id` should eventually expose a stable `messages[].parentId`
  field instead of forcing the frontend to infer parent relationships from
  linear order.
- This is required for regenerate/edit flows and for future branch navigation.

2. Add an explicit message edit contract

- The current stack has `createMessage` and `deleteMessage`, but no clear public
  message-edit route.
- A future protocol should add either:
  - `PATCH /messages/:id`, or
  - an equivalent message mutation contract that explicitly documents tail
    pruning / branch rewrite semantics.

3. Add an explicit regenerate contract

- Regenerate should not stay as implicit client behavior layered on top of
  generic send.
- A future protocol should explicitly define:
  - which message id regeneration starts from
  - whether it replaces the existing assistant message or creates a new branch
  - how the returned lineage is represented

4. Clarify cancellation semantics if cancellation must become durable

- The current desktop runtime can cancel the local request transport once that
  UI is wired, but cancellation is not yet a documented persisted message state.
- If product requirements later require durable `cancelled` state or backend
  task interruption beyond disconnect semantics, a dedicated cancel protocol
  will be needed.

5. Separate display filename from stored filename in attachment responses

- Current upload/storage semantics are safe, but the public attachment response
  shape should eventually distinguish:
  - original display filename
  - stored server filename / path key
  - public attachment URL
- This avoids frontend confusion between user-facing file names and server-side
  storage names.

## Embeddings

`POST /proxy/embeddings/:provider`

Request body:

```json
{
  "input": ["第一段文本", "第二段文本"]
}
```

Success response payload:

```json
{
  "success": true,
  "data": {
    "providerCode": "ollama",
    "model": "nomic-embed-text",
    "modelConfigId": "xxx",
    "dimensions": 768,
    "embeddings": [[0.1, 0.2], [0.3, 0.4]]
  },
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

## Knowledge Base ingestion

Knowledge-base document ingestion does not require the frontend to call the embeddings endpoint directly.

The desktop upload flow now sends `multipart/form-data` to `POST /knowledge-base/documents/upload`.
The backend stores the uploaded text first, then indexes it asynchronously.

The ingestion pipeline performs:

1. file upload and UTF-8 text extraction
2. document row creation with `indexStatus = processing`
3. background text normalization and chunking
4. batched internal embedding generation via the provider proxy service
5. vector persistence into the SQLite vector table
6. document status update to `ready` or `failed`

The legacy JSON route `POST /knowledge-base/documents` remains available for direct text ingestion, but the desktop UI no longer sends large document bodies through that path.

This keeps provider-specific behavior inside the backend service layer.
