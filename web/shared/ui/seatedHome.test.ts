// The seated home over a fake page (docs/design/shared-shell.md §4.1: "over a FAKE_GAME and
// dom.fake/page.fake"): the shell's ids, two steppers for two to five seats, the third to fifth
// name inputs under one group. briscola's ui/home.test.ts runs the composed home against its own
// markup; this suite is what holds the shared row at 100 (tools/ci/suites.ts).
import { describe, expect, test } from 'vitest';

import { fakeEl, fakePage, fakeTarget, type FakeEl, type FakePage } from '../edge/page.fake.ts';
import { seatNameInputId } from '../markup/seatNames.ts';
import { stepperIds } from '../markup/stepper.ts';
import { DEFAULT_MARK } from './home.ts';
import {
  LOCAL_PLAYERS,
  ONLINE_PLAYERS,
  seatedHome,
  type SeatedHomeApp,
  type SeatedHomeSpec,
  type SeatedRaw,
} from './seatedHome.ts';
import type { Intent } from './shell.ts';
import type { Fake } from './test-helpers.ts';

/** The fake two-seat game's bag with a seat count and the seated raw values: what the three seated games plug in. */
type Seated = Omit<Fake, 'Opts' | 'Raw'> &
  Readonly<{ Opts: Readonly<{ seatCount: number }>; Raw: SeatedRaw }>;
type App = SeatedHomeApp<Seated>;
type SeatedIntent = Intent<Seated>;

const TABS = ['play', 'rules', 'about'] as const;
const MODES = ['online', 'local'] as const;
const SEATS = { min: 2, max: 5 } as const;
/** A page built with `seatNamesHtml`: no group around the extra inputs. */
const UNGROUPED: SeatedHomeSpec<Seated> = {
  seats: SEATS,
  localNames: ['Ari', 'Lavi', 'Sandro'],
  allNames: (game) => game.players.map((p) => p.name),
  tabs: TABS,
};
/** A page with the extra inputs under `#moreNames` (flip7's, briscola's). */
const SPEC: SeatedHomeSpec<Seated> = { ...UNGROUPED, group: 'moreNames' };
const P3 = seatNameInputId(2);
const P4 = seatNameInputId(3);
const P5 = seatNameInputId(4);

/** The seated page: the shell's ids as home.test.ts lists them, then both steppers at two and the three extra inputs put away. */
const seatedPage = (): FakePage => {
  const modeButtons = MODES.map((mode) =>
    fakeEl(`modeSwitch-${mode}`, {
      classes: ['mode-btn', ...(mode === 'online' ? ['active'] : [])],
      attrs: { 'data-mode': mode },
    }),
  );
  const submenuButtons = MODES.map((mode) =>
    fakeEl(`submenu-${mode}`, { attrs: { 'data-mode': mode } }),
  );
  const tabPlayBtn = fakeEl('tabPlayBtn', { classes: ['active'] });
  const stepper = (id: string): ReadonlyArray<FakeEl> => {
    const ids = stepperIds(id);
    return [
      fakeEl(ids.dec, { attrs: { disabled: '' } }),
      fakeEl(ids.num, { text: '2' }),
      fakeEl(ids.inc),
      fakeEl(id, { value: '2' }),
    ];
  };
  return fakePage([
    fakeEl('nameInput', { value: 'Ann' }),
    fakeEl('p1NameInput', { value: 'Ann' }),
    fakeEl('p2NameInput', { value: 'Bob' }),
    fakeEl('codeInput'),
    fakeEl('hostBtn'),
    fakeEl('joinBtn'),
    fakeEl('startGameBtn'),
    fakeEl('localBtn'),
    tabPlayBtn,
    fakeEl('tabRulesBtn'),
    fakeEl('tabAboutBtn'),
    fakeEl('tabPlayWrap', { children: [tabPlayBtn] }),
    fakeEl('playPanel'),
    fakeEl('rulesPanel', { classes: ['hidden'] }),
    fakeEl('aboutPanel', { classes: ['hidden'] }),
    fakeEl('onlineModeContent'),
    fakeEl('localModeContent', { classes: ['hidden'] }),
    fakeEl('playModeSwitch', { queries: { '.mode-btn': modeButtons } }),
    fakeEl('playSubmenu', {
      queries: { button: submenuButtons, 'button[data-mode]': submenuButtons },
    }),
    fakeEl('resumeBox', { classes: ['hidden'] }),
    fakeEl('resumeBtn'),
    fakeEl('shareCodeBtn'),
    fakeEl('cancelHostBtn'),
    fakeEl('cancelGuestBtn'),
    fakeEl('guestNameInput'),
    fakeEl('guestRenameBtn'),
    ...modeButtons,
    ...submenuButtons,
    ...stepper(ONLINE_PLAYERS),
    ...stepper(LOCAL_PLAYERS),
    fakeEl('moreNames', { classes: ['row', 'hidden'] }),
    ...[P3, P4, P5].map((id) => fakeEl(id, { classes: ['grow', 'hidden'] })),
  ]);
};

