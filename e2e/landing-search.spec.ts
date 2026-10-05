// The landing page's search bar (web/main.ts over web/shared/lib/fuzzy.ts), on a phone with the
// soft keyboard up and on a desktop. Playwright has no keyboard to raise: a phone's visual
// viewport with the keyboard open is about half its height, so the context is an iPhone (390 x
// 844) that is resized to 390 x 420 once the bar has focus, which is what `visualViewport`
// reports then (its resize fires, and the page sizes the results to it). What is checked: the bar
// is 44px tall and the heading and the lede stay in view above it while typing (the page is never
// scrolled for the keyboard); typing filters on each keystroke with the input keeping focus; the
// exact and prefix matches come first, a labelled divider, then the lesser matches; the list ends
// at the visible edge, so the first result is above the keyboard; Enter opens the top match;
// Escape and the clear button empty the search and the grid returns; nothing matching is one
// line. About the page alone: on `pages` only (e2e/fixtures/site.ts PAGE_ONLY_SPECS).
import type { Page } from '@playwright/test';

import { LANDING_PAGES, PAGE_TITLES } from '../tools/games.ts';
import { baseUrl, pagePath, type Project } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const PHONE = { width: 390, height: 844 };
/** The phone with its keyboard up: the visual viewport is what the keyboard leaves. */
const PHONE_KEYBOARD = { width: 390, height: 420 };

/** The names of the results as listed, and where the divider sits among the children (-1: none). */
const LISTING = `(() => {
  const children = [...document.querySelector('#results').children];
  return {
    names: children
      .filter((el) => el.matches('a.card'))
      .map((el) => el.querySelector('.name').textContent.trim()),
    divider: children.findIndex((el) => el.matches('hr.divider')),
  };
})()`;
type Listing = Readonly<{ names: ReadonlyArray<string>; divider: number }>;
const listing = (page: Page): Promise<Listing> => page.evaluate<Listing>(LISTING);

/** The id of the focused element ('' for none). */
const FOCUSED_ID = `document.activeElement ? document.activeElement.id : ''`;
const focusedId = (page: Page): Promise<string> => page.evaluate<string>(FOCUSED_ID);

const gridRestored = async (page: Page): Promise<void> => {
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#grid')).toBeVisible();
  await expect(page.locator('#grid a.card')).toHaveCount(LANDING_PAGES.length);
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#clearBtn')).toBeHidden();
};

