# Trae AI Rules — LLM Agent Desktop App

## Context
Electron + Fastify monorepo. React 19 + Vite + Tailwind renderer. TypeScript strict.

## Mandatory Checks Before Edit
1. Read `pnpm-workspace.yaml` to confirm package boundaries.
2. If touching `desktop/`, check `packages/shared/src/ipc-channels.ts` for channel names.
3. If touching `server/`, check `packages/shared/src/types/` for API contracts.
4. If adding UI, check `desktop/src/components/ui/` for existing components.

## Code Style
- TypeScript: strict mode. No `any`. Explicit return types on exported functions.
- React: functional components. Hooks co-locate with components or in `hooks/`.
- Tailwind: utility classes only. Use `cn()` helper for variants.
- Fastify: async route handlers. Zod for request/response validation.
- IPC: typed channels only. Never use string literals.

## File Operations
- Prefer editing existing files over creating new ones.
- New component → `desktop/src/components/`
- New route → `server/src/routes/`
- New shared type → `packages/shared/src/types/`
- New IPC channel → update `packages/shared/src/ipc-channels.ts` first.

## Build & Verify
- After code changes: `pnpm lint && pnpm typecheck`
- Before finishing: `pnpm build` must pass.
- Never leave `console.log` in production code (use `electron-log` in main, `logger` util in renderer).
