import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { createStore, type StorageLike } from '../../../../shared/edge/storage.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { ORIGIN, keyOf, sameHex, type Hex } from '../engine/hex.ts';
import {
  cuesBetween,
  initialApp,
  intentOf,
  moveHop,
  placeableNow,
  reachable,
  readHome,
  reduce,
  namesOf,
  type Resume,
  runEffect,
  viewOf,
  type App,
  type Intent,
  type Hive,
} from './state.ts';
import type { ShellEffectDeps } from '../../../../shared/ui/shellEffects.ts';
import { handoffLabel, resumeLabel as sharedResumeLabel } from '../../../../shared/lib/name.ts';

/** The shell's effect adapters over this game's bag (the game spells no alias of its own since dry-review-2026-10.md §7 row 3). */
type EffectDeps = ShellEffectDeps<Hive>;

/** The shell's resume label over this game's seats (web/shared/lib/name.ts). */
const resumeLabel = (resume: Resume): string => sharedResumeLabel(resume, namesOf);

const fakeStorage = (): StorageLike => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
};

const ctx = { rng: mulberry32(7), now: () => NOW };
const run = runIntents(reduce, ctx);

const localClick: Intent = { type: 'local/click', p1: 'Ann', p2: 'Bob' };

/** A pass-and-play table: White's view, on show at once (no curtain). */
const started = (): App => run(initialApp, localClick).app;

