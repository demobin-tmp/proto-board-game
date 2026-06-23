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

  // --- Red places the second offered tile at the top-left corner ---
  await red.locator('.offer-tile').nth(1).click();
  await red.locator('[data-row="3"][data-col="3"]').click();

  // Turn passes to Blue, visible from both sides.
  await expect(blue.locator('.turn-indicator')).toContainText('Your turn');
  await expect(red.locator('.turn-indicator')).toContainText('Waiting');
});
