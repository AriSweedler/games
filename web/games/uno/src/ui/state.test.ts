import { describe, expect, test } from 'vitest';

import { NOW, runIntents, viaJson } from '../../../../../test/shared/engine-helpers.ts';
import { createStore, type StorageLike } from '../../../../shared/edge/storage.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import type { Card } from '../engine/cards.ts';
import type { Game } from '../engine/engine.ts';
import { viewFor, type State, type View } from '../engine/view.ts';
import { STORAGE_KEYS } from '../storage.ts';
import {
  cuesBetween,
  guestContextOf,
  hostContextOf,
  initialApp,
  initialShell,
  initialTable,
  namesOf,
  readHome,
  reduce,
  type Resume,
  runEffect,
  viewOf,
  type App,
  type EffectDeps,
  type Intent,
} from './state.ts';
import {
  handoffLabel,
  listNames,
  resumeLabel as sharedResumeLabel,
} from '../../../../shared/lib/name.ts';

/** The shell's resume label over this game's seats (web/shared/lib/name.ts). */
const resumeLabel = (resume: Resume): string => sharedResumeLabel(resume, namesOf);

const ctx = { rng: mulberry32(7), now: () => NOW };
const run = runIntents(reduce, ctx);

const card = (
  id: string,
  color: Card['color'],
  kind: Card['kind'],
  value: number | null,
): Card => ({
  id,
  kind,
  color,
  value,
});
const R5 = card('r5a', 'red', 'number', 5);
const R7 = card('r7a', 'red', 'number', 7);
const B2 = card('b2a', 'blue', 'number', 2);
const G9 = card('g9a', 'green', 'number', 9);
const WILD = card('W1', null, 'wild', null);
const SKIP = card('rSa', 'red', 'skip', null);
const REV = card('rRa', 'red', 'reverse', null);
const D2 = card('rD2a', 'red', 'draw2', null);

/** Ann (seat 0) to play on a red 5; Bob and Cy wait. */
const position = (over: Partial<Game> = {}): State => ({
  startedAt: 42,
  game: {
    names: ['Ann', 'Bob', 'Cy'],
    hands: [
      [R7, B2, WILD],
      [G9, B2],
      [B2, G9],
    ],
    draw: [G9, B2, R7],
    discard: [R5],
    color: 'red',
    turn: 0,
    direction: 1,
    phase: { kind: 'turn' },
    uno: null,
    note: 'Ann starts.',
    ...over,
  },
});

const fakeStorage = (): StorageLike & Readonly<{ map: Map<string, string> }> => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
};

const localClick = (seats: string, names: ReadonlyArray<string> = []): Intent => ({
  type: 'local/click',
  p1: 'Ann',
  p2: 'Bob',
  localPlayers: seats,
  names,
});

/** A pass-and-play table at the hand-built position, its curtain lifted by Ann. */
const atPosition = (over: Partial<Game> = {}): App =>
  run(
    initialApp,
    localClick('3'),
    { type: 'position/load', state: viaJson(position(over)) },
    { type: 'curtain/reveal' },
  ).app;

const types = (effects: ReadonlyArray<Readonly<{ type: string }>>): ReadonlyArray<string> =>
  effects.map((e) => e.type);

