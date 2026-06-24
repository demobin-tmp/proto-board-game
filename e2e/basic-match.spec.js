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
  await red.locator('.offer-tile').nth(1).click();
  await red.locator('[data-row="3"][data-col="3"]').click();

  // Turn passes to Blue, visible from both sides.
  await expect(blue.locator('.turn-indicator')).toContainText('Your turn');
  await expect(red.locator('.turn-indicator')).toContainText('Waiting');

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

  await blue.locator('.offer-tile').nth(0).click();
  await blue.locator('.rotate-button').click();
  await blue.locator('[data-row="3"][data-col="6"]').click();

  // Turn 3
  await expect(red.locator('.turn-indicator')).toContainText('Your turn');

  // Red tries to place the second offered tile (second layer), but it is illegal (only based on one shape)
  await red.locator('.offer-tile').nth(2).click();
  await red.locator('.rotate-button').click();
  await red.locator('[data-row="6"][data-col="3"]').click();
  await red.locator('.rotate-button').click();
  await red.locator('.rotate-button').click();
  await red.locator('.rotate-button').click();

  // Legal move on second layer
  await red.locator('[data-row="4"][data-col="3"]').click();
  await expect(red.locator('.score-pill.red strong')).toHaveText('16');
});
