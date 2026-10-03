// No jsdom here (docs/ARCHITECTURE.md "Testing pyramid"): the home screen runs against the page
// fake built from the page's own markup (ui/page.fake.ts over web/games/briscola/index.html). The
// seat count is the shell's stepper (web/shared/ui/stepper.ts): its hidden field ships `value="2"`,
// which the fake reads, and a test taps − and + as a player would. The shell's input writes and
// pure helpers are pinned where they live (web/shared/ui/home.test.ts, seatedHome.test.ts); this
// suite holds the composed home against briscola's own markup.
import { describe, expect, test } from 'vitest';

import { fakeTarget } from '../../../../shared/edge/page.fake.ts';
import { seatNameInputId } from '../../../../shared/markup/seatNames.ts';
import { stepperIds } from '../../../../shared/markup/stepper.ts';
import { LOCAL_PLAYERS, ONLINE_PLAYERS } from '../../../../shared/ui/seatedHome.ts';
import { bindHome, paintHome, readHostOptions, readLocalOptions } from './home.ts';
import { briscolaPage, type BriscolaPage } from './page.fake.ts';
import { DEFAULT_OPTS, initialApp, type App, type Intent } from './state.ts';

import MARKUP from '../../index.html?raw';

/** The controls the owner took off the home screen (2026-09-25): the match select and the house rules, in both panels; the seat count selects (2026-10-02: the stepper). */
const GONE_IDS = [
  'playersSel',
  'localPlayersSel',
  'matchSel',
  'localMatchSel',
  'removedTwoSel',
  'localRemovedTwoSel',
  'exchangeChk',
  'localExchangeChk',
  'scopertaChk',
  'localScopertaChk',
  'partnerPeekChk',
  'localPartnerPeekChk',
];

const page = (): BriscolaPage => briscolaPage(MARKUP);
/** The third and fourth pass-and-play seats' inputs (`#moreNames` shows them from three players). */
const EXTRA_NAME_INPUTS: Readonly<Record<2 | 3, string>> = {
  2: seatNameInputId(2),
  3: seatNameInputId(3),
};
/** Type into an input as the player would. */
const type = (p: BriscolaPage, id: string, value: string): void => {
  const input = p.get(id).el as HTMLInputElement;
  input.value = value;
};
/** One tap on a stepper's + (`inc`) or − (`dec`). */
const tap = (p: BriscolaPage, field: string, which: 'inc' | 'dec'): void => {
  p.get(stepperIds(field)[which]).fire('click');
};
const withOpts = (
  over: Partial<App['shell']['opts']>,
  seatNames: ReadonlyArray<string | null> = [null, null],
): App => ({
  shell: { ...initialApp.shell, opts: { ...DEFAULT_OPTS, ...over }, seatNames },
  table: initialApp.table,
});
const recorder = (): Readonly<{ intents: Intent[]; dispatch: (i: Intent) => void }> => {
  const intents: Intent[] = [];
  return { intents, dispatch: (i) => intents.push(i) };
};

