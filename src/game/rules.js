import { getShape, BOARD_SIZE } from './shapes';

// Translates a shape's rotation (relative offsets) into absolute board
// coordinates anchored at (row, col). `mirrored` selects the flip side of
// the physical tile (see shapes.js's `mirroredRotations`).
export function absoluteCells(shapeId, rotationIndex, row, col, mirrored = false) {
  const shape = getShape(shapeId);
  const rotation = (mirrored ? shape.mirroredRotations : shape.rotations)[rotationIndex];
  return rotation.map(([dr, dc]) => [row + dr, col + dc]);
}

function inBounds([row, col]) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function topColor(board, row, col) {
  const stack = board[row][col];
  return stack.length ? stack[stack.length - 1].color : null;
}

// A placement is legal when:
//  1. every footprint cell is on the board,
//  2. every footprint cell currently sits at the same height — the shape lands
//     as one flat rigid layer, so it can't overhang empty space, and
//  3. for colored tiles, every footprint cell is empty, already the placing
//     player's color, or grey. Grey tiles ignore this rule entirely.
export function validatePlacement(board, heights, cells, kind, placerColor) {
  if (!cells.every(inBounds)) {
    return { legal: false, reason: 'out-of-bounds' };
  }

  const landingHeight = heights[cells[0][0]][cells[0][1]];
  const restsFlat = cells.every(([row, col]) => heights[row][col] === landingHeight);
  if (!restsFlat) {
    return { legal: false, reason: 'overhang' };
  }

  if (landingHeight > 0) {
    const ids = new Set(cells.map(([r, c]) => board[r][c][landingHeight - 1].tileId));
    if (ids.size < 2) {
      return { legal: false, reason: 'must cover at least 2 distinct tiles when stacking' };
    }
  }

  if (kind === 'color') {
    const colorsMatch = cells.every(([row, col]) => {
      const color = topColor(board, row, col);
      return color === null || color === placerColor || color === 'grey';
    });
    if (!colorsMatch) {
      return { legal: false, reason: 'color-mismatch' };
    }
  }

  return { legal: true, landingHeight };
}

// Score = tile size x the (1-indexed) layer it lands on. `landingHeight` is
// the stack height *before* placement, so the new tile occupies layer
// landingHeight + 1.
export function scoreForPlacement(cellCount, landingHeight) {
  return cellCount * (landingHeight + 1);
}

// A "drop" placement: discard the offered tile and place a 1x1 filler
// instead, for turns where no real placement is possible. A single cell
// always rests flat, so the multi-cell "≥2 distinct tiles" stacking rule
// doesn't apply — but a filler can never be stacked on top of another
// filler, since that would let a player "pass" forever on the same spot.
export function validateFillerPlacement(board, heights, row, col, kind, placerColor) {
  if (!inBounds([row, col])) {
    return { legal: false, reason: 'out-of-bounds' };
  }

  const landingHeight = heights[row][col];
  if (landingHeight > 0 && board[row][col][landingHeight - 1].filler) {
    return { legal: false, reason: 'cannot-stack-on-filler' };
  }

  if (kind === 'color') {
    const color = topColor(board, row, col);
    if (color !== null && color !== placerColor && color !== 'grey') {
      return { legal: false, reason: 'color-mismatch' };
    }
  }

  return { legal: true, landingHeight };
}
