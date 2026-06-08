import { chromium } from 'playwright';
const br = await chromium.launch({ headless: true });
const [redCtx, blueCtx] = [await br.newContext(), await br.newContext()];
const [red, blue] = [await redCtx.newPage(), await blueCtx.newPage()];
await red.goto('http://localhost:5173');
await red.fill('input[placeholder="optional"]', 'Red');
await red.selectOption('select', '0');
await red.click('button[type="submit"]');
await red.waitForSelector('.match-banner strong', { timeout: 10000 });
const matchID = await red.locator('.match-banner strong').innerText();
await blue.goto('http://localhost:5173');
await blue.fill('input[placeholder="optional"]', 'Blue');
await blue.selectOption('select', '1');
await blue.fill('input[placeholder="leave blank to create a new match"]', matchID);
await blue.click('button[type="submit"]');
await blue.waitForSelector('svg.stacked-board', { timeout: 10000 });
await red.waitForSelector('svg.stacked-board', { timeout: 10000 });
await red.waitForTimeout(400);
async function placeTile(page, row, col) {
  if (!(await page.locator('.turn-indicator').innerText()).includes('Your turn')) return false;
  await page.locator('.offer-tile').first().click();
  await page.waitForTimeout(100);
  const cell = page.locator(`[data-row="${row}"][data-col="${col}"]`).first();
  if (!await cell.count()) return false;
  await cell.hover(); await page.waitForTimeout(150);
  await cell.click(); await page.waitForTimeout(500);
  return !(await page.locator('.turn-indicator').innerText()).includes('Your turn');
}
const spots = [[3,3],[4,4],[5,5],[3,4],[4,3],[5,4],[3,3],[4,4],[5,3],[3,5]];
for (let i = 0; i < 10; i++) {
  const [r,c] = spots[i % spots.length];
  let ok = await placeTile(red,r,c) || await placeTile(blue,r,c);
  if (!ok) for (const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
    ok = await placeTile(red,r+dr,c+dc) || await placeTile(blue,r+dr,c+dc);
    if (ok) break;
  }
}
await red.screenshot({ path: '.tmp-s-played.png' });
await br.close();
