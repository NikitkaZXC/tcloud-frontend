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
- Other localStorage keys (`tcloud.view`, `tcloud.onboarding.dismissed`, `tcloud.theme`, `tcloud.sidebar`) go through `lib/prefs.ts` or try/catch; they are conveniences only.
- Layout is a left sidebar (`components/layout.tsx`, drawer on mobile). The command palette (`components/command-palette.tsx`) drives `FolderView` through the `tcloud:folder-action` window event (`lib/commands.ts`).
- Sign-in and Telegram errors are mapped from backend `code` in `lib/auth.ts` (`describeError`, `retryAfterOf`); the Telegram wizard step logic is there too.

## Gotchas

- Proxies must keep the `Host` header (Vite default, nginx `$http_host`): the backend Origin check compares `Origin` with `Host`.
- Do not duplicate backend access rules; show actions and surface `403`.
- Telegram QR must be rendered locally, never via external QR services.
- Theme: lo-fi pixel EX8 style on the green palette (#051F20…#DAF1DE); dark in `:root`, light in `:root.light` (`lib/theme.ts`, toggle in the sidebar profile; Tailwind `dark:` = no `.light`). Fonts are pixel only: Tiny5 (titles, numbers, ring centers; sizes in multiples of 5px) and Handjet (text). Effects live in `src/index.css` (`fx-*` classes, shadcn tweaks via `data-slot`) and `components/fx.tsx` (`PageTitle`, `Section`, `Stat`, `Ring`, `ChannelsRing`, `StorageIcon`, `StatusChip`/`StatusLight`, `WireCubes`); every animation must stay off under `prefers-reduced-motion`. Color only for signals; no glitch/scanline/CRT effects.
- Storages page shows per-storage size and file count (`total_size`, `files`) but no capacity/fill bars: Telegram channels have no size limit. Channel limit ring: `channelUsage` (`channels_used`/`channels_limit` from `GET /api/account`, fallback 500/1000 with an honest label).
- Storage read/write lamps: `useStorageIo` (sending + tracked upload tasks = write; archive tasks `archiving` + `markRead` from `lib/reads.ts` on downloads/previews = read), held ≥ `IO_HOLD_MS` by `lingerIo`. Only this browser's activity is known.
- `task.progress` from the API is a percent (0–100): always go through `taskFraction`.
- Dashboard uses only existing endpoints; admin-only queries (`users`) are `enabled`/rendered only for admins; the first-run checklist (`telegram` query) only for root.
- No thumbnails in the API: never load full images from `/download` in listings; previews only in the file card.
- Uploads are encrypted by default: send `encrypt: true` explicitly; `withSendAs` turns it off for `media` and back on for `file`.
- Uploads keep relative paths (folder upload); the backend creates parent folders. Bulk download = sequential links + zip per folder (no archive of an arbitrary file set in the API).

## Rules

- Plan first; important decisions go to the owner as multiple-choice questions.
- No code comments; explanations go to README.md. Keep README.md and this file current.
- Tests for new logic in `src/lib`. Commits: one-line English (`feat:`, `fix:`), **never push**.