describe('pass and play', () => {
  test('the start: White first with the board on show, no curtain, the names defaulted when empty', () => {
    const s = run(initialApp, localClick);
    expect(s.app.shell.role).toBe('local');
    expect(s.app.shell.game?.game.names).toEqual({ white: 'Ann', black: 'Bob' });
    expect(s.app.shell.screen).toBe('tableScreen');
    // The owner (2026-10-02): "hive is like backgammon, where you don't need to pass the phone for turns."
    expect(s.app.table.curtain).toBeNull();
    expect(viewOf(s.app)?.seat).toBe(0);
    const defaults = run(initialApp, { type: 'local/click', p1: '', p2: '' });
    expect(defaults.app.shell.game?.game.names).toEqual({ white: 'Ari', black: 'Lavi' });
  });

  test('a hand tile picked lights its placements; a tap on one places and the view changes hands, no curtain', () => {
    const app = started();
    expect(app.table.curtain).toBeNull();
    const view = viewOf(app);
    if (view === null) throw new Error('no view');
    expect(placeableNow(view).size).toBe(5);
    const picked = run(app, { type: 'pick/hand', bug: 'ant' }).app;
    expect(picked.table.picked).toEqual({ kind: 'hand', bug: 'ant' });
    expect(reachable(view, picked.table.picked)).toEqual([ORIGIN]);
    // The same tile again clears the pick; a bug not playable now is not picked.
    expect(run(picked, { type: 'pick/hand', bug: 'ant' }).app.table.picked).toBeNull();
    const placed = run(picked, { type: 'tap/hex', hex: ORIGIN });
    expect(placed.app.shell.game?.game.board['0,0']).toEqual([{ side: 'white', bug: 'ant' }]);
    expect(placed.app.table.picked).toBeNull();
    expect(placed.app.table.curtain).toBeNull();
    expect(viewOf(placed.app)?.seat).toBe(1);
    expect(placed.effects.map((e) => e.type)).toContain('fx');
  });

  test('a tap off the lit hexes clears the pick; a tap on my movable tile picks it', () => {
    const app = started();
    const stray = run(
      app,
      { type: 'pick/hand', bug: 'queen' },
      { type: 'tap/hex', hex: { q: 3, r: 3 } },
    );
    expect(stray.app.table.picked).toBeNull();
    expect(stray.app.shell.game?.game.board).toEqual({});
    // Black's Queen down and White's Queen down: White may move her.
    const moved = run(
      app,
      { type: 'act', action: { type: 'place', bug: 'queen', to: ORIGIN } },
      { type: 'act', action: { type: 'place', bug: 'queen', to: { q: 1, r: 0 } } },
    ).app;
    const view = viewOf(moved);
    if (view === null) throw new Error('no view');
    expect(view.seat).toBe(0);
    expect(view.movable.map((m) => m.from)).toEqual([ORIGIN]);
    const picked = run(moved, { type: 'tap/hex', hex: ORIGIN }).app;
    expect(picked.table.picked).toEqual({ kind: 'hex', hex: ORIGIN });
    const to = reachable(view, picked.table.picked)[0];
    if (to === undefined) throw new Error('no move');
    const done = run(picked, { type: 'tap/hex', hex: to }).app;
    expect(done.shell.game?.game.board['0,0']).toBeUndefined();
    expect(done.table.curtain).toBeNull();
    expect(viewOf(done)?.seat).toBe(1);
  });

  test('a refused action toasts and drops the pick; the result sheet, Continue and Play again', () => {
    const app = started();
    const refused = run(
      app,
      { type: 'pick/hand', bug: 'ant' },
      { type: 'act', action: { type: 'pass' } },
    );
    expect(refused.effects.map((e) => e.type)).toContain('toast');
    expect(refused.app.table.picked).toBeNull();
    const over = run(app, { type: 'act', action: { type: 'resign' } }).app;
    expect(over.shell.game?.game.result).toEqual({ kind: 'win', winner: 'black', by: 'resign' });
    expect(over.table.curtain).toBeNull();
    expect(over.shell.resultDismissed).toBe(false);
    const seen = run(over, { type: 'result/dismiss' }).app;
    expect(seen.shell.resultDismissed).toBe(true);
    const again = run(seen, { type: 'again/click' }).app;
    expect(again.shell.game?.game.board).toEqual({});
    expect(again.shell.resultDismissed).toBe(false);
    expect(again.table.curtain).toBeNull();
    expect(viewOf(again)?.seat).toBe(0);
  });

  test('the sheets and Escape', () => {
    const app = started();
    expect(run(app, { type: 'rules/open' }).app.shell.rulesOpen).toBe(true);
    expect(run(app, { type: 'rules/open' }, { type: 'escape' }).app.shell.rulesOpen).toBe(false);
    expect(run(app, { type: 'history/open' }).app.shell.historyOpen).toBe(true);
    expect(
      run(app, { type: 'history/open' }, { type: 'history/close' }).app.shell.historyOpen,
    ).toBe(false);
    expect(run(app, { type: 'history/open' }, { type: 'escape' }).app.shell.historyOpen).toBe(
      false,
    );
    expect(
      run(app, { type: 'pick/hand', bug: 'ant' }, { type: 'escape' }).app.table.picked,
    ).toBeNull();
    expect(
      run(app, { type: 'pick/hand', bug: 'ant' }, { type: 'pick/clear' }).app.table.picked,
    ).toBeNull();
  });

  test('the labels and the cues', () => {
    const app = started();
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    expect(handoffLabel(namesOf(game))).toBe('Continue online: Ann hosts, Bob joins by invite');
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ann vs Bob');
    expect(resumeLabel({ kind: 'host', code: 'KQZM', handoff: false, game: null } as never)).toBe(
      'Resume hosting room KQZM',
    );
    expect(resumeLabel({ kind: 'guest', code: 'KQZM' } as never)).toBe('Rejoin room KQZM');
    const before = viewOf(app);
    const placed = run(app, { type: 'act', action: { type: 'place', bug: 'ant', to: ORIGIN } }).app;
    const after = viewOf(placed);
    if (before === null || after === null) throw new Error('no view');
    expect(cuesBetween(before, after)).toEqual(['place']);
    const resigned = viewOf(run(app, { type: 'act', action: { type: 'resign' } }).app);
    if (resigned === null) throw new Error('no view');
    expect(cuesBetween(before, resigned)).toEqual(['lose']);
  });
});

