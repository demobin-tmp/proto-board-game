// See server.js for why this imports the CJS build path directly — game.js is
// loaded both by the Vite-bundled client and the tsx-run server.
import { INVALID_MOVE } from 'boardgame.io/dist/cjs/core.js';
import { BOARD_SIZE, buildTileSupply, getShape } from './shapes';
import { absoluteCells, validatePlacement, scoreForPlacement } from './rules';

// Patchwork-style ring: every tile in the supply gets a fixed slot in a
// circle. A neutral token marks a slot; the offer is the next OFFER_SIZE
// non-empty slots clockwise from it, and PREVIEW_SIZE more beyond that are
// shown as a non-selectable preview. Picking a tile empties its slot and
// moves the token there, so skipped tiles stay put and only resurface once
// the token comes back around to them.
export const OFFER_SIZE = 3;
export const PREVIEW_SIZE = 3;

// How many previously-seen, not-yet-taken tiles to show "behind" the token
// (i.e. tiles that were offered/previewed earlier but skipped).
export const SKIP_SIZE = 3;

// Seat '0' always plays red, seat '1' always plays blue.
export const PLAYER_COLORS = { '0': 'red', '1': 'blue' };

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [])
  );
}

function emptyHeights() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

// Returns up to `count` { tile, ringIndex } entries for the non-empty slots
// walking clockwise from the token, in order.
export function ringWindow(ring, tokenIndex, count) {
  const entries = [];
  const n = ring.length;
  for (let step = 1; step <= n && entries.length < count; step++) {
    const idx = (((tokenIndex + step) % n) + n) % n;
    if (ring[idx]) entries.push({ tile: ring[idx], ringIndex: idx });
  }
  return entries;
}

// Returns up to `count` { tile, ringIndex } entries for tiles sitting just
// behind the token that were part of an earlier offer/preview window but
// never picked. Already-taken slots are skipped over; the walk stops at the
// first remaining slot that was never shown, since everything further back
// is then guaranteed unseen too. Ordered farthest-from-token first, so it
// reads left-to-right toward the token like the forward window does.
export function ringWindowBackward(ring, seen, tokenIndex, count) {
  const entries = [];
  const n = ring.length;
  for (let step = 1; step <= n && entries.length < count; step++) {
    const idx = (((tokenIndex - step) % n) + n) % n;
    if (!ring[idx]) continue;
    if (!seen[idx]) break;
    entries.push({ tile: ring[idx], ringIndex: idx });
  }
  return entries.reverse();
}

// Marks every slot in the current offer+preview window as seen, so it can
// later be recognised as "skipped" if it isn't picked.
function markSeen(G) {
  for (const { ringIndex } of ringWindow(G.ring, G.tokenIndex, OFFER_SIZE + PREVIEW_SIZE)) {
    G.seen[ringIndex] = true;
  }
}

export const StackingGame = {
  name: 'stacking-tiles',

  setup: ({ random }) => {
    const ring = random.Shuffle(buildTileSupply());
    const G = {
      board: emptyBoard(),
      heights: emptyHeights(),
      scores: { red: 0, blue: 0 },
      ring,
      tokenIndex: -1,
      seen: new Array(ring.length).fill(false),
    };
    markSeen(G);
    return G;
  },

  moves: {
    placeShape: ({ G, ctx, events }, offerIndex, rotationIndex, row, col) => {
      const offer = ringWindow(G.ring, G.tokenIndex, OFFER_SIZE);
      const entry = offer[offerIndex];
      if (!entry) return INVALID_MOVE;
      const tile = entry.tile;

      const shape = getShape(tile.shapeId);
      if (!shape.rotations[rotationIndex]) return INVALID_MOVE;

      const placerColor = PLAYER_COLORS[ctx.currentPlayer];
      const cells = absoluteCells(tile.shapeId, rotationIndex, row, col);
      const result = validatePlacement(G.board, G.heights, cells, tile.kind, placerColor);
      if (!result.legal) return INVALID_MOVE;

      const tileColor = tile.kind === 'grey' ? 'grey' : placerColor;
      for (const [r, c] of cells) {
        G.board[r][c].push({ color: tileColor, tileId: tile.tileId });
        G.heights[r][c] += 1;
      }

      // Only colored tiles score — grey tiles have no "respected color" to
      // credit. Revisit this once the scoring rules are nailed down.
      if (tile.kind === 'color') {
        G.scores[placerColor] += scoreForPlacement(cells.length, result.landingHeight);
      }

      G.ring[entry.ringIndex] = null;
      G.tokenIndex = entry.ringIndex;
      markSeen(G);

      events.endTurn();
    },
  },

  endIf: ({ G }) => {
    if (ringWindow(G.ring, G.tokenIndex, 1).length > 0) return;

    const { red, blue } = G.scores;
    if (red === blue) return { draw: true, scores: G.scores };
    return { winner: red > blue ? 'red' : 'blue', scores: G.scores };
  },

  minPlayers: 2,
  maxPlayers: 2,
};