describe('paintHome', () => {
  test('tabs, panels, the play mode, the resume box, and the room controls from the App', () => {
    const p = page();
    paintHome(p.doc, initialApp);
    expect(p.get('tabPlayBtn').hasClass('active')).toBe(true);
    expect(p.get('playPanel').hidden()).toBe(false);
    expect(p.get('rulesPanel').hidden()).toBe(true);
    expect(p.get('onlineModeContent').hidden()).toBe(false);
    expect(p.get('localModeContent').hidden()).toBe(true);
    expect(p.get('resumeBox').hidden()).toBe(true);
    // The default (D3): two players, − disabled at the floor; the match and the house rules have no controls at all.
    expect(p.get(LOCAL_PLAYERS).value()).toBe('2');
    expect(p.get(stepperIds(LOCAL_PLAYERS).num).text()).toBe('2');
    expect(p.get(stepperIds(LOCAL_PLAYERS).dec).disabled()).toBe(true);
    expect(p.get(stepperIds(LOCAL_PLAYERS).inc).disabled()).toBe(false);
    GONE_IDS.forEach((id) => {
      expect(MARKUP).not.toContain(`id="${id}"`);
    });
    expect(MARKUP).not.toContain('house-rules');
    // Two seats: the third and fourth name inputs are put away.
    expect(p.get('moreNames').hidden()).toBe(true);
    expect(p.get(EXTRA_NAME_INPUTS[3]).hidden()).toBe(true);
    // One count for both panels: the Online stepper follows the room's too, and its three and four
    // open a table online (docs/design/n-seat-sessions.md §7); + is disabled at four.
    expect(p.get(ONLINE_PLAYERS).value()).toBe('2');
    expect(MARKUP).not.toContain('online soon');
    paintHome(p.doc, withOpts({ seatCount: 4 }));
    expect(p.get(ONLINE_PLAYERS).value()).toBe('4');
    expect(p.get(stepperIds(ONLINE_PLAYERS).num).text()).toBe('4');
    expect(p.get(stepperIds(ONLINE_PLAYERS).inc).disabled()).toBe(true);
    expect(p.get(stepperIds(ONLINE_PLAYERS).dec).disabled()).toBe(false);
  });

  test('three and four seats show the extra names, painted from the shell`s memory', () => {
    const p = page();
    paintHome(p.doc, withOpts({ seatCount: 3 }, ['Cara', 'Dan']));
    expect(p.get(LOCAL_PLAYERS).value()).toBe('3');
    expect(p.get('moreNames').hidden()).toBe(false);
    expect(p.get(EXTRA_NAME_INPUTS[2]).hidden()).toBe(false);
    expect(p.get(EXTRA_NAME_INPUTS[3]).hidden()).toBe(true);
    expect(p.get(EXTRA_NAME_INPUTS[2]).value()).toBe('Cara');
    expect(p.get(EXTRA_NAME_INPUTS[3]).value()).toBe('Dan');
    // Remembered or typed names carry no mark.
    expect(p.get(EXTRA_NAME_INPUTS[2]).attr('data-default')).toBeNull();
    expect(p.get(EXTRA_NAME_INPUTS[3]).attr('data-default')).toBeNull();
    // Nothing remembered (null): the seat shows its default (the owner's Sandro and Grant), marked
    // for the first-tap clear; a seat emptied by that tap ('') shows empty, unmarked.
    paintHome(p.doc, withOpts({ seatCount: 4 }, [null, null]));
    expect(p.get(EXTRA_NAME_INPUTS[2]).value()).toBe('Sandro');
    expect(p.get(EXTRA_NAME_INPUTS[3]).value()).toBe('Grant');
    expect(p.get(EXTRA_NAME_INPUTS[2]).attr('data-default')).toBe('1');
    expect(p.get(EXTRA_NAME_INPUTS[3]).attr('data-default')).toBe('1');
    paintHome(p.doc, withOpts({ seatCount: 4 }, ['', null]));
    expect(p.get(EXTRA_NAME_INPUTS[2]).value()).toBe('');
    expect(p.get(EXTRA_NAME_INPUTS[2]).attr('data-default')).toBeNull();
    expect(p.get(EXTRA_NAME_INPUTS[3]).attr('data-default')).toBe('1');
    paintHome(p.doc, withOpts({ seatCount: 4 }));
    expect(p.get(LOCAL_PLAYERS).value()).toBe('4');
    expect(p.get(EXTRA_NAME_INPUTS[3]).hidden()).toBe(false);
  });
});

