# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-25

First public release.

### Added

- Storages, folders and files: keyset-paged listings with server-side natural sort, folder sizes and counts, grid and
  list views, resizable columns, multi-select, hotkeys and lazy pixel thumbnails.
- Uploads from the device, whole folders and by URL, encrypted by default; resumable chunked uploads for files over
  64 MiB; a conflict dialog on 409 (replace, keep both, apply to all); per-file progress, speed, ETA and cancel.
- Folder and selection archives, downloads and previews.
- File search with scope, format and date/size filters, a linkable `/search` URL and a Ctrl/Cmd+K command palette.
- Task tracking in the browser: batched polling, step progress, retry, cancel and priority (high for admins).
- Users, access grants, API keys, sessions and unfinished uploads management; webhook signing key in settings.
- Step-by-step Telegram sign-in wizard with QR code, code and 2FA password for root, plus a first-run checklist.
- Dashboard with ring gauges, storage read/write lamps, an upload activity map and a system health rack; blocks can be
  reordered and hidden.
- Server-side user settings (`/account/settings`) for theme, view, sort, page size, animations and defaults.
- Russian and English UI with typed i18n, plurals, dates, sizes and collation per language.
- Pixel EX8 look with the self-hosted Departure Mono font, six themes plus one that follows the system.
- Rate-limit handling (429): one shared toast and query retries after `retry_after`; readable quota and limit errors.
- nginx Docker image with Content-Security-Policy, HSTS, Permissions-Policy and COOP headers, a 1 MB body limit outside
  upload routes, gzip and immutable font caching.
- CI (lint, tests, build, `npm audit`), Dependabot, and Docker image publishing to GHCR on version tags.

[Unreleased]: https://github.com/NikitkaZXC/tcloud-frontend/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NikitkaZXC/tcloud-frontend/releases/tag/v1.0.0
