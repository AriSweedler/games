// UNO's fixtures (docs/design/uno.md): the seat's view read through the documented hook
// (`window.__uno.view()`, hands private), the pass-and-play start over the shell's (two to four
// names, the Pass the phone select), and one turn played through the hook (`window.__uno.act`) as a
// player would: a number card where one plays (no colour to name, no turn kept), else whatever
// plays, else a draw and then the drawn card or a pass, so the turn moves on. A hand-made position
// goes in through `window.__uno.setup` (`unoPosition`, `unoSetup`), as briscola's does.
import { expect, type Page } from '@playwright/test';

import { findCard, makeDeck, type Card } from '../../web/games/uno/src/engine/cards.ts';
import type { State, View } from '../../web/games/uno/src/engine/view.ts';
import type { Viewport } from './geometry.ts';
import { DEFAULT_NAMES, reveal, startLocal } from './shell.ts';

export type { State, View };

/** The seat's view the page holds, or null before a table is up. */
export const readView = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.__uno.view()');

/** A view the page must have (the table is up); throws with the reason otherwise. */
export const requireView = async (page: Page): Promise<View> => {
  const view = await readView(page);
  if (view === null) throw new Error('the page holds no game view');
  return view;
};

/** What every seat's table agrees on (the hands are private): the deal, the pile, whose turn and which way, the counts, the winner. */
export const unoKey = (v: View | null): string =>
  v === null
    ? 'none'
    : JSON.stringify([
        v.startedAt,
        v.phase,
        v.turn,
        v.direction,
        v.top.id,
        v.color,
        v.counts,
        v.winner,
        v.drawCount,
      ]);

export const unoSnapshot = async (page: Page): Promise<string> => unoKey(await readView(page));

/** The pass-and-play names by seat count: the shell's two, then the page's third and fourth. */
export type LocalNames = readonly [string, string, ...string[]];

/** The Pass the phone stepper raised from its two to `count` seats, one tap of its + a seat. */
export const unoLocalSeats = async (page: Page, count: number): Promise<void> => {
  const field = page.locator('#localPlayersCount');
  const now = Number(await field.inputValue());
  if (now >= count) return;
  await page.locator('#localPlayersCountInc').click();
  await expect(field).toHaveValue(String(now + 1));
  await unoLocalSeats(page, count);
};

/**
 * Pass the phone between `names` (two to four) at `viewport`: the shell's start with the seat count
 * stepped up and the extra names filled; resolves with the table up and the first curtain over it.
 */
export const unoStartLocal = (
  page: Page,
  url: string,
  viewport: Viewport,
  names: LocalNames = ['Ann', 'Bob'],
): Promise<void> =>
  startLocal(page, url, viewport, [names[0], names[1]], async (p) => {
    const [, , p3, p4] = names;
    if (p3 === undefined) return;
    await unoLocalSeats(p, names.length);
    await expect(p.locator('#moreNames')).toBeVisible();
    await p.locator('#p3NameInput').fill(p3);
    if (p4 !== undefined) await p.locator('#p4NameInput').fill(p4);
  });

export const unoReveal = reveal;

/** One action through the hook, as the seat holding the phone. */
export const unoAct = async (
  page: Page,
  action: Readonly<Record<string, string>>,
): Promise<void> => {
  await page.evaluate(`window.__uno.act(${JSON.stringify(action)})`);
};

/**
 * One step of the seat to move: a colour named, else a number card played (it neither keeps the
 * turn nor asks a colour), else any card that plays, else a draw (and the drawn card next step) or
 * a pass. Resolves with the view the step was chosen from.
 */
export const unoStep = async (page: Page): Promise<View> => {
  const v = await requireView(page);
  if (v.phase === 'color') {
    await unoAct(page, { type: 'color', color: 'red' });
    return v;
  }
  const number = v.hand.find((card) => card.kind === 'number' && v.playable.includes(card.id));
  const id = number?.id ?? v.playable[0];
  if (id !== undefined) await unoAct(page, { type: 'play', id });
  else await unoAct(page, { type: v.phase === 'drawn' ? 'pass' : 'draw' });
  return v;
};

/** Steps (`unoStep`) until the turn is no longer `turn`'s, at most `left` of them. */
const playUntilMoved = async (page: Page, turn: number, left: number): Promise<void> => {
  const v = await requireView(page);
  if (v.turn !== turn || v.phase === 'gameOver') return;
  if (left === 0) throw new Error(`seat ${String(turn)} kept the turn: ${v.note}`);
  await unoStep(page);
  await playUntilMoved(page, turn, left - 1);
};

/**
 * The seat holding the phone plays until the turn has moved to another seat (a Skip or a Reverse at
 * two keeps it; a wild asks its colour first): resolves once the turn is another seat's.
 */
export const unoPlayTurn = async (page: Page): Promise<void> => {
  const { turn } = await requireView(page);
  await playUntilMoved(page, turn, 12);
};

// ---- a hand-made position -------------------------------------------------------------------------

const DECK = makeDeck();

/** A card of the deck by its id (cards.ts: the colour's letter, the value or the kind's letter, the copy: `r5a`, `bSb`, `W1`); a typo in a spec is a test bug and throws. */
export const unoCard = (id: string): Card => {
  const card = findCard(DECK, id);
  if (card === undefined) throw new Error(`${id} is not an UNO card`);
  return card;
};

/**
 * A pass-and-play position for `unoSetup`: the hands by card id (seat order), the discard pile's
 * top (a coloured card: its colour is the one in play), whose turn (seat 0 unless said), phase
 * `turn`, play clockwise, the rest of the deck as the draw pile.
 */
export const unoPosition = (
  p: Readonly<{
    hands: ReadonlyArray<ReadonlyArray<string>>;
    top: string;
    turn?: number;
    names?: ReadonlyArray<string>;
  }>,
): State => {
  const hands = p.hands.map((ids) => ids.map(unoCard));
  const top = unoCard(p.top);
  if (top.color === null) throw new Error(`${p.top} is a wild: the top card names the colour`);
  const used = new Set([top.id, ...hands.flat().map((card) => card.id)]);
  return {
    game: {
      names: p.names ?? [...DEFAULT_NAMES],
      hands,
      draw: DECK.filter((card) => !used.has(card.id)),
      discard: [top],
      color: top.color,
      turn: p.turn ?? 0,
      direction: 1,
      phase: { kind: 'turn' },
      uno: null,
      note: '',
    },
    startedAt: 0,
  };
};

/**
 * Seat `state` through the hook (the shell's `position/load`: pass and play only, the phone left
 * with the seat to move, no curtain); resolves with that seat's view once the page shows it.
 */
export const unoSetup = async (page: Page, state: State): Promise<View> => {
  // The harness has no DOM types (tsconfig.node.json): the hook is called by source, as briscola's is.
  await page.evaluate(`window.__uno.setup(${JSON.stringify(state)})`);
  const seated = (counts: ReadonlyArray<number>, turn: number, top: string | undefined): string =>
    JSON.stringify([counts, turn, top]);
  const want = seated(
    state.game.hands.map((hand) => hand.length),
    state.game.turn,
    state.game.discard.at(-1)?.id,
  );
  await expect
    .poll(async () => {
      const v = await readView(page);
      return v === null ? 'none' : seated(v.counts, v.turn, v.top.id);
    })
    .toBe(want);
  await expect(page.locator('#curtainOverlay')).toBeHidden();
  return requireView(page);
};