const app = (seatCount: number, seatNames: ReadonlyArray<string | null> = []): App => ({
  shell: {
    homeTab: 'play',
    playMode: 'online',
    submenuOpen: false,
    resume: null,
    opts: { seatCount },
    seatNames,
  },
});

/** Type into an input as the player would (the fake's inputs carry a writable value). */
const type = (p: FakePage, id: string, value: string): void => {
  const input = p.get(id).el as HTMLInputElement;
  input.value = value;
  p.get(id).fire('input');
};
/** One tap on a stepper's + (`inc`) or − (`dec`). */
const tap = (p: FakePage, field: string, which: 'inc' | 'dec'): void => {
  p.get(stepperIds(field)[which]).fire('click');
};
const recorder = (): Readonly<{
  intents: SeatedIntent[];
  dispatch: (i: SeatedIntent) => void;
}> => {
  const intents: SeatedIntent[] = [];
  return { intents, dispatch: (i) => intents.push(i) };
};

describe('paintHome', () => {
  test('the shell, both steppers at the one count, the group and the extra names shown from three', () => {
    const p = seatedPage();
    const home = seatedHome(SPEC);
    home.paintHome(p.doc, app(2));
    expect(p.get('tabPlayBtn').hasClass('active')).toBe(true);
    expect(p.get('playPanel').hasClass('hidden')).toBe(false);
    expect(p.get('onlineModeContent').hasClass('hidden')).toBe(false);
    expect(p.get('localModeContent').hasClass('hidden')).toBe(true);
    expect(p.get('resumeBox').hasClass('hidden')).toBe(true);
    [ONLINE_PLAYERS, LOCAL_PLAYERS].forEach((id) => {
      expect(p.get(id).value()).toBe('2');
      expect(p.get(stepperIds(id).num).text()).toBe('2');
      expect(p.get(stepperIds(id).dec).disabled()).toBe(true);
      expect(p.get(stepperIds(id).inc).disabled()).toBe(false);
    });
    expect(p.get('moreNames').hasClass('hidden')).toBe(true);
    expect(p.get(P3).hasClass('hidden')).toBe(true);
    // Three seats: the group opens, the third input shows its default marked for the first-tap
    // clear, the fourth (remembered) is unmarked but still put away.
    home.paintHome(p.doc, app(3, [null, 'Dan']));
    expect(p.get('moreNames').hasClass('hidden')).toBe(false);
    expect(p.get(P3).hasClass('hidden')).toBe(false);
    expect(p.get(P3).value()).toBe('Sandro');
    expect(p.get(P3).attr(DEFAULT_MARK)).toBe('1');
    expect(p.get(P4).hasClass('hidden')).toBe(true);
    expect(p.get(P4).value()).toBe('Dan');
    expect(p.get(P4).attr(DEFAULT_MARK)).toBeNull();
    // The cap: + disabled on both, every input shown, the seat past the list numbered.
    home.paintHome(p.doc, app(5));
    [ONLINE_PLAYERS, LOCAL_PLAYERS].forEach((id) => {
      expect(p.get(id).value()).toBe('5');
      expect(p.get(stepperIds(id).inc).disabled()).toBe(true);
      expect(p.get(stepperIds(id).dec).disabled()).toBe(false);
    });
    expect(p.get(P5).hasClass('hidden')).toBe(false);
    expect(p.get(P5).value()).toBe('Player 5');
  });

  test('a page built with seatNamesHtml names no group: each input hides on its own', () => {
    const p = seatedPage();
    seatedHome(UNGROUPED).paintHome(p.doc, app(4));
    expect(p.get('moreNames').hasClass('hidden')).toBe(true);
    expect(p.get(P3).hasClass('hidden')).toBe(false);
    expect(p.get(P4).hasClass('hidden')).toBe(false);
    expect(p.get(P5).hasClass('hidden')).toBe(true);
  });

  test('the resume offer is labelled with the game`s names', () => {
    const p = seatedPage();
    const game = {
      players: [
        { id: 'a', name: 'Ann' },
        { id: 'b', name: 'Bob' },
      ],
      level: 1,
      turn: 0,
      moves: 0,
      over: false,
    } as const;
    seatedHome(SPEC).paintHome(p.doc, {
      shell: { ...app(2).shell, resume: { kind: 'local', game } },
    });
    expect(p.get('resumeBox').hasClass('hidden')).toBe(false);
    expect(p.get('resumeBtn').text()).toBe('Resume pass & play: Ann vs Bob');
  });
});

