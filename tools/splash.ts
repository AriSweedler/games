// The link-preview splash art (docs/design/link-previews.md §2): one SVG per shell game,
// web/games/<g>/assets/splash.svg, in the game's quiet theme, rendered here to the 1200x630 PNG the
// page's og:image names, web/public/games/<g>/splash.png. Vite copies public/ verbatim, so the PNG
// ships at games/<g>/splash.png on both origins; a `<meta content>` URL is not a Vite asset reference,
// which is why the PNG cannot sit beside its SVG. The render is Chromium's (the repo's Playwright
// browser) at device scale 1, so the committed PNG is the rendering machine's: a font family the SVG
// names that the machine lacks falls back to the generic family after it.
//
// Hive's SVG is not drawn by hand: this tool first recomposes it from the page's own bug art
// (tools/splash-hive.ts, the owner 2026-10-02: "fix the splash pipeline first") and writes it, so the
// committed SVG stays the one source the renderer reads. Every render is then recorded: a sidecar
// beside the SVG, web/games/<g>/assets/splash.sha256, holds the SHA-256 of the SVG and of the PNG in
// `shasum -c` form, and tools/splash.test.ts (the harness suite) fails when either file no longer
// matches it, or when Hive's SVG is not the composition, each with the one line to run:
//   node --experimental-strip-types tools/splash.ts
// Re-run when an SVG, a bug file, Hive's theme or the engraving changes; commit the SVG, the PNG and
// the sidecar. test/dist/link-previews.test.ts holds each PNG's size to the head's width and height.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { type Browser, chromium } from '@playwright/test';

import { SHELL_GAMES, type ShellGame } from './games.ts';
import { REPO_ROOT, isMain } from './legacy/extract.ts';
import { composeHiveSplash } from './splash-hive.ts';

/** The card's size: the Open Graph large-image card (1.91:1). */
export const SPLASH_WIDTH = 1200;
export const SPLASH_HEIGHT = 630;
const CARD = { width: SPLASH_WIDTH, height: SPLASH_HEIGHT } as const;

/** The drawn source, repo-relative. */
export const splashSvg = (game: ShellGame): string => `web/games/${game}/assets/splash.svg`;

/** The rendered PNG, repo-relative (served at games/<g>/splash.png). */
export const splashPng = (game: ShellGame): string => `web/public/games/${game}/splash.png`;

/** The record of the last render, repo-relative: the SVG's and the PNG's SHA-256, `shasum -a 256 -c` form. */
export const splashSidecar = (game: ShellGame): string => `web/games/${game}/assets/splash.sha256`;

/** The games whose SVG this tool composes before rendering; the others' are drawn by hand. */
export const COMPOSED: Readonly<Partial<Record<ShellGame, () => string>>> = {
  hive: () => composeHiveSplash(CARD),
};

/** The one line that brings the SVG, the PNG and the sidecar back into step. */
export const RERUN = 'run `node --experimental-strip-types tools/splash.ts`';

export const sha256Of = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

/** The sidecar's text for a game, from the two files' bytes: one `<sha256>  <repo path>` line each. */
export const sidecarText = (game: ShellGame, svg: string, png: Uint8Array): string =>
  `${sha256Of(svg)}  ${splashSvg(game)}\n${sha256Of(png)}  ${splashPng(game)}\n`;

const readBytes = (path: string): Uint8Array => readFileSync(resolve(REPO_ROOT, path));

/** The composed games' SVGs rewritten from their sources; the paths written. */
const compose = (): ReadonlyArray<string> =>
  SHELL_GAMES.filter((game) => COMPOSED[game] !== undefined).map((game) => {
    const svg = COMPOSED[game]?.() ?? '';
    writeFileSync(resolve(REPO_ROOT, splashSvg(game)), svg);
    return splashSvg(game);
  });

const render = async (browser: Browser, game: ShellGame): Promise<ReadonlyArray<string>> => {
  const page = await browser.newPage({
    viewport: { width: SPLASH_WIDTH, height: SPLASH_HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve(REPO_ROOT, splashSvg(game))).href);
  const out = resolve(REPO_ROOT, splashPng(game));
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({
    path: out,
    clip: { x: 0, y: 0, width: SPLASH_WIDTH, height: SPLASH_HEIGHT },
  });
  await page.close();
  const svg = readFileSync(resolve(REPO_ROOT, splashSvg(game)), 'utf8');
  writeFileSync(
    resolve(REPO_ROOT, splashSidecar(game)),
    sidecarText(game, svg, readBytes(splashPng(game))),
  );
  return [splashPng(game), splashSidecar(game)];
};

const main = async (): Promise<void> => {
  const composed = compose();
  const browser = await chromium.launch();
  try {
    const rendered = await Promise.all(SHELL_GAMES.map((game) => render(browser, game)));
    [...composed, ...rendered.flat()].forEach((path) => {
      console.log(`${path}: written`);
    });
  } finally {
    await browser.close();
  }
};

if (isMain(import.meta.url)) await main();