describe('pass and play', () => {
  test('two seats: the deal, the curtain up for the first player, the count remembered', () => {
    const s = run(initialApp, localClick('2'));
    expect(s.app.shell.role).toBe('local');
    expect(s.app.shell.game?.game.names).toEqual(['Ann', 'Bob']);
    expect(s.app.shell.screen).toBe('tableScreen');
    expect(s.app.table.curtain).toBe(0);
    expect(s.effects).toContainEqual({ type: 'writeOpts', opts: { seatCount: 2 } });
  });

  test('twelve seats, the largest table: the names past the fourth are numbered', () => {
    const twelve = run(initialApp, localClick('12'));
    expect(twelve.app.shell.game?.game.names).toHaveLength(12);
    expect(twelve.app.shell.game?.game.names.slice(3, 5)).toEqual(['Grant', 'Player 5']);
  });

  test('three seats: the third name the default when left empty; four with all four typed', () => {
    expect(run(initialApp, localClick('3')).app.shell.game?.game.names).toEqual([
      'Ann',
      'Bob',
      'Sandro',
    ]);
    const four = run(initialApp, {
      type: 'local/click',
      p1: 'Ann',
      p2: 'Bob',
      localPlayers: '4',
      names: ['Cy', 'Di'],
    });
    expect(four.app.shell.game?.game.names).toEqual(['Ann', 'Bob', 'Cy', 'Di']);
  });

  test('a name typed for a later seat is the shell`s, remembered, written, and seats the game when the click carries none', () => {
    const typed = run(initialApp, { type: 'seatName/typed', seat: 4, value: 'Eve' });
    expect(typed.app.shell.seatNames[2]).toBe('Eve');
    expect(typed.effects).toContainEqual({ type: 'rememberSeatName', seat: 4, name: 'Eve' });
    const six = run(typed.app, { type: 'local/click', p1: 'Ann', p2: 'Bob', localPlayers: '6' });
    expect(six.app.shell.game?.game.names).toEqual([
      'Ann',
      'Bob',
      'Sandro',
      'Grant',
      'Eve',
      'Player 6',
    ]);
    // Leaving the table keeps the names typed at home.
    expect(run(six.app, { type: 'leave/finish' }).app.shell.seatNames[2]).toBe('Eve');
    // A cleared seat stays '' (the paint leaves it empty); only an unknown seat is null.
    const cleared = run(typed.app, { type: 'seatName/typed', seat: 4, value: '' });
    expect(cleared.app.shell.seatNames[2]).toBe('');
    expect(cleared.effects).toContainEqual({ type: 'rememberSeatName', seat: 4, name: '' });
  });

  test('the reveal shows the seat its own hand; a play hands the phone to the next seat', () => {
    const app = atPosition();
    expect(app.table.curtain).toBeNull();
    expect(viewOf(app)?.seat).toBe(0);
    expect(viewOf(app)?.hand.map((c) => c.id)).toEqual(['r7a', 'b2a', 'W1']);
    const played = run(app, { type: 'act', action: { type: 'play', id: 'r7a' } });
    expect(played.app.shell.game?.game.turn).toBe(1);
    expect(played.app.table.curtain).toBe(1);
    expect(viewOf(played.app)?.seat).toBe(1);
    expect(viewOf(played.app)?.hand.map((c) => c.id)).toEqual(['g9a', 'b2a']);
    expect(types(played.effects)).toContain('persist');
  });

  test('a card that does not match is refused with a toast and changes nothing', () => {
    const app = atPosition();
    const s = run(app, { type: 'act', action: { type: 'play', id: 'b2a' } });
    expect(s.app.shell.game).toEqual(app.shell.game);
    expect(s.effects).toContainEqual(expect.objectContaining({ type: 'toast' }));
  });

  test('a wild asks its player for the colour, under no curtain; the colour hands the turn on', () => {
    const app = atPosition();
    const wild = run(app, { type: 'act', action: { type: 'play', id: 'W1' } });
    expect(wild.app.shell.view?.phase).toBe('color');
    expect(wild.app.table.curtain).toBeNull();
    const named = run(wild.app, { type: 'act', action: { type: 'color', color: 'blue' } });
    expect(named.app.shell.game?.game.color).toBe('blue');
    expect(named.app.table.curtain).toBe(1);
  });

  test('one round is the game: the first empty hand wins, under no curtain; Play again deals anew and curtains its first player', () => {
    const app = atPosition({ hands: [[R7], [G9, B2], [B2, G9]] });
    const out = run(app, { type: 'act', action: { type: 'play', id: 'r7a' } });
    expect(out.app.shell.view?.phase).toBe('gameOver');
    expect(out.app.shell.view?.winner).toBe(0);
    expect(out.app.table.curtain).toBeNull();
    expect(out.effects).toContainEqual({ type: 'fx', cue: 'win' });
    expect(out.effects).toContainEqual(expect.objectContaining({ type: 'recordGame' }));
    const next = run(out.app, { type: 'act', action: { type: 'again' } });
    expect(next.app.shell.game?.game.names).toEqual(['Ann', 'Bob', 'Cy']);
    expect(next.app.shell.game?.startedAt).toBe(NOW);
    expect(next.app.shell.view?.phase).not.toBe('gameOver');
    expect(next.app.shell.revealed).toBeNull();
    expect(next.app.table.curtain).not.toBeNull();
  });

  test('the handoff is offered at two seats only', () => {
    const three = run(initialApp, localClick('3')).app;
    expect(run(three, { type: 'handoff/click' }).app).toBe(three);
    const two = run(initialApp, localClick('2')).app;
    expect(run(two, { type: 'handoff/click' }).app.shell.role).toBe('host');
  });
});

