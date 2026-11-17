# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

Web UI for `../tcloud-backend` (FastAPI, Telegram-backed file storage). Vite + React 19 + TS, Tailwind v4 + shadcn/ui (`src/components/ui`, add with `npx shadcn@latest add <name>`), TanStack Query, react-router. UI text is Russian. Details in `README.md`.

## Commands

```bash
npm run dev     # :5173, proxies /api to API_URL or http://127.0.0.1:8000
npm test        # vitest (src/**/*.test.ts)
npm run build   # tsc -b && vite build
npm run lint    # oxlint
docker build -t tcloud-frontend .   # nginx, API_UPSTREAM env
```

## Architecture

- `src/lib/api.ts`: every call goes through `request`/`api.*` (prefix `/api`, `credentials: same-origin`, one refresh on 401, errors as `ApiError` with backend `code`). `src/lib/types.ts` mirrors backend response schemas (`src/application/schemas` there) — update it when the API changes.
- Mutations use `hooks/use-action.ts` (toast on error, invalidate query keys). Query keys: `me`, `storages`, `folder/<path>`, `task/<id>`, `users`, `user/<id>`, `grants/<id>`, `api-keys/<id>`, `sessions`, `telegram`, `health`.
- Tasks are tracked by id in localStorage (`lib/tasks.ts`); the backend has no "my tasks" list on purpose.

## Gotchas

- Proxies must keep the `Host` header (Vite default, nginx `$http_host`): the backend Origin check compares `Origin` with `Host`.
- Do not duplicate backend access rules; show actions and surface `403`.
- Telegram QR must be rendered locally, never via external QR services.

## Rules

- Plan first; important decisions go to the owner as multiple-choice questions.
- No code comments; explanations go to README.md. Keep README.md and this file current.
- Tests for new logic in `src/lib`. Commits: one-line English (`feat:`, `fix:`), **never push**.
