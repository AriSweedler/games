// UNO pass-and-play on a phone through the shared shell (docs/design/uno.md): a seeded two-seat
// game on the shell page. The deal comes off `window.__rng` (a mulberry32 the spec installs before
// the page boots, so the hands are the same every run); Pass the phone with two players, Start, the
// first curtain hides the hand until "Show my hand", the table shows the seat's tiles with the
// playable ones lit, a tap (or, where no number card plays, the hook `window.__uno.act`) moves the
// turn and the curtain drops for the other seat. The hook's `view()` reads the seat's view back.
// On `pages` alone: this is about the page, not the origin. The shell's own flows (the home, the
// room, the handoff, resume) are the shell specs' `@uno` describes.
import type { Page } from '@playwright/test';

import { PHONE } from './fixtures/geometry.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';
import { requireView, unoPlayTurn, unoReveal, unoStartLocal } from './fixtures/uno.ts';

/** mulberry32 as text: the specs run without the DOM lib and the page reads `window.__rng` at boot. */
const seedRng = async (page: Page, seed: number): Promise<void> => {
  await page.addInitScript({
    content: `(() => { let a = ${String(seed)} >>> 0; window.__rng = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`,
  });
};

const NAMES = ['Ari', 'Lavi'] as const;

test('a seeded two-seat game: the curtain, the hand, a play and the curtain for the other seat', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await seedRng(page, 42);
  await unoStartLocal(page, pagePath(project, 'uno'), PHONE, [...NAMES]);
  await expect(page).toHaveTitle('UNO');

  // The first curtain names the seat to move and hides the hand; its one button shows it.
  await expect(page.locator('#curtainTitle')).toHaveText(/^Pass the phone to (Ari|Lavi)$/);
  await expect(page.locator('#curtainBtn')).toHaveText('Show my hand');
  const firstName = (await page.locator('#curtainTitle').innerText()).replace(
    'Pass the phone to ',
    '',
  );
  await unoReveal(page);

  // The seat's table: nobody out, its own tiles (seven, or more where the opening card made it draw),
  // the pile, the playable tiles lit and enabled, the others dark.
  const dealt = await requireView(page);
  expect(dealt.names).toEqual([...NAMES]);
  expect(dealt).toMatchObject({ winner: null });
  expect(dealt.names[dealt.turn]).toBe(firstName);
  expect(dealt.hand.length).toBe(dealt.counts[dealt.seat]);
  expect(dealt.counts.reduce((n, c) => n + c, 0)).toBeGreaterThanOrEqual(14);
  await expect(page.locator('#hand .tile')).toHaveCount(dealt.hand.length);
  await expect(page.locator('#topCard')).toBeVisible();
  await expect(page.locator('#drawBtn')).toBeVisible();
  if (dealt.phase === 'turn') {
    await expect(page.locator('#hand .tile.playable')).toHaveCount(dealt.playable.length);
    await Promise.all(
      dealt.playable.map((id) =>
        expect(page.locator(`#hand .tile[data-id="${id}"]`)).toBeEnabled(),
      ),
    );
  }

  // A play: a number card that plays is tapped (it neither keeps the turn nor asks a colour);
  // without one the hook plays the turn out (a draw, a colour, the drawn card or a pass).
  const number = dealt.hand.find((c) => c.kind === 'number' && dealt.playable.includes(c.id));
  if (dealt.phase === 'turn' && number !== undefined) {
    await page.locator(`#hand .tile[data-id="${number.id}"]`).click();
  } else {
    await unoPlayTurn(page);
  }

  // The turn moved to the other seat and the curtain dropped over the table for it.
  const otherName = NAMES.find((name) => name !== firstName) ?? '';
  await expect(page.locator('#curtainOverlay')).toBeVisible();
  await expect(page.locator('#curtainTitle')).toHaveText(`Pass the phone to ${otherName}`);
  await expect(page.locator('#curtainSub')).toHaveText(`${firstName}, look away`);
  await unoReveal(page);
  const next = await requireView(page);
  expect(next.names[next.turn]).toBe(otherName);
  expect(next.seat).toBe(next.turn);
  await expect(page.locator('#hand .tile')).toHaveCount(next.hand.length);
  if (number !== undefined && dealt.phase === 'turn') expect(next.top.id).toBe(number.id);
});
