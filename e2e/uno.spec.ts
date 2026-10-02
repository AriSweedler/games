// UNO pass-and-play on a phone through the shared shell (docs/design/uno.md): a seeded two-seat
// game on the shell page. The deal comes off `window.__rng` (a mulberry32 the spec installs before
// the page boots, so the hands are the same every run); Pass the phone with two players, Start, the
// first curtain hides the hand until "Show my hand", the table shows the seat's tiles with the
// playable ones lit, a tap (or, where no number card plays, the hook `window.__uno.act`) moves the
// turn and the curtain drops for the other seat. The hook's `view()` reads the seat's view back.
// The second test seats a hand-made position (§7): a seat plays down to one card without the call
// and the next seat, under its curtain lifted, catches it for two; the call made in time leaves the
// catcher nothing to press. On `pages` alone: this is about the page, not the origin. The shell's own flows (the home, the
// room, the handoff, resume) are the shell specs' `@uno` describes.
import type { Page } from '@playwright/test';

import { PHONE } from './fixtures/geometry.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';
import {
  requireView,
  unoPlayTurn,
  unoPosition,
  unoReveal,
  unoSetup,
  unoStartLocal,
} from './fixtures/uno.ts';

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

test('the UNO call (§7): a seat at one card without the call is caught for two; called in time, there is nothing to catch', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await unoStartLocal(page, pagePath(project, 'uno'), PHONE, [...NAMES]);
  await unoReveal(page);

  // Ari at two cards on a red 5: the UNO button is offered; Ari plays without pressing it.
  const twoLeft = unoPosition({
    hands: [
      ['r7a', 'b2a'],
      ['b3a', 'g4a', 'y6a'],
    ],
    top: 'r5a',
    names: [...NAMES],
  });
  const ari = await unoSetup(page, twoLeft);
  expect(ari).toMatchObject({ seat: 0, canUno: true, canCallOut: false });
  await expect(page.locator('#unoBtn')).toBeVisible();
  await expect(page.locator('#callOutBtn')).toBeHidden();
  await page.locator('#hand .tile[data-id="r7a"]').click();

  // The phone goes to Lavi, who sees Ari down to one card and calls it out: Ari draws two.
  await expect(page.locator('#curtainTitle')).toHaveText('Pass the phone to Lavi');
  await unoReveal(page);
  const lavi = await requireView(page);
  expect(lavi).toMatchObject({ seat: 1, counts: [1, 3], canCallOut: true, canUno: false });
  expect(lavi.uno).toEqual({ seat: 0, called: false, open: true });
  await expect(page.locator('#unoBtn')).toBeHidden();
  await expect(page.locator('#callOutBtn')).toBeVisible();
  await page.locator('#callOutBtn').click();
  await expect(page.locator('#callOutBtn')).toBeHidden();
  await expect(page.locator('#statusText')).toContainText('Ari draws two');
  const caught = await requireView(page);
  expect(caught).toMatchObject({ seat: 1, turn: 1, counts: [3, 3], uno: null });

  // Again from the same position, with UNO pressed before the play: Lavi has nothing to catch.
  const again = await unoSetup(page, twoLeft);
  expect(again.canUno).toBe(true);
  await page.locator('#unoBtn').click();
  await expect(page.locator('#unoBtn')).toBeHidden();
  await expect(page.locator('#statusText')).toContainText('Ari calls UNO!');
  await page.locator('#hand .tile[data-id="r7a"]').click();
  await expect(page.locator('#curtainTitle')).toHaveText('Pass the phone to Lavi');
  await unoReveal(page);
  const safe = await requireView(page);
  expect(safe).toMatchObject({ seat: 1, counts: [1, 3], canCallOut: false });
  expect(safe.uno).toEqual({ seat: 0, called: true, open: true });
  await expect(page.locator('#callOutBtn')).toBeHidden();
});