describe('a tile dragged by hand (ui/dragger.ts)', () => {
  const lift: Intent = { type: 'drag/start', picked: { kind: 'hand', bug: 'ant' } };

  test('drag/start picks the tile up (its hexes light) and the drag stands; a tile not mine to lift is nothing', () => {
    const app = started();
    const lifted = run(app, lift).app;
    expect(lifted.table.picked).toEqual({ kind: 'hand', bug: 'ant' });
    expect(lifted.table.drag).toEqual({ over: null });
    // Nothing on the board yet: no board tile can be lifted.
    const still = run(app, { type: 'drag/start', picked: { kind: 'hex', hex: ORIGIN } }).app;
    expect(still.table.drag).toBeNull();
    expect(still.table.picked).toBeNull();
  });

  test('drag/over holds a reachable hex once; an unreachable one is none; the click a release fires is nothing while the drag stands', () => {
    const lifted = run(started(), lift).app;
    const over = run(lifted, { type: 'drag/over', hex: ORIGIN }).app;
    expect(over.table.drag).toEqual({ over: ORIGIN });
    // The same hex again: the same App (no repaint).
    expect(run(over, { type: 'drag/over', hex: { q: 0, r: 0 } }).app).toBe(over);
    expect(run(over, { type: 'drag/over', hex: { q: 3, r: 3 } }).app.table.drag).toEqual({
      over: null,
    });
    // The board's click, the tray's click, the stray click: all ignored under a drag.
    expect(run(over, { type: 'pick/clear' }).app).toBe(over);
    expect(run(over, { type: 'tap/hex', hex: ORIGIN }).app).toBe(over);
    expect(run(over, { type: 'pick/hand', bug: 'queen' }).app).toBe(over);
  });

  test('drag/end over a lit hex plays the tile there (the tap cue, the view changes hands); off every hex it drops the pick', () => {
    const lifted = run(started(), lift).app;
    const over = run(lifted, { type: 'drag/over', hex: ORIGIN }).app;
    const played = run(over, { type: 'drag/end' });
    expect(played.app.shell.game?.game.board['0,0']).toEqual([{ side: 'white', bug: 'ant' }]);
    expect(played.app.table.picked).toBeNull();
    expect(played.app.table.drag).toBeNull();
    expect(viewOf(played.app)?.seat).toBe(1);
    expect(played.effects.map((e) => e.type)).toContain('fx');
    const dropped = run(lifted, { type: 'drag/end' }).app;
    expect(dropped.table.picked).toBeNull();
    expect(dropped.table.drag).toBeNull();
    expect(dropped.shell.game?.game.board).toEqual({});
  });

  test('a board tile dragged: my Queen lifted off the origin, dropped on a hex she may step to, moves', () => {
    const app = run(
      started(),
      { type: 'act', action: { type: 'place', bug: 'queen', to: ORIGIN } },
      { type: 'act', action: { type: 'place', bug: 'queen', to: { q: 1, r: 0 } } },
    ).app;
    const view = viewOf(app);
    if (view === null) throw new Error('no view');
    const lifted = run(app, { type: 'drag/start', picked: { kind: 'hex', hex: ORIGIN } }).app;
    expect(lifted.table.picked).toEqual({ kind: 'hex', hex: ORIGIN });
    const to = reachable(view, lifted.table.picked)[0];
    if (to === undefined) throw new Error('the Queen has no step');
    const moved = run(lifted, { type: 'drag/over', hex: to }, { type: 'drag/end' }).app;
    const board = moved.shell.game?.game.board ?? {};
    expect(board['0,0']).toBeUndefined();
    expect(board[`${String(to.q)},${String(to.r)}`]).toEqual([{ side: 'white', bug: 'queen' }]);
    expect(moved.table.drag).toBeNull();
  });
});