describe('bindHome', () => {
  test('the start buttons carry the raw seat count of their panel (`Raw`), the extra names with Start', () => {
    const p = page();
    const r = recorder();
    bindHome(p.doc, r.dispatch);
    type(p, 'nameInput', 'Ann');
    p.get('hostBtn').fire('click');
    expect(r.intents).toEqual([{ type: 'host/click', name: 'Ann', players: '2' }]);
    expect(readHostOptions(p.doc)).toEqual({ players: '2' });
    type(p, 'p1NameInput', 'Ann');
    type(p, 'p2NameInput', 'Bob');
    tap(p, LOCAL_PLAYERS, 'inc');
    type(p, EXTRA_NAME_INPUTS[2], 'Cara');
    p.get('localBtn').fire('click');
    expect(r.intents.at(-1)).toEqual({
      type: 'local/click',
      p1: 'Ann',
      p2: 'Bob',
      localPlayers: '3',
      names: ['Cara', ''],
    });
    expect(readLocalOptions(p.doc).names).toEqual(['Cara', '']);
  });

  test('a tap on − or + remembers its panel`s count at once, clamped to two and four; the third and fourth names as typed', () => {
    const p = page();
    const r = recorder();
    bindHome(p.doc, r.dispatch);
    tap(p, LOCAL_PLAYERS, 'inc');
    tap(p, LOCAL_PLAYERS, 'inc');
    expect(r.intents).toEqual([
      { type: 'opts/set', raw: { localPlayers: '3' } },
      { type: 'opts/set', raw: { localPlayers: '4' } },
    ]);
    expect(p.get(LOCAL_PLAYERS).value()).toBe('4');
    expect(p.get(stepperIds(LOCAL_PLAYERS).num).text()).toBe('4');
    // At four, + is disabled and a tap on it moves nothing: no intent.
    expect(p.get(stepperIds(LOCAL_PLAYERS).inc).disabled()).toBe(true);
    tap(p, LOCAL_PLAYERS, 'inc');
    expect(r.intents).toHaveLength(2);
    // The Online panel's − at two likewise; its + steps to three.
    tap(p, ONLINE_PLAYERS, 'dec');
    expect(r.intents).toHaveLength(2);
    tap(p, ONLINE_PLAYERS, 'inc');
    expect(r.intents.at(-1)).toEqual({ type: 'opts/set', raw: { players: '3' } });
    expect(readHostOptions(p.doc)).toEqual({ players: '3' });
    type(p, EXTRA_NAME_INPUTS[2], 'Cara');
    p.get(EXTRA_NAME_INPUTS[2]).fire('input');
    type(p, EXTRA_NAME_INPUTS[3], 'Dan ');
    p.get(EXTRA_NAME_INPUTS[3]).fire('input');
    expect(r.intents.slice(-2)).toEqual([
      { type: 'seatName/typed', seat: 2, value: 'Cara' },
      { type: 'seatName/typed', seat: 3, value: 'Dan ' },
    ]);
    // A third or fourth seat showing its default (painted marked) clears on its first tap and
    // tells the reducer the seat is empty; the second tap, and a tap on a typed name, do nothing.
    paintHome(p.doc, withOpts({ seatCount: 4 }, [null, null]));
    const before = r.intents.length;
    p.get(EXTRA_NAME_INPUTS[2]).fire('focus');
    expect(p.get(EXTRA_NAME_INPUTS[2]).value()).toBe('');
    expect(p.get(EXTRA_NAME_INPUTS[2]).attr('data-default')).toBeNull();
    p.get(EXTRA_NAME_INPUTS[2]).fire('focus');
    p.get(EXTRA_NAME_INPUTS[2]).fire('pointerdown');
    expect(r.intents.slice(before)).toEqual([{ type: 'seatName/typed', seat: 2, value: '' }]);
    p.get(EXTRA_NAME_INPUTS[3]).fire('pointerdown');
    expect(p.get(EXTRA_NAME_INPUTS[3]).value()).toBe('');
    expect(r.intents.slice(before)).toEqual([
      { type: 'seatName/typed', seat: 2, value: '' },
      { type: 'seatName/typed', seat: 3, value: '' },
    ]);
    // The shell's own controls are bound through the shared binder: a tab click, for one.
    p.get('tabRulesBtn').fire('click', { target: fakeTarget({ id: 'tabRulesBtn' }) });
    expect(r.intents.at(-1)).toEqual({ type: 'tab/set', tab: 'rules' });
  });
});
