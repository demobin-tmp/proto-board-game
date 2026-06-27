// Plain subpath imports (e.g. 'boardgame.io/server') resolve to a directory
// whose package.json points at the CJS build — bundlers like Vite follow that,
// but Node's strict ESM loader (and tsx) can't, so we import the CJS file directly.
import { Server, Origins } from 'boardgame.io/dist/cjs/server.js';
import { Client } from 'boardgame.io/dist/cjs/client.js';
import { SocketIO } from 'boardgame.io/dist/cjs/multiplayer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import serveStatic from 'koa-static';
import { StackingGame, PLAYER_COLORS, BOTS, OFFER_SIZE, POWER_UP_LIMIT, ringWindow } from './src/game/game.js';
import { DEFAULT_PROFILE, BOARD_SIZE, getShape } from './src/game/shapes.js';
import { absoluteCells, validatePlacement, validateFillerPlacement, scoreForPlacement } from './src/game/rules.js';

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

// --- Bots ---
// Each runs as a headless boardgame.io client connecting to this same server
// over the same SocketIO transport a real browser would, so it sees the
// exact synced state and its moves broadcast normally to the human player.
//
// A strategy is `(G, color) => moveArgs | null`, where moveArgs match
// placeShape's signature (offerIndex, rotationIndex, row, col, flipped,
// useFiller, powerUp). Returning null skips that turn's tick (the bot will
// be asked again on the next state update).

// Every legal (offerIndex, rotationIndex, row, col) for the tiles in `offer`
// that pass `includeTile`. Used by Jane's fallback once the filler
// "power-up" is no longer usable — at that point she has to place one of
// the actual offered shapes instead.
function legalOfferPlacements(G, color, offer, includeTile) {
  const mirrored = color === 'blue';
  const candidates = [];
  offer.forEach((entry, offerIndex) => {
    if (!includeTile(entry.tile)) return;
    const shape = getShape(entry.tile.shapeId);
    const rotations = mirrored ? shape.mirroredRotations : shape.rotations;
    rotations.forEach((_, rotationIndex) => {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const cells = absoluteCells(entry.tile.shapeId, rotationIndex, row, col, mirrored);
          const result = validatePlacement(G.board, G.heights, G.groundColors, cells, entry.tile.kind, color, false);
          if (result.legal) candidates.push({ offerIndex, rotationIndex, row, col, cells, result });
        }
      }
    });
  });
  return candidates;
}

// Jane: never uses power-ups. Skips grey tiles whenever a colored one is
// offered (drops a 1x1 filler only if all three offered are grey, or — as a
// safety net the spec didn't cover — no colored tile has any legal placement
// at all). Either way, whatever she places — colored tile or filler — is
// chosen by trying every option (every rotation at every board position, or
// every cell for a filler), scoring each, and keeping the single
// highest-scoring legal one, breaking ties by distance from board centre,
// then by topmost-then-leftmost anchor.
const BOARD_MID = (BOARD_SIZE - 1) / 2;

function centroidDistanceFromMiddle(cells) {
  const avgRow = cells.reduce((sum, [r]) => sum + r, 0) / cells.length;
  const avgCol = cells.reduce((sum, [, c]) => sum + c, 0) / cells.length;
  return (avgRow - BOARD_MID) ** 2 + (avgCol - BOARD_MID) ** 2;
}

// Returns whichever of two candidates is better by Jane's tie-break order;
// `a` may be null (no candidate yet).
function betterCandidate(a, b) {
  if (!a) return b;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  const da = centroidDistanceFromMiddle(a.cells);
  const db = centroidDistanceFromMiddle(b.cells);
  if (db !== da) return db < da ? b : a;
  if (b.row !== a.row) return b.row < a.row ? b : a;
  if (b.col !== a.col) return b.col < a.col ? b : a;
  return a;
}

// Jane's filler fallback also maximizes score — same scan-and-tie-break
// approach as her colored-tile logic, just over single cells instead of
// whole shapes. Returns null once her power-up budget (shared with every
// other power-up) is exhausted, since the filler drop is itself a power-up now.
function bestFillerMove(G, color) {
  if ((G.powerUpsUsed?.[color] ?? 0) >= POWER_UP_LIMIT) return null;
  let best = null;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const result = validateFillerPlacement(G.board, G.heights, G.groundColors, row, col, 'color', color);
      if (!result.legal) continue;
      const score = scoreForPlacement(1, result.landingHeight);
      best = betterCandidate(best, { offerIndex: 0, rotationIndex: 0, row, col, cells: [[row, col]], score });
    }
  }
  if (!best) return null;
  return { offerIndex: 0, rotationIndex: 0, row: best.row, col: best.col, flipped: false, useFiller: true, powerUp: null };
}

