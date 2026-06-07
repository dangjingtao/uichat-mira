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
- Routes: `async function` in `server/src/routes/{resource}.ts`.
- Register in `server/src/app.ts` with prefix.
- Input validation: Zod schemas. Output types: inferred from schema.
- Error handling: `fastify.setErrorHandler()` in `app.ts`.

## IPC
- Channels defined as const in `packages/shared/src/ipc-channels.ts`.
- Handler in `electron/src/handlers/{channel}.ts`.
- Renderer hook in `desktop/src/hooks/use-{feature}.ts`.
- Preload bridge in `electron/src/preload.ts` — one method per channel.

## Imports
- Order: React → external libs → internal packages (`@shared`, `@ui`) → relative.
- No `../..` beyond 2 levels. Use package aliases.
