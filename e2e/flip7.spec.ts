// Flip 7 pass-and-play on a phone (docs/design/flip7.md §7): a seeded three-seat game through the
// page. The deal comes off `window.__rng` (a mulberry32 the spec installs before the page boots),
// the opening deals one card to each seat through the one button, then Hit and Stay move the
// round along; the documented hook `window.__flip7` (`app`, `game()`, `dispatch`) reads the state
// back. On `pages` alone: this is about the page, not the origin.
import type { Page } from '@playwright/test';

import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

type Game = Readonly<{
  seats: ReadonlyArray<Readonly<{ name: string; line: ReadonlyArray<unknown>; status: string }>>;
  turn: number;
  opening: number;
  phase: Readonly<{ kind: string; choices?: ReadonlyArray<number> }>;
  round: number;
  scores: ReadonlyArray<number>;
}>;

const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('expected a value');
  return value;
};

/** mulberry32 as text: the specs run without the DOM lib and the page reads `window.__rng` at boot. */
const seedRng = async (page: Page, seed: number): Promise<void> => {
  await page.addInitScript({
    content: `(() => { let a = ${String(seed)} >>> 0; window.__rng = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`,
  });
};

const kind = (page: Page): Promise<string> => page.evaluate<string>('window.__flip7.app.kind');
const game = (page: Page): Promise<Game | null> =>
  page.evaluate<Game | null>('window.__flip7.game()');

/** One step of the game through the hook: deal/hit, or give to the first choice, until the opening is done. */
const dealOut = async (page: Page): Promise<void> => {
  const steps = Array.from({ length: 12 });
  await steps.reduce<Promise<void>>(async (prev) => {
    await prev;
    const g = must(await game(page));
    if (g.phase.kind === 'target') {
      const seat = g.phase.choices?.[0] ?? 0;
      await page.evaluate(
        `window.__flip7.dispatch({ type: 'game', intent: { type: 'give', seat: ${String(seat)} } })`,
      );
    } else if (g.opening > 0 && g.phase.kind === 'turn') {
      await page.locator('#hitBtn').click();
    }
  }, Promise.resolve());
};

test('a seeded three-seat game: the setup, the opening deal, a hit and a stay', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await seedRng(page, 42);
  await page.goto(pagePath(project, 'flip7'));
  await expect(page).toHaveTitle('Flip 7');
  await expect.poll(() => page.evaluate<string>('typeof window.__flip7')).toBe('object');
  expect(await kind(page)).toBe('setup');

  // Three seats by default, one name typed.
  await expect(page.locator('#names input')).toHaveCount(3);
  await page.locator('#names input').first().fill('Ari');
  await page.locator('#startBtn').click();
  expect(await kind(page)).toBe('table');
  const dealt = must(await game(page));
  expect(dealt.seats.map((s) => s.name)).toEqual(['Ari', 'Player 2', 'Player 3']);
  expect(dealt.opening).toBe(3);
  await expect(page.locator('#seats .seat')).toHaveCount(3);
  await expect(page.locator('#hitBtn')).toHaveText('Deal to Ari');
  await expect(page.locator('#stayBtn')).toBeDisabled();

  await dealOut(page);
  const opened = must(await game(page));
  expect(opened.opening).toBe(0);
  // Every seat still in has at least one card in front of it.
  opened.seats
    .filter((s) => s.status === 'active' || s.status === 'stayed' || s.status === 'frozen')
    .forEach((s) => {
      expect(s.line.length).toBeGreaterThanOrEqual(1);
    });

  // The first active seat may stay: it banks and the turn moves on (or the round ends).
  if (opened.phase.kind === 'turn') {
    await expect(page.locator('#stayBtn')).toBeEnabled();
    const who = opened.turn;
    await page.locator('#stayBtn').click();
    const after = must(await game(page));
    expect(after.seats[who]?.status === 'stayed' || after.phase.kind === 'roundOver').toBe(true);
  }
  await expect(page.locator('#status')).not.toHaveText('');

  // New game returns to the setup.
  await page.locator('#newGameBtn').click();
  expect(await kind(page)).toBe('setup');
});
