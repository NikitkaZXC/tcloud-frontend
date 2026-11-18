# Загрузки и задачи

У API нет списка «моих задач» (только по id или `batch_id`), поэтому браузер сам помнит id запущенных задач и опрашивает
их. Загрузка с устройства проходит два этапа: отправка тела в вкладке (XHR) и задача на сервере.

## Точки входа

Все файлы с устройства попадают в `UploadDialog` (`components/upload-dialog.tsx`) через состояние `files` в
`FolderView` (`components/folder-view.tsx`). Ссылки — в `UrlUploadDialog`.

```mermaid
flowchart LR
    pick["input file"] -- fromFiles --> setFiles
    dir["input webkitdirectory"] -- "fromFiles → choose" --> setFiles
    paste["Ctrl+V (paste)"] -- fromFiles --> setFiles
    dropF["drop без entries"] -- fromFiles --> setFiles
    dropD["drop папок<br/>webkitGetAsEntry"] -- "readEntries (lib/dir-upload.ts) → choose" --> setFiles
    palette["Ctrl+K: tcloud:folder-action<br/>upload / upload-folder"] --> pick
    palette --> dir
    setFiles["FolderView: setFiles(Picked[])"] --> dialog["UploadDialog"]
    paletteUrl["Ctrl+K: url"] --> urlDialog["UrlUploadDialog"]
    btnUrl["кнопка «По ссылке»"] --> urlDialog
    dialog --> xhr["POST /api/uploads (XHR)<br/>по одному файлу"]
    urlDialog --> batch["POST /api/uploads/batch"]
    archive["меню «Скачать папку»<br/>POST /api/folders/archive"] --> track
    sel["«Скачать архивом» выбранное<br/>POST /api/folders/archive/selection"] --> track
    retry["Задачи: «Повторить»<br/>POST /api/tasks/{id}/retry"] --> track
    xhr --> track["trackTask(id)<br/>lib/tasks.ts"]
    batch --> track
```

- `choose` пустой список не открывает диалог, а показывает «нет файлов»; пустые папки не загружаются.
- `Picked.path` — относительный путь (`webkitRelativePath` или путь из обхода); итоговый путь
  `joinPath(folder, path)`, недостающие папки создаёт бэкенд.
- Параметры: `uploadOptions(settings.uploads)` как стартовые, правки в диалоге — только для этой загрузки;
  `withSendAs` выключает `encrypt` для `media` и включает для `file`. Все параметры уходят явно в query-строке.

## Отправка файлов

```mermaid
sequenceDiagram
    autonumber
    participant D as UploadDialog.start()
    participant U as lib/upload.ts
    participant B as Backend
    participant T as lib/tasks.ts
    D->>U: startSending(path, size) для каждого файла
    D->>D: onClose(), toast «в очереди: N»
    loop файлы по очереди
        D->>U: uploadFile(file, {...options, path}, onProgress)
        U->>B: XHR POST /api/uploads?path=…&send_as=…&encrypt=… (тело = файл)
        B-->>U: upload.onprogress
        U->>U: updateSending(id, loaded)<br/>не чаще SENDING_TICK_MS (250 мс), последний байт всегда,<br/>rate = nextRate (сглаживание 0.7/0.3)
        alt 401
            U->>B: POST /api/auth/refresh
            U->>B: повтор XHR
        end
        alt 2xx
            B-->>U: Task
            U-->>D: task
            D->>T: trackTask(task.id)
        else ошибка
            U-->>D: throw ApiError
            D->>D: toast «имя: ошибка»
        end
        D->>U: finishSending(id)
    end
```

- Прогресс отправки живёт только в памяти вкладки (`useSending`). Пока список не пуст, `TaskWatcher` вешает
  `beforeunload`, чтобы браузер спросил перед закрытием.
- Ссылки: `parseUrlLines` (строка `url` или `url | имя`) → `POST /api/uploads/batch {items}`; для каждого элемента с
  `task` — `trackTask`, с `error` — уведомление.

## Отслеживание задач

