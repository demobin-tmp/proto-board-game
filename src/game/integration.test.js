import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { StackingGame, OFFER_SIZE, ringWindow } from './game';
import { DEFAULT_PROFILE } from './shapes';

// A few entries copied straight from the live default profile, so the fixture
// stays in sync with however shapes.js tunes colorCount/greyCount — but kept
// to a handful of shapes so the ring is short and easy to reason about.
const TEST_PROFILE = {
  domino: DEFAULT_PROFILE.domino,
  'tromino-l': DEFAULT_PROFILE['tromino-l'],
  'tetromino-o': DEFAULT_PROFILE['tetromino-o'],
  board: 'default',
};

// Fixed so the ring shuffle — and therefore the whole match — is identical
// every run. No flakiness, and assertions can rely on exact ring contents.
const TEST_SEED = 'integration-test-seed-1';

function waitForSync(client) {
  return new Promise((resolve) => {
    const check = () => (client.getState() ? resolve() : setTimeout(check, 5));
    check();
  });
}

describe('StackingGame (headless integration)', () => {
  it('starts a 2-player match and accepts one legal placement', async () => {
    // The exact same StackingGame export the real server registers — no
    // override needed. Determinism comes from setupData.seed (see shapes.js's
    // seededShuffle), the same mechanism the Lobby's "Edit game" seed field
    // uses for reproducible test matches against the real server too.
    const matchID = 'test-match-basic-placement';

    const redClient = Client({
      game: StackingGame,
      multiplayer: Local(),
      matchID,
      playerID: '0',
      setupData: { profile: TEST_PROFILE, seed: TEST_SEED },
    });
    const blueClient = Client({
      game: StackingGame,
      multiplayer: Local(),
      matchID,
      playerID: '1',
      setupData: { profile: TEST_PROFILE, seed: TEST_SEED },
    });

    // Start red first so its setupData is the one that creates the match;
    // blue then joins the already-created match.
    redClient.start();
    await waitForSync(redClient);
    blueClient.start();
    await waitForSync(blueClient);

    const before = redClient.getState();
    expect(before.ctx.currentPlayer).toBe('0'); // seat 0 (red) moves first

    // Read what's actually offered rather than hardcoding a shape, so the
    // test stays readable even if the shuffle/ring internals change.
    const offer = ringWindow(before.G.ring, before.G.tokenIndex, OFFER_SIZE);
    expect(offer.length).toBe(OFFER_SIZE);
    const tile = offer[0].tile;

    // Place the first offered tile's default rotation flat at the board's
    // top-left corner — every test shape's normalized rotation 0 fits there.
    redClient.moves.placeShape(0, 0, 0, 0, false, false, null);

    const after = redClient.getState();
    expect(after.ctx.currentPlayer).toBe('1'); // turn passed to blue
    expect(after.G.heights[0][0]).toBe(1); // a tile landed at (0,0)
    expect(after.G.board[0][0][0].tileId).toBe(tile.tileId);

    if (tile.kind === 'color') {
      expect(after.G.scores.red).toBeGreaterThan(0);
      expect(after.G.charges.red).toBe(0);
    } else {
      expect(after.G.charges.red).toBe(1);
      expect(after.G.scores.red).toBe(0);
    }
  });
});
