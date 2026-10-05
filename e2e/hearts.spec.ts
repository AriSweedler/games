// Hearts pass-and-play through the shared shell (docs/design/hearts.md §3): the placeholder page
// at a phone, three seats (the smallest Hearts table). Pass the phone with three names, Start, lift
// the curtain, and the table is seat 0's with the other two named beside it; round 1 is the pass;
// the first legal action through the hook is seat 0's pass of three, after which the table has
// moved on. On `pages` alone: this is about the page,
// not the origin. The table itself (the hand, the trick, the pass UI) is the hearts-table row's
// spec; the shell's own flows (the home, the room, resume) are the shell specs' `@hearts` describes,
// those written for a table of two skipped (e2e/fixtures/shell.ts `seatsTwo`).
import { PHONE } from './fixtures/geometry.ts';
import { heartsPlayTurn, heartsStartLocal, requireView } from './fixtures/hearts.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi', 'Sandro'] as const;

test('three seats, the pass of round 1 at a phone', async ({ phone, project }) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await heartsStartLocal(page, pagePath(project, 'hearts'), PHONE, NAMES);
  await expect(page).toHaveTitle('Hearts');
  await expect(page.locator('#myName')).toHaveText(NAMES[0]);
  await expect(page.locator('#oppName')).toHaveText(`${NAMES[1]}, ${NAMES[2]}`);
  const opening = await requireView(page);
  expect(opening).toMatchObject({ seat: 0, phase: 'passing', round: 1 });
  expect(opening.names).toEqual([...NAMES]);
  expect(opening.hand).toHaveLength(opening.counts[0] ?? -1);
  expect(opening.legal.length).toBeGreaterThan(0);

  // Seat 0 passes three through the hook: the table moves on, nobody has played a card yet.
  await heartsPlayTurn(page);
  const passed = await requireView(page);
  expect(['passing', 'playing']).toContain(passed.phase);
  expect(passed.round).toBe(1);
  expect(passed.trick.plays).toHaveLength(0);
  expect(passed.scores).toEqual(NAMES.map(() => 0));
});
