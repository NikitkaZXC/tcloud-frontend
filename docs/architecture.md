# Архитектура

Одностраничное приложение на Vite + React 19. Сервера у фронтенда нет: в dev статику отдаёт Vite, в Docker — nginx,
оба проксируют `/api` на бэкенд. Все схемы ниже сверены с кодом; при изменении потока обновляйте схему в том же коммите.

## Запуск приложения

`src/main.tsx` до первого рендера применяет настройки интерфейса (тема, `still`, язык) из стора `lib/settings.ts` и
подписывается на его изменения. Затем монтируется дерево провайдеров.

```mermaid
flowchart TD
    boot["main.tsx: applySettings()"] --> theme["applyTheme(ui.theme)<br/>lib/theme.ts"]
    boot --> still["html.still = !ui.animations"]
    boot --> lang["resolveLang + setLang<br/>html lang"]
    boot -. "subscribeSettings(applySettings)" .-> store[("settings store<br/>lib/settings.ts")]
    boot --> root["createRoot"]
    root --> strict["StrictMode"]
    strict --> qc["QueryClientProvider"]
    qc --> router["RouterProvider<br/>createBrowserRouter: один маршрут * → App"]
    router --> app["App<br/>key = useLang()"]
    qc --> toaster["Toaster (sonner)<br/>theme = useTheme()"]
    app --> routes["AppRoutes"]
```

- `QueryClient` (`src/main.tsx`): ретраи только для сетевых ошибок и `5xx` (не больше двух), `ApiError` со статусом
  `< 500` не повторяется; `refetchOnWindowFocus: false`.
- Роутер — data router (`createBrowserRouter`) с одним маршрутом `*`, внутри которого `<Routes>` из `App`: он нужен
  для `useBlocker` (дашборд спрашивает подтверждение перед уходом с несохранённым порядком блоков).
- `App` (`src/App.tsx`) монтирует `AppRoutes` с `key={useLang()}`: смена языка пересоздаёт всё дерево маршрутов.
- Отдельного провайдера темы и i18n нет: оба — модульные сторы на `useSyncExternalStore` (`lib/theme.ts`,
  `lib/i18n.ts`, `lib/settings.ts`).

## Маршруты

`src/App.tsx`. Всё, кроме `/login`, рендерится внутри `Layout` (`src/components/layout.tsx`).

```mermaid
flowchart LR
    login["/login<br/>LoginPage"]
    subgraph shell["Layout (нужен /users/me)"]
        index["/ → Navigate startPath()"]
        dash["/dashboard<br/>DashboardPage (lazy)"]
        files["/files<br/>FilesPage"]
        search["/search<br/>SearchPage (lazy)"]
        tasks["/tasks<br/>TasksPage (lazy)"]
        account["/account<br/>AccountPage (lazy)"]
        settings["/settings<br/>SettingsPage (lazy)"]
        users["/users<br/>UsersPage (lazy)"]
        user["/users/:id<br/>UserPage (lazy)"]
        tg["/telegram<br/>TelegramPage (lazy)"]
        star["* → NotFound (fx_easter_eggs)<br/>иначе Navigate startPath()"]
    end
    files --> list["без ?path: StorageList"]
    files --> folder["?path=tcloud/&lt;id&gt;/...: FolderView key=path"]
```

- `startPath` (`lib/settings.ts`): `interface.start_page` `dashboard|storages|tasks` → `/dashboard|/files|/tasks`.
- Маршруты не охраняются по роли: в боковой панели `/users` скрыт не для admin/root (`isAdmin`), `/telegram` — не для
  root; прямой заход получит `403` от бэкенда.

### Разбиение бандла

- `/login` и `/files` (стартовые) — в основном чанке; остальные страницы — `React.lazy` в `App.tsx`, каждая своим чанком
  (`/telegram` тянет `qrcode.react` только к себе). `Suspense` вокруг `<Outlet />` в `Layout` показывает «Загрузка…»
  (`common.loading`) в стиле остальных загрузок, боковая панель остаётся.
