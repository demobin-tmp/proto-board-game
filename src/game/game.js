// See server.js for why this imports the CJS build path directly — game.js is
// loaded both by the Vite-bundled client and the tsx-run server.
import { INVALID_MOVE } from 'boardgame.io/dist/cjs/core.js';
import { BOARD_SIZE, DEFAULT_PROFILE, buildTileSupply, getShape } from './shapes';
import { absoluteCells, validatePlacement, validateFillerPlacement, scoreForPlacement } from './rules';

// Patchwork-style ring: every tile in the supply gets a fixed slot in a
// circle. A neutral token marks a slot; the offer is the next OFFER_SIZE
// non-empty slots clockwise from it, and PREVIEW_SIZE more beyond that are
// shown as a non-selectable preview. Picking a tile empties its slot and
// moves the token there, so skipped tiles stay put and only resurface once
// the token comes back around to them.
export const OFFER_SIZE = 3;
export const PREVIEW_SIZE = 3;
export const EMPOWERED_OFFER_SIZE = 6;
export const POWER_TRACK_MAX = 5;

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

// The "default" board is neutral ground everywhere (behaves like grey: any
// color may build on it). The "colored" board splits the ground into a red
// half and a blue half, and the "diagonal" board splits it into red/blue
// triangles with a grey diagonal between them — in both cases a colored tile
// can only be placed on bare ground of its own color or grey ground, same
// rule that already governs stacking on top of colored tiles.
function buildGroundColors(boardType) {
  if (boardType === 'colored') {
    const half = BOARD_SIZE / 2;
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, (_, col) => (col < half ? 'red' : 'blue'))
    );
  }
  if (boardType === 'diagonal') {
    return Array.from({ length: BOARD_SIZE }, (_, row) =>
      Array.from({ length: BOARD_SIZE }, (_, col) => {
        if (row === col) return 'grey';
        return row < col ? 'red' : 'blue';
      })
    );
  }
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
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

  setup: ({ random }, setupData) => {
    // The creator picks a profile (which shapes are in play, and how many of
    // each) from the lobby; see data/profiles.json. Fall back to the default
    // composition if none was supplied.
    const profile =
      setupData?.profile && Object.keys(setupData.profile).length > 0 ? setupData.profile : DEFAULT_PROFILE;
    const ring = random.Shuffle(buildTileSupply(profile));
    const G = {
      board: emptyBoard(),
      heights: emptyHeights(),
      groundColors: buildGroundColors(profile.board),
      scores: { red: 0, blue: 0 },
      charges: { red: 0, blue: 0 },
      power: { red: 0, blue: 0 },
      ring,
      tokenIndex: -1,
      seen: new Array(ring.length).fill(false),
    };
    markSeen(G);
    return G;
  },

  turn: {
    onBegin: ({ G, ctx, events }) => {
      const currentColor = PLAYER_COLORS[ctx.currentPlayer];
      if ((G.power?.[currentColor] ?? 0) >= POWER_TRACK_MAX) {
        events.endTurn();
      }
    },
  },

  moves: {
    placeShape: ({ G, ctx, events }, offerIndex, rotationIndex, row, col, flipped, useFiller, powerUp) => {
      if (!G.charges) G.charges = { red: 0, blue: 0 };
      if (!G.power) G.power = { red: 0, blue: 0 };

      const placerColor = PLAYER_COLORS[ctx.currentPlayer];
      const otherColor = placerColor === 'red' ? 'blue' : 'red';

      // Validate charge cost for each power-up type.
      if (powerUp === 'expand'       && G.charges[placerColor] < 1) return INVALID_MOVE;
      if (powerUp === 'extra-turn'   && G.charges[placerColor] < 2) return INVALID_MOVE;
      if (powerUp === 'ignore-color' && G.charges[placerColor] < 2) return INVALID_MOVE;
      const activeOfferSize = powerUp === 'expand' ? EMPOWERED_OFFER_SIZE : OFFER_SIZE;
      const offer = ringWindow(G.ring, G.tokenIndex, activeOfferSize);
      const entry = offer[offerIndex];
      if (!entry) return INVALID_MOVE;
      const tile = entry.tile;

      let cells;
      let result;
      if (useFiller) {
        // Drop the offered tile and place a 1x1 filler instead — for turns
        // where none of the offered shapes can legally go anywhere. The
        // filler always counts as a colored tile, regardless of the
        // dropped tile's kind.
        cells = [[row, col]];
        result = validateFillerPlacement(G.board, G.heights, G.groundColors, row, col, 'color', placerColor);
      } else {
        // Every colored tile is a physical two-sided piece: red plays the
        // normal face, blue plays the mirror face. For grey tiles the player
        // chooses which face to use (the `flipped` flag from the client).
        const mirrored = tile.kind === 'color' ? ctx.currentPlayer === '1' : !!flipped;
        const shape = getShape(tile.shapeId);
        const rotations = mirrored ? shape.mirroredRotations : shape.rotations;
        if (!rotations[rotationIndex]) return INVALID_MOVE;
        cells = absoluteCells(tile.shapeId, rotationIndex, row, col, mirrored);
        result = validatePlacement(G.board, G.heights, G.groundColors, cells, tile.kind, placerColor, powerUp === 'ignore-color');
      }
      if (!result.legal) return INVALID_MOVE;

      const tileColor = useFiller || tile.kind !== 'grey' ? placerColor : 'grey';
      for (const [r, c] of cells) {
        G.board[r][c].push({ color: tileColor, tileId: tile.tileId, filler: !!useFiller });
        G.heights[r][c] += 1;
      }

      // Colored tiles score; grey tiles earn the placer one charge instead.
      // Filler placements are always colored, so they score too.
      if (useFiller || tile.kind === 'color') {
        G.scores[placerColor] += scoreForPlacement(cells.length, result.landingHeight);
      } else {
        G.charges[placerColor] += 1;
      }

      // Spend charges and advance 1 on the power track for any power-up.
      // Auto-advance also triggers if the other player is already maxed.
      // Both effects are capped at 1 step per turn.
      if (powerUp === 'expand')       G.charges[placerColor] -= 1;
      if (powerUp === 'extra-turn')   G.charges[placerColor] -= 2;
      if (powerUp === 'ignore-color') G.charges[placerColor] -= 2;
      const autoAdvance = G.power[otherColor] >= POWER_TRACK_MAX;
      if ((powerUp || autoAdvance) && G.power[placerColor] < POWER_TRACK_MAX) {
        G.power[placerColor] += 1;
      }

      G.ring[entry.ringIndex] = null;
      G.tokenIndex = entry.ringIndex;
      markSeen(G);

      if (powerUp === 'extra-turn') {
        events.endTurn({ next: ctx.currentPlayer });
      } else {
        events.endTurn();
      }
    },

    disrupt: ({ G, ctx, events }) => {
      if (!G.charges) G.charges = { red: 0, blue: 0 };
      if (!G.power) G.power = { red: 0, blue: 0 };

      const placerColor = PLAYER_COLORS[ctx.currentPlayer];
      const otherColor = placerColor === 'red' ? 'blue' : 'red';

      if (G.charges[placerColor] < 2) return INVALID_MOVE;

      G.charges[placerColor] -= 2;

      // Push opponent one step forward on the power track.
      if (G.power[otherColor] < POWER_TRACK_MAX) G.power[otherColor] += 1;

      // Strip one opponent charge (floor at 0).
      if (G.charges[otherColor] > 0) G.charges[otherColor] -= 1;

      // Using charges always advances the current player too.
      if (G.power[placerColor] < POWER_TRACK_MAX) G.power[placerColor] += 1;

      events.endTurn();
    },

    placeTokens: ({ G, ctx, events }, cells) => {
      if (!G.charges) G.charges = { red: 0, blue: 0 };
      if (!G.power) G.power = { red: 0, blue: 0 };

      const placerColor = PLAYER_COLORS[ctx.currentPlayer];
      const otherColor = placerColor === 'red' ? 'blue' : 'red';

      if (G.charges[placerColor] < 1) return INVALID_MOVE;
      if (!Array.isArray(cells) || cells.length !== 4) return INVALID_MOVE;

      const seen = new Set();
      for (const [r, c] of cells) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return INVALID_MOVE;
        if (G.heights[r][c] !== 0) return INVALID_MOVE;
        const gc = G.groundColors[r][c];
        if (gc && gc !== 'grey' && gc !== placerColor) return INVALID_MOVE;
        const key = `${r},${c}`;
        if (seen.has(key)) return INVALID_MOVE;
        seen.add(key);
      }

      const tileId = `tok-${ctx.turn}`;
      for (const [r, c] of cells) {
        G.board[r][c].push({ color: placerColor, tileId, filler: false });
        G.heights[r][c] += 1;
      }

      G.charges[placerColor] -= 1;
      if (G.power[placerColor] < POWER_TRACK_MAX) {
        G.power[placerColor] += 1;
      }

      events.endTurn();
    },
  },

  endIf: ({ G }) => {
    const tilesLeft = ringWindow(G.ring, G.tokenIndex, 1).length > 0;
    const bothMaxed = (G.power?.red ?? 0) >= POWER_TRACK_MAX && (G.power?.blue ?? 0) >= POWER_TRACK_MAX;
    if (tilesLeft && !bothMaxed) return;

    const { red, blue } = G.scores;
    if (red === blue) return { draw: true, scores: G.scores };
    return { winner: red > blue ? 'red' : 'blue', scores: G.scores };
  },

  minPlayers: 2,
  maxPlayers: 2,
};