describe("the Spider's 1-2-3 (the owner: it must show when the Spider moves)", () => {
  const h = (q: number, r: number): Hex => ({ q, r });
  const SPIDER = h(-1, 0);
  /** Both Queens down, White's Spider a leaf at (-1,0), White to move. */
  const placed = (): App =>
    run(
      started(),
      { type: 'act', action: { type: 'place', bug: 'queen', to: ORIGIN } },
      { type: 'act', action: { type: 'place', bug: 'queen', to: h(1, 0) } },
      { type: 'act', action: { type: 'place', bug: 'spider', to: SPIDER } },
      { type: 'act', action: { type: 'place', bug: 'ant', to: h(2, 0) } },
    ).app;

  test('an aim is held while it changes and dropped with the pick; the same aim again is no change', () => {
    const app = placed();
    const picked = run(app, { type: 'tap/hex', hex: SPIDER }).app;
    expect(picked.table.picked).toEqual({ kind: 'hex', hex: SPIDER });
    const view = viewOf(picked);
    if (view === null) throw new Error('no view');
    const to = reachable(view, picked.table.picked)[0];
    if (to === undefined) throw new Error('no move');
    const aimed = run(picked, { type: 'aim/hex', hex: to }).app;
    expect(aimed.table.aim).toEqual(to);
    expect(run(aimed, { type: 'aim/hex', hex: to }).app).toBe(aimed);
    expect(run(aimed, { type: 'aim/hex', hex: null }).app.table.aim).toBeNull();
    expect(run(aimed, { type: 'pick/clear' }).app.table.aim).toBeNull();
    expect(run(aimed, { type: 'escape' }).app.table.aim).toBeNull();
    expect(run(aimed, { type: 'tap/hex', hex: SPIDER }).app.table.aim).toBeNull();
    expect(run(app, { type: 'aim/hex', hex: null }).app).toBe(app);
  });

  test('a Spider’s move lands as a hop: its three hexes, keyed on the position; the Ant’s next move hops its own way', () => {
    const app = placed();
    const picked = run(app, { type: 'tap/hex', hex: SPIDER }).app;
    const view = viewOf(picked);
    if (view === null) throw new Error('no view');
    const to = reachable(view, picked.table.picked)[0];
    if (to === undefined) throw new Error('no move');
    const landed = run(picked, { type: 'aim/hex', hex: to }, { type: 'tap/hex', hex: to }).app;
    const hop = landed.table.hop;
    if (hop === null) throw new Error('no hop');
    expect(hop.from).toEqual(SPIDER);
    expect(hop.path).toHaveLength(3);
    expect(sameHex(hop.path[2] ?? ORIGIN, to)).toBe(true);
    expect(hop.reduced).toBe(false);
    expect(landed.table.aim).toBeNull();
    expect(landed.table.picked).toBeNull();
    // The hop stays on the position (a later paint keys on it) and goes with the next one.
    expect(run(landed, { type: 'pick/clear' }).app.table.hop).toBe(hop);
    const blackView = viewOf(landed);
    if (blackView === null) throw new Error('no view');
    const ant = blackView.movable.find((m) => sameHex(m.from, h(2, 0)));
    const antTo = ant?.to[0];
    if (antTo === undefined) throw new Error('the Ant cannot move');
    const antMoved = run(
      landed,
      { type: 'tap/hex', hex: h(2, 0) },
      { type: 'tap/hex', hex: antTo },
    ).app;
    expect(antMoved.table.hop).toMatchObject({ bug: 'ant', from: h(2, 0) });
    expect(antMoved.table.hop?.path[antMoved.table.hop.path.length - 1]).toEqual(antTo);
    expect(antMoved.table.hop?.key).not.toBe(hop.key);
    // Under reduced motion the hop says so: the tile snaps.
    const reduced = runIntents(reduce, { ...ctx, reducedMotion: true })(picked, {
      type: 'tap/hex',
      hex: to,
    }).app;
    expect(reduced.table.hop?.reduced).toBe(true);
    expect(reduced.table.hop?.path).toEqual(hop.path);
  });

  test('moveHop reads the move off two views: the stack shortened, the one grown, and the way between', () => {
    const app = placed();
    const before = viewOf(app);
    if (before === null) throw new Error('no view');
    const to = before.movable.find((m) => sameHex(m.from, SPIDER))?.to[0];
    if (to === undefined) throw new Error('no move');
    const after = viewOf(run(app, { type: 'act', action: { type: 'move', from: SPIDER, to } }).app);
    if (after === null) throw new Error('no view');
    const hop = moveHop(before, after);
    expect(hop).toMatchObject({ bug: 'spider', side: 'white', from: SPIDER });
    expect(hop?.path).toHaveLength(3);
    expect(hop?.path.map(keyOf)).toContain(keyOf(to));
    expect(moveHop(before, before)).toBeNull();
    // A placement: the tray is its origin (no `from`), its way its hex alone.
    const placedMore = viewOf(
      run(app, { type: 'act', action: { type: 'place', bug: 'ant', to: h(-2, 1) } }).app,
    );
    if (placedMore === null) throw new Error('no view');
    expect(moveHop(before, placedMore)).toEqual({
      bug: 'ant',
      side: 'white',
      from: null,
      path: [h(-2, 1)],
    });
    // A resignation changes no stack: nothing hops.
    const resigned = viewOf(run(app, { type: 'act', action: { type: 'resign' } }).app);
    if (resigned === null) throw new Error('no view');
    expect(moveHop(before, resigned)).toBeNull();
  });
});

