// See server.js for why this imports the CJS build path directly — game.js is
// loaded both by the Vite-bundled client and the tsx-run server.
import { INVALID_MOVE } from 'boardgame.io/dist/cjs/core.js';
import { BOARD_SIZE, buildTileSupply, getShape } from './shapes';
import { absoluteCells, validatePlacement, scoreForPlacement } from './rules';

const OFFER_SIZE = 3;

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

function refillOffer(G) {
  while (G.offer.length < OFFER_SIZE && G.drawPile.length > 0) {
    G.offer.push(G.drawPile.pop());
  }
}

export const StackingGame = {
  name: 'stacking-tiles',

  setup: ({ random }) => {
    const G = {
      board: emptyBoard(),
      heights: emptyHeights(),
      scores: { red: 0, blue: 0 },
      drawPile: random.Shuffle(buildTileSupply()),
      offer: [],
    };
    refillOffer(G);
    return G;
  },

  moves: {
    placeShape: ({ G, ctx, events }, offerIndex, rotationIndex, row, col) => {
      const tile = G.offer[offerIndex];
      if (!tile) return INVALID_MOVE;

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

      G.offer.splice(offerIndex, 1);
      refillOffer(G);

      events.endTurn();
    },
  },

  endIf: ({ G }) => {
    if (G.drawPile.length > 0 || G.offer.length > 0) return;

    const { red, blue } = G.scores;
    if (red === blue) return { draw: true, scores: G.scores };
    return { winner: red > blue ? 'red' : 'blue', scores: G.scores };
  },

  minPlayers: 2,
  maxPlayers: 2,
};
