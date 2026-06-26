# Frontend Request Wrapper

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: runtime
Doc Type: current-contract

`desktop/src/shared/lib/request.ts` provides the shared Axios client used by renderer code.

## Request Rules

- Feature code uses backend route paths such as `/login`, `/me`, `/models`.
- Development base URL is `/api`.
- Production base URL is `window.desktopApi.backendUrl`.
- The backend never exposes `/api` routes.
- Do not hardcode backend host or port in renderer code.

## Development Flow

```text
feature code -> /api/models -> Vite proxy -> backend /models
```
