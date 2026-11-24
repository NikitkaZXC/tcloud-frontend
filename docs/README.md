# Документация tcloud-frontend

Точка входа — [README.md](../README.md) (обзор, схема, ручки, быстрый старт). Здесь — как всё устроено, со схемами
Mermaid, сверенными с кодом.

| Файл | О чём |
|---|---|
| [architecture.md](architecture.md) | запуск, провайдеры, маршруты, оболочка `Layout`, прокси `/api` и nginx, авторизация и refresh, 429, события окна, i18n |
| [data-flow.md](data-flow.md) | ключи TanStack Query, карта инвалидаций, сторы вне Query, настройки: загрузка, слияние, оптимистичное сохранение, перенос |
| [uploads-and-tasks.md](uploads-and-tasks.md) | точки входа загрузок, XHR-отправка, загрузка частями, конфликты имён, отслеживание задач, `TaskWatcher`, статусы |
| [ui.md](ui.md) | страницы и функции: вход, Telegram, навигация, поиск, листинг папки, настройки, дашборд, лампы чтения/записи, фишки |
| [theming.md](theming.md) | стиль, темы и пресеты, `data-theme`/`.light`, токены, типографика, анимации, как добавить тему |

## Разработка

- CI (`.github/workflows/ci.yml`) на push в `main` и на pull request (повторный запуск отменяет предыдущий): `npm ci`, `npm run lint`, `npm test`,
  `npm run build` на Node 26 (как в `Dockerfile`, поднимать вместе).
- Dependabot (`.github/dependabot.yml`) раз в месяц обновляет npm, базовые образы `Dockerfile`
  и GitHub Actions: все обновления экосистемы одним PR, не больше 2 открытых PR на экосистему.
- Проверено в Chrome и Safari (WebKit); Firefox не проверялся.

Правило: изменение кода, которое меняет поток со схемы, обновляет документ и схему в том же коммите.
API бэкенда описан в `../tcloud-backend/docs/`.