```mermaid
sequenceDiagram
    autonumber
    participant T as lib/tasks.ts (tcloud.tasks, tcloud.tasks.pending)
    participant Q as useTasks (hooks/use-tasks.ts)
    participant B as Backend
    participant W as TaskWatcher
    participant C as QueryClient
    T-->>Q: useTrackedTasks(): id[]
    loop каждые 1500 мс, пока статус не done/failed/cancelled
        Q->>B: GET /api/tasks/{id}
        B-->>Q: Task
    end
    Q-->>W: results
    alt 404 (задачи больше нет)
        W->>T: forgetTasks(gone)
    else статус завершённый и id в pending (isPending)
        W->>T: reportTask(id, forget) — убрать из pending,<br/>done без архива — забыть совсем
        W->>C: invalidate folder, storages, account, activity
        W->>W: dispatch tcloud:task-finished (detail = status)
        alt done + archive
            W->>W: toast «архив готов» + кнопка «Скачать»<br/>markRead(path), location = /api/tasks/{id}/archive
        else done
            W->>W: toast «готово»
        else failed
            W->>W: toast с errorText(task.error)
        end
    end
```

`TaskWatcher` смонтирован в `Layout` один раз на всё приложение. `trackTask` кладёт id и в `tcloud.tasks`, и в
`tcloud.tasks.pending` (задачи, о завершении которых ещё не сообщили); повтор задачи кладёт её в pending снова.
Завершённая задача из pending вызывает уведомление ровно один раз, даже если уже завершена при первом опросе или
завершилась, пока вкладка была закрыта; после `reportTask` перезагрузка страницы её не повторяет.
Готовые задачи без архива забываются сразу после уведомления; `failed`/`cancelled` и готовые архивы (кнопка «Скачать» на «Задачах») остаются до «Забыть». Список ограничен
`MAX_TASKS` (50): `trackTask` сначала выкидывает самые старые уже объявленные задачи, потом самые старые вообще.
Завершённые задачи в кэше не устаревают (`staleTime: Infinity`), их не перезапрашивают при монтировании.
Другие вкладки подхватывают оба ключа по событию `storage`.

### Жизнь элемента в браузере

```mermaid
stateDiagram-v2
    [*] --> Sending: startSending
    Sending --> Tracked: uploadFile ok → trackTask
    Sending --> [*]: ошибка отправки → toast
    [*] --> Tracked: batch / архив / повтор → trackTask
    Tracked --> Polling
    Polling --> Polling: GET /tasks/{id} каждые 1,5 с
    Polling --> Finished: done / failed / cancelled
    Polling --> [*]: 404 → forgetTasks
    Finished --> Polling: «Повторить» (setQueryData queued)
    Finished --> [*]: done без архива — сразу после уведомления (reportTask)
    Finished --> [*]: «Забыть» / «Убрать завершённые» (forgetTask)
    Finished --> [*]: вытеснена лимитом MAX_TASKS (capTasks)
```

### Статусы задачи (как их показывает фронт)

`TASK_STATUS` и `TASK_STAGE` в `src/lib/tasks.ts`; `FINISHED` — в `hooks/use-tasks.ts`.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> running
    queued --> cancelled: отмена
    running --> done
    running --> failed
    running --> cancelled: отмена
    failed --> queued: retry (только задачи по ссылке)
    cancelled --> queued: retry (только задачи по ссылке)
    done --> [*]
```

Стадии — подписи `TASK_STAGE` (`downloading`, `scanning`, `uploading_tg`, `archiving`, `done`); порядок стадий и
правила повторов задаёт бэкенд (`tcloud-backend/docs/flows/uploads.md`, `docs/background-tasks.md`). Повтор
возвращает ту же задачу (тот же id) в `queued`. `task.progress` — проценты 0–100, во фронте только через
`taskFraction` (0–1).

## Кто читает задачи и отправки

| Потребитель | Что показывает |
|---|---|
| `components/folder-uploads.tsx` | над листингом: отправки и не-архивные задачи `queued/running/failed` внутри текущей папки, спидометр |
| `pages/tasks.tsx` | все отслеживаемые задачи, фильтр `visibleTasks(tasks_filter)`, отмена/приоритет/повтор/забыть |
| `pages/dashboard.tsx` | «Активность»: кольца по статусам, прогресс идущих, чек-лист первого запуска (`lib/onboarding.ts`) |
| `hooks/use-storages.ts` `useStorageIo` | лампы чтения/записи хранилищ: отправки + задачи загрузки = запись, `archiving` + `markRead` = чтение, удержание `IO_HOLD_MS` (`lingerIo`) |
| `components/extras.tsx` | реакции на `tcloud:task-finished` (за флагами `fx_*`) |