describe("every tile crawls (the owner: 'have them move in little jumps'), unless the player snaps them", () => {
  const h = (q: number, r: number): Hex => ({ q, r });
  /** Both Queens down, White's Ant a leaf at (-1,0), White to move. */
  const placed = (): App =>
    run(
      started(),
      { type: 'act', action: { type: 'place', bug: 'queen', to: ORIGIN } },
      { type: 'act', action: { type: 'place', bug: 'queen', to: h(1, 0) } },
      { type: 'act', action: { type: 'place', bug: 'ant', to: h(-1, 0) } },
      { type: 'act', action: { type: 'place', bug: 'spider', to: h(2, 0) } },
    ).app;

  test('a placement lands as a hop from the tray; an Ant’s move as one hop a hex of its way', () => {
    const start = run(started(), {
      type: 'act',
      action: { type: 'place', bug: 'queen', to: ORIGIN },
    }).app;
    expect(start.table.hop).toMatchObject({
      bug: 'queen',
      side: 'white',
      from: null,
      path: [ORIGIN],
      reduced: false,
    });
    const app = placed();
    const view = viewOf(app);
    if (view === null) throw new Error('no view');
    const far = view.movable.find((m) => sameHex(m.from, h(-1, 0)))?.to.find((x) => x.q > 1);
    if (far === undefined) throw new Error('the Ant cannot slide far');
    const moved = run(app, { type: 'act', action: { type: 'move', from: h(-1, 0), to: far } }).app;
    const hop = moved.table.hop;
    if (hop === null) throw new Error('no hop');
    expect(hop.bug).toBe('ant');
    expect(hop.from).toEqual(h(-1, 0));
    expect(hop.path.length).toBeGreaterThan(1);
    expect(hop.path[hop.path.length - 1]).toEqual(far);
    expect(hop.reduced).toBe(false);
  });

  test('the motion setting: crawl by default, read at boot from the device, toggled with a write, kept through a start and a leave', () => {
    expect(initialApp.table.motion).toBe('crawl');
    const home = readHome(createStore(fakeStorage()));
    expect(home.motion).toBe('crawl');
    const booted = run(initialApp, { type: 'home/init', home: { ...home, motion: 'snap' } }).app;
    expect(booted.table.motion).toBe('snap');
    const startedSnap = run(booted, localClick).app;
    expect(startedSnap.table.motion).toBe('snap');
    const toggled = run(startedSnap, { type: 'motion/toggle' });
    expect(toggled.app.table.motion).toBe('crawl');
    expect(toggled.effects).toEqual([{ type: 'motion/write', motion: 'crawl' }]);
    const back = run(toggled.app, { type: 'motion/toggle' });
    expect(back.app.table.motion).toBe('snap');
    expect(back.effects).toEqual([{ type: 'motion/write', motion: 'snap' }]);
    const left = run(back.app, { type: 'leave/confirmed' }, { type: 'leave/finish' }).app;
    expect(left.table.motion).toBe('snap');
    expect(left.table.hop).toBeNull();
  });

  test('under snap (or reduced motion) a hop says so, and the paint carries nothing', () => {
    const app = placed();
    const snapped = run(app, { type: 'motion/toggle' }).app;
    const landed = run(snapped, {
      type: 'act',
      action: { type: 'place', bug: 'beetle', to: h(-2, 1) },
    }).app;
    expect(landed.table.hop?.reduced).toBe(true);
    const reduced = runIntents(reduce, { ...ctx, reducedMotion: true })(app, {
      type: 'act',
      action: { type: 'place', bug: 'beetle', to: h(-2, 1) },
    }).app;
    expect(reduced.table.hop?.reduced).toBe(true);
  });

  test('the write effect reaches the store through runEffect', () => {
    const store = createStore(fakeStorage());
    runEffect(initialApp, { type: 'motion/write', motion: 'snap' }, {
      store,
    } as unknown as EffectDeps);
    expect(store.readText('hive_motion')).toEqual({ ok: true, value: 'snap' });
    expect(readHome(store).motion).toBe('snap');
  });
});

