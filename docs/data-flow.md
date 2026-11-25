# Data: queries, invalidation, settings

Server state lives in TanStack Query. What the server does not have, or what is needed instantly, lives in small module
stores on `useSyncExternalStore`.

## Query keys

Every request goes through `api.*` (`src/lib/api.ts`). The `QueryClient` defaults are in
[architecture.md](architecture.md#app-startup).

| Key | Request | Where | Notes |
|---|---|---|---|
| `['me']` | `GET /users/me` | `hooks/use-me.ts` | `queryFn` calls `hydrateSettings(me.settings)` |
| `['storages']` | `GET /storages` | `hooks/use-storages.ts` | `staleTime` 5 s (`STORAGES_STALE_MS`): own changes invalidate at once, other people's show up within 5 s on the next mount |
| `['folder', path, {sort_by, sort_order, folders_first, lang, limit}]` (`listingKey`) | `GET /folders?path=&sort_by=&sort_order=&folders_first=&lang=&limit=&cursor=` | `components/folder-view.tsx` (`useInfiniteQuery`) | pages of `limit` = `interface.page_size` (20/50/100/200, default 20; `pageSizeOf`, the `tcloud.page_size` copy while the server omits the field), the next one by `next_cursor` when the sentinel under the list enters the `IntersectionObserver` with a 600 px margin (or via the "Show more" button); the order comes from the backend, the client does not sort; totals (`size`, `total_files`, `total_folders`, `direct_files`) are only in the first page, cursor pages carry `null`, and the header and "N of M selected" read them through `listingTotals`; a new sort/language/page size = a new key = back to the first page (`placeholderData` keeps the old list until the answer); invalidation refetches the loaded pages one by one from the first (fresh cursors) without resetting the scroll; the palette reads the cache by the `listingKey` of the current sort; mouse hover (`pointerType === 'mouse'`, not touch) or keyboard focus (`:focus-visible`) on a folder link runs `prefetchInfiniteQuery` for its first page with the same `listingKey`/`limit`/sort (`listingOf`, freshness `PREFETCH_STALE_MS` 10 s, so hovering again sends no request); on navigation the page renders from the cache and refreshes in the background |
| `['task', id]` | `GET /tasks?ids=…` (batched by `taskLoader`) | `hooks/use-tasks.ts` (`useQueries`) | `refetchInterval` 5 s for `queued`, 1 s otherwise (`pollInterval`), until `done/failed/cancelled`; finished ones get `staleTime: Infinity` |
| `['task-counts']` | `GET /tasks/counts` | `hooks/use-tasks.ts` (`useTaskCounts`), `pages/dashboard.tsx` | `refetchInterval` 5 s; `TaskWatcher` invalidates per batch |
| `['storage-activity']` | `GET /storages/activity` | `hooks/use-storages.ts` (`useStorageIo`) | `refetchInterval` 500 ms while any lamp is lit, otherwise 3 s (not polled in the background); `markRead` → `refetch` after 300 ms; merged with the local lamps by `mergeIo`; after a local operation ends, the server's view of it is ignored until an answer later than the end + 1 s (`freshServerIo`) |
| `['search', apiQuery]` | `GET /files/search?…` | `hooks/use-search.ts` (`useInfiniteQuery`) | `enabled: hasCriteria`, `retry: false`, pages by `offset`; `lang` (the UI language) is part of `apiQuery`, the name order comes from the backend |
| `['search', 'palette', term]` | `GET /files/search?…&limit=8` | `components/command-palette.tsx` | from 2 characters, `retry: false` |
| `['mimes', path]` | `GET /files/search/mimes` | `hooks/use-search.ts` | `retry: false`; no `staleTime`, so the format facets see new/deleted files at once |
| `['activity', path]` | `GET /files/activity` | `hooks/use-activity.ts` | `retry: false`; not mounted if the `activity_map` block is hidden (`interface.dashboard_hidden`) |
| `['account']` | `GET /account` | `useAccount` (`hooks/use-storages.ts`) on the dashboard, in `components/storages.tsx`, `pages/telegram.tsx` | `staleTime` 60 s (`ACCOUNT_STALE_MS`; tasks, storage create and delete (`storageChangeKeys`, so the channels ring updates at once) and the previews switch invalidate at once); always `200`; before Telegram sign-in `telegram_connected: false` and `null` in the other fields |
| `['health']` | `GET /health` | `hooks/use-health.ts` (`useHealth`) → `components/health.tsx` (`HealthRack`) on `pages/dashboard.tsx`, `pages/telegram.tsx` | `refetchInterval` 15 s; `details` (probe latency, worker heartbeat age) are the rack metrics |
| `['telegram']` | `GET /telegram` | `pages/dashboard.tsx` (root), `pages/telegram.tsx` | on `/telegram` polled every 2 s while the step is `qr`/`starting` |
| `['telegram-devices']` | `GET /telegram/sessions` | `pages/telegram.tsx` | `retry: false` |
| `['users']` | `GET /users` | `pages/users.tsx`, `pages/dashboard.tsx` (admin) | |
| `['user', id]` | `GET /users/{id}` | `pages/user.tsx` | |
| `['grants', userId]` | `GET /users/{id}/grants` | `pages/user.tsx` | |
| `['api-keys', userId]` | `GET /users/{id}/api-keys` | `components/api-keys.tsx` | |
| `['upload-sessions', userId]` | `GET /uploads/sessions?user_id=` | `pages/user.tsx` | the "Unfinished uploads" card (root sees anyone, admin the `user` role), the cross sends `DELETE /uploads/sessions/{id}` |
| `['sessions']` | `GET /auth/sessions` | `pages/account.tsx` | |

## Mutations and invalidation

Mutations use `useAction` (`hooks/use-action.ts`): `useMutation`; on success `invalidateQueries` for every key in
`invalidate` (prefix match: `['folder']` hits every `['folder', path, …]`, `['folder', path]` every sort of that
folder), `toast.success`, `onSuccess`; on error `toast.error(describe ?? errorMessage)`.

```mermaid
flowchart LR
    subgraph files["Files and folders (folder-view.tsx)"]
        delFile["DELETE /files/{id}"]
        delFolder["DELETE /folders"]
        bulk["bulkDelete: DELETE one by one"]
        mkdir["POST /folders"]
    end
    subgraph st["Storages (storages.tsx)"]
        stCreate["POST /storages<br/>+ PUT photo"]
        stSave["PATCH /storages/{id}<br/>+ PUT photo"]
        stPhoto["DELETE /storages/{id}/photo"]
        stDel["DELETE /storages/{id}"]
    end
    subgraph adm["Users (users.tsx, user.tsx, api-keys.tsx)"]
        uCreate["POST /users"]
        uPatch["PATCH /users/{id}"]
        uDel["DELETE /users/{id}"]
        grant["PUT/DELETE grants"]
        key["POST/DELETE api-keys"]
        upSess["DELETE /uploads/sessions/{id}"]
    end
    subgraph acc["Account and Telegram"]
        pwd["POST /auth/password"]
        sess["DELETE /auth/sessions/{id}"]
        tgStep["Telegram session sign-in/out<br/>useRefreshTelegram"]
        dev["DELETE /telegram/sessions/{id}"]
    end
    watcher["TaskWatcher:<br/>a task finished"]

    delFile & delFolder & bulk --> kDeleted["folder, storages, account,<br/>activity, search, mimes"]
    mkdir --> kFolderP["folder, parent"]
    stCreate --> kStorageAcc["storages, account"]
    stSave --> kStorages["storages"]
    stPhoto --> kStorages
    stDel --> kStorageDel["storages, account,<br/>search, mimes"]
    uCreate --> kUsers["users"]
    uPatch --> kUsers
    uPatch --> kUser["user, id"]
    uDel --> kUsers
    grant --> kGrants["grants, id"]
    key --> kKeys["api-keys, id"]
    upSess --> kUpSess["upload-sessions, id"]
    pwd --> kSessions["sessions"]
    pwd --> kKeys
    sess --> kSessions
    tgStep --> kTelegram["telegram"]
    tgStep --> kHealth["health"]
    dev --> kDevices["telegram-devices"]
    watcher --> kFolderT["folder, the task's folder + ancestors<br/>(at once, once per batch response)"]
    watcher --> kStorages
    watcher --> kAccount["account"]
    watcher --> kActivity["activity"]
    watcher --> kCounts["task-counts"]
    watcher --> kSearch["search, mimes"]
```

Without invalidation:

- Actions on Tasks (`pages/tasks.tsx`: cancel, priority, retry) and cancel in the upload widget (`FolderUploads`) put the
  answer straight into the cache with `setQueryData(['task', id], task)`; cancel also refetches the task at once
  (`invalidateQueries(['task', id])`), retry also calls `trackTask`.
- Uploads from the device (after the XHR load) and by URL put the task answer into the cache (`setQueryData`) before
  `trackTask`.
- Archives (`POST /folders/archive`, `/folders/archive/selection`) only call `trackTask`: `TaskWatcher` refreshes the
  listing.
- Sign-in and sign-out: `queryClient.clear()` (`pages/login.tsx`, `Layout.logout`, "Sign out everywhere" and ending the
  current session in `pages/account.tsx`).
- `search`/`mimes` are invalidated by deletes (`DELETED` in `folder-view.tsx`, storage delete) and by `TaskWatcher` when
  tasks with a folder (uploads) finish; otherwise they refetch when the key changes (a new query) or on mount.

## Stores outside TanStack Query

```mermaid
flowchart LR
    subgraph ls["localStorage"]
        tasksLs["tcloud.tasks<br/>tcloud.tasks.pending"]
        mirror["tcloud.mirror"]
        layout["tcloud.dashboard.layout<br/>tcloud.dashboard.hidden"]
        cols["tcloud.file_columns<br/>tcloud.page_size"]
    end
    settings["lib/settings.ts<br/>useSettings"] -- "theme, language" --> mirror
    tasks["lib/tasks.ts<br/>useTrackedTasks: id[]"] <--> tasksLs
    sending["lib/upload.ts<br/>useSending: Sending[] (tab memory)"]
    reads["lib/reads.ts<br/>useReads: name for 5 s after markRead"]
    lang["lib/i18n.ts<br/>useLang"]
    io["hooks/use-storages.ts<br/>useStorageIo: endIo + freshServerIo + lingerIo"]
    srvIo["['storage-activity']<br/>GET /storages/activity<br/>500 ms lit / 3 s idle"] --> io
    sending -- "not cancelled" --> io
    tasks --> io
    reads -- "onRead → refetch after 300 ms" --> srvIo
    settings --> lang
    settings -- "dashboard_layout, dashboard_hidden (copies)" --> layout
    settings -- "file_columns, page_size (copies)" --> cols
```

Each store is a module variable + a `Set` of listeners + `useSyncExternalStore`. The other `localStorage` keys
(`tcloud.sidebar`, `tcloud.onboarding.dismissed`, `tcloud.dashboard.layout` / `tcloud.dashboard.hidden` as copies of
`interface.dashboard_layout` / `interface.dashboard_hidden`, `tcloud.file_columns` / `tcloud.page_size` as copies of
`interface.file_columns` / `interface.page_size`; all read only when the server omitted the field) are conveniences,
accessed through `lib/prefs.ts` or `try/catch`.

## Settings

`src/lib/settings.ts`. The source of truth is the server (`GET/PATCH/DELETE /api/account/settings`, `settings` in
`/users/me`). The store holds two values: `confirmed` (the last server answer) and `current` (what the UI shows).

### Loading and merging

```mermaid
flowchart TD
    def["DEFAULT_SETTINGS"] --> boot["confirmed = current =<br/>mergeSettings(DEFAULT, {interface: readMirror()})"]
    mirror[("localStorage tcloud.mirror<br/>theme, language")] --> boot
    boot --> apply1["main.tsx applySettings: theme, language before the server answers"]
    me["useMe: GET /users/me"] --> hyd{"hydrateSettings:<br/>settings present and pending == 0?"}
    hyd -- no --> skip["ignored (a save is in progress)"]
    hyd -- yes --> merge["confirmed = mergeSettings(DEFAULT, server)"]
    merge --> pub["publish(confirmed)"]
    pub --> mirrorW["writeMirror"]
    pub --> listeners["listeners: useSettings, applySettings"]
```

`mergeSettings` merges per group (`uploads`, `archives`, `interface`, `telegram`) over the defaults, so keys missing on
the server get their defaults.

### Optimistic saving

```mermaid
sequenceDiagram
    autonumber
    participant UI as Component
    participant S as settings store
    participant B as Backend
    UI->>S: updateSettings(patch)
    S->>S: id = ++pending
    S->>S: publish(mergeSettings(current, patch))
    Note over S: the UI sees the new value at once,<br/>hydrateSettings is ignored
    S->>S: queue = queue.then(send), waits for the previous PATCH/DELETE
    S->>B: PATCH /api/account/settings (patch only)
    alt 2xx
        B-->>S: full Settings
        S->>S: confirmed = merge(DEFAULT, answer)
        S->>S: if id == pending: publish(confirmed)
    else error
        B-->>S: ApiError
        S->>S: if id == pending: publish(confirmed), a revert
        S-->>UI: throw → toast (settingsError / errorMessage)
    end
    S->>S: if id == pending: pending = 0
```

- Only the last of concurrent saves publishes its result; intermediate answers update `confirmed`.
- Requests go strictly one at a time (`queue` in `commit`): the backend merges the patch with the stored value as a
  read-modify-write without a lock, and two parallel PATCHes lost one change (that is how "Done" on the dashboard lost
  `dashboard_layout` sent together with `dashboard_hidden`).
- `resetSettings()` does the same with `DEFAULT_SETTINGS` and `DELETE /api/account/settings`.
- Who writes: `pages/settings.tsx` (each field at once, the webhook via a button), `FolderView` (sort `sortPatch`, view
  `folder_view`), `Layout` (theme `setTheme`, language).

### Migrating old keys

`Layout` calls `migrateLegacy()` once, when `me.data` is ready.

```mermaid
flowchart TD
    start["migrateLegacy()"] --> any{"any of LEGACY_KEYS present?<br/>tcloud.view / sort / theme / feature.* / achievements"}
    any -- no --> done["nothing"]
    any -- yes --> patch["migrationPatch(current, read)"]
    patch --> def{"server interface = defaults<br/>and there are differences?"}
    def -- no --> clear["remove the keys"]
    def -- yes --> upd["updateSettings(patch)"]
    upd -- success --> clear
    upd -- error --> keep["keys stay until the next sign-in"]
```