- `vite.config.ts` → `build.rolldownOptions.output.codeSplitting.groups`: `react` (react, react-dom, scheduler,
  react-router) и `vendor` (весь остальной `node_modules`, кроме `qrcode.react`). Новую тяжёлую зависимость, нужную
  только ленивой странице, тоже исключать из `vendor`, иначе она попадёт в начальную загрузку.
- Было: один `index.js` 751 kB (gzip 227 kB). Стало: `react` 257 kB, `vendor` 244 kB, `index` 113 kB, общий код
  страниц 71 kB, страницы 3–26 kB; предупреждения о чанке > 500 kB нет.

## Оболочка `Layout`

```mermaid
flowchart TD
    me["useMe(): GET /api/users/me<br/>hydrateSettings(me.settings)"] --> s401{"ошибка 401?"}
    s401 -- да --> nav["Navigate /login<br/>state.from = path + search"]
    s401 -- нет --> pend{"isPending?"}
    pend -- да --> loading["«Загрузка»"]
    pend -- нет --> err{"другая ошибка?"}
    err -- да --> msg["текст ошибки"]
    err -- нет --> ui["Sidebar + TaskWatcher + Extras<br/>CommandPalette + CornerHint<br/>SearchBar + main key=pathname → Outlet"]
    me -. "me.data готов" .-> mig["migrateLegacy() один раз"]
```

- `TaskWatcher`, `CommandPalette`, `SearchBar` смонтированы вне `<main key={location.pathname}>`, поэтому живут при
  переходах между страницами (строка поиска не теряет фокус).
- Выход: `POST /api/auth/logout` → `queryClient.clear()` → `/login`.

## Связь с бэкендом

```mermaid
flowchart LR
    browser["Браузер<br/>fetch / XHR / ссылки"] -- "/api/*, cookie access/refresh" --> proxy
    subgraph proxy["один origin"]
        vite["dev: Vite proxy<br/>vite.config.ts<br/>API_URL или 127.0.0.1:8000"]
        nginx["Docker: nginx<br/>docker/nginx.conf.template<br/>API_UPSTREAM"]
    end
    proxy -- "Host сохранён" --> backend["tcloud-backend<br/>FastAPI"]
```

- Фронт и API всегда на одном origin, поэтому cookie `access`/`refresh` ходят без CORS (`credentials: same-origin`).
- Прокси обязан сохранять `Host` (Vite по умолчанию, nginx — `proxy_set_header Host $http_host`): бэкенд сравнивает
  `Origin` с `Host`, иначе изменяющие запросы получают `403 cross_site_request`.
- nginx для `/api/` выключает буферизацию запроса и ответа, `client_max_body_size 0`, таймауты 1 ч — загрузки и
  скачивания идут потоком.
- Заголовки безопасности — `docker/security-headers.conf`, `include` в `server` и в каждом `location` с собственным
  `add_header` (`/assets/`, `/`): `add_header` в `location` отменяет унаследованные с уровня `server`.
- gzip: статика (`text/html`, CSS, JS, SVG, JSON) от 1 КБ с `Vary: Accept-Encoding`; в `/api/` `gzip_types` сужен до
  `application/json`; `/files/{id}/download`, `/files/{id}/thumb` и `/tasks/{id}/archive` идут через отдельный
  regex-`location` с `gzip off` (те же настройки прокси), даже если файл сам JSON (ответы `206` nginx не сжимает вовсе).

### Клиент API

`src/lib/api.ts`: `request(method, url, {query, json, body, retry})` добавляет префикс `/api`, сериализует `json`,
`204` → `undefined`, ошибка → `ApiError(status, body.error)` (`code`, `message`, `details` из ответа бэкенда; без
тела — `http_error`). Обёртки `api.get/post/put/patch/del`. Тексты ошибок: `errorMessage` (по `error.<code>` из
словаря, иначе `message (code)`, `TypeError` → «нет сети»), `errorText` для тела ошибки задачи.

### Авторизация и обновление сессии