const onPhone = async (
  browser: Parameters<Parameters<typeof test>[2]>[0]['browser'],
  project: Project,
  run: (page: Page) => Promise<void>,
): Promise<void> => {
  const context = await browser.newContext({
    baseURL: baseUrl(project),
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(pagePath(project, 'landing'));
    await run(page);
    expect(errors, 'uncaught exceptions').toEqual([]);
  } finally {
    await context.close();
  }
};

test('phone: the bar is 44px under the heading, which stays in view; the list ends at the visible edge; Enter opens the top match', async ({
  browser,
  project,
}) => {
  await onPhone(browser, project, async (page) => {
    const input = page.locator('#q');
    await expect(input).toBeVisible();
    await expect(page.locator('#grid a.card')).toHaveCount(LANDING_PAGES.length);
    await expect(page.locator('#results')).toBeHidden();
    expect((await input.boundingBox())?.height).toBe(44);

    await input.focus();
    await page.setViewportSize(PHONE_KEYBOARD);
    await input.pressSequentially('gin');
    await expect(page.locator('#grid')).toBeHidden();
    const results = page.locator('#results a.card');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText('Gin Rummy');
    await expect(page.locator('#results hr.divider')).toHaveCount(0);
    expect(await focusedId(page), 'the input keeps focus while filtering').toBe('q');

    // The heading, the lede and the bar keep their place: nothing scrolled when the keyboard rose.
    const heading = page.locator('h1');
    await expect(heading).toBeInViewport({ ratio: 1 });
    await expect(page.locator('p.lede')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate<number>('window.scrollY'), 'the page is not scrolled').toBe(0);
    const headingBox = await heading.boundingBox();
    const bar = await page.locator('#searchForm').boundingBox();
    const first = await results.first().boundingBox();
    const list = await page.locator('#results').boundingBox();
    expect(headingBox, 'the heading').not.toBeNull();
    expect(bar, 'the bar').not.toBeNull();
    expect(first, 'the first result').not.toBeNull();
    expect(list, 'the list').not.toBeNull();
    expect(bar?.y ?? -1, 'the bar under the heading').toBeGreaterThan(
      (headingBox?.y ?? 0) + (headingBox?.height ?? 0),
    );
    expect(
      (first?.y ?? -1) >= (bar?.y ?? 0) + (bar?.height ?? 0),
      'the first result under the bar',
    ).toBe(true);
    const listBottom = (list?.y ?? 0) + (list?.height ?? 0);
    expect(listBottom, 'the list ends at the visible edge').toBeLessThanOrEqual(
      PHONE_KEYBOARD.height,
    );
    expect(listBottom, 'the list reaches the visible edge').toBeGreaterThanOrEqual(
      PHONE_KEYBOARD.height - 2,
    );
    expect(
      (first?.y ?? 0) + (first?.height ?? 0),
      'the first result above the keyboard',
    ).toBeLessThanOrEqual(PHONE_KEYBOARD.height);

    await input.press('Enter');
    await expect(page).toHaveTitle(PAGE_TITLES['gin-rummy']);
  });
});

test('phone: lesser matches sit under the divider; Escape and the clear button restore the grid', async ({
  browser,
  project,
}) => {
  await onPhone(browser, project, async (page) => {
    const input = page.locator('#q');
    await input.focus();
    await page.setViewportSize(PHONE_KEYBOARD);

    // 's': Sheshbesh is a prefix; Briscola and Hearts subsequences, by title (the reaction game, a
    // word start, is unlisted: tools/games.ts SOLO `listed: false`, so it is never a result).
    await input.pressSequentially('s');
    await expect(page.locator('#results a.card')).toHaveCount(3);
    expect(await listing(page)).toEqual({
      names: ['Sheshbesh', 'Briscola', 'Hearts'],
      divider: 1,
    });
    await expect(page.locator('#results hr.divider')).toHaveAttribute(
      'aria-label',
      'more like this',
    );
    const resultsBox = await page.locator('#results').boundingBox();
    expect(
      (resultsBox?.y ?? 0) + (resultsBox?.height ?? 0),
      'the list within what is visible',
    ).toBeLessThanOrEqual(PHONE_KEYBOARD.height);

    await input.fill('zzzz');
    await expect(page.locator('#results a.card')).toHaveCount(0);
    await expect(page.locator('#results p.none')).toHaveText('Nothing matches');

    await input.press('Escape');
    await gridRestored(page);
    expect(await focusedId(page), 'focus stays after Escape').toBe('q');

    await input.pressSequentially('uno');
    await expect(page.locator('#results a.card')).toHaveCount(1);
    await expect(page.locator('#clearBtn')).toBeVisible();
    await page.locator('#clearBtn').click();
    await gridRestored(page);
  });
});

test('desktop: an alias and an accented spelling find their tile; Enter opens the top match', async ({
  player,
}) => {
  const { page } = player;
  await page.goto(pagePath('pages', 'landing'));
  const input = page.locator('#q');
  await input.pressSequentially('brìsc');
  await expect(page.locator('#results a.card')).toHaveCount(1);
  await expect(page.locator('#results a.card .name')).toHaveText('Briscola');

  // `backgammon` is the folder Sheshbesh's link names (tools/games.ts ALIASES), so it is on top.
  await input.fill('back');
  expect(await listing(page)).toEqual({ names: ['Sheshbesh'], divider: -1 });
  await input.press('Enter');
  await expect(page).toHaveTitle(PAGE_TITLES.backgammon);
});
