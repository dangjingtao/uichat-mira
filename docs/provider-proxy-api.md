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

Request body:

```json
{
  "messages": [
    {
      "role": "user",
      "parts": [{ "type": "text", "text": "你好" }]
    }
  ]
}
```

Response:

- `text/event-stream`
- Uses the existing assistant-ui compatible SSE event format already consumed by the desktop chat runtime.

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
