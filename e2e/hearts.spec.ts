// Hearts pass-and-play through the shared shell (docs/design/hearts.md §3): a two-seat game on the
// shell page at a phone. Pass the phone with two names, Start, lift the curtain, and the table is seat 0's;
// a Pass hands it to seat 1 under the curtain; Resign ends the game on the shell's pause sheet, whose
// Continue clears it for the result sheet and Play again. On `pages` alone: this is about the page, not the origin.
// The shell's own flows (the home, the room, the handoff, resume) are the shell specs' `@hearts` describes.
import { PHONE } from './fixtures/geometry.ts';
import { requireView, heartsStartLocal } from './fixtures/hearts.ts';
import { reveal } from './fixtures/shell.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi'] as const;

test('pass, resign, continue at a phone', async ({ phone, project }) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await heartsStartLocal(page, pagePath(project, 'hearts'), PHONE, [...NAMES]);
  await expect(page).toHaveTitle('Hearts');
  await expect(page.locator('#myName')).toHaveText(NAMES[0]);
  await expect(page.locator('#oppName')).toHaveText(NAMES[1]);
  expect(await requireView(page)).toMatchObject({ seat: 0, game: { turn: 0, turns: 0 } });

  await page.locator('#passBtn').click();
  await expect(page.locator('#curtainOverlay')).toBeVisible();
  await reveal(page);
  await expect(page.locator('#myName')).toHaveText(NAMES[1]);
  await expect(page.locator('#statusText')).toContainText('Your turn');

  await page.locator('#resignBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await expect(page.locator('#pauseTitle')).toHaveText(`${NAMES[0]} wins!`);
  await page.locator('#continueBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeHidden();
  await expect(page.locator('#resultOverlay')).toBeVisible();
  await expect(page.locator('#rsTitle')).toHaveText(`${NAMES[0]} wins!`);
  await expect(page.locator('#againBtn')).toBeVisible();
  expect((await requireView(page)).game.result).toEqual({ kind: 'win', winner: 0, by: 'resign' });
});
