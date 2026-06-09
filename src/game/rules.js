import { getShape, BOARD_SIZE } from './shapes';

// Translates a shape's rotation (relative offsets) into absolute board
// coordinates anchored at (row, col).
export function absoluteCells(shapeId, rotationIndex, row, col) {
  const rotation = getShape(shapeId).rotations[rotationIndex];
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
