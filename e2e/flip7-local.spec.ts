// Flip 7 on the shell, one phone (docs/design/flip7.md §8): a seeded three-seat game through the
// composed page. The deal comes off `window.__rng` (a mulberry32 the spec installs before the page
// boots); the curtain rises once for the first player, then the table follows whoever must act:
// the opening deal one card each through Hit, then Hit and Stay to the round's end, the scores
// shown with Next round. The documented hook `window.__flip7` (`view()`, `act()`, `legal()`)
// reads the state back and plays the rest. On `pages` alone: this is about the page.
import type { Page } from '@playwright/test';

import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

type View = Readonly<{
  me: number;
  seats: ReadonlyArray<Readonly<{ name: string; line: ReadonlyArray<unknown>; status: string }>>;
  turn: number;
  opening: number;
  phase: Readonly<{ kind: string }>;
  round: number;
}>;

/** mulberry32 as text: the specs run without the DOM lib and the page reads `window.__rng` at boot. */
const seedRng = async (page: Page, seed: number): Promise<void> => {
  await page.addInitScript({
    content: `(() => { let a = ${String(seed)} >>> 0; window.__rng = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`,
  });
};

const view = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.__flip7.view()');

/** A bust, a freeze or a Flip 7 holds the table until Continue: tap it when it is up. */
const dismissPause = async (page: Page): Promise<void> => {
  if (await page.locator('#pauseOverlay').isVisible()) await page.locator('#continueBtn').click();
};

test('a seeded three-seat game on one phone: the curtain once, the opening deal, Hit and Stay, the round over', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await seedRng(page, 42);
  await page.goto(pagePath(project, 'flip7'));
  await expect(page).toHaveTitle('Flip 7');
  await expect.poll(() => page.evaluate<string>('typeof window.__flip7')).toBe('object');

  await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
  await page.locator('#localPlayersCountInc').click();
  await expect(page.locator('#localPlayersCountNum')).toHaveText('3');
  await expect(page.locator('#p3NameInput')).toBeVisible();
  await page.locator('#localBtn').click();
  await expect(page.locator('#curtainTitle')).toHaveText('Pass the phone to Ari');
  await page.locator('#curtainBtn').click();
  await expect(page.locator('#curtainOverlay')).toBeHidden();
  // This phone's seat in the foreground, the other two in the background grid.
  await expect(page.locator('#mySeat .seat-name')).toHaveText('Ari');
  await expect(page.locator('#others .seat .seat-name')).toHaveText(['Lavi', 'Sandro']);
  await expect(page.locator('#stayBtn')).toBeDisabled();

  // The opening deal: one card each, the seat to act's own Hit (Freeze or Flip Three given to the first choice).
  await expect
    .poll(async () => {
      await dismissPause(page);
      const v = await view(page);
      if (v === null || v.opening === 0 || v.phase.kind !== 'turn') {
        if (v?.phase.kind === 'target')
          await page.evaluate('window.__flip7.act(window.__flip7.legal()[0])');
        return v?.opening ?? -1;
      }
      if (await page.locator('#hitBtn').isVisible()) await page.locator('#hitBtn').click();
      return v.opening;
    })
    .toBe(0);
  // The curtain never came back: every card is face up.
  await expect(page.locator('#curtainOverlay')).toBeHidden();

  // The rest of the round through the hook: Stay when Stay is open, else whatever is legal.
  await expect
    .poll(async () => {
      await dismissPause(page);
      const v = await view(page);
      if (v === null) return 'none';
      if (v.phase.kind === 'roundOver' || v.phase.kind === 'gameOver') return v.phase.kind;
      await page.evaluate(
        `(() => { const f = window.__flip7; const legal = f.legal(); f.act(legal.find((a) => a.type === 'stay') ?? legal[0]); })()`,
      );
      return v.phase.kind;
    })
    .toBe('roundOver');
  await dismissPause(page);
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#scores li')).toHaveCount(3);
  await expect(page.locator('#nextRoundBtn')).toBeVisible();
  await page.locator('#nextRoundBtn').click();
  await expect.poll(async () => (await view(page))?.round).toBe(2);
});

test('twelve seats on one phone: the stepper tops out at twelve, eleven seats in the background grid', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await page.goto(pagePath(project, 'flip7'));
  await expect.poll(() => page.evaluate<string>('typeof window.__flip7')).toBe('object');
  await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
  const inc = page.locator('#localPlayersCountInc');
  await Array.from({ length: 11 }).reduce<Promise<void>>(async (prev) => {
    await prev;
    if (await inc.isEnabled()) await inc.click();
  }, Promise.resolve());
  await expect(page.locator('#localPlayersCountNum')).toHaveText('12');
  await expect(inc).toBeDisabled();
  await expect(page.locator('#p12NameInput')).toBeVisible();
  await page.locator('#localBtn').click();
  await expect(page.locator('#curtainTitle')).toHaveText('Pass the phone to Ari');
  await page.locator('#curtainBtn').click();
  await expect(page.locator('#others')).toHaveAttribute('data-count', '11');
  await expect(page.locator('#others .seat')).toHaveCount(11);
  await expect(page.locator('#mySeat .seat-name')).toHaveText('Ari');
  // The names and scores stay on screen at twelve: the last background seat's are laid out too.
  await expect(page.locator('#others .seat-name').last()).toBeVisible();
  await expect(page.locator('#others .seat-score').last()).toBeVisible();
  expect((await view(page))?.seats).toHaveLength(12);
});

test('a bust waits for Continue: the card and the points lost, the seat greyed and kept, then the next seat', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await page.goto(pagePath(project, 'flip7'));
  await expect.poll(() => page.evaluate<string>('typeof window.__flip7')).toBe('object');
  await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
  await page.locator('#localBtn').click();
  await page.locator('#curtainBtn').click();
  // A hand-made position through the hook: Ari holds a 5 and a 9, the next card is another 5.
  await page.evaluate(`(() => {
    const f = window.__flip7;
    const g = f.game();
    const n = (id, value) => ({ id, kind: 'number', value });
    const used = ['n5-1', 'n9-1', 'n5-2', 'n3-1'];
    f.setup({
      ...g,
      opening: 0,
      turn: 0,
      phase: { kind: 'turn' },
      flip3: null,
      pending: [],
      seats: g.seats.map((s, i) => ({ ...s, status: 'active', line: i === 0 ? [n('n5-1', 5), n('n9-1', 9)] : [n('n3-1', 3)] })),
      draw: [...g.draw.filter((c) => !used.includes(c.id)), n('n5-2', 5)],
    });
  })()`);
  await expect(page.locator('#mySeat .seat-name')).toHaveText('Ari');
  await page.locator('#hitBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await expect(page.locator('#pauseTitle')).toHaveText('Ari busts');
  await expect(page.locator('#pauseDetail')).toHaveText('Another 5: 14 points lost this round.');
  // Nothing moves on until Continue: no Hit or Stay for the next seat yet.
  await expect(page.locator('#hitBtn')).toBeHidden();
  await page.locator('#continueBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeHidden();
  await expect(page.locator('#mySeat .seat-name')).toHaveText('Lavi');
  await expect(page.locator('#hitBtn')).toBeVisible();
  // The busted seat stays on the table, greyed, its Bust badge on, its three cards still there.
  const ari = page.locator('#others .seat[data-seat="0"]');
  await expect(ari).toHaveClass(/status-busted/);
  await expect(ari.locator('.seat-status')).toHaveText('bust');
  await expect(ari.locator('.tile')).toHaveCount(3);
});
