// Plain subpath imports (e.g. 'boardgame.io/server') resolve to a directory
// whose package.json points at the CJS build — bundlers like Vite follow that,
// but Node's strict ESM loader (and tsx) can't, so we import the CJS file directly.
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import serveStatic from 'koa-static';
import { StackingGame } from './src/game/game.js';
import { DEFAULT_PROFILE } from './src/game/shapes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = path.join(__dirname, 'data', 'profiles.json');
const PORT = process.env.PORT || 8000;

const server = Server({
  games: [StackingGame],
  // LOCALHOST covers the Vite dev server during local play-testing. When
  // deploying (e.g. to Render), set CLIENT_ORIGIN to the deployed URL.
  origins: [Origins.LOCALHOST, ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : [])],
});

// Lets the lobby list available tile-supply profiles for the "create match"
// form. Read fresh on every request, so editing data/profiles.json takes
// effect for the next match without a server restart.
server.router.get('/profiles', (ctx) => {
  try {
    ctx.body = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  } catch {
    ctx.body = { default: DEFAULT_PROFILE };
  }
});

// Serve the built React app (npm run build -> dist/) from the same server,
// so a single deployed service hosts both the API/socket endpoints and the
// frontend.
server.app.use(serveStatic(path.join(__dirname, 'dist')));

server.run(PORT, () => {
  console.log(`Stacking Tiles server listening on http://localhost:${PORT}`);
});
