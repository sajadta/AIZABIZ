# AIZABIZ — Upstox Live Algo Trading Terminal

A full-featured algorithmic trading terminal for **Upstox** (NSE/BSE). React + Vite frontend, Express backend, built with Bun.

**Paper trading is the default.** Without a valid Upstox access token the app runs entirely in **simulated mode** — quotes, candles, option chains, signals and orders are generated locally and no real money is ever touched. Point it at your real Upstox account only after you are ready to trade live.

## Features

- Real-time quotes & candlestick charts (NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX, equities)
- Option chain with synthetic Greeks & IV
- Automated buy/sell engine (AlgoBot) with strategy signals
- Orders, positions & square-off management
- Gemini AI market analysis (optional, needs `GEMINI_API_KEY`)
- PWA: installable on Android / desktop

## Requirements

- [Bun](https://bun.sh) ≥ 1.x (or Node.js ≥ 20 + npm)

## Quick start

```bash
bun install
cp .env.example .env   # then fill in your values
bun run dev            # dev server (Vite middleware, auto-reload)
```

Open http://localhost:3000 (change with `PORT=3100 bun run dev`).

## Production

```bash
bun install
bun run build          # builds frontend + bundles server to dist/
bun start              # boots the production server (NODE_ENV=production)
```

- `bun start` serves the **built output** from `dist/` — it never starts Vite.
- The port defaults to `3000`; override with `PORT`:
  `PORT=3100 bun start`
- On Render/Heroku-style platforms set `PORT` in the platform config.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | optional | Google Gemini API key for AI market analysis. |
| `APP_URL` | recommended | Public URL of the deployed app (used for the Upstox OAuth redirect URI and keep-alive pings). |
| `UPSTOX_API_KEY` | for live | Upstox API key (client id). |
| `UPSTOX_API_SECRET` | for live | Upstox API secret. |
| `UPSTOX_REDIRECT_URI` | for live | OAuth redirect URI; defaults to `${APP_URL}/api/upstox/callback`. |
| `UPSTOX_ACCESS_TOKEN` | for live | Upstox access token. Can also be set in the app's Live Terminal settings UI. |

**Important:** without `UPSTOX_ACCESS_TOKEN` the terminal runs in **simulated/paper mode** (randomized but realistic market data; no real orders). Live mode is only active when a valid token is configured — double-check before trading with real money.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Start dev server (tsx + Vite middleware) |
| `bun run build` | Build frontend + bundle server to `dist/` |
| `bun start` | Run the production server (`NODE_ENV=production node dist/server.cjs`) |
| `bun run lint` | Typecheck (`tsc --noEmit`) |
| `bun run clean` | Remove `dist/` build output |

## Security notes

Never commit real secrets. `.env` is gitignored; only `.env.example` is committed. The Upstox OAuth flow exchanges credentials server-side — keep API keys out of the client bundle.

## License

See the repository owner.