describe('the peek at a stack', () => {
  /** A table where Black's Beetle stands on White's Ant at the origin (through `position/load`), White to move. */
  const climbed = (): App => {
    const app = started();
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    const board = {
      '0,0': [
        { side: 'white', bug: 'ant' },
        { side: 'black', bug: 'beetle' },
      ],
      '1,0': [{ side: 'white', bug: 'queen' }],
      '-1,0': [{ side: 'black', bug: 'queen' }],
    };
    const hands = {
      white: { ...game.game.hands.white, ant: 2, queen: 0 },
      black: { ...game.game.hands.black, beetle: 1, queen: 0 },
    };
    return run(app, {
      type: 'position/load',
      state: { ...game, game: { ...game.game, board, hands, turns: { white: 2, black: 2 } } },
    }).app;
  };

  test('opens on a stacked hex only, the same hex again is no change, and closes', () => {
    const app = climbed();
    expect(app.table.peek).toBeNull();
    expect(run(app, { type: 'peek/open', hex: { q: 1, r: 0 } }).app).toBe(app);
    expect(run(app, { type: 'peek/open', hex: { q: 5, r: 5 } }).app).toBe(app);
    const open = run(app, { type: 'peek/open', hex: ORIGIN }).app;
    expect(open.table.peek).toEqual(ORIGIN);
    expect(run(open, { type: 'peek/open', hex: ORIGIN }).app).toBe(open);
    expect(run(open, { type: 'peek/close' }).app.table.peek).toBeNull();
    expect(run(app, { type: 'peek/close' }).app).toBe(app);
  });

  test('a dismissal sticks while the pointer rests on the badge: Escape then the same hover does not reopen; leaving, another badge or a tap does', () => {
    const open = run(climbed(), { type: 'peek/hover', hex: ORIGIN }).app;
    expect(open.table.peek).toEqual(ORIGIN);
    const shut = run(open, { type: 'escape' }).app;
    expect(shut.table.peek).toBeNull();
    expect(shut.table.peekShut).toEqual(ORIGIN);
    // The repaint put a fresh badge under the pointer: its pointerover is nothing.
    expect(run(shut, { type: 'peek/hover', hex: ORIGIN }).app).toBe(shut);
    // A tap on it reopens.
    expect(run(shut, { type: 'peek/open', hex: ORIGIN }).app.table).toMatchObject({
      peek: ORIGIN,
      peekShut: null,
    });
    // The pointer leaving spends the dismissal: the next hover opens.
    const left = run(shut, { type: 'peek/close' }).app;
    expect(left.table.peekShut).toBeNull();
    expect(run(left, { type: 'peek/hover', hex: ORIGIN }).app.table.peek).toEqual(ORIGIN);
    // A tap elsewhere dismisses the same way.
    const tapped = run(open, { type: 'tap/hex', hex: { q: 1, r: 0 } }).app;
    expect(tapped.table).toMatchObject({ peek: null, peekShut: ORIGIN });
    expect(run(tapped, { type: 'peek/hover', hex: ORIGIN }).app).toBe(tapped);
    // A new position forgets the dismissal.
    const placed = run(shut, {
      type: 'act',
      action: { type: 'place', bug: 'ant', to: { q: 2, r: 0 } },
    }).app;
    expect(placed.table.peekShut).toBeNull();
  });

  test('a pick, a tap elsewhere, Escape, a drag and a new position all close it', () => {
    const open = run(climbed(), { type: 'peek/open', hex: ORIGIN }).app;
    expect(run(open, { type: 'pick/hand', bug: 'ant' }).app.table.peek).toBeNull();
    expect(run(open, { type: 'tap/hex', hex: { q: 1, r: 0 } }).app.table.peek).toBeNull();
    expect(run(open, { type: 'pick/clear' }).app.table.peek).toBeNull();
    const escaped = run(open, { type: 'escape' }).app;
    expect(escaped.table.peek).toBeNull();
    expect(escaped.shell.rulesOpen).toBe(false);
    // Escape takes the peek first: a pick in hand stays.
    const pickedThenOpen = withPeek(run(open, { type: 'pick/hand', bug: 'ant' }).app);
    const esc = run(pickedThenOpen, { type: 'escape' }).app;
    expect(esc.table.peek).toBeNull();
    expect(esc.table.picked).toEqual({ kind: 'hand', bug: 'ant' });
    const dragged = run(open, { type: 'drag/start', picked: { kind: 'hand', bug: 'ant' } }).app;
    expect(dragged.table.drag).not.toBeNull();
    expect(dragged.table.peek).toBeNull();
    // A placement is a new position: the peek goes with it.
    const placed = run(open, {
      type: 'act',
      action: { type: 'place', bug: 'ant', to: { q: 2, r: 0 } },
    }).app;
    expect(Object.keys(placed.shell.game?.game.board ?? {})).toHaveLength(4);
    expect(placed.table.peek).toBeNull();
  });

  /** `app` with the origin's peek open, whatever else it holds. */
  const withPeek = (app: App): App => ({ ...app, table: { ...app.table, peek: ORIGIN } });
});

