---
title: Mira Mobile Surface API Inventory
status: current-inventory
doc_type: inventory
canonical: false
last_verified: 2026-08-12
related:
  - docs/remote-access/mobile-host-protocol-v1.md
  - docs/remote-access/relay-product-config-v1.md
---

# Mira Mobile Surface API Inventory

## 1. Purpose

This document inventories the features currently visible in `uichat-mira-mobile/dev` against the HTTP surfaces that already exist in `uichat-mira/dev`.

It is **not** an authorization contract and does not extend Remote Host V1.

The canonical Mobile authorization contract remains:

- `docs/remote-access/mobile-host-protocol-v1.md`

A route being present in the Desktop/Server backend does **not** mean a `mira_device_*` credential may call it. Any new Mobile capability still requires an explicit main-repo contract, scope decision, Remote Gateway allowlist decision, ownership/security review, and Mobile implementation.

Current Mobile chat scope for this inventory is **chat only**. Agent routes that happen to exist in Remote Host V1 are intentionally excluded from the Mobile chat mapping below.

## 2. Mobile visual sources

Current visible surfaces inspected from `uichat-mira-mobile/dev`:

- `src/components/CustomDrawer.tsx`
  - 图片
  - 文件库
  - 项目
  - Remote
  - 已计划
  - 插件
  - existing conversation list
- `src/screens/SearchScreen.tsx`
  - 全部 / 对话 / 图片 / 文档 / 项目
- `src/screens/SettingsScreen.tsx`
  - 个性化 / 记忆 / 插件
  - account email
  - appearance / accent / device sync
  - Mira Host configuration
  - general / notifications / voice / security / storage / report error / about
  - logout
- `src/screens/PersonalizationScreen.tsx`
  - tone
  - traits
  - quick answer
  - custom instructions
- `src/screens/ReportErrorScreen.tsx`
- `src/screens/AboutScreen.tsx`
- existing thread list and chat screens

## 3. Current truth: what Mobile may call today

Remote Host V1 currently allows a paired device to use the following chat-related surfaces:

```text
GET  /remote/v1/manifest
GET  /threads
GET  /threads/:id
GET  /threads/:id/messages
POST /proxy/chat/default
GET  /threads/:id/media/:mediaId/content
```

This is enough for:

- restoring/validating a paired device;
- listing existing conversations;
- opening an existing conversation;
- reading messages;
- sending normal chat messages through the persisted default chat stream;
- reading media already attached to a thread when its media id is known.

It is **not** currently enough for a general image library, file library, project management, plugins, memory, voice, scheduled work, account settings, or other settings surfaces.

## 4. Surface-to-backend inventory

