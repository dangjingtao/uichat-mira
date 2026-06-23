# Knowledge Base API

## Swagger Organization

The current knowledge-base APIs are split into three Swagger groups:

- `Knowledge Base - Collections`
- `Knowledge Base - Documents`
- `Knowledge Base - Upload & Preview`

This separation matches the current UI usage:

- collection-level management in Settings
- document-level inspection and CRUD
- upload wizard and chunk preview

## Endpoints

### Collections

- `GET /knowledge-bases`
- `GET /knowledge-bases/:knowledgeBaseId`
- `POST /knowledge-bases`
- `PATCH /knowledge-bases/:knowledgeBaseId`
- `DELETE /knowledge-bases/:knowledgeBaseId`
- `GET /knowledge-base`

### Documents

- `GET /knowledge-base/documents`
- `GET /knowledge-bases/:knowledgeBaseId/documents`
- `GET /knowledge-base/documents/:id/status`
- `GET /knowledge-bases/:knowledgeBaseId/documents/:id/status`
- `GET /knowledge-base/documents/:id`
- `GET /knowledge-bases/:knowledgeBaseId/documents/:id`
- `POST /knowledge-base/documents`
- `POST /knowledge-bases/:knowledgeBaseId/documents`
- `PATCH /knowledge-base/documents/:id`
- `PATCH /knowledge-bases/:knowledgeBaseId/documents/:id`
- `DELETE /knowledge-base/documents/:id`
- `DELETE /knowledge-bases/:knowledgeBaseId/documents/:id`

### Upload & Preview

- `POST /knowledge-base/chunk-preview`
- `POST /knowledge-base/documents/upload`
- `POST /knowledge-bases/:knowledgeBaseId/documents/upload`

## Notes

- The old single `Knowledge Base` tag is intentionally replaced by smaller groups.
- Attachment upload now uses its own `Attachments` Swagger tag.
- The default knowledge base remains a normal knowledge-base resource in UI and data flow, but it is treated as non-deletable in product rules.
- The default knowledge base is marked with `isSystem: true` in collection responses. UI should disable delete actions from that field instead of hardcoding `id === "default"`.
- Knowledge-base archive interaction is still pending UI/product implementation even though the entity model already reserves lifecycle status fields such as `active` and `archived`.

## UI Boundary Rule

- `Settings -> Knowledge Base` is a standalone settings surface. Its selected knowledge base is owned by the settings page itself.
- Switching knowledge bases in settings must only change the current settings-page state, the URL mirror, and the knowledge-base/document requests for that page.
- This selection must not be coupled to chat runtime state, chat thread creation defaults, RAG enablement state, or any shared cross-page provider.
- Which knowledge base a user chats against must be an explicit user decision in the chat flow, not an implicit side effect of visiting or switching the settings knowledge-base page.