describe("the hints hidden (the owner: 'option to not show moves... click on the grid where you wanna put them and then confirm')", () => {
  const h = (q: number, r: number): Hex => ({ q, r });
  /** Both Queens down, White's Ant a leaf at (-1,0), White to move, the hints hidden. */
  const placed = (): App =>
    run(
      started(),
      { type: 'act', action: { type: 'place', bug: 'queen', to: ORIGIN } },
      { type: 'act', action: { type: 'place', bug: 'queen', to: h(1, 0) } },
      { type: 'act', action: { type: 'place', bug: 'ant', to: h(-1, 0) } },
      { type: 'act', action: { type: 'place', bug: 'spider', to: h(2, 0) } },
      { type: 'hints/toggle' },
    ).app;

  test('the hints setting: shown by default, read at boot, toggled with a write (the pick dropped), kept through a start and a leave', () => {
    expect(initialApp.table.hints).toBe('show');
    const store = createStore(fakeStorage());
    expect(readHome(store).hints).toBe('show');
    const home = readHome(store);
    const booted = run(initialApp, { type: 'home/init', home: { ...home, hints: 'hide' } }).app;
    expect(booted.table.hints).toBe('hide');
    expect(run(booted, localClick).app.table.hints).toBe('hide');
    const app = run(started(), { type: 'pick/hand', bug: 'ant' }).app;
    const toggled = run(app, { type: 'hints/toggle' });
    expect(toggled.app.table.hints).toBe('hide');
    expect(toggled.app.table.picked).toBeNull();
    expect(toggled.effects).toEqual([{ type: 'hints/write', hints: 'hide' }]);
    const left = run(toggled.app, { type: 'leave/confirmed' }, { type: 'leave/finish' }).app;
    expect(left.table.hints).toBe('hide');
    runEffect(initialApp, { type: 'hints/write', hints: 'hide' }, {
      store,
    } as unknown as EffectDeps);
    expect(store.readText('hive_hints')).toEqual({ ok: true, value: 'hide' });
    expect(readHome(store).hints).toBe('hide');
  });

  test('a tap anywhere proposes the pick there; a tap on the tile itself clears it; Cancel puts it back and drops the pick', () => {
    const app = placed();
    const picked = run(app, { type: 'tap/hex', hex: h(-1, 0) }).app;
    expect(picked.table.picked).toEqual({ kind: 'hex', hex: h(-1, 0) });
    expect(picked.table.proposal).toBeNull();
    // Onto a hex the Ant could never reach: proposed all the same, nothing played.
    const proposed = run(picked, { type: 'tap/hex', hex: h(1, 0) });
    expect(proposed.app.table.proposal).toEqual(h(1, 0));
    expect(proposed.app.table.picked).toEqual({ kind: 'hex', hex: h(-1, 0) });
    expect(proposed.effects).toEqual([]);
    expect(proposed.app.shell.game?.game.board['-1,0']).toEqual([{ side: 'white', bug: 'ant' }]);
    // Another hex: the proposal moves.
    const moved = run(proposed.app, { type: 'tap/hex', hex: h(-2, 1) }).app;
    expect(moved.table.proposal).toEqual(h(-2, 1));
    // Cancel: the tile hops back from the proposed hex to its own, the pick is gone.
    const cancelled = run(moved, { type: 'proposal/cancel' });
    expect(cancelled.app.table.proposal).toBeNull();
    expect(cancelled.app.table.picked).toBeNull();
    expect(cancelled.app.table.hop).toMatchObject({ bug: 'ant', from: h(-2, 1), path: [h(-1, 0)] });
    expect(cancelled.effects).toEqual([]);
    // Escape cancels a proposal the same way; the tile's own hex clears the pick.
    expect(run(moved, { type: 'escape' }).app.table.proposal).toBeNull();
    expect(run(picked, { type: 'tap/hex', hex: h(-1, 0) }).app.table.picked).toBeNull();
    // A hand tile proposed anywhere: no hop back (the tray is drawn back at once).
    const hand = run(app, { type: 'pick/hand', bug: 'beetle' }, { type: 'tap/hex', hex: h(3, 3) });
    expect(hand.app.table.proposal).toEqual(h(3, 3));
    const handBack = run(hand.app, { type: 'proposal/cancel' }).app;
    expect(handBack.table.proposal).toBeNull();
    expect(handBack.table.hop).toBe(app.table.hop);
  });

  test('Confirm on a legal proposal plays it; on a bad one the red toast names the rule, the tile goes back and the pick stays', () => {
    const app = placed();
    const view = viewOf(app);
    if (view === null) throw new Error('no view');
    const to = reachable(view, { kind: 'hex', hex: h(-1, 0) })[0];
    if (to === undefined) throw new Error('the Ant cannot move');
    const legal = run(
      app,
      { type: 'tap/hex', hex: h(-1, 0) },
      { type: 'tap/hex', hex: to },
      { type: 'proposal/confirm' },
    );
    expect(legal.app.shell.game?.game.board[keyOf(to)]).toEqual([{ side: 'white', bug: 'ant' }]);
    expect(legal.app.shell.game?.game.board['-1,0']).toBeUndefined();
    expect(legal.app.table.proposal).toBeNull();
    expect(legal.app.table.picked).toBeNull();
    expect(viewOf(legal.app)?.seat).toBe(1);
    expect(legal.effects.map((e) => e.type)).toContain('fx');
    // The Ant onto the Queen: a climb only the Beetle makes.
    const bad = run(
      app,
      { type: 'tap/hex', hex: h(-1, 0) },
      { type: 'tap/hex', hex: ORIGIN },
      { type: 'proposal/confirm' },
    );
    expect(bad.effects).toEqual([
      {
        type: 'toast',
        message: 'Only the Beetle may climb onto another tile.',
        ms: 4000,
        kind: 'error',
      },
    ]);
    expect(bad.app.shell.game?.game.board['-1,0']).toEqual([{ side: 'white', bug: 'ant' }]);
    expect(bad.app.shell.game?.game.turn).toBe('white');
    expect(bad.app.table.proposal).toBeNull();
    expect(bad.app.table.picked).toEqual({ kind: 'hex', hex: h(-1, 0) });
    expect(bad.app.table.hop).toMatchObject({
      bug: 'ant',
      from: ORIGIN,
      path: [h(-1, 0)],
      reduced: false,
    });
    // A second try from the kept pick: proposed and confirmed where it may go.
    const again = run(bad.app, { type: 'tap/hex', hex: to }, { type: 'proposal/confirm' }).app;
    expect(again.shell.game?.game.board[keyOf(to)]).toEqual([{ side: 'white', bug: 'ant' }]);
    // A hand tile on a taken hex: the reason, the pick kept, no hop (the tray tile is simply back).
    const taken = run(
      app,
      { type: 'pick/hand', bug: 'beetle' },
      { type: 'tap/hex', hex: h(1, 0) },
      { type: 'proposal/confirm' },
    );
    expect(taken.effects.map((e) => (e.type === 'toast' ? e.message : e.type))).toEqual([
      'That hex is taken.',
    ]);
    expect(taken.app.table.picked).toEqual({ kind: 'hand', bug: 'beetle' });
    expect(taken.app.table.hop).toBe(app.table.hop);
    // Under snap the hop back says so.
    const snapped = run(
      run(app, { type: 'motion/toggle' }).app,
      { type: 'tap/hex', hex: h(-1, 0) },
      { type: 'tap/hex', hex: ORIGIN },
      { type: 'proposal/confirm' },
    ).app;
    expect(snapped.table.hop?.reduced).toBe(true);
    // Confirm with nothing proposed is nothing.
    expect(run(app, { type: 'proposal/confirm' })).toEqual({ app, effects: [] });
    expect(intentOf({ kind: 'hand', bug: 'ant' }, ORIGIN)).toEqual({
      type: 'place',
      bug: 'ant',
      to: ORIGIN,
    });
  });

  test('a drag with the hints hidden: any hex is over, a release on one proposes, off every one drops the pick', () => {
    const app = placed();
    const far = h(3, -2);
    const over = run(
      app,
      { type: 'drag/start', picked: { kind: 'hex', hex: h(-1, 0) } },
      { type: 'drag/over', hex: far },
    ).app;
    expect(over.table.drag).toEqual({ over: far });
    const dropped = run(over, { type: 'drag/end' }).app;
    expect(dropped.table.drag).toBeNull();
    expect(dropped.table.proposal).toEqual(far);
    expect(dropped.table.picked).toEqual({ kind: 'hex', hex: h(-1, 0) });
    const off = run(
      app,
      { type: 'drag/start', picked: { kind: 'hex', hex: h(-1, 0) } },
      { type: 'drag/over', hex: null },
      { type: 'drag/end' },
    ).app;
    expect(off.table.picked).toBeNull();
    expect(off.table.proposal).toBeNull();
    // Nothing lights: `reachable` is the engine's, the paint reads the hints (render.ts boardHtml).
    expect(over.table.hints).toBe('hide');
  });

  test('a fresh position drops a proposal; the other seat is told it is not its turn', () => {
    const app = placed();
    const proposed = run(
      app,
      { type: 'tap/hex', hex: h(-1, 0) },
      { type: 'tap/hex', hex: ORIGIN },
    ).app;
    const fresh = run(proposed, {
      type: 'act',
      action: { type: 'move', from: h(-1, 0), to: h(-2, 1) },
    }).app;
    expect(fresh.table.proposal).toBeNull();
    expect(fresh.table.picked).toBeNull();
    // A guest (seat 1) with a view on White's turn: its confirm is refused as out of turn.
    const view = viewOf(app);
    if (view === null) throw new Error('no view');
    const guest: App = {
      ...app,
      shell: { ...app.shell, role: 'guest', view: { ...view, seat: 1 } },
      table: { ...app.table, picked: { kind: 'hand', bug: 'beetle' }, proposal: h(3, 3) },
    };
    const refused = run(guest, { type: 'proposal/confirm' });
    expect(refused.effects).toEqual([
      { type: 'toast', message: 'Not your turn.', ms: 4000, kind: 'error' },
    ]);
    expect(refused.app.table.proposal).toBeNull();
  });
});
