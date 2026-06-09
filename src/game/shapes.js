export const BOARD_SIZE = 8;

// Each base shape is defined by its cells (relative [row, col] offsets) and how
// many copies of it go into the supply: `colorCount` tiles take the placing
// player's color, `greyCount` tiles stay neutral grey. Tune these freely while
// balancing — nothing else needs to change.
const BASE_SHAPES = [
  // monomino (1×1) removed — reserved for a future special role
  { id: 'domino', cells: [[0, 0], [0, 1]], colorCount: 4, greyCount: 2 },
  { id: 'tromino-i', cells: [[0, 0], [0, 1], [0, 2]], colorCount: 3, greyCount: 2 },
  { id: 'tromino-l', cells: [[0, 0], [1, 0], [1, 1]], colorCount: 3, greyCount: 2 },
  { id: 'tetromino-o', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], colorCount: 2, greyCount: 1 },
  { id: 'tetromino-t', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], colorCount: 2, greyCount: 1 },
  { id: 'tetromino-s', cells: [[0, 1], [0, 2], [1, 0], [1, 1]], colorCount: 2, greyCount: 1 },
  { id: 'tetromino-l', cells: [[0, 0], [1, 0], [2, 0], [2, 1]], colorCount: 2, greyCount: 1 },
];

function normalize(cells) {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function rotateClockwise(cells) {
  return normalize(cells.map(([row, col]) => [col, -row]));
}

function cellsKey(cells) {
  return cells.map(([row, col]) => `${row},${col}`).join(';');
}

// Returns every visually-distinct rotation of a shape (symmetric shapes like
// the square tetromino yield fewer than 4).
function uniqueRotations(cells) {
  const rotations = [];
  const seen = new Set();
  let current = normalize(cells);
  for (let i = 0; i < 4; i++) {
    const key = cellsKey(current);
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(current);
    }
    current = rotateClockwise(current);
  }
  return rotations;
}

const SHAPES_BY_ID = Object.fromEntries(
  BASE_SHAPES.map((shape) => [
    shape.id,
    { id: shape.id, size: shape.cells.length, rotations: uniqueRotations(shape.cells) },
  ])
);

export function getShape(id) {
  return SHAPES_BY_ID[id];
}

// Builds the full tile supply for a match: every base shape contributes
// `colorCount` tiles (which take the placing player's color) and `greyCount`
// neutral tiles. The result is shuffled by the caller using boardgame.io's
// seeded random so it stays in sync across clients.
export function buildTileSupply() {
  const supply = [];
  let nextId = 0;
  for (const shape of BASE_SHAPES) {
    for (let i = 0; i < shape.colorCount; i++) {
      supply.push({ tileId: `t${nextId++}`, shapeId: shape.id, kind: 'color' });
    }
    for (let i = 0; i < shape.greyCount; i++) {
      supply.push({ tileId: `t${nextId++}`, shapeId: shape.id, kind: 'grey' });
    }
  }
  return supply;
}