// Last resort once she can no longer afford the filler and no colored tile
// fits: place whichever grey tile she can, anywhere legal. Never the
// preferred move, but it keeps her from being stuck.
function anyLegalGreyMove(G, color, offer) {
  const candidates = legalOfferPlacements(G, color, offer, (tile) => tile.kind === 'grey');
  if (!candidates.length) return null;
  const pick = candidates[0];
  return { offerIndex: pick.offerIndex, rotationIndex: pick.rotationIndex, row: pick.row, col: pick.col, flipped: false, useFiller: false, powerUp: null };
}

function janeStrategy(G, color) {
  const offer = ringWindow(G.ring, G.tokenIndex, OFFER_SIZE);
  const coloredOffers = offer
    .map((entry, offerIndex) => ({ entry, offerIndex }))
    .filter(({ entry }) => entry.tile.kind === 'color');

  if (coloredOffers.length === 0) return bestFillerMove(G, color) ?? anyLegalGreyMove(G, color, offer); // all three offered are grey

  const mirrored = color === 'blue';
  let best = null;

  for (const { entry, offerIndex } of coloredOffers) {
    const shape = getShape(entry.tile.shapeId);
    const rotations = mirrored ? shape.mirroredRotations : shape.rotations;

    for (let rotationIndex = 0; rotationIndex < rotations.length; rotationIndex++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const cells = absoluteCells(entry.tile.shapeId, rotationIndex, row, col, mirrored);
          const result = validatePlacement(G.board, G.heights, G.groundColors, cells, entry.tile.kind, color, false);
          if (!result.legal) continue;
          const score = scoreForPlacement(cells.length, result.landingHeight);
          best = betterCandidate(best, { offerIndex, rotationIndex, row, col, cells, score });
        }
      }
    }
  }

  if (!best) return bestFillerMove(G, color) ?? anyLegalGreyMove(G, color, offer); // no colored tile fits anywhere right now

  return {
    offerIndex: best.offerIndex,
    rotationIndex: best.rotationIndex,
    row: best.row,
    col: best.col,
    flipped: false,
    useFiller: false,
    powerUp: null,
  };
}

const BOT_STRATEGIES = {
  jane: janeStrategy,
};

const activeBots = new Map(); // matchID -> client

function startBot(matchID, playerID, credentials, botId) {
  if (activeBots.has(matchID)) return;
  const color = PLAYER_COLORS[playerID];
  const strategy = BOT_STRATEGIES[botId] ?? janeStrategy;

  const client = Client({
    game: StackingGame,
    multiplayer: SocketIO({ server: `http://localhost:${PORT}` }),
    matchID,
    playerID,
    credentials,
  });

  client.subscribe((state) => {
    if (!state || state.ctx.gameover || !state.isActive) return;
    // A small delay so moves don't look instant/inhuman, and so this read
    // happens after the state settles rather than mid-update.
    setTimeout(() => {
      const fresh = client.getState();
      if (!fresh || fresh.ctx.gameover || !fresh.isActive) return;
      const move = strategy(fresh.G, color);
      if (!move) return; // no move found this tick — skip, will be asked again next turn
      client.moves.placeShape(
        move.offerIndex, move.rotationIndex, move.row, move.col, move.flipped, move.useFiller, move.powerUp
      );
    }, 600);
  });

  client.start();
  activeBots.set(matchID, client);
}

// The Lobby calls this right after joining the bot's seat (see Lobby.jsx),
// handing over the credentials from that join and which bot strategy to run.
server.router.get('/bots/start', (ctx) => {
  const { matchID, playerID, credentials, bot } = ctx.query;
  if (!matchID || playerID == null || !credentials || !BOTS[bot]) {
    ctx.status = 400;
    ctx.body = { error: 'matchID, playerID, credentials, and a known bot id are required' };
    return;
  }
  startBot(matchID, playerID, credentials, bot);
  ctx.body = { ok: true };
});

// Serve the built React app (npm run build -> dist/) from the same server,
// so a single deployed service hosts both the API/socket endpoints and the
// frontend.
server.app.use(serveStatic(path.join(__dirname, 'dist')));

server.run(PORT, () => {
  console.log(`Stacking Tiles server listening on http://localhost:${PORT}`);
});
