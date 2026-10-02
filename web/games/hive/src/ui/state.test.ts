import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { ORIGIN } from '../engine/hex.ts';
import {
  cuesBetween,
  handoffLabel,
  initialApp,
  placeableNow,
  reachable,
  reduce,
  resumeLabel,
  viewOf,
  type App,
  type Intent,
} from './state.ts';

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
    expect(over.table.resultSeen).toBe(false);
    const seen = run(over, { type: 'result/continue' }).app;
    expect(seen.table.resultSeen).toBe(true);
    const again = run(seen, { type: 'act', action: { type: 'again' } }).app;
    expect(again.shell.game?.game.board).toEqual({});
    expect(again.table.resultSeen).toBe(false);
    expect(again.table.curtain).toBeNull();
    expect(viewOf(again)?.seat).toBe(0);
  });

  test('the sheets and Escape', () => {
    const app = started();
    expect(run(app, { type: 'rules/open' }).app.shell.rulesOpen).toBe(true);
    expect(run(app, { type: 'rules/open' }, { type: 'escape' }).app.shell.rulesOpen).toBe(false);
    expect(run(app, { type: 'history/open' }).app.table.historyOpen).toBe(true);
    expect(
      run(app, { type: 'history/open' }, { type: 'history/close' }).app.table.historyOpen,
    ).toBe(false);
    expect(run(app, { type: 'history/open' }, { type: 'escape' }).app.table.historyOpen).toBe(
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
    expect(handoffLabel(game)).toBe('Continue online: Ann hosts, Bob joins by invite');
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
