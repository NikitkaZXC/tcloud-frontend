# tcloud-frontend documentation

Start at [README.md](../README.md) (overview, diagram, endpoints, quick start). This folder explains how everything
works, with Mermaid diagrams checked against the code.

| File | Topic |
|---|---|
| [architecture.md](architecture.md) | startup, providers, routes, the `Layout` shell, the `/api` proxy and nginx, auth and refresh, 429, window events, i18n |
| [data-flow.md](data-flow.md) | TanStack Query keys, the invalidation map, stores outside Query, settings: loading, merging, optimistic saving, migration |
| [uploads-and-tasks.md](uploads-and-tasks.md) | upload entry points, XHR sending, chunked uploads, name conflicts, task tracking, `TaskWatcher`, statuses |
| [ui.md](ui.md) | pages and features: sign-in, Telegram, navigation, search, folder listing, settings, dashboard, read/write lamps, extras |
| [theming.md](theming.md) | style, themes and presets, `data-theme`/`.light`, tokens, typography, animations, how to add a theme |

## Development

- CI (`.github/workflows/ci.yml`) on push to `main` and on pull requests (a new run cancels the previous one): `npm ci`,
  `npm run lint`, `npm test`, `npm run build` on Node 26 (same as the `Dockerfile`; bump both together).
- Release (`.github/workflows/release.yml`): a `v*.*.*` tag builds the `Dockerfile` and pushes it to
  `ghcr.io/nikitkazxc/tcloud-frontend`.
- Dependabot (`.github/dependabot.yml`) updates npm, the `Dockerfile` base images and GitHub Actions once a month: all
  updates of an ecosystem in one PR, at most 2 open PRs per ecosystem.
- Tested in Chrome and Safari (WebKit); Firefox has not been tested.

Rule: a code change that alters a flow shown in a diagram updates the document and the diagram in the same commit.
The backend API is documented in [tcloud-backend/docs](https://github.com/NikitkaZXC/tcloud-backend/tree/main/docs).