describe('online', () => {
  const hosting = (): App => ({
    shell: {
      ...initialShell,
      role: 'host',
      code: 'KQZM',
      myName: 'Ann',
      opts: { seatCount: 3 },
      game: position(),
      view: viewFor(position(), 0),
      seats: [
        { name: 'Bob', connected: true },
        { name: 'Cy', connected: true },
      ],
      oppName: 'Bob',
      oppConnected: true,
      screen: 'tableScreen',
    },
    table: initialTable,
  });

  test('the host plays and sends every seat its own view: its hand, never another', () => {
    const s = run(hosting(), { type: 'act', action: { type: 'play', id: 'r7a' } });
    const sends = s.effects.flatMap((e) =>
      e.type === 'send' ? [e as unknown as Readonly<{ frame: { view: View }; seat: number }>] : [],
    );
    expect(sends.map((e) => e.seat)).toEqual([1, 2]);
    sends.forEach((e) => {
      expect(e.frame.view.seat).toBe(e.seat);
      expect(e.frame.view.hand).toEqual(position().game.hands[e.seat]);
    });
    expect(s.app.shell.view?.seat).toBe(0);
    expect(s.app.shell.game?.game.turn).toBe(1);
  });

  test('the host out of turn is refused with a toast', () => {
    const app = hosting();
    const s = run(
      { ...app, shell: { ...app.shell, game: position({ turn: 1 }) } },
      { type: 'act', action: { type: 'draw' } },
    );
    expect(s.effects).toContainEqual(expect.objectContaining({ type: 'toast' }));
  });

  test('a guest sends its action frame; unconnected, it is told so', () => {
    const guest: App = {
      shell: { ...initialShell, role: 'guest', oppConnected: true },
      table: initialTable,
    };
    expect(run(guest, { type: 'act', action: { type: 'draw' } }).effects).toContainEqual({
      type: 'send',
      frame: { t: 'action', action: { type: 'draw' } },
    });
    const lost = { ...guest, shell: { ...guest.shell, oppConnected: false } };
    expect(types(run(lost, { type: 'act', action: { type: 'draw' } }).effects)).toContain('toast');
    expect(types(run(initialApp, { type: 'act', action: { type: 'draw' } }).effects)).toContain(
      'toast',
    );
  });

  test('my turn arriving online is cued; the sessions read the seats back', () => {
    const app = hosting();
    const guest: App = {
      shell: {
        ...initialShell,
        role: 'guest',
        oppConnected: true,
        mySeat: 1,
        view: viewFor(position(), 1),
        screen: 'tableScreen',
      },
      table: initialTable,
    };
    const mine = viewFor(position({ turn: 1, discard: [R5, R7] }), 1);
    const s = run(guest, { type: 'guest/frame', frame: { t: 'state', view: mine } });
    expect(s.effects).toContainEqual({ type: 'fx', cue: 'yourTurn' });
    expect(s.effects).toContainEqual({ type: 'fx', cue: 'play' });
    expect(hostContextOf(app).seats).toEqual(app.shell.seats);
    expect(guestContextOf(app)).toMatchObject({ code: 'KQZM' });
  });

  test('a game the host lost, or that never was, acts on nothing', () => {
    const app = hosting();
    const none = { ...app, shell: { ...app.shell, game: null } };
    expect(run(none, { type: 'act', action: { type: 'draw' } }).app).toEqual(none);
    const local = { ...none, shell: { ...none.shell, role: 'local' as const } };
    expect(run(local, { type: 'act', action: { type: 'draw' } }).app).toEqual(local);
  });
});

describe('the table’s own intents', () => {
  test('the counts, the two sheets and Escape', () => {
    const set = run(initialApp, { type: 'opts/set', raw: { players: '4' } });
    expect(set.app.shell.opts).toEqual({ seatCount: 4 });
    expect(set.effects).toEqual([{ type: 'writeOpts', opts: { seatCount: 4 } }]);
    const rules = run(initialApp, { type: 'rules/open' }).app;
    expect(rules.shell.rulesOpen).toBe(true);
    expect(run(rules, { type: 'rules/close' }).app.shell.rulesOpen).toBe(false);
    expect(run(rules, { type: 'escape' }).app.shell.rulesOpen).toBe(false);
    const history = run(initialApp, { type: 'history/open' }).app;
    expect(history.shell.historyOpen).toBe(true);
    expect(run(history, { type: 'history/close' }).app.shell.historyOpen).toBe(false);
    expect(run(history, { type: 'escape' }).app.shell.historyOpen).toBe(false);
    expect(run(initialApp, { type: 'escape' }).app).toEqual(initialApp);
  });

  test('hosting remembers the count', () => {
    const s = run(initialApp, { type: 'host/click', name: 'Ann', players: '3' });
    expect(s.app.shell.opts).toEqual({ seatCount: 3 });
    expect(s.effects).toContainEqual({ type: 'writeOpts', opts: { seatCount: 3 } });
  });
});

