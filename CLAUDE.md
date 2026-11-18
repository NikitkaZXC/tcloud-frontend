# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

Web UI for `../tcloud-backend` (FastAPI, Telegram-backed file storage). Vite + React 19 + TS, Tailwind v4 + shadcn/ui (`src/components/ui`, add with `npx shadcn@latest add <name>`), TanStack Query, react-router. UI text is Russian and English (`lib/i18n.ts`). Details in `README.md`.

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
- Mutations use `hooks/use-action.ts` (toast on error, invalidate query keys). Query keys: `me`, `storages`, `folder/<path>`, `task/<id>`, `users`, `user/<id>`, `grants/<id>`, `api-keys/<id>`, `sessions`, `telegram`, `health`, `account`, `activity/<path>`, `search/<api query>`, `mimes/<path>`.
- Tasks are tracked by id in localStorage (`lib/tasks.ts`); the backend has no "my tasks" list on purpose.
- User preferences live on the server (`GET/PATCH/DELETE /api/account/settings`, also `settings` in `/users/me`): `lib/settings.ts` store (`useSettings`, `updateSettings` optimistic + revert, `hydrateSettings` from `useMe`), page `/settings`. Never add new localStorage prefs; `tcloud.mirror` (theme/language before `/users/me`) is a mirror only. Old `tcloud.view`/`sort`/`theme`/`feature.*` are migrated once (`migrateLegacy`) and removed.
- Other localStorage keys (`tcloud.onboarding.dismissed`, `tcloud.sidebar`, `tcloud.achievements`) go through `lib/prefs.ts` or try/catch; they are conveniences only.
- Layout is a left sidebar (`components/layout.tsx`, drawer on mobile). The command palette (`components/command-palette.tsx`) drives `FolderView` through the `tcloud:folder-action` window event (`lib/commands.ts`).
- i18n (own, no deps): every user-visible string goes through `t(key, params)` from `lib/i18n.ts`; keys live in `lib/locales/ru.ts` (source of the `Key` type) and `en.ts` (`Record<Key, Entry>`, same keys enforced by tsc and `i18n.test.ts`). Plurals are `{one, few, many, other}` objects picked by `Intl.PluralRules` with `{n}`. Language = `interface.language` or the browser (`resolveLang`); `App` remounts on change (`key={useLang()}`), so module-level constants must hold keys, not text. Dates/sizes/collation use `getLang()`. Ctrl+K commands carry `keywords` in both languages (`tAll`). Backend codes map to `error.<code>` keys in `errorMessage`/`errorText`.
- Sign-in and Telegram errors are mapped from backend `code` in `lib/auth.ts` (`describeError`, `retryAfterOf`); the Telegram wizard step logic is there too.

## Gotchas

- Proxies must keep the `Host` header (Vite default, nginx `$http_host`): the backend Origin check compares `Origin` with `Host`.
- Do not duplicate backend access rules; show actions and surface `403`.
- Telegram QR must be rendered locally, never via external QR services.
- Theme: lo-fi pixel EX8 style on the green palette (#051F20…#DAF1DE); dark in `:root`, light in `:root.light` (`lib/theme.ts` over `interface.theme` = `dark`|`light`|`system`; `system` follows `prefers-color-scheme` live via `resolveTheme`, the sidebar toggle shows the resolved theme and sets the opposite explicitly; toggle in the sidebar profile and on `/settings`; Tailwind `dark:` = no `.light`). Fonts are pixel only: Tiny5 (titles, numbers, ring centers; sizes in multiples of 5px) and Handjet (text). Effects live in `src/index.css` (`fx-*` classes, shadcn tweaks via `data-slot`) and `components/fx.tsx` (`PageTitle`, `Section`, `Stat`, `Ring`, `ChannelsRing`, `StorageIcon`, `StatusChip`/`StatusLight`, `WireCubes`); every animation must stay off under `prefers-reduced-motion` and when `interface.animations` is off (`:root.still`, `prefersReducedMotion()`). Color only for signals; no glitch/scanline/CRT effects.
- Storages page shows per-storage size and file count (`total_size`, `files`) but no capacity/fill bars: Telegram channels have no size limit. Channel limit ring: `channelUsage` (`channels_used`/`channels_limit` from `GET /api/account`, fallback 500/1000 with an honest label).
- Storage read/write lamps: `useStorageIo` (sending + tracked upload tasks = write; archive tasks `archiving` + `markRead` from `lib/reads.ts` on downloads/previews = read), held ≥ `IO_HOLD_MS` by `lingerIo`. Only this browser's activity is known.
- `task.progress` from the API is a percent (0–100): always go through `taskFraction`.
- Never show storage/file uuids: use `lib/names.ts` (`humanPath`, `taskTitle`, `storageName`); "unavailable" only for `available === false` (`isUnavailable`).
- Search state lives in the URL of `/search` (`lib/search.ts`: `parseSearch`/`searchUrl` for the page, `searchQuery` for the API); the global bar is `components/search-bar.tsx` (outside the keyed `<main>` so it keeps focus across navigation). Never send an empty search (`hasCriteria`).
- Folder listing order lives in `lib/files.ts` (`viewEntries`: natural `Intl.Collator`, folders-first toggle, header sort with `aria-sort`).
- Optional extras (pet, sounds, confetti, cursor, eggs) are behind `lib/features.ts` (`interface.fx_*` settings), default off; the speedometer is always on; the activity map is on unless `interface.activity_map` is false (then not mounted, no `/files/activity` query); both skip animation under reduced motion. No new dependencies for effects.
- Dashboard uses only existing endpoints; admin-only queries (`users`) are `enabled`/rendered only for admins; the first-run checklist (`telegram` query) only for root.
- Thumbnails: only via `Thumb` / `thumbUrl` (`lib/thumbs.ts`): `/api/files/{id}/thumb?v=<updated_at>`, only for non-encrypted photo/video/animation, lazy, a failed URL falls back to the kind icon and is not retried. Never load full images from `/download` in listings.
- Upload dialogs start from `settings.uploads` (`uploadOptions`) and still send every option explicitly; `withSendAs` turns encryption off for `media` and back on for `file`. Archive menus use `settings.archives` (format first, priority sent).
- Uploads keep relative paths (folder upload); the backend creates parent folders. Bulk download = one archive of the selection (`POST /api/folders/archive/selection`, `selectionPayload`/`archiveError` in `lib/archive.ts`), tracked like any archive task.

## Rules

- Plan first; important decisions go to the owner as multiple-choice questions.
- No code comments; explanations go to README.md. Keep README.md and this file current.
- Tests for new logic in `src/lib`. Commits: one-line English (`feat:`, `fix:`), **never push**.
