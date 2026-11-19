# Данные: запросы, инвалидация, настройки

Серверное состояние живёт в TanStack Query. То, чего нет на сервере или что нужно мгновенно, — в маленьких
модульных сторах на `useSyncExternalStore`.

## Ключи запросов

Все запросы идут через `api.*` (`src/lib/api.ts`). Умолчания `QueryClient` — в [architecture.md](architecture.md#запуск-приложения).

| Ключ | Запрос | Где | Особенности |
|---|---|---|---|
| `['me']` | `GET /users/me` | `hooks/use-me.ts` | `queryFn` вызывает `hydrateSettings(me.settings)` |
| `['storages']` | `GET /storages` | `hooks/use-storages.ts` | |
| `['folder', path]` | `GET /folders?path=` | `components/folder-view.tsx` | палитра читает кэш `getQueryData(['folder', folder])` |
| `['task', id]` | `GET /tasks?ids=…` (пачкой через `taskLoader`) | `hooks/use-tasks.ts` (`useQueries`) | `refetchInterval` 5 с для `queued`, 1,5 с иначе (`pollInterval`), пока не `done/failed/cancelled`; завершённые — `staleTime: Infinity` |
| `['task-counts']` | `GET /tasks/counts` | `hooks/use-tasks.ts` (`useTaskCounts`), `pages/dashboard.tsx` | `refetchInterval` 5 с; `TaskWatcher` инвалидирует пачкой |
| `['storage-activity']` | `GET /storages/activity` | `hooks/use-storages.ts` (`useStorageIo`) | `refetchInterval` 2,5 с (в фоне не опрашивается); сливается с локальными лампами `mergeIo` |
| `['search', apiQuery]` | `GET /files/search?…` | `hooks/use-search.ts` (`useInfiniteQuery`) | `enabled: hasCriteria`, `retry: false`, страницы по `offset`; `lang` (язык интерфейса) входит в `apiQuery`, порядок по имени — от бэкенда |
| `['search', 'palette', term]` | `GET /files/search?…&limit=8` | `components/command-palette.tsx` | от 2 символов, `retry: false` |
| `['mimes', path]` | `GET /files/search/mimes` | `hooks/use-search.ts` | `staleTime` 60 с, `retry: false` |
| `['activity', path]` | `GET /files/activity` | `hooks/use-activity.ts` | `retry: false`; не монтируется, если блок `activity_map` скрыт (`interface.dashboard_hidden`) |
| `['account']` | `GET /account` | `pages/dashboard.tsx`, `components/storages.tsx`, `pages/telegram.tsx` | всегда `200`; до входа в Telegram `telegram_connected: false` и `null` в остальных полях |
| `['health']` | `GET /health` | `hooks/use-health.ts` (`useHealth`) → `components/health.tsx` (`HealthRack`) на `pages/dashboard.tsx`, `pages/telegram.tsx` | `refetchInterval` 15 с; `details` (задержка проб, возраст пульса воркеров) — метрики стойки |
| `['telegram']` | `GET /telegram` | `pages/dashboard.tsx` (root), `pages/telegram.tsx` | на `/telegram` опрос 2 с, пока шаг `qr`/`starting` |
| `['telegram-devices']` | `GET /telegram/sessions` | `pages/telegram.tsx` | `retry: false` |
| `['users']` | `GET /users` | `pages/users.tsx`, `pages/dashboard.tsx` (admin) | |
| `['user', id]` | `GET /users/{id}` | `pages/user.tsx` | |
| `['grants', userId]` | `GET /users/{id}/grants` | `pages/user.tsx` | |
| `['api-keys', userId]` | `GET /users/{id}/api-keys` | `components/api-keys.tsx` | |
| `['sessions']` | `GET /auth/sessions` | `pages/account.tsx` | |

## Мутации и инвалидация

Мутации — `useAction` (`hooks/use-action.ts`): `useMutation`, на успех `invalidateQueries` по каждому ключу из
`invalidate` (префиксное совпадение: `['folder']` задевает все `['folder', path]`), `toast.success`, `onSuccess`; на
ошибку `toast.error(describe ?? errorMessage)`.

```mermaid
flowchart LR
    subgraph files["Файлы и папки (folder-view.tsx)"]
        delFile["DELETE /files/{id}"]
        delFolder["DELETE /folders"]
        bulk["bulkDelete: DELETE по одному"]
        mkdir["POST /folders"]
    end
    subgraph st["Хранилища (storages.tsx)"]
        stSave["POST /storages, PATCH /storages/{id}<br/>+ PUT photo"]
        stPhoto["DELETE /storages/{id}/photo"]
        stDel["DELETE /storages/{id}"]
    end
    subgraph adm["Пользователи (users.tsx, user.tsx, api-keys.tsx)"]
        uCreate["POST /users"]
        uPatch["PATCH /users/{id}"]
        uDel["DELETE /users/{id}"]
        grant["PUT/DELETE grants"]
        key["POST/DELETE api-keys"]
    end
    subgraph acc["Аккаунт и Telegram"]
        pwd["POST /auth/password"]
        sess["DELETE /auth/sessions/{id}"]
        tgStep["вход/выход сессии Telegram<br/>useRefreshTelegram"]
        dev["DELETE /telegram/sessions/{id}"]
    end
    watcher["TaskWatcher:<br/>задача завершилась"]

    delFile & delFolder & bulk --> kDeleted["folder, storages, account,<br/>activity, search, mimes"]
    mkdir --> kFolderP["folder, parent"]
    stSave --> kStorages
    stPhoto --> kStorages
    stDel --> kStorages
    uCreate --> kUsers["users"]
    uPatch --> kUsers
    uPatch --> kUser["user, id"]
    uDel --> kUsers
    grant --> kGrants["grants, id"]
    key --> kKeys["api-keys, id"]
    pwd --> kSessions["sessions"]
    sess --> kSessions
    tgStep --> kTelegram["telegram"]
    tgStep --> kHealth["health"]
    dev --> kDevices["telegram-devices"]
    watcher --> kFolderT["folder, папка задачи + предки<br/>(пачкой через 1,5 с)"]
    watcher --> kStorages
    watcher --> kAccount["account"]
    watcher --> kActivity["activity"]
    watcher --> kCounts["task-counts"]
```

Без инвалидации:

- Действия на «Задачах» (`pages/tasks.tsx`: отмена, приоритет, повтор) кладут ответ прямо в кэш
  `setQueryData(['task', id], task)`; повтор ещё и `trackTask`.
- Архивы (`POST /folders/archive`, `/folders/archive/selection`) только `trackTask`: листинг обновит `TaskWatcher`.
- Вход и выход: `queryClient.clear()` (`pages/login.tsx`, `Layout.logout`, «Выйти везде» и завершение текущей сессии в
  `pages/account.tsx`).
- `search`/`mimes` инвалидируют только удаления (`DELETED` в `folder-view.tsx`); иначе они перезапрашиваются при смене
  ключа (новый запрос) или монтировании.

## Сторы вне TanStack Query

```mermaid
flowchart LR
    subgraph ls["localStorage"]
        tasksLs["tcloud.tasks<br/>tcloud.tasks.pending"]
        mirror["tcloud.mirror"]
        layout["tcloud.dashboard.layout<br/>tcloud.dashboard.hidden"]
        cols["tcloud.file_columns"]
    end
    settings["lib/settings.ts<br/>useSettings"] -- "theme, language" --> mirror
    tasks["lib/tasks.ts<br/>useTrackedTasks: id[]"] <--> tasksLs
    sending["lib/upload.ts<br/>useSending: Sending[] (память вкладки)"]
    reads["lib/reads.ts<br/>useReads: 5 с после markRead"]
    lang["lib/i18n.ts<br/>useLang"]
    io["hooks/use-storages.ts<br/>useStorageIo + lingerIo"]
    srvIo["['storage-activity']<br/>GET /storages/activity"] --> io
    sending --> io
    tasks --> io
    reads --> io
    settings --> lang
    settings -- "dashboard_layout, dashboard_hidden (копии)" --> layout
    settings -- "file_columns (копия)" --> cols
```

Каждый стор — модульная переменная + `Set` слушателей + `useSyncExternalStore`. Прочие ключи `localStorage`
(`tcloud.sidebar`, `tcloud.onboarding.dismissed`, `tcloud.dashboard.layout` / `tcloud.dashboard.hidden` — копии
`interface.dashboard_layout` / `interface.dashboard_hidden`, `tcloud.file_columns` — копия `interface.file_columns`; обе читаются, только если сервер не отдал поле) — удобства, через `lib/prefs.ts` или
`try/catch`.

## Настройки

`src/lib/settings.ts`. Источник правды — сервер (`GET/PATCH/DELETE /api/account/settings`, `settings` в
`/users/me`). Стор держит два значения: `confirmed` (последний ответ сервера) и `current` (то, что видит UI).

### Загрузка и слияние

```mermaid
flowchart TD
    def["DEFAULT_SETTINGS"] --> boot["confirmed = current =<br/>mergeSettings(DEFAULT, {interface: readMirror()})"]
    mirror[("localStorage tcloud.mirror<br/>theme, language")] --> boot
    boot --> apply1["main.tsx applySettings: тема, язык до ответа сервера"]
    me["useMe: GET /users/me"] --> hyd{"hydrateSettings:<br/>есть settings и pending == 0?"}
    hyd -- нет --> skip["игнор (идёт сохранение)"]
    hyd -- да --> merge["confirmed = mergeSettings(DEFAULT, server)"]
    merge --> pub["publish(confirmed)"]
    pub --> mirrorW["writeMirror"]
    pub --> listeners["слушатели: useSettings, applySettings"]
```

`mergeSettings` сливает по группам (`uploads`, `archives`, `interface`, `telegram`) поверх значений по умолчанию,
поэтому отсутствующие на сервере ключи получают умолчания.

### Оптимистичное сохранение

```mermaid
sequenceDiagram
    autonumber
    participant UI as Компонент
    participant S as settings store
    participant B as Backend
    UI->>S: updateSettings(patch)
    S->>S: id = ++pending
    S->>S: publish(mergeSettings(current, patch))
    Note over S: UI сразу видит новое значение,<br/>hydrateSettings игнорируется
    S->>B: PATCH /api/account/settings (только patch)
    alt 2xx
        B-->>S: полные Settings
        S->>S: confirmed = merge(DEFAULT, ответ)
        S->>S: если id == pending: publish(confirmed)
    else ошибка
        B-->>S: ApiError
        S->>S: если id == pending: publish(confirmed) — откат
        S-->>UI: throw → toast (settingsError / errorMessage)
    end
    S->>S: если id == pending: pending = 0
```

- Только последнее из одновременных сохранений публикует результат; промежуточные ответы обновляют `confirmed`.
- `resetSettings()` — то же с `DEFAULT_SETTINGS` и `DELETE /api/account/settings`.
- Кто пишет: `pages/settings.tsx` (каждое поле сразу, вебхук — кнопкой), `FolderView` (сортировка `sortPatch`, вид
  `folder_view`), `Layout` (тема `setTheme`, язык).

### Перенос старых ключей

`migrateLegacy()` вызывается `Layout` один раз, когда `me.data` готов.

```mermaid
flowchart TD
    start["migrateLegacy()"] --> any{"есть хоть один из LEGACY_KEYS<br/>tcloud.view / sort / theme / feature.* / achievements?"}
    any -- нет --> done["ничего"]
    any -- да --> patch["migrationPatch(current, read)"]
    patch --> def{"interface на сервере = умолчания<br/>и есть отличия?"}
    def -- нет --> clear["удалить ключи"]
    def -- да --> upd["updateSettings(patch)"]
    upd -- успех --> clear
    upd -- ошибка --> keep["ключи остаются до следующего входа"]
```
