import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { MAX_TURNS } from '../engine/engine.ts';
import {
  cuesBetween,
  handoffLabel,
  initialApp,
  pauseFor,
  reduce,
  resumeLabel,
  viewOf,
  type App,
  type Intent,
} from './state.ts';

const ctx = { rng: mulberry32(7), now: () => NOW };
const run = runIntents(reduce, ctx);

const localClick: Intent = { type: 'local/click', p1: 'Ann', p2: 'Bob' };
const pass: Intent = { type: 'act', action: { type: 'pass' } };
const reveal: Intent = { type: 'curtain/reveal' };

/** A pass-and-play table, seat 0's view, the curtain lifted when the game raises one. */
const started = (): App => {
  const s = run(initialApp, localClick).app;
  return s.table.curtain === null ? s : run(s, reveal).app;
};

describe('pass and play', () => {
  test('the start: seat 0 first, the names defaulted when empty, the curtain as the game hides or not', () => {
    const s = run(initialApp, localClick);
    expect(s.app.shell.role).toBe('local');
    expect(s.app.shell.game?.game.names).toEqual(['Ann', 'Bob']);
    expect(s.app.shell.screen).toBe('tableScreen');
    expect(s.app.table.curtain).toBe(0);
    const defaults = run(initialApp, { type: 'local/click', p1: '', p2: '' });
    expect(defaults.app.shell.game?.game.names).toEqual(['Ari', 'Lavi']);
  });

  test('a pass hands the view to the other seat, under the curtain, with the cue; a play out of turn is refused', () => {
    const app = started();
    expect(viewOf(app)?.seat).toBe(0);
    const passed = run(app, pass);
    expect(passed.app.shell.game?.game.turns).toBe(1);
    expect(viewOf(passed.app)?.seat).toBe(1);
    expect(passed.app.table.curtain).toBe(1);
    const cues = passed.effects
      .filter((e) => e.type === 'fx')
      .map((e) => (e as { cue: string }).cue);
    expect(cues).toContain('tap');
    expect(cues).toContain('pass');
    const over = run(app, { type: 'act', action: { type: 'again' } });
    expect(over.effects.map((e) => e.type)).toContain('toast');
  });

  test('the end is a pause the shell holds: nothing moves meanwhile, Continue clears it for the result, Play again deals the same seats anew', () => {
    const app = started();
    const resigned = run(app, { type: 'act', action: { type: 'resign' } }).app;
    expect(resigned.shell.game?.game.result).toEqual({ kind: 'win', winner: 1, by: 'resign' });
    expect(resigned.shell.pause).toEqual({ title: 'Bob wins!', detail: 'Ann resigned.' });
    const stuck = run(resigned, { type: 'act', action: { type: 'again' } }).app;
    expect(stuck.shell.game?.game.result).not.toBeNull();
    const cleared = run(resigned, { type: 'pause/continue' }).app;
    expect(cleared.shell.pause).toBeNull();
    const again = run(cleared, { type: 'again/click' }).app;
    expect(again.shell.game?.game.result).toBeNull();
    expect(again.shell.game?.game.turns).toBe(0);
    expect(again.shell.game?.game.names).toEqual(['Ann', 'Bob']);
  });

  test('the draw after MAX_TURNS passes ends the game on a pause too', () => {
    const end = Array.from({ length: MAX_TURNS }).reduce<App>((a, _, i) => {
      const next = run(a, pass).app;
      return i < MAX_TURNS - 1 && next.table.curtain !== null ? run(next, reveal).app : next;
    }, started());
    expect(end.shell.game?.game.result).toMatchObject({ kind: 'win', by: 'luck' });
    expect(end.shell.pause?.title).toMatch(/wins!$/);
  });
});

describe('the helpers', () => {
  test('cuesBetween, pauseFor, the labels', () => {
    const app = started();
    const v0 = viewOf(app);
    const v1 = viewOf(run(app, pass).app);
    if (v0 === null || v1 === null) throw new Error('no view');
    expect(cuesBetween(v0, v1)).toEqual(['pass']);
    expect(cuesBetween(v0, v0)).toEqual([]);
    expect(pauseFor(v0, v1)).toBeNull();
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    expect(handoffLabel(game)).toBe('Continue online: Ann hosts, Bob joins by invite');
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ann vs Bob');
    expect(resumeLabel({ kind: 'guest', code: 'ABCD', name: 'x' } as never)).toBe(
      'Rejoin room ABCD',
    );
  });
});
