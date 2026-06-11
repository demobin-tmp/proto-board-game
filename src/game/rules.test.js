import { describe, it, expect } from 'vitest';
import { absoluteCells, validatePlacement, scoreForPlacement } from './rules';
import { BOARD_SIZE } from './shapes';

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => []));
}

function emptyHeights() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

describe('absoluteCells', () => {
  it('translates a shape rotation to board coordinates anchored at (row, col)', () => {
    expect(absoluteCells('domino', 0, 2, 3)).toEqual([[2, 3], [2, 4]]);
  });

  it('uses the mirrored orientation set for chiral shapes when mirrored is true', () => {
    expect(absoluteCells('tetromino-l', 0, 0, 0, false)).toEqual([[0, 0], [1, 0], [2, 0], [2, 1]]);
    expect(absoluteCells('tetromino-l', 0, 0, 0, true)).toEqual([[0, 1], [1, 1], [2, 0], [2, 1]]);
  });

  it('leaves achiral shapes unchanged when mirrored', () => {
    expect(absoluteCells('domino', 0, 2, 3, true)).toEqual([[2, 3], [2, 4]]);
  });
});

describe('validatePlacement', () => {
  it('rejects placements that fall off the board', () => {
    const cells = [[0, BOARD_SIZE - 1], [0, BOARD_SIZE]];
    const result = validatePlacement(emptyBoard(), emptyHeights(), cells, 'color', 'red');
    expect(result).toEqual({ legal: false, reason: 'out-of-bounds' });
  });

  it('allows placing on empty ground', () => {
    const cells = [[0, 0], [0, 1]];
    const result = validatePlacement(emptyBoard(), emptyHeights(), cells, 'color', 'red');
    expect(result).toEqual({ legal: true, landingHeight: 0 });
  });

  it('rejects overhangs — every footprint cell must rest at the same height', () => {
    const board = emptyBoard();
    const heights = emptyHeights();
    board[0][0].push({ color: 'red' });
    heights[0][0] = 1;

    const result = validatePlacement(board, heights, [[0, 0], [0, 1]], 'color', 'red');
    expect(result).toEqual({ legal: false, reason: 'overhang' });
  });

  it('lets a player stack on their own color or grey, but not the opponent color', () => {
    const board = emptyBoard();
    const heights = emptyHeights();
    board[0][0].push({ color: 'blue', tileId: 'a' });
    board[0][1].push({ color: 'grey', tileId: 'b' });
    heights[0][0] = 1;
    heights[0][1] = 1;
    const cells = [[0, 0], [0, 1]];

    expect(validatePlacement(board, heights, cells, 'color', 'red').legal).toBe(false);
    expect(validatePlacement(board, heights, cells, 'color', 'blue').legal).toBe(true);
  });

  it('rejects stacking on only one distinct underlying tile', () => {
    const board = emptyBoard();
    const heights = emptyHeights();
    // Both cells belong to the same tileId
    board[0][0].push({ color: 'red', tileId: 'a' });
    board[0][1].push({ color: 'red', tileId: 'a' });
    heights[0][0] = 1;
    heights[0][1] = 1;

    expect(validatePlacement(board, heights, [[0, 0], [0, 1]], 'color', 'red').legal).toBe(false);
  });

  it('allows stacking when footprint covers at least 2 distinct underlying tiles', () => {
    const board = emptyBoard();
    const heights = emptyHeights();
    board[0][0].push({ color: 'red', tileId: 'a' });
    board[0][1].push({ color: 'red', tileId: 'b' });
    heights[0][0] = 1;
    heights[0][1] = 1;

    expect(validatePlacement(board, heights, [[0, 0], [0, 1]], 'color', 'red').legal).toBe(true);
  });

  it('lets grey tiles land on any color, ignoring the matching rule', () => {
    const board = emptyBoard();
    const heights = emptyHeights();
    board[0][0].push({ color: 'red', tileId: 'a' });
    board[0][1].push({ color: 'blue', tileId: 'b' });
    heights[0][0] = 1;
    heights[0][1] = 1;

    const result = validatePlacement(board, heights, [[0, 0], [0, 1]], 'grey', 'red');
    expect(result.legal).toBe(true);
  });
});

describe('scoreForPlacement', () => {
  it('multiplies tile size by the (1-indexed) layer it lands on', () => {
    expect(scoreForPlacement(3, 0)).toBe(3); // lands on layer 1 (ground)
    expect(scoreForPlacement(3, 2)).toBe(9); // lands on layer 3
  });
});
