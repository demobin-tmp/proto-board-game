import { test, expect } from '@playwright/test';

// Reuses the seed field shipped in the Lobby: a fixed seed always produces
// the same tile order (see shapes.js's seededShuffle), so this scenario is
// reproducible. Unlike the headless boardgame.io integration tests in
// src/game/, this drives the real app end to end — Lobby, server, sockets,
// and the actual GameBoard UI — so it can be watched with `--headed`.
//
// Uses the "e2e-test" profile (data/profiles.json) rather than "default" —
// it's a frozen copy, so future rebalancing of the real default profile
// can't silently change this test's behavior.
const TEST_SEED = 'e2e-basic-seed-1';
const TEST_PROFILE = 'e2e-test';

async function placeTile(player, pick, rotation, row, column, { activatePowerUp, staysActive = false, flip = false, filler = false } = {}) {
  if (activatePowerUp) {
    await player.getByRole('button', { name: activatePowerUp }).click();
  }
  await player.locator('.offer-tile').nth(pick).click();
  if (filler) {
    // Rotate/flip controls aren't shown once filler mode is active.
    await player.locator('.filler-button').click();
  } else {
    for (let i = 0; i < rotation; i++) {
      await player.locator('.rotate-button').click();
    }
    if (flip) {
      await player.locator('.flip-button').click();
    }
  }
  await player.locator(`[data-row="${row}"][data-col="${column}"]`).click();
  // An extra-turn placement keeps this player active instead of passing the
  // turn away, so the usual "Waiting" check would be wrong for it.
  await expect(player.locator('.turn-indicator')).toContainText(staysActive ? 'Your turn' : 'Waiting');
}

test('two players start a seeded match and Red places one legal tile', async ({ browser }) => {
  const redContext = await browser.newContext();
  const blueContext = await browser.newContext();
  const red = await redContext.newPage();
  const blue = await blueContext.newPage();

  // --- Red creates a match with a fixed seed ---
  await red.goto('/');
  await red.getByPlaceholder('optional').fill('Red');
  await red.getByLabel('Seat').selectOption('0');
  await red.getByLabel('Base settings').selectOption(TEST_PROFILE);
  await red.getByRole('button', { name: 'Edit game' }).click();
  await red.getByPlaceholder(/reproducible tile order/).fill(TEST_SEED);
  await red.getByRole('button', { name: 'Create match' }).click();

  await expect(red.locator('.match-banner strong')).toBeVisible();
  const matchID = (await red.locator('.match-banner strong').textContent()).trim();

  // --- Blue joins using the match code ---
  await blue.goto('/');
  await blue.getByPlaceholder('optional').fill('Blue');
  await blue.getByPlaceholder('leave blank to create a new match').fill(matchID);
  await blue.waitForTimeout(500); // Lobby's auto-seat-pick debounce
  await blue.getByRole('button', { name: 'Join match' }).click();

  await expect(red.locator('.game-board')).toBeVisible();
  await expect(blue.locator('.game-board')).toBeVisible();
  await expect(red.locator('.turn-indicator')).toContainText('Your turn');

  // Turn 1
  // --- Red places the second offered tile in the center ---
  await placeTile(red, 1, 0, 3, 3);

  // Turn passes to Blue, visible from both sides.
  await expect(blue.locator('.turn-indicator')).toContainText('Your turn');

  // --- Blue tries to place the third offered tile on top of Red's tile, but it's illegal ---
  await blue.locator('.offer-tile').nth(2).click();
  await blue.locator('[data-row="3"][data-col="3"]').click();

  // Rejected client-side before any move is sent: turn doesn't pass, and the
  // tile stays selected since nothing happened.
  await expect(blue.locator('.turn-indicator')).toContainText('Your turn');
  await expect(red.locator('.turn-indicator')).toContainText('Waiting');
  await expect(blue.locator('.offer-tile.selected')).toHaveCount(1);

  // --- Blue place third tile in the center ---
  await blue.locator('[data-row="3"][data-col="4"]').click();

  // Turn 2
  // --- Red tries to place the second offered tile in the center (second layer), but it is illegal (placed on top of blue tile) ---
  await red.locator('.offer-tile').nth(1).click();
  await red.locator('[data-row="3"][data-col="3"]').click();

  await red.locator('[data-row="5"][data-col="3"]').click();

  // --- Check scores, everithing on first layer ---
  await expect(red.locator('.score-pill.red strong')).toHaveText('8');
  await expect(red.locator('.score-pill.blue strong')).toHaveText('4');

  await placeTile(blue, 0, 1, 3, 6);

  // Turn 3
  await expect(red.locator('.turn-indicator')).toContainText('Your turn');

  // Red tries to place the second offered tile (second layer), but it is illegal (only based on one shape)
  await red.locator('.offer-tile').nth(2).click();
  await red.locator('.rotate-button').click();
  await red.locator('[data-row="6"][data-col="3"]').click();
  
  // Legal move on second layer
  await red.locator('.rotate-button').click();
  await red.locator('.rotate-button').click();
  await red.locator('.rotate-button').click();
  await red.locator('[data-row="4"][data-col="3"]').click();
  await expect(red.locator('.score-pill.red strong')).toHaveText('16');

  await placeTile(blue, 0, 2, 1, 4);

  // Turn 4
  const redScoreBeforeCharge = await red.locator('.score-pill.red strong').textContent();
  await placeTile(red, 0, 2, 2, 5);
  // Grey tile: earns a charge, not points.
  await expect(red.locator('.score-pill.red .charge-badge')).toHaveText('⚡1');
  await expect(red.locator('.score-pill.red strong')).toHaveText(redScoreBeforeCharge);

  await placeTile(blue, 1, 2, 2, 4);

  // Turn 5
  await placeTile(red, 0, 0, 2, 4);
  await expect(red.locator('.score-pill.red .charge-badge')).toHaveText('⚡2');

  await placeTile(blue, 1, 0, 0, 2);

  // Turn 6
  // Red uses additional turn
  await placeTile(red, 2, 1, 3, 1, { activatePowerUp: 'Extra turn', staysActive: true });

  // Extra turn cost 2 charges, and Red had exactly 2 — the badge disappears at 0.
  await expect(red.locator('.score-pill.red .charge-badge')).toHaveCount(0);
  await placeTile(red, 0, 0, 3, 1);

  await placeTile(blue, 1, 0, 0, 6);

  // Turn 7
  await placeTile(red, 0, 1, 3, 2);
  await placeTile(blue, 0, 1, 3, 3);

  // Turn 8
  await placeTile(red, 1, 0, 3, 0);
  await placeTile(blue, 0, 2, 0, 6);

  // Turn 9
  await placeTile(red, 0, 0, 5, 0);
  await placeTile(blue, 2, 0, 1, 2);
  
  // Turn 10
  await placeTile(red, 1, 1, 6, 2);
  await placeTile(blue, 2, 2, 0, 5);
  
  // Turn 11
  await placeTile(red, 2, 1, 0, 5, { flip: true });
  await placeTile(blue, 2, 0, 3, 5, { filler: true });

  // Turn 12
  await placeTile(red, 0, 0, 4, 1);
  await placeTile(blue, 4, 0, 1, 4, { activatePowerUp: 'select from 6' });
});
