import { describe, it, expect } from 'vitest';
import { ringWindow } from './game';

describe('ringWindow', () => {
  it('returns the next N non-empty slots clockwise from the token', () => {
    const ring = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(ringWindow(ring, -1, 3)).toEqual([
      { tile: 'a', ringIndex: 0 },
      { tile: 'b', ringIndex: 1 },
      { tile: 'c', ringIndex: 2 },
    ]);
  });

  it('skips empty slots left behind by earlier picks', () => {
    const ring = ['a', null, 'c', 'd', 'e', 'f'];
    // Token sits at the emptied slot 1, so the window starts at slot 2.
    expect(ringWindow(ring, 1, 3)).toEqual([
      { tile: 'c', ringIndex: 2 },
      { tile: 'd', ringIndex: 3 },
      { tile: 'e', ringIndex: 4 },
    ]);
  });

  it('wraps around the end of the ring', () => {
    const ring = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(ringWindow(ring, 4, 3)).toEqual([
      { tile: 'f', ringIndex: 5 },
      { tile: 'a', ringIndex: 0 },
      { tile: 'b', ringIndex: 1 },
    ]);
  });

  it('lets a skipped tile resurface once the token comes back around', () => {
    const ring = ['a', 'b', 'c', 'd', 'e', 'f'];
    // Token jumped to slot 3 (picked 'd'); 'b' and 'c' were skipped earlier
    // and remain available later in the window.
    const ring2 = [...ring];
    ring2[3] = null;
    expect(ringWindow(ring2, 3, 6)).toEqual([
      { tile: 'e', ringIndex: 4 },
      { tile: 'f', ringIndex: 5 },
      { tile: 'a', ringIndex: 0 },
      { tile: 'b', ringIndex: 1 },
      { tile: 'c', ringIndex: 2 },
    ]);
  });

  it('returns fewer than N entries once most of the ring is consumed', () => {
    const ring = [null, null, 'c', null, null, null];
    expect(ringWindow(ring, 1, 3)).toEqual([{ tile: 'c', ringIndex: 2 }]);
  });

  it('returns an empty array once the ring is fully consumed', () => {
    const ring = [null, null, null];
    expect(ringWindow(ring, 0, 3)).toEqual([]);
  });
});