describe('bindHome', () => {
  test('the start buttons carry their panel`s raw count, Start the extra names too; the readers read the same', () => {
    const p = seatedPage();
    const r = recorder();
    const home = seatedHome(SPEC);
    home.bindHome(p.doc, r.dispatch);
    p.get('hostBtn').fire('click');
    expect(r.intents).toEqual([{ type: 'host/click', name: 'Ann', players: '2' }]);
    expect(home.readHostOptions(p.doc)).toEqual({ players: '2' });
    tap(p, LOCAL_PLAYERS, 'inc');
    type(p, P3, 'Cara');
    p.get('localBtn').fire('click');
    expect(r.intents.at(-1)).toEqual({
      type: 'local/click',
      p1: 'Ann',
      p2: 'Bob',
      localPlayers: '3',
      names: ['Cara', '', ''],
    });
    expect(home.readLocalOptions(p.doc)).toEqual({ localPlayers: '3', names: ['Cara', '', ''] });
  });

  test('a tap on − or + remembers its panel`s count at once, clamped; the extra names as typed; the shell`s controls through the shared binder', () => {
    const p = seatedPage();
    const r = recorder();
    const home = seatedHome(SPEC);
    home.bindHome(p.doc, r.dispatch);
    tap(p, LOCAL_PLAYERS, 'inc');
    tap(p, LOCAL_PLAYERS, 'inc');
    tap(p, LOCAL_PLAYERS, 'inc');
    expect(r.intents).toEqual([
      { type: 'opts/set', raw: { localPlayers: '3' } },
      { type: 'opts/set', raw: { localPlayers: '4' } },
      { type: 'opts/set', raw: { localPlayers: '5' } },
    ]);
    expect(p.get(stepperIds(LOCAL_PLAYERS).num).text()).toBe('5');
    // At the cap + is disabled and a tap on it moves nothing: no intent; the Online − at the floor likewise.
    expect(p.get(stepperIds(LOCAL_PLAYERS).inc).disabled()).toBe(true);
    tap(p, LOCAL_PLAYERS, 'inc');
    tap(p, ONLINE_PLAYERS, 'dec');
    expect(r.intents).toHaveLength(3);
    tap(p, ONLINE_PLAYERS, 'inc');
    expect(r.intents.at(-1)).toEqual({ type: 'opts/set', raw: { players: '3' } });
    // Each keystroke on a third seat on is the shell's `seatName/typed`, the seat 0-based.
    type(p, P4, 'Dan ');
    expect(r.intents.at(-1)).toEqual({ type: 'seatName/typed', seat: 3, value: 'Dan ' });
    // A default painted marked clears on its first tap and reports the seat empty.
    home.paintHome(p.doc, app(5));
    p.get(P3).fire('focus');
    expect(p.get(P3).value()).toBe('');
    expect(r.intents.at(-1)).toEqual({ type: 'seatName/typed', seat: 2, value: '' });
    p.get('tabRulesBtn').fire('click', { target: fakeTarget({ id: 'tabRulesBtn' }) });
    expect(r.intents.at(-1)).toEqual({ type: 'tab/set', tab: 'rules' });
  });
});
