import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { createStore, type StorageLike } from '../../../../shared/edge/storage.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { createGame, viewFor, type State } from '../engine/index.ts';
import { STORAGE_KEYS } from '../storage.ts';
import {
  FLIP7,
  NO_EXTRA_NAMES,
  guestContextOf,
  hostContextOf,
  initialApp,
  listNames,
  myTurn,
  pauseFor,
  readHome,
  reduce,
  resumeLabel,
  runEffect,
  waitingToDealMsg,
  type App,
  type EffectDeps,
  type Intent,
} from './state.ts';

const ctx = { rng: mulberry32(5), now: () => NOW };
const run = runIntents(reduce, ctx);

const startThree: Intent = {
  type: 'local/click',
  p1: '',
  p2: 'Lavi',
  localPlayers: '3',
  names: ['', '', '', ''],
};

const seated = (role: 'host' | 'guest', game: State | null, seat = 0): App => ({
  ...initialApp,
  shell: {
    ...initialApp.shell,
    role,
    code: 'ABCD',
    game,
    view: game === null ? null : viewFor(game, seat),
    oppConnected: true,
    oppName: 'Lavi',
    seats: [{ name: 'Lavi', connected: true }],
    mySeat: role === 'host' ? 0 : 1,
    screen: 'tableScreen',
  },
});

describe('pass the phone', () => {
  test('Start seats two to six (the defaults for the empty ones), deals, and the curtain names the first player once', () => {
    const started = run(initialApp, startThree);
    const game = started.app.shell.game;
    expect(game?.seats.map((s) => s.name)).toEqual(['Ari', 'Lavi', 'Sandro']);
    expect(started.app.shell.role).toBe('local');
    expect(started.app.table.curtain).toBe(0);
    expect(started.effects).toContainEqual({ type: 'writeOpts', opts: { seatCount: 3 } });
    const revealed = run(started.app, { type: 'curtain/reveal' });
    expect(revealed.app.table.curtain).toBeNull();
    expect(revealed.app.shell.screen).toBe('tableScreen');
    // The opening deal goes round: the table follows whoever must act, no curtain comes back.
    const dealt = run(revealed.app, { type: 'hit/click' }, { type: 'hit/click' });
    expect(dealt.app.table.curtain).toBeNull();
    expect(dealt.app.shell.view?.me).toBe(dealt.app.shell.game?.turn);
  });

  test('a refused action toasts the reason and changes nothing', () => {
    const started = run(initialApp, startThree, { type: 'curtain/reveal' });
    const refused = run(started.app, { type: 'stay/click' });
    expect(refused.app.shell.game).toEqual(started.app.shell.game);
    expect(refused.effects).toContainEqual({
      type: 'toast',
      message: 'The deal comes first.',
      ms: null,
    });
  });

  test('Play again deals anew once the game is over; not before', () => {
    const started = run(initialApp, startThree, { type: 'curtain/reveal' });
    expect(run(started.app, { type: 'replay/click' }).app).toBe(started.app);
    const game = started.app.shell.game;
    if (game === null) throw new Error('no game');
    const over: App = {
      ...started.app,
      shell: {
        ...started.app.shell,
        game: { ...game, phase: { kind: 'gameOver', winner: 1 } },
        view: viewFor({ ...game, phase: { kind: 'gameOver', winner: 1 } }, 0),
      },
    };
    const again = run(over, { type: 'replay/click' });
    expect(again.app.shell.game?.round).toBe(1);
    expect(again.app.shell.game?.phase.kind).toBe('turn');
  });
});