```mermaid
sequenceDiagram
    autonumber
    participant C as Компонент / useQuery
    participant R as request() lib/api.ts
    participant F as refreshSession()
    participant B as Backend /api
    participant L as Layout

    C->>R: api.get('/users/me')
    R->>B: GET /api/users/me (cookie access)
    B-->>R: 401
    alt url не начинается с /auth/ и retry !== false
        R->>F: refreshSession()
        Note over F: параллельные 401 ждут один и тот же<br/>промис refreshing
        F->>B: POST /api/auth/refresh (cookie refresh)
        alt refresh ok
            B-->>F: 200, новые cookie
            F-->>R: true
            R->>B: повтор исходного запроса
            B-->>R: 200
            R-->>C: данные
        else refresh не удался
            B-->>F: 401
            F-->>R: false
            R-->>C: throw ApiError(401)
            C-->>L: useMe().error.status === 401
            L->>L: Navigate /login, state.from
        end
    end
```

```mermaid
sequenceDiagram
    autonumber
    participant P as LoginPage
    participant B as Backend /api
    participant Q as QueryClient
    P->>B: POST /api/auth/signin {login, password}
    alt успех
        B-->>P: 200 + cookie access/refresh
        P->>Q: queryClient.clear()
        P->>P: navigate(state.from ?? '/', replace)
    else ошибка
        B-->>P: ApiError(code, retry_after?)
        P->>P: describeError / retryAfterOf (lib/auth.ts), отсчёт
    end
```

- Только `401` от `/users/me` уводит на `/login` (через `Layout`); другие запросы после неудачного refresh просто
  показывают ошибку.
- Загрузка файла через XHR (`uploadFile`, `lib/upload.ts`) делает тот же один `refreshSession()` и повтор.
- Скачивания и превью — обычные ссылки `/api/files/{id}/download`, `/api/tasks/{id}/archive`, `/api/files/{id}/thumb`:
  cookie уходят сами, refresh для них не делается.

## События окна

Связь между несвязанными частями дерева без общего состояния.

| Событие | Кто шлёт | Кто слушает |
|---|---|---|
| `tcloud:folder-action` (`FOLDER_ACTION`, `lib/commands.ts`) | `CommandPalette` (`runFolderAction`) | `FolderView`: загрузить файлы/папку/по ссылке, новая папка, архив |
| `tcloud:palette` (`OPEN_PALETTE`) | кнопки в шапке/панели (`openPalette`) | `CommandPalette` |
| `tcloud:task-finished` (`TASK_EVENT`, `lib/features.ts`) | `TaskWatcher` при завершении задачи | `components/extras.tsx` (звуки) |

## Языки (i18n)

Свой модуль без зависимостей, `src/lib/i18n.ts`. `<html translate="no">` в `index.html` (`lang` ставит `applySettings` в `main.tsx`): автоперевод браузера переписывает DOM-узлы, и React падает на следующем обновлении (`removeChild`/`insertBefore`); интерфейс и так на двух языках.

```mermaid
flowchart LR
    set["interface.language<br/>(null = браузер)"] --> resolve["resolveLang(setting, navigator.language)<br/>ru* → ru, иначе en"]
    resolve --> setLang["setLang(lang)<br/>main.tsx applySettings"]
    setLang --> htmlLang["html lang"]
    setLang --> useLang["useLang()"]
    useLang --> remount["App: AppRoutes key=lang<br/>перемонтирование"]
    remount --> tcall["t(key, params)<br/>словарь ru.ts / en.ts"]
```

- Словари: `src/lib/locales/ru.ts` задаёт тип `Key`, `en.ts` — `Record<Key, Entry>`; совпадение ключей и подстановок
  проверяют `tsc` и `src/lib/i18n.test.ts`.
- `translate`: нет ключа в языке → русский → сам ключ. Множественное число — объект `{one, few, many, other}`, форма
  по `Intl.PluralRules(lang)` от `params.n`. Подстановки `{name}`.
- Константы модулей хранят ключи, а не текст (текст вычисляется после перемонтирования). `tAll` склеивает перевод на
  обоих языках — для `keywords` команд Ctrl+K.
- До ответа `/users/me` язык берётся из `tcloud.mirror` (см. [data-flow.md](data-flow.md#настройки)) или браузера.
