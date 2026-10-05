// Hearts pass-and-play through the shared shell (docs/design/hearts.md §3, §8) at a phone: four
// seats through the stepper, the pass (three cards tapped on the table, then Pass; the curtain
// between seats), then the hand played through the hook with every consequential event read off
// the shell's pause sheet: a trick that carried points waits for Continue with who took what, a
// trick without points does not, and the hand's end waits with the scores, then the result sheet
// offers Next hand. On `pages` alone: this is about the page, not the origin. The shell's own flows
// (the home, the room, resume) are the shell specs' `@hearts` describes, those written for a table
// of two skipped (e2e/fixtures/shell.ts `seatsTwo`).
import { PHONE } from './fixtures/geometry.ts';
import { heartsStartLocal, heartsStep, requireView } from './fixtures/hearts.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi', 'Sandro', 'Noa'] as const;

test("four seats: the pass on the table, every pointed trick and the hand's end wait for Continue", async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await heartsStartLocal(page, pagePath(project, 'hearts'), PHONE, NAMES);
  await expect(page).toHaveTitle('Hearts');
  await expect(page.locator('#myName')).toHaveText(NAMES[0]);
  await expect(page.locator('#others .seat')).toHaveCount(3);
  await expect(page.locator('#roundLabel')).toHaveText('Hand 1 · pass left');
  const opening = await requireView(page);
  expect(opening).toMatchObject({ seat: 0, phase: 'passing', round: 1 });
  expect(opening.names).toEqual([...NAMES]);
  expect(opening.hand).toHaveLength(13);
  await expect(page.locator('#hand .card')).toHaveCount(13);

  // Seat 0 picks three cards on the table and passes them: the curtain rises for seat 1.
  const pass = page.locator('#passBtn');
  await expect(pass).toBeVisible();
  await expect(pass).toBeDisabled();
  const cards = page.locator('#hand .card');
  await cards.nth(0).click();
  await cards.nth(5).click();
  await cards.nth(9).click();
  await expect(page.locator('#hand .card.picked')).toHaveCount(3);
  await expect(pass).toBeEnabled();
  await pass.click();
  await expect(page.locator('#curtainOverlay')).toBeVisible();
  await expect(page.locator('#curtainTitle')).toHaveText(`Pass the phone to ${NAMES[1]}`);
  const passed = await requireView(page);
  expect(passed.passed[0]).toBe(true);
  expect(passed.trick.plays).toHaveLength(0);

  // The hand through the hook, every pause read: at least one pointed trick, then the hand's end.
  const seen: string[] = [];
  const play = async (budget: number): Promise<void> => {
    if (budget === 0) return;
    const did = await heartsStep(page);
    if (did.title !== null) seen.push(did.title);
    if (did.kind === 'handOver') return;
    await play(budget - 1);
  };
  await play(400);
  const tricks = seen.filter((t) => /takes? \d+ points?$/.test(t));
  expect(tricks.length).toBeGreaterThan(0);
  expect(seen[seen.length - 1]).toBe('Hand 1 over');
  const over = await requireView(page);
  expect(over.phase).toBe('handOver');
  expect(over.counts).toEqual([0, 0, 0, 0]);
  expect((over.handScores ?? []).reduce((a, b) => a + b, 0)).toBe(over.moon === null ? 26 : 78);
  // The hand's end is the result sheet: the totals a row a seat, Next hand.
  await expect(page.locator('#resultOverlay')).toBeVisible();
  await expect(page.locator('#rsTitle')).toHaveText('Hand 1 over');
  await expect(page.locator('#rsScore .score-row')).toHaveCount(4);
  await expect(page.locator('#rsNextBtn')).toHaveText('Next hand');
  await page.locator('#rsNextBtn').click();
  await expect.poll(async () => (await requireView(page)).round).toBe(2);
});