describe('online: the host holds the game, a guest sends its moves', () => {
  const game = createGame(['Ari', 'Lavi'], mulberry32(9), () => NOW);

  test('the host`s own move is applied and every seat is sent its view', () => {
    const moved = run(seated('host', game), { type: 'hit/click' });
    expect(moved.app.shell.game?.opening).toBe(1);
    expect(moved.effects.some((e) => e.type === 'send')).toBe(true);
  });

  test('the host refuses a move out of turn', () => {
    const refused = run(seated('host', { ...game, turn: 1 }), { type: 'hit/click' });
    expect(refused.effects).toContainEqual({ type: 'toast', message: 'Not your turn.', ms: null });
  });

  test('a guest sends its move as an action frame; between rounds it waits for the host to deal', () => {
    const sent = run(seated('guest', game, 1), { type: 'give/click', seat: 0 });
    expect(sent.effects).toContainEqual({
      type: 'send',
      frame: { t: 'action', action: { type: 'give', seat: 0 } },
    });
    const between = run(seated('guest', { ...game, phase: { kind: 'roundOver' } }, 1), {
      type: 'nextRound/click',
    });
    expect(between.effects).toContainEqual({
      type: 'toast',
      message: waitingToDealMsg('Ari'),
      ms: null,
    });
    const offline = run(
      {
        ...seated('guest', game, 1),
        shell: { ...seated('guest', game, 1).shell, oppConnected: false },
      },
      { type: 'hit/click' },
    );
    expect(offline.effects.some((e) => e.type === 'toast')).toBe(true);
  });
});

describe('the table`s own controls', () => {
  test('the seat count, the extra names, the rules and the recent games sheets', () => {
    const set = run(initialApp, { type: 'opts/set', raw: { players: '5' } });
    expect(set.app.shell.opts).toEqual({ seatCount: 5 });
    expect(set.effects).toEqual([{ type: 'writeOpts', opts: { seatCount: 5 } }]);
    const named = run(initialApp, { type: 'pname/typed', seat: 3, value: 'Grant' });
    expect(named.app.table.extraNames[3]).toBe('Grant');
    expect(
      run(named.app, { type: 'pname/typed', seat: 3, value: '' }).app.table.extraNames[3],
    ).toBeNull();
    const rules = run(initialApp, { type: 'rules/open' });
    expect(rules.app.shell.rulesOpen).toBe(true);
    expect(run(rules.app, { type: 'escape' }).app.shell.rulesOpen).toBe(false);
    expect(run(rules.app, { type: 'rules/close' }).app.shell.rulesOpen).toBe(false);
    const history = run(initialApp, { type: 'history/open' });
    expect(history.app.table.historyOpen).toBe(true);
    expect(run(history.app, { type: 'escape' }).app.table.historyOpen).toBe(false);
    expect(run(history.app, { type: 'history/close' }).app.table.historyOpen).toBe(false);
  });

  test('the resume labels and the name list', () => {
    const game = createGame(['Ari', 'Lavi', 'Sandro'], mulberry32(2), () => NOW);
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ari, Lavi and Sandro');
    const two = createGame(['Ann', 'Bob'], mulberry32(2), () => NOW);
    expect(resumeLabel({ kind: 'local', game: two })).toBe('Resume pass & play: Ann vs Bob');
    const host = {
      kind: 'host',
      code: 'ABCD',
      myName: 'Ann',
      seatCount: 2,
      game: two,
      oppName: 'Bob',
      at: null,
    } as const;
    expect(resumeLabel({ ...host, handoff: true })).toBe(
      'Continue online: Ann hosts, Bob joins by invite',
    );
    expect(resumeLabel({ ...host, handoff: false })).toBe('Resume hosting room ABCD');
    expect(resumeLabel({ kind: 'guest', code: 'ABCD', myName: 'Lavi' })).toBe('Rejoin room ABCD');
    expect(listNames(['Ari'])).toBe('Ari');
    expect(FLIP7.result.scoreOf(viewFor(game, 0))).toBe('0–0–0');
  });

  test('the two effects of its own write the seat count and an extra name', () => {
    const map = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    };
    const deps = { store: createStore(storage) } as unknown as EffectDeps;
    runEffect(initialApp, { type: 'writeOpts', opts: { seatCount: 4 } }, deps);
    runEffect(initialApp, { type: 'rememberPName', seat: 2, name: 'Sandro' }, deps);
    expect(map.get(STORAGE_KEYS.players)).toBe('4');
    expect(map.get(STORAGE_KEYS.p3Name)).toBe('Sandro');
  });
});

