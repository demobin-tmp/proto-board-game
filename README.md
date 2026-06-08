# Stacking Tiles — prototype

A two-player, turn-based tile-stacking board game prototype, built to playtest
the idea remotely. See [docs/GAME_PLAN.md](docs/GAME_PLAN.md) for the rules,
architecture, how to run it (you need both `npm run server` and `npm run dev`),
and how to play remotely with a friend over a tunnel.

## Quick start

```
npm install
npm run server   # game server on http://localhost:8000
npm run dev      # web client on http://localhost:5173 (separate terminal)
```

Then open http://localhost:5173 — create a match as one color, share the
generated match code, and join from a second window/browser as the other color.

## Scripts
- `npm run dev` — Vite dev client
- `npm run server` — boardgame.io game server
- `npm test` — unit tests for the placement/scoring rules
- `npm run build` / `npm run preview` — production client build
