import { describe, expect, test } from 'vitest';

import { GUEST_SEAT_NAME, THEME_LOOK, headHtml, seatListHtml } from './page.ts';
import { idsIn } from './shell.ts';

// The blocks every page shares (docs/design/shell-hoist.md row J): the theme look, the head, the
// guest's name field and the seat list. Each game's page.ts spells only its own values;
// test/dist/shell-markup.test.ts pins what they compose to.
describe('the shared page blocks', () => {
  test('THEME_LOOK is the shell.css look: a class per hook, no inline style', () => {
    expect(THEME_LOOK.resumeClass).toBe(' resume');
    expect(THEME_LOOK.resumeStyle).toBe('');
    expect(THEME_LOOK.resumeBtnKind).toBe('btn-primary');
    expect(THEME_LOOK.curtainClass).toBe(' curtain');
    expect(THEME_LOOK.curtainStyle).toBe('');
    expect(THEME_LOOK.toastAttrs).toBe(' role="status"');
    // The spacing hooks are empty: shell.css spaces the theme pages, gin's legacy page spells them.
    expect([
      THEME_LOOK.mt8,
      THEME_LOOK.mt10,
      THEME_LOOK.mt14,
      THEME_LOOK.mb8,
      THEME_LOOK.pt10,
      THEME_LOOK.m0,
    ]).toEqual(['', '', '', '', '', '']);
    expect(Object.values(THEME_LOOK).some((v) => v.includes('style='))).toBe(false);
  });

  test('headHtml spells the card, the tab and the sheets, one tag per line', () => {
    const head = headHtml({
      slug: 'tally',
      name: 'Tally',
      share: 'Tally for two.',
      imageAlt: 'Tally: a board',
    });
    const lines = head.split('\n');
    expect(lines[0]).toBe('<!doctype html>');
    expect(lines[1]).toBe('<html lang="en">');
    expect(lines[2]).toBe('  <head>');
    expect(lines[lines.length - 1]).toBe('  </head>');
    // Every tag is indented four and self-contained: Prettier's wrapping is the composed page's.
    expect(lines.slice(3, -1).every((l) => l.startsWith('    <') && l.endsWith('>'))).toBe(true);
    expect(head).toContain('<meta property="og:title" content="Tally" />');
    expect(head).toContain('<meta property="og:description" content="Tally for two." />');
    expect(head).toContain(
      '<meta property="og:url" content="https://games.sweedler.com/tally/" />',
    );
    expect(head).toContain(
      '<meta property="og:image" content="https://games.sweedler.com/tally/splash.png" />',
    );
    expect(head).toContain('<meta property="og:image:alt" content="Tally: a board" />');
    expect(head).toContain('<meta name="twitter:title" content="Tally" />');
    expect(head).toContain(
      '<meta name="twitter:image" content="https://games.sweedler.com/tally/splash.png" />',
    );
    // No tab title, no description, no extra tags: the title is the name and nothing else appears.
    expect(head).toContain('<title>Tally</title>');
    expect(head).not.toContain('name="description"');
    // The order: card, charset, viewport, title, icons, then the three shell sheets and the theme.
    const at = (s: string): number => lines.findIndex((l) => l.includes(s));
    expect(at('og:title')).toBeLessThan(at('charset'));
    expect(at('charset')).toBeLessThan(at('viewport'));
    expect(at('viewport')).toBeLessThan(at('<title>'));
    expect(at('<title>')).toBeLessThan(at('favicon.svg'));
    expect(at('favicon.svg')).toBeLessThan(at('favicon.ico'));
    expect(at('favicon.ico')).toBeLessThan(at('tokens.css'));
    expect(at('tokens.css')).toBeLessThan(at('base.css'));
    expect(at('base.css')).toBeLessThan(at('shell.css'));
    expect(at('shell.css')).toBeLessThan(at('./theme.css'));
    expect(lines.length).toBe(3 + 21 + 1);
  });

  test('headHtml places the tab title, the description and the extra tags', () => {
    const head = headHtml({
      slug: 'veil',
      name: 'Veil',
      tabTitle: 'Veil — cards',
      share: 'Veil for four.',
      imageAlt: 'Veil: a fan',
      description: 'Veil for four: hide a card.',
      extraTags: [
        '<link rel="manifest" href="./manifest.webmanifest" />',
        '<meta name="theme-color" content="#000" />',
      ],
    });
    const lines = head.split('\n');
    const at = (s: string): number => lines.findIndex((l) => l.includes(s));
    // The tab title is its own; the card keeps the name.
    expect(head).toContain('<title>Veil — cards</title>');
    expect(head).toContain('<meta property="og:title" content="Veil" />');
    // The description follows the title; the extra tags sit after the icons, before the sheets, in order.
    expect(at('name="description"')).toBe(at('<title>') + 1);
    expect(head).toContain('<meta name="description" content="Veil for four: hide a card." />');
    expect(at('manifest.webmanifest')).toBe(at('favicon.ico') + 1);
    expect(at('theme-color')).toBe(at('manifest.webmanifest') + 1);
    expect(at('tokens.css')).toBe(at('theme-color') + 1);
    expect(lines.length).toBe(3 + 21 + 3 + 1);
  });

  test('GUEST_SEAT_NAME carries the four ids shellPaint.ts paints, hidden until the seat is taken', () => {
    expect(idsIn(GUEST_SEAT_NAME)).toEqual([
      'guestSeatName',
      'guestNameInput',
      'guestRenameBtn',
      'guestNameNote',
    ]);
    expect(GUEST_SEAT_NAME).toContain('<div id="guestSeatName" class="hidden">');
    expect(GUEST_SEAT_NAME).toContain('<label for="guestNameInput">Playing as</label>');
    expect(GUEST_SEAT_NAME).toContain('maxlength="20"');
    expect(GUEST_SEAT_NAME).toContain('id="guestRenameBtn">Change</button>');
    // A block: indented as page.html's waiting partial places it, no trailing newline.
    expect(GUEST_SEAT_NAME.startsWith('      <div')).toBe(true);
    expect(GUEST_SEAT_NAME.endsWith('      </div>')).toBe(true);
  });

  test('seatListHtml is the one-line seat list under a waiting room status, by the id paintWaiting fills', () => {
    expect(seatListHtml('seatList')).toBe(
      '      <ul class="seat-list" id="seatList" aria-label="Seats"></ul>',
    );
    expect(idsIn(seatListHtml('guestSeatList'))).toEqual(['guestSeatList']);
  });
});