| Mobile visual surface | Existing `uichat-mira/dev` backend surface | Main API maturity | `mira_device_*` today | Inventory conclusion |
| --- | --- | --- | --- | --- |
| Existing conversations | `GET /threads`, `GET /threads/:id` | Implemented + schema | Allowed | Ready/current |
| Chat messages | `GET /threads/:id/messages`, `POST /proxy/chat/default` | Implemented/current contract | Allowed | Ready/current; Mobile chat stays on normal chat only |
| Thread images/audio already referenced by a message | `GET /threads/:id/media/:mediaId/content` | Implemented/current contract | Allowed with `artifacts:read` | Ready for thread-scoped rendering; not a global gallery |
| Search: 对话 | `GET /threads` has status/sort filters but no dedicated text-search query; Mobile currently filters titles locally | Partial | Allowed | Keep local search for now or define a later search contract |
| Search: 图片 / 文档 / 项目 | No current Remote search contract | Missing as a cross-domain search surface | No | Remain placeholder until a main-repo search contract exists |
| 图片 | Image generation HTTP surface exists under `/microapps/image-generation/**`; thread media read also exists | Generation is implemented; gallery/list semantics are incomplete | No, except thread media content | Do not call this “图片库” yet. If Mobile means generation, a new Remote contract is required; if it means gallery, the server still needs a list/query contract |
| 文件库 | Knowledge Base APIs exist: `/knowledge-bases`, `/knowledge-base/documents`, `/knowledge-bases/:knowledgeBaseId/documents`, document detail/status, upload/create/update/delete | Mature server surface + schemas | No | Strong candidate **if** Mobile “文件库” means knowledge-base documents. Do not equate it with all chat attachments |
| Chat attachment upload | `POST /attachments` | Implemented for chat upload | No | Separate from “文件库”; requires an explicit Mobile upload contract if needed |
| 项目 | Closest existing entity is `/chat-workspaces` CRUD | Implemented | No | Candidate only. Product must first confirm `项目 == Chat Workspace`; do not silently rename the backend entity in Mobile |
| Remote | Current pairing/manifest/credential flow under Remote Host V1 | Canonical/current | Allowed as defined | Ready/current. Relay evolution remains governed by separate main-repo docs |
| 已计划 | No dedicated scheduled-task / automation HTTP surface verified in current server routes | Missing | No | Keep placeholder; do not map Agent “plan” or runtime tasks to scheduled work |
| 插件 | MCP marketplace and external-server APIs under `/mcp/marketplace/**`, `/mcp/external/**`; capability/Harness APIs also exist | Mature Desktop/Server surface | No | Strong candidate for later read/manage Mobile contract; currently blocked by Remote Gateway |
| 记忆 | `GET /memory`, `PUT /memory/settings`, `POST /memory`, `PATCH /memory/:id`, `DELETE /memory/:id` | Implemented + OpenAPI schema | No | Strong candidate for a dedicated Mobile Memory contract |
| 个性化 | No exact persisted API verified for tone/traits/quick-answer/custom-instructions semantics | Missing exact contract | No | Keep local/placeholder. **Do not reuse Memory API as personalization storage**; the semantics differ |
| Account email/profile | `GET /me` exists for normal authenticated user JWT | Implemented desktop-account API | No | Do not wire directly. Mobile is a paired device, not a Desktop username/password session. If owner profile is needed, define a safe Remote projection |
| 外观 / 重点色 | Mobile-local theme state | Server API not needed | N/A | Keep local |
| 设备同步 | Remote Host V1 canonical-state replay already synchronizes supported Thread/Message state, but there is no generic “device sync” settings API | Partial concept, no settings contract | Only current replay behavior | Current visual row is not backed by a generic sync API; avoid promising all-device sync |
| Mira Host 配置 | pairing + secure device credential + manifest | Canonical/current | Allowed | Ready/current |
| 常规 | `/general-settings` exists, but currently represents Desktop/backend settings such as SOCKS5 proxy | Implemented desktop-only semantics | No | Do not expose as generic Mobile settings |
| 通知 | No dedicated Mobile notification/push settings HTTP surface verified | Missing | No | Placeholder |
| 语音 | TTS APIs exist under `/microapps/tts/**`: overview, voices, syntheses, audio, provider-specific surfaces | Mature server feature | No | Strong candidate if Mobile voice means Host-side TTS; requires Remote contract and a deliberately small surface |
| 安全 | `/account/change-password` exists for Desktop authenticated user | Implemented desktop-account API | No | Must not be reused for paired-device identity. A Mobile device-security surface needs its own contract |
| 存储 | Server has logs/cleanup/media/storage internals, but no Mobile storage-settings contract matching this UI | No exact Mobile contract | No | Placeholder; do not expose destructive Desktop cleanup routes casually |
| 报告错误 | No dedicated feedback/error-report HTTP route verified in current server tree | Missing | No | Current disabled Mobile submit state is truthful |
| 关于 | `GET /app/meta` returns Host application metadata/version/links | Implemented + schema | No | Candidate for “Host information”, not for Mobile app version/update checking |
| Mobile update check | No dedicated current update-check HTTP route verified | Missing | No | Mobile package/release update is a separate concern from Host `/app/meta` |
| 退出登录 | Desktop account login/logout semantics are not the Mobile identity model | Wrong abstraction for paired device | N/A | Prefer “断开此设备 / 清除设备授权” semantics; self-revoke would require an explicit Remote contract if server-side revoke is desired |

## 5. Existing server API documentation source

The main server already registers OpenAPI + Swagger UI. Current configuration exposes Swagger UI at:

```text
/api-docs
```

The OpenAPI source is built from the route schemas registered in `server/src/index.ts`.

For Mobile work, API documentation should therefore be generated/verified from current route schemas first, then narrowed by this process:

```text
Mobile visual requirement
  -> existing Server route/schema
  -> product semantic match
  -> Remote scope/allowlist contract
  -> Mobile transport/client implementation
```

Do not copy the entire Desktop Swagger surface into Mobile.

## 6. Best next candidates from the current UI

Without changing current chat semantics, the strongest existing Server surfaces for future Mobile contracts are:

1. **Memory** — exact UI/backend semantic match is already close.
2. **File Library as Knowledge Base documents** — backend is mature, but product naming/permissions need to be fixed first.
3. **Plugins as MCP catalog/configured servers** — backend is mature, but management operations need a strict Remote security boundary.
4. **Voice as Host-side TTS** — backend exists; Mobile should receive a deliberately reduced synthesis/voice-list contract instead of provider administration.
5. **Project as Chat Workspace** — only after product explicitly confirms the semantic equivalence.
6. **Images** — first decide whether Mobile “图片” means generation, thread media, or a persistent gallery. Current backend has generation and thread media, but not one unified image-library contract.

## 7. Explicit non-decisions

This inventory does not:

- add any new Remote Device scope;
- change the Remote Gateway allowlist;
- expose Desktop JWT/account APIs to Mobile;
- add Relay-only pairing or Relay transport behavior;
- treat Memory as Personalization;
- treat Chat Workspace as Product Project without confirmation;
- treat Agent runtime planning as “已计划” scheduled tasks;
- claim that a Desktop API is usable from Mobile merely because it appears in Swagger.