describe('the cues', () => {
  test('a card played, a card drawn, a round won or lost', () => {
    const a = viewFor(position(), 0);
    const played = viewFor(position({ discard: [R5, R7] }), 0);
    expect(cuesBetween(a, played)).toEqual(['play']);
    expect(cuesBetween(a, viewFor(position({ draw: [G9] }), 0))).toEqual(['draw']);
    const won = viewFor(position({ phase: { kind: 'gameOver', winner: 0 } }), 0);
    expect(cuesBetween(a, won)).toEqual(['win']);
    const lost = viewFor(position({ phase: { kind: 'gameOver', winner: 1 } }), 0);
    expect(cuesBetween(a, lost)).toEqual(['lose']);
    expect(cuesBetween(a, a)).toEqual([]);
  });

  test('a Skip, a Reverse and a Draw Two each cue once, by their kind (sound.ts is the table)', () => {
    const a = viewFor(position(), 0);
    expect(cuesBetween(a, viewFor(position({ discard: [R5, SKIP], turn: 2 }), 0))).toEqual([
      'skip',
    ]);
    expect(
      cuesBetween(a, viewFor(position({ discard: [R5, REV], direction: -1, turn: 2 }), 0)),
    ).toEqual(['reverse']);
    // The two cards land in Bob's hand: the table hears the sting, Bob the penalty.
    const d2 = position({
      discard: [R5, D2],
      hands: [
        [R7, B2, WILD],
        [G9, B2, R7, G9],
        [B2, G9],
      ],
      turn: 2,
    });
    expect(cuesBetween(a, viewFor(d2, 0))).toEqual(['draw2']);
    expect(cuesBetween(viewFor(position(), 1), viewFor(d2, 1))).toEqual(['penalty']);
  });
});

describe('the labels', () => {
  test('names listed, the handoff, and each resume offer', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Ann'])).toBe('Ann');
    expect(listNames(['Ann', 'Bob', 'Cy'])).toBe('Ann, Bob and Cy');
    expect(handoffLabel(namesOf(position()))).toBe(
      'Continue online: Ann hosts, Bob joins by invite',
    );
    expect(resumeLabel({ kind: 'local', game: position() })).toBe(
      'Resume pass & play: Ann, Bob and Cy',
    );
    const two = position({ names: ['Ann', 'Bob'], hands: [[R7], [G9]] });
    expect(resumeLabel({ kind: 'local', game: two })).toBe('Resume pass & play: Ann vs Bob');
    expect(resumeLabel({ kind: 'guest', code: 'KQZM', myName: 'Bob' })).toBe('Rejoin room KQZM');
    const host = {
      kind: 'host' as const,
      code: 'KQZM',
      myName: 'Ann',
      seatCount: 2 as const,
      game: position(),
      oppName: 'Bob',
      handoff: true,
      at: null,
    };
    expect(resumeLabel(host)).toBe('Continue online: Ann hosts, Bob joins by invite');
    expect(resumeLabel({ ...host, handoff: false })).toBe('Resume hosting room KQZM');
  });
});

describe('storage', () => {
  test('the count is written and read back; the shell’s save goes through the shared runner', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const deps = { store } as unknown as EffectDeps;
    expect(readHome(store).opts).toEqual({ seatCount: 2 });
    runEffect(initialApp, { type: 'writeOpts', opts: { seatCount: 3 } }, deps);
    expect(s.map.get(STORAGE_KEYS.players)).toBe('3');
    expect(readHome(store).opts).toEqual({ seatCount: 3 });
    // A later seat's name under its own key, read back into the shell at `home/init`.
    runEffect(initialApp, { type: 'rememberSeatName', seat: 3, name: 'Eve' }, deps);
    expect(s.map.get(STORAGE_KEYS.p4Name)).toBe('Eve');
    expect(readHome(store).seatNames).toEqual([null, 'Eve', ...Array<null>(8).fill(null)]);
    const app = atPosition();
    runEffect(app, { type: 'persist' }, deps);
    expect(JSON.parse(s.map.get(STORAGE_KEYS.save) ?? 'null')).toMatchObject({ role: 'local' });
    expect(readHome(store).save).toMatchObject({ role: 'local' });
    // `home/init`: the remembered count into the shell, the saved game offered to resume.
    const home = run(initialApp, { type: 'home/init', home: readHome(store) }).app;
    expect(home.shell.opts).toEqual({ seatCount: 3 });
    expect(home.shell.seatNames[1]).toBe('Eve');
    expect(home.shell.resume).toMatchObject({ kind: 'local' });
  });
});
