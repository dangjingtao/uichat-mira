# Coding Standards

## TypeScript
- `strict: true` in all `tsconfig.json`.
- No `any`. Use `unknown` + type guards.
- Exported functions must declare return types.
- Enums: use `as const` objects instead of TS enums.

## React
- Components: PascalCase, one per file, default export.
- Hooks: camelCase, prefix `use`, one per file.
- Props interface: named `{ComponentName}Props`.
- No class components. No default props.

## Tailwind
- Mobile-first responsive prefixes.
- Use `packages/ui/src/lib/utils.ts` `cn()` for conditional classes.
- No arbitrary values (`w-[100px]`) unless absolutely necessary.
- Theme tokens in `packages/ui/tailwind.config.ts`.

## Fastify
- Backend route paths must not include the development-only `/api` prefix.
- Register route plugins from `server/src/index.ts`.
- Small resources may stay in `server/src/routes/{resource}.ts` when the file remains easy to scan.
- Split larger resources into `server/src/routes/{resource}/` with this layout:
  - `index.ts`: route plugin entry only; compose internal route groups here.
  - `*.routes.ts`: HTTP orchestration only, including request parsing, service calls, and response mapping.
  - `schemas.ts`: Fastify/OpenAPI JSON schemas and response contracts.
  - `types.ts`: route-local request/response TypeScript contracts.
  - Extra private helpers, such as multipart parsing or protocol conversion, should live in focused files named after their responsibility.
- `types.ts` must use JSDoc for exported interfaces and important fields. Explain route-layer semantics, normalization rules, defaults, and behavior-changing fields.
- `schemas.ts` must add comments for schema groups and `description` for important OpenAPI fields, especially IDs, lifecycle/status fields, source fields, body fields that trigger side effects, and protocol payloads.
- Keep route-local types and schemas private to the route folder unless they are intentionally shared by multiple resources.
- If a helper is reusable across route folders, move it to a shared module and document what transport concern it owns.
- Preserve the shared API envelope from `docs/API-Response-Spec.md`.
- New route handlers should use `routeHandler()` from `server/src/utils/route-errors.ts` instead of repeating `try/catch -> log -> reply.code(...).send(error(...))`.
- Throw typed route errors such as `badRequest()`, `notFound()`, `unauthorized()`, or `internalError()` for expected failures. Let the global Fastify error handler convert them into the shared response envelope and structured logs.
- Use naming that separates thrown errors from response payload builders:
  `errorResponse()` builds the HTTP error envelope;
  `createAppError()` / `createRouteError()` build throwable error objects.
- Avoid introducing ambiguous names like `error()` when the code may either `throw` an exception or `send` an API response.

## Database
- The desktop product does not support preserving local SQLite data across reinstall/upgrade.
- Database initialization should create the current schema for an empty database.
- Do not add table-rebuild or legacy-schema migration code unless the product explicitly introduces an in-place upgrade requirement.
- Runtime-required setup such as indexes, FTS triggers, vector tables, seed/default records, and connection pragmas is still part of initialization and should be kept.

## IPC
- Channels defined as const in `packages/shared/src/ipc-channels.ts`.
- Handler in `electron/src/handlers/{channel}.ts`.
- Renderer hook in `desktop/src/hooks/use-{feature}.ts`.
- Preload bridge in `electron/src/preload.ts` — one method per channel.

## Imports
- Order: React → external libs → internal packages (`@shared`, `@ui`) → relative.
- No `../..` beyond 2 levels. Use package aliases.
