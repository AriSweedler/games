// The splash pipeline's guard (docs/design/link-previews.md §2): Hive's card is composed from the
// page's bug art, so the committed SVG must be the composition byte for byte, and every card's PNG
// was rendered from the committed SVG, which the sidecar beside the SVG records (the SHA-256 of
// each). A bug file, the engraving, Hive's palette or any hand-drawn SVG changed without the tool
// re-run fails here with the one line to run. Harness suite: no build, no browser; the files are read
// off the repo as the tool reads them.
import { describe, expect, test } from 'vitest';

import { BUGS } from '../web/games/hive/src/engine/pieces.ts';
import { symbolId } from '../web/games/hive/src/ui/engrave.ts';
import { SHELL_GAMES } from './games.ts';
import { readRepoFile } from './legacy/extract.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './legacy/extract.ts';
import {
  BUG_FILE,
  SPLASH_TILES,
  THEME_FILE,
  composeHiveSplash,
  composeHiveSplashFrom,
  themeTokens,
} from './splash-hive.ts';
import {
  COMPOSED,
  RERUN,
  SPLASH_HEIGHT,
  SPLASH_WIDTH,
  sidecarText,
  splashPng,
  splashSidecar,
  splashSvg,
} from './splash.ts';

const CARD = { width: SPLASH_WIDTH, height: SPLASH_HEIGHT };

describe('the hive splash is composed from the bug art', () => {
  test(`the committed splash.svg is the composition, byte for byte (else ${RERUN})`, () => {
    expect(readRepoFile(splashSvg('hive')), `${splashSvg('hive')} is stale: ${RERUN}`).toBe(
      composeHiveSplash(CARD),
    );
  });

  test('the tool composes hive and only hive', () => {
    expect(Object.keys(COMPOSED)).toEqual(['hive']);
    expect(COMPOSED.hive?.()).toBe(composeHiveSplash(CARD));
  });

  test('the composition is deterministic and well formed: the card’s size, no double hyphen in a comment', () => {
    const svg = composeHiveSplash(CARD);
    expect(composeHiveSplash(CARD)).toBe(svg);
    expect(
      svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"`),
    ).toBe(true);
    expect(svg.endsWith('</svg>\n')).toBe(true);
    const comments = [...svg.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1] ?? '');
    expect(comments.length).toBeGreaterThan(0);
    comments.forEach((body) => {
      expect(body).not.toContain('--');
    });
  });

  test('every bug’s symbol once, from its own file, and every bug engraved on a tile of each colour pattern', () => {
    const svg = composeHiveSplash(CARD);
    BUGS.forEach((bug) => {
      expect(svg.split(`<symbol id="${symbolId(bug)}"`)).toHaveLength(2);
      expect(svg).toContain(`data-bug="${bug}"`);
      // The file's first shape is in the symbol: the art is the file's, not a copy.
      const firstShape =
        /<(path|circle|ellipse|line)\b[^>]*\/>/.exec(readRepoFile(BUG_FILE(bug)))?.[0] ?? '';
      expect(firstShape).not.toBe('');
      expect(svg).toContain(firstShape.replace(/\s+/g, ' '));
    });
    expect(new Set(SPLASH_TILES.map((t) => t.bug)).size).toBe(BUGS.length);
    expect(SPLASH_TILES.filter((t) => t.side === 'white').length).toBeGreaterThan(0);
    expect(SPLASH_TILES.filter((t) => t.side === 'black').length).toBeGreaterThan(0);
    // Each tile: the face, the sheen, the four engraving layers of its bug.
    expect(svg.split('<g class="hex ')).toHaveLength(SPLASH_TILES.length + 1);
    expect(svg.split('class="ink"')).toHaveLength(SPLASH_TILES.length + 1);
    ['hive-sheen', 'hive-edge', 'hive-shadow'].forEach((id) => {
      expect(svg).toContain(`id="${id}"`);
    });
  });

  test('the palette is the theme’s: every token the style reads is declared in theme.css and carried into the card', () => {
    const tokens = themeTokens(readRepoFile(THEME_FILE));
    const svg = composeHiveSplash(CARD);
    tokens.forEach((line) => {
      expect(svg).toContain(line);
    });
    const read = [...svg.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1] ?? '');
    expect(read.length).toBeGreaterThan(0);
    const declared = new Set(tokens.map((line) => /^--([\w-]+):/.exec(line)?.[1] ?? ''));
    read.forEach((name) => {
      expect(declared.has(name), `--${name} is read but theme.css declares no such token`).toBe(
        true,
      );
    });
  });

  test('a changed bug file or palette changes the card', () => {
    const files = Object.fromEntries(
      BUGS.map((bug) => [bug, readRepoFile(BUG_FILE(bug))]),
    ) as Record<(typeof BUGS)[number], string>;
    const css = readRepoFile(THEME_FILE);
    const base = composeHiveSplashFrom(CARD, files, css);
    expect(
      composeHiveSplashFrom(
        CARD,
        { ...files, ant: files.ant.replace('<path', '<path data-x="1"') },
        css,
      ),
    ).not.toBe(base);
    expect(
      composeHiveSplashFrom(
        CARD,
        files,
        css.replace('--bug-ant-dark: #3d55b8', '--bug-ant-dark: #000'),
      ),
    ).not.toBe(base);
  });
});

describe('every splash PNG was rendered from its committed SVG', () => {
  SHELL_GAMES.forEach((game) => {
    test(`${game}: the sidecar records the SVG and the PNG as they are (else ${RERUN})`, () => {
      const svg = readRepoFile(splashSvg(game));
      const png = readFileSync(resolve(REPO_ROOT, splashPng(game)));
      const recorded = readRepoFile(splashSidecar(game));
      const expected = sidecarText(game, svg, png);
      const [svgLine, pngLine] = expected.split('\n');
      expect(recorded.split('\n')[0], `${splashSvg(game)} changed since its render: ${RERUN}`).toBe(
        svgLine,
      );
      expect(
        recorded.split('\n')[1],
        `${splashPng(game)} is not the recorded render: ${RERUN}`,
      ).toBe(pngLine);
      expect(recorded).toBe(expected);
    });
  });
});