describe('what the boot and the sessions read back', () => {
  test('the contexts, the home read and its apply, my turn, and a position loaded on the phone', () => {
    const game = createGame(['Ari', 'Lavi'], mulberry32(4), () => NOW);
    const host = seated('host', game);
    expect(hostContextOf(host)).toMatchObject({
      code: 'ABCD',
      seatCount: 2,
      seats: host.shell.seats,
    });
    expect(guestContextOf(seated('guest', game, 1))).toMatchObject({ code: 'ABCD' });
    expect(myTurn(host)).toBe(true);
    expect(myTurn(seated('guest', game, 1))).toBe(false);
    const map = new Map<string, string>([
      [STORAGE_KEYS.players, '4'],
      [STORAGE_KEYS.p5Name, 'Noa'],
    ]);
    const store = createStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    });
    const home = readHome(store);
    expect(home.opts).toEqual({ seatCount: 4 });
    expect(home.extraNames).toEqual({ ...NO_EXTRA_NAMES, 4: 'Noa' });
    const applied = FLIP7.home.apply(initialApp, home);
    expect(applied.shell.opts).toEqual({ seatCount: 4 });
    expect(applied.table.extraNames[4]).toBe('Noa');
    // The resume box is the shell's off the save: none saved, none offered.
    expect(run(initialApp, { type: 'home/init', home }).app.shell.resume).toBeNull();
    const started = run(initialApp, startThree, { type: 'curtain/reveal' });
    const loaded = run(started.app, {
      type: 'position/load',
      state: JSON.parse(JSON.stringify(game)),
    });
    expect(loaded.app.shell.game?.seats.map((s) => s.name)).toEqual(['Ari', 'Lavi']);
    expect(loaded.app.table.curtain).toBeNull();
    expect(FLIP7.local.revealer(game).seat).toBe(0);
    expect(FLIP7.table.reset(started.app.table, 'leave').extraNames).toEqual(
      started.app.table.extraNames,
    );
    expect(FLIP7.table.reset(started.app.table, 'view')).toBe(started.app.table);
  });

  test('a flip, a bust and a Flip 7 each cue once; a repaint cues nothing', () => {
    const base = createGame(['Ari', 'Lavi'], mulberry32(4), () => NOW);
    const num = (value: number, n = 1) =>
      ({ id: `n${String(value)}-${String(n)}`, kind: 'number', value }) as const;
    const dealt: State = { ...base, opening: 0, turn: 0 };
    const at = (game: State): App => ({
      ...seated('host', game),
      shell: { ...seated('host', game).shell, cues: { key: null } },
    });
    const lined = (
      line: ReadonlyArray<ReturnType<typeof num>>,
      status: 'active' | 'busted' | 'flip7' = 'active',
    ): State => ({
      ...dealt,
      seats: dealt.seats.map((s, i) => (i === 0 ? { ...s, line, status } : s)),
    });
    const cuesOf = (prev: State, next: State): ReadonlyArray<unknown> =>
      FLIP7.table
        .rendered(at(next), viewFor(prev, 0), ctx)
        .effects.filter((e) => e.type === 'fx')
        .map((e) => (e as { cue: string }).cue);
    expect(cuesOf(dealt, lined([num(5)]))).toEqual(['flip']);
    expect(cuesOf(lined([num(5)]), lined([num(5), num(5, 2)], 'busted'))).toEqual(['flip', 'bust']);
    const six = lined([1, 2, 3, 4, 5, 6].map((v) => num(v)));
    const seven = {
      ...lined(
        [1, 2, 3, 4, 5, 6, 7].map((v) => num(v)),
        'flip7',
      ),
      phase: { kind: 'roundOver' },
    } as const;
    expect(cuesOf(six, seven)).toEqual(['flip', 'flip7', 'roundOver']);
    // The position is remembered: the same view painted again plays nothing.
    const once = FLIP7.table.rendered(at(lined([num(5)])), viewFor(dealt, 0), ctx);
    expect(once.app.shell.cues.key).not.toBeNull();
    expect(FLIP7.table.rendered(once.app, viewFor(dealt, 0), ctx).effects).toEqual([]);
  });

  test('the game`s end plays the win online, once', () => {
    const game = createGame(['Ari', 'Lavi'], mulberry32(4), () => NOW);
    const before = seated('host', game);
    const won = { ...game, phase: { kind: 'gameOver', winner: 0 } } as const;
    const after: App = { ...before, shell: { ...before.shell, game: won, view: viewFor(won, 0) } };
    const step = FLIP7.table.rendered(after, before.shell.view, ctx);
    expect(step.effects).toContainEqual({ type: 'fx', cue: 'win' });
    expect(FLIP7.table.rendered(after, after.shell.view, ctx).effects).toEqual([]);
    // A refusal is the shell's toast alone (nothing picked up to drop): the host's refusal at a guest.
    expect(
      run(seated('guest', game, 1), { type: 'guest/frame', frame: { t: 'toast', msg: 'No.' } })
        .effects,
    ).toEqual([{ type: 'toast', message: 'No.', ms: null }]);
  });
});

