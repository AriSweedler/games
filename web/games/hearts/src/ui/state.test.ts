import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { DECK } from '../engine/cards.ts';
import type { Action, View } from '../engine/view.ts';
import {
  cuesBetween,
  endWords,
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

const localClick: Intent = { type: 'local/click', p1: 'Ann', p2: 'Bob', names: ['Cat'] };
const reveal: Intent = { type: 'curtain/reveal' };

const act = (action: Action): Intent => ({ type: 'act', action });

/** A pass-and-play table of three, the curtain lifted for the first seat. */
const started = (): App => {
  const s = run(initialApp, localClick).app;
  return s.table.curtain === null ? s : run(s, reveal).app;
};

/** The phone holder's first legal action (the pass as the three highest, then the play). */
const firstLegal = (app: App): Action => {
  const first = viewOf(app)?.legal[0];
  if (first === undefined) throw new Error('nothing to do');
  return first;
};

/** One action by the holder, then the curtain lifted for the next seat when it drops. */
const step = (app: App): App => {
  const next = run(app, act(firstLegal(app))).app;
  return next.table.curtain === null ? next : run(next, reveal).app;
};

describe('pass and play', () => {
  test('the start: three seats dealt, seat 0 under the curtain first, the deal hidden from the other seats', () => {
    const s = run(initialApp, localClick);
    expect(s.app.shell.role).toBe('local');
    expect(s.app.shell.game?.game.names).toEqual(['Ann', 'Bob', 'Cat']);
    expect(s.app.shell.game?.game.hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(s.app.shell.screen).toBe('tableScreen');
    expect(s.app.table.curtain).toBe(0);
    const view = viewOf(s.app);
    expect(view?.seat).toBe(0);
    expect(view?.hand).toHaveLength(17);
    expect(view?.phase).toBe('passing');
  });

  test('each seat passes under its own curtain; the 2♣ holder then leads; a play by another seat is refused', () => {
    const app = started();
    const afterPasses = [0, 1, 2].reduce<App>((a) => step(a), app);
    const view = viewOf(afterPasses);
    if (view === null) throw new Error('no view');
    expect(view.phase).toBe('playing');
    expect(view.turn).toBe(view.seat);
    expect(view.legal).toEqual([{ type: 'play', id: '2C' }]);
    // A card the phone holder does not hold (another seat's) is the engine's refusal, toasted.
    const foreign = DECK.find((id) => !view.hand.includes(id)) ?? '';
    const refused = run(afterPasses, act({ type: 'play', id: foreign }));
    expect(refused.effects.map((e) => e.type)).toContain('toast');
    const led = run(afterPasses, act({ type: 'play', id: '2C' }));
    expect(viewOf(led.app)?.counts[view.seat]).toBe(16);
    const cues = led.effects.filter((e) => e.type === 'fx').map((e) => (e as { cue: string }).cue);
    expect(cues).toContain('tap');
    expect(cues).toContain('pass');
    expect(led.app.table.curtain).not.toBeNull();
  });

  test('the game plays through to its end on a pause the shell holds; Continue clears it; Play again deals the same seats anew', () => {
    const play = (a: App, steps: number): App => {
      if (viewOf(a)?.phase === 'gameOver' || steps === 0) return a;
      return play(step(a), steps - 1);
    };
    const end = play(started(), 5000);
    const view = viewOf(end);
    expect(view?.phase).toBe('gameOver');
    expect(Math.max(...(view?.scores ?? []))).toBeGreaterThanOrEqual(100);
    expect(end.shell.pause?.title).toMatch(/wins!$/);
    const stuck = run(end, act({ type: 'playAgain' })).app;
    expect(viewOf(stuck)?.phase).toBe('gameOver');
    const cleared = run(end, { type: 'pause/continue' }).app;
    expect(cleared.shell.pause).toBeNull();
    const again = run(cleared, { type: 'again/click' }).app;
    expect(viewOf(again)?.phase).toBe('passing');
    expect(viewOf(again)?.round).toBe(1);
    expect(again.shell.game?.game.names).toEqual(['Ann', 'Bob', 'Cat']);
  });
});

describe('the helpers', () => {
  test('cuesBetween, endWords, pauseFor, the labels', () => {
    const app = started();
    const v0 = viewOf(app);
    if (v0 === null) throw new Error('no view');
    const over: View = { ...v0, phase: 'gameOver', winners: [1], scores: [100, 20, 50] };
    expect(cuesBetween(v0, over)).toEqual(['lose']);
    expect(cuesBetween(v0, { ...over, winners: [0] })).toEqual(['win']);
    expect(cuesBetween(v0, { ...v0, counts: [16, 17, 17] })).toEqual(['pass']);
    expect(cuesBetween(v0, v0)).toEqual([]);
    expect(endWords(v0)).toBeNull();
    expect(endWords(over)).toEqual({ title: 'Bob wins!', detail: 'Ann 100, Bob 20, Cat 50' });
    expect(pauseFor(v0, v0)).toBeNull();
    expect(pauseFor(null, over)).toBeNull();
    expect(pauseFor(v0, over)?.title).toBe('Bob wins!');
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    expect(handoffLabel(game)).toBe('Continue online: Ann hosts, Bob, Cat join by invite');
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ann, Bob, Cat');
    expect(resumeLabel({ kind: 'guest', code: 'ABCD', name: 'x' } as never)).toBe(
      'Rejoin room ABCD',
    );
  });
});
