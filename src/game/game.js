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

export const StackingGame = {
  name: 'stacking-tiles',

  setup: ({ random }) => ({
    board: emptyBoard(),
    heights: emptyHeights(),
    scores: { red: 0, blue: 0 },
    ring: random.Shuffle(buildTileSupply()),
    tokenIndex: -1,
  }),

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
