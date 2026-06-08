// Plain subpath imports (e.g. 'boardgame.io/server') resolve to a directory
// whose package.json points at the CJS build — bundlers like Vite follow that,
// but Node's strict ESM loader (and tsx) can't, so we import the CJS file directly.
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import { StackingGame } from './src/game/game.js';

const PORT = process.env.PORT || 8000;

const server = Server({
  games: [StackingGame],
  // LOCALHOST covers the Vite dev server during local play-testing. When
  // exposing this through a tunnel for a remote friend, add that origin too —
  // see docs/GAME_PLAN.md.
  origins: [Origins.LOCALHOST, ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : [])],
});

server.run(PORT, () => {
  console.log(`Stacking Tiles server listening on http://localhost:${PORT}`);
});
