# AGENTS.md

## Repository overview
`trading-pwa` — React/Vite PWA frontend plus an Express/TypeScript backend (`server.ts`
bootstraps the server, logic lives under `server/`).

## Commands
- Typecheck: `npm run typecheck` (tsc --noEmit) — must stay at 0 errors.
- Build: `npm run build` (vite build).
- Lint: `npm run lint` (eslint). Warnings are tolerated; errors are not.
- Tests: `npx tsx --test "server/tests/*.test.ts"` (34 tests across focused files).
- Dev server: `npx tsx server.ts` (listens on port 3000; run with `timeout` in CI/agent contexts).

## Structure
- `server/routes/*.ts` are thin registrars; route groups live in matching folders
  (`server/routes/market/*`, `server/routes/bot/*`, `server/routes/trading/*`).
- `server/services/bot/*` holds the bot engine (liveFeed, positionMonitor, entryScan, antiChurn).
- `server/tests/*.test.ts` holds the node:test suites; shared fixtures live in `server/tests/helpers.ts`.
- `src/utils/indicators/*` holds pure indicator math (signals, calculations, session helpers).

## Refactor conventions
- Keep route registration parity: `app.get/post/put/delete` paths must be identical
  before and after a split.
- When moving a file one directory deeper, adjust relative import depth
  (`../state` -> `../../state`) and drop imports that are no longer referenced.
- Verify each split with typecheck + build + a `timeout` boot of `server.ts` before committing.

## Known environment limitation
- The sandbox GitHub credentials currently CANNOT push to `sajadta/AIZABIZ`
  (git push returns `403 Permission ... denied`, and `gh api` ref creation returns
  `Resource not accessible by integration`). Commit locally and push once credentials
  with write access are available.

## Running the app for a preview
- The Agent Canvas preview URL proxies to port 12000, so start the server with
  `npx tsx server.ts --port 12000`. Plain `npm start` binds 3000 and the tunnel
  shows "Bad Gateway".
- `vite.config.ts` lists `server.allowedHosts`; add a new tunnel domain there if
  Vite answers "Blocked request. This host is not allowed".
- The container reports `navigator.language` as `en-US@posix`, which `Intl`
  rejects. Never let a library default to it — pass an explicit locale
  (e.g. lightweight-charts `localization.locale`).