describe('the pause: what happened to a seat waits for its Continue', () => {
  const base = createGame(['Ari', 'Lavi', 'Sandro'], mulberry32(6), () => NOW);
  const five = { id: 'n5-1', kind: 'number', value: 5 } as const;
  const fiveAgain = { id: 'n5-2', kind: 'number', value: 5 } as const;
  const nine = { id: 'n9-1', kind: 'number', value: 9 } as const;
  const before: State = {
    ...base,
    opening: 0,
    turn: 0,
    seats: base.seats.map((s, i) => (i === 0 ? { ...s, line: [five, nine] } : s)),
    draw: [...base.draw, fiveAgain],
  };

  test('a bust on one phone: the card and the points lost, Hit and Stay held until Continue', () => {
    const local: App = {
      ...initialApp,
      shell: {
        ...initialApp.shell,
        role: 'local',
        game: before,
        view: viewFor(before, 0),
        revealed: 0,
        screen: 'tableScreen',
      },
    };
    const busted = run(local, { type: 'hit/click' });
    expect(busted.app.shell.game?.seats[0]?.status).toBe('busted');
    expect(busted.app.table.pause).toEqual({
      seat: 0,
      kind: 'bust',
      title: 'Ari busts',
      detail: 'Another 5: 14 points lost this round.',
    });
    expect(myTurn(busted.app)).toBe(false);
    // Nothing moves while the pause is up.
    expect(run(busted.app, { type: 'hit/click' }).app).toBe(busted.app);
    const on = run(busted.app, { type: 'continue/click' });
    expect(on.app.table.pause).toBeNull();
    expect(myTurn(on.app)).toBe(true);
  });

  test('online the pause is this phone`s own seat`s alone; a cold paint raises none', () => {
    const after = {
      ...before,
      seats: before.seats.map((s, i) => (i === 1 ? ({ ...s, status: 'frozen' } as const) : s)),
    };
    expect(pauseFor(false, viewFor(before, 0), viewFor(after, 0))).toBeNull();
    expect(pauseFor(false, viewFor(before, 1), viewFor(after, 1))).toMatchObject({
      kind: 'frozen',
      title: 'You are frozen',
    });
    expect(pauseFor(true, null, viewFor(after, 1))).toBeNull();
    const flipped = {
      ...before,
      seats: before.seats.map((s, i) => (i === 2 ? ({ ...s, status: 'flip7' } as const) : s)),
    };
    expect(pauseFor(true, viewFor(before, 0), viewFor(flipped, 0))).toMatchObject({
      seat: 2,
      kind: 'flip7',
      title: 'Sandro flips 7!',
    });
  });

  test('the seat count: two to twelve off either stepper; anything else keeps the count', () => {
    const twelve = run(initialApp, { type: 'opts/set', raw: { localPlayers: '12' } });
    expect(twelve.app.shell.opts).toEqual({ seatCount: 12 });
    expect(run(twelve.app, { type: 'opts/set', raw: { players: '13' } }).app.shell.opts).toEqual({
      seatCount: 12,
    });
  });
});
