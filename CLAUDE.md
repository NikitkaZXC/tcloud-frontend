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
- Mutations use `hooks/use-action.ts` (toast on error, invalidate query keys). Query keys: `me`, `storages`, `folder/<path>`, `task/<id>`, `users`, `user/<id>`, `grants/<id>`, `api-keys/<id>`, `sessions`, `telegram`, `health`, `account`.
- Tasks are tracked by id in localStorage (`lib/tasks.ts`); the backend has no "my tasks" list on purpose.
- Other localStorage keys (`tcloud.view`, `tcloud.last-folder`, `tcloud.onboarding.dismissed`, `tcloud.theme`, `tcloud.sidebar`) go through `lib/prefs.ts` or try/catch; they are conveniences only.
- Layout is a left sidebar (`components/layout.tsx`, drawer on mobile). The command palette (`components/command-palette.tsx`) drives `FolderView` through the `tcloud:folder-action` window event (`lib/commands.ts`).
- Sign-in and Telegram errors are mapped from backend `code` in `lib/auth.ts` (`describeError`, `retryAfterOf`); the Telegram wizard step logic is there too.

## Gotchas

- Proxies must keep the `Host` header (Vite default, nginx `$http_host`): the backend Origin check compares `Origin` with `Host`.
- Do not duplicate backend access rules; show actions and surface `403`.
- Telegram QR must be rendered locally, never via external QR services.
- Theme: dark palette in `:root`, light in `:root.light` (`lib/theme.ts`, toggle in the sidebar profile; Tailwind `dark:` = no `.light`). Effects live in `src/index.css` (`fx-*` classes, shadcn tweaks via `data-slot`) and `components/fx.tsx`; every animation must stay off under `prefers-reduced-motion` (CSS media block, `prefersReducedMotion()` in JS). Page titles use `PageTitle`, statuses `StatusChip`/`StatusLight`. Solid tactile panels (`fx-panel`, cards) for content; glass only for dialogs, menus, selects and the palette. Manrope only, no monospace/terminal styling.
- Dashboard uses only existing endpoints; admin-only queries (`users`) are `enabled`/rendered only for admins; the first-run checklist (`telegram` query) only for root.
- No thumbnails in the API: never load full images from `/download` in listings; previews only in the file card.
- Uploads keep relative paths (folder upload); the backend creates parent folders. Bulk download = sequential links + zip per folder (no archive of an arbitrary file set in the API).

## Rules

- Plan first; important decisions go to the owner as multiple-choice questions.
- No code comments; explanations go to README.md. Keep README.md and this file current.
- Tests for new logic in `src/lib`. Commits: one-line English (`feat:`, `fix:`), **never push**.
