# Stacking Tiles — prototype plan

## Context
A turn-based, two-player tile-placement game (Tetris-like polyomino shapes,
similar in spirit to Patchwork but with pieces stacking into multiple layers).
This prototype exists to playtest the idea remotely with a friend. The rules
and balance are still being tuned, so game-specific values (board size, shape
set, scoring) live as easily-changeable constants — see `src/game/shapes.js`.

## Game rules implemented
- Square grid board (`BOARD_SIZE` in `src/game/shapes.js`, currently 8x8).
- Two tile kinds:
  - **Colored tiles** take on the color of whichever player places them (red
    or blue — seat `'0'` is always red, seat `'1'` is always blue).
  - **Grey tiles** are neutral, placeable by either player, and stay grey.
- Polyomino shapes (multi-cell, rotatable), drawn from a shared shuffled supply.
- Each turn, the active player picks 1 of 3 offered shapes and places it.
- Placement legality (`src/game/rules.js`):
  1. Fits within board bounds.
  2. **No overhangs** — every footprint cell must currently sit at the same
     height (the shape lands as one flat rigid layer).
  3. **Color matching** — every footprint cell must be empty, the placing
     player's own color, or grey. Grey tiles ignore this rule.
- Scoring on placement: `tile size (cell count) × landing layer number`,
  credited to the placing player's color. Grey tiles currently score nobody —
  tweak `placeShape` in `src/game/game.js` if that should change.
- Game ends when the tile supply runs out; higher total score wins.

## Architecture
- **[boardgame.io](https://boardgame.io/)** runs the authoritative game state,
  move validation, turn order, and multiplayer sync/transport — see
  `src/game/game.js` for the game definition.
- **React** (Vite) renders the UI — see `src/components/`.
- `src/game/rules.js` holds placement/scoring logic as pure, unit-tested
  functions (`npm test`), independent of boardgame.io — keeps the trickiest
  logic easy to verify in isolation.

### Visualizing height/depth
The board shows each cell's *topmost* tile color plus a small height-number
badge. Clicking any cell opens the **Stack inspector** side panel, which shows
that column's full vertical stack bottom-to-top — this is what makes "how
tall is this and whose tiles are in it" legible. A pseudo-3D/isometric view is
a natural follow-up visual upgrade once the mechanic itself feels right (no
rule-engine changes needed — it's a rendering change only).

### Project structure
```
/src
  /game
    game.js     — boardgame.io game definition (setup, moves, endIf)
    shapes.js   — polyomino shape definitions, rotations, tile supply, BOARD_SIZE
    rules.js    — pure placement validation & scoring (rules.test.js covers it)
  /components
    Lobby.jsx          — create/join match screen (uses LobbyClient)
    GameBoard.jsx      — top-level `board` component wired to boardgame.io
    Board.jsx          — the grid: colors, height badges, placement preview
    ShapeOffer.jsx     — the 3 selectable shapes + rotate control
    ScorePanel.jsx     — running scores + game-over banner
    StackInspector.jsx — cross-section view of a clicked column
  config.js     — SERVER_URL / GAME_NAME shared by Lobby and the Client
server.js       — boardgame.io Server entry point (run with `npm run server`)
```

## Running it locally
You need **two processes**: the boardgame.io server (state authority +
multiplayer transport) and the Vite dev client.

```
npm run server   # starts the game server on http://localhost:8000
npm run dev      # starts the Vite client on http://localhost:5173
```

Open http://localhost:5173 in two browser windows (or one normal + one
incognito, so sessions don't collide): in the first, leave the match code
blank, pick "Red", and click **Create match** — this generates a shareable
match code shown in the banner. In the second window, paste that code, pick
"Blue", and click **Join match**. Moves made in either window sync to the
other in real time.

## Playtesting remotely with a friend
The fastest path — no deployment needed:
1. Run `npm run server` and `npm run dev` locally as above.
2. Expose the **game server** (port 8000) to the internet with a tunnel, e.g.
   [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/)
   (`cloudflared tunnel --url http://localhost:8000`) or `ngrok http 8000`.
3. Create a `.env.local` file with `VITE_SERVER_URL=https://<your-tunnel-url>`
   so the client (and Lobby) point at the tunneled server, then restart
   `npm run dev`.
4. Also expose the Vite client (port 5173) the same way — or just send your
   friend a built/hosted copy of the client pointed at the tunneled server.
5. Share the match code generated when you create a match; your friend joins
   using that code from their machine.

For something more durable than a tunnel, deploy `server.js` (a small Node
process) and a static build of the client (`npm run build`) to a host with a
free/cheap tier — Railway, Render, or Fly.io are all suitable for a 2-player
prototype.

## Verification
- `npm test` runs the placement/scoring rule unit tests
  (`src/game/rules.test.js`) — covers bounds checks, overhangs, color
  matching for both colored and grey tiles, and scoring math.
- Manual play: run both processes, open two browser windows as described
  above, and play full games — confirms turn flow, legality enforcement,
  scoring, sync between clients, and end-game detection.
