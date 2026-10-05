import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { DECK } from '../engine/cards.ts';
import type { Action, View } from '../engine/view.ts';
import {
  PICK_THREE_MSG,
  cuesBetween,
  endWords,
  handWords,
  handoffLabel,
  initialApp,
  pauseFor,
  reduce,
  resumeLabel,
  togglePick,
  trickWords,
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

/** One move of the phone: a pause up is read (Continue), a finished hand is dealt on (Next hand), else the holder's first legal action; then the curtain lifted for the next seat when it drops. */
const step = (app: App): App => {
  if (app.shell.pause !== null) return run(app, { type: 'pause/continue' }).app;
  if (viewOf(app)?.phase === 'handOver') return run(app, { type: 'next/click' }).app;
  const next = run(app, act(firstLegal(app))).app;
  return next.table.curtain === null ? next : run(next, reveal).app;
};

/** The apps a run passes through, `steps` long or until the game is over. */
const trail = (app: App, steps: number): ReadonlyArray<App> =>
  viewOf(app)?.phase === 'gameOver' || steps === 0 ? [app] : [app, ...trail(step(app), steps - 1)];

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
    const apps = trail(started(), 8000);
    const end = apps[apps.length - 1] ?? started();
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

  test("every trick with points and every hand's end pause with what happened, and Continue clears each; a trick without points does not pause", () => {
    const apps = trail(started(), 8000);
    const paused = apps.filter((a) => a.shell.pause !== null);
    const titles = paused.map((a) => a.shell.pause?.title ?? '');
    // The pointed tricks: who took how many, the cards in the detail.
    const tricks = paused.filter((a) => /takes? \d+ points?$/.test(a.shell.pause?.title ?? ''));
    expect(tricks.length).toBeGreaterThan(0);
    tricks.forEach((a) => {
      expect(a.shell.pause?.detail).toMatch(/ from /);
      expect(viewOf(a)?.lastTrick?.points).toBeGreaterThan(0);
    });
    // Every hand's end: its scores, then the result sheet's Next hand.
    const hands = paused.filter((a) => /^Hand \d+ over$/.test(a.shell.pause?.title ?? ''));
    expect(hands.length).toBeGreaterThan(0);
    expect(hands[0]?.shell.pause?.detail).toMatch(
      /^(.* shot the moon! )?This hand: .*\. Totals: .*\.$/,
    );
    // A pointless trick raises none: every paused trick carried points (checked above), and the
    // tricks that carried none went by without a pause.
    const quiet = apps.filter(
      (a) =>
        a.shell.pause === null &&
        viewOf(a)?.lastTrick !== null &&
        viewOf(a)?.lastTrick?.points === 0,
    );
    expect(quiet.length).toBeGreaterThan(0);
    // While a pause is up nothing moves; Continue clears it and the game goes on.
    const first = paused[0];
    if (first === undefined) throw new Error('no pause');
    expect(run(first, act(firstLegal(first))).app.shell.game).toEqual(first.shell.game);
    expect(run(first, { type: 'pause/continue' }).app.shell.pause).toBeNull();
    expect(titles[titles.length - 1]).toMatch(/wins!$/);
  });

  test('the pass through the table: three taps pick, a fourth is ignored, a tap again unpicks, Pass sends them; fewer than three is a nudge', () => {
    const app = started();
    const hand = viewOf(app)?.hand ?? [];
    const [a, b, c, d] = hand;
    if (a === undefined || b === undefined || c === undefined || d === undefined)
      throw new Error('a short hand');
    const nudged = run(app, { type: 'pass/click' });
    expect(nudged.effects).toContainEqual({ type: 'toast', message: PICK_THREE_MSG, ms: null });
    const picked = run(
      app,
      { type: 'card/tap', id: a },
      { type: 'card/tap', id: b },
      { type: 'card/tap', id: c },
      { type: 'card/tap', id: d },
    ).app;
    expect(picked.table.picked).toEqual([a, b, c]);
    expect(run(picked, { type: 'card/tap', id: b }).app.table.picked).toEqual([a, c]);
    const passed = run(picked, { type: 'pass/click' }).app;
    expect(passed.shell.game?.game.passes[0]).toEqual([a, b, c]);
    expect(passed.table.picked).toEqual([]);
    expect(passed.table.curtain).toBe(1);
    expect(togglePick(['x', 'y', 'z'], 'w')).toEqual(['x', 'y', 'z']);
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
    expect(pauseFor(v0, { ...v0, round: 2 })).toBeNull();
    const trick = {
      leader: 1,
      taker: 2,
      points: 14,
      plays: [
        { seat: 1, card: 'QS' },
        { seat: 2, card: '5H' },
      ],
    };
    expect(trickWords(v0, trick)).toEqual({
      title: 'Cat takes 14 points',
      detail: 'QS (13) from Bob, 5H (1) from Cat',
    });
    expect(trickWords({ ...v0, seat: 2 }, { ...trick, points: 1 }).title).toBe('You take 1 point');
    expect(pauseFor(v0, { ...v0, phase: 'playing', lastTrick: trick })?.title).toBe(
      'Cat takes 14 points',
    );
    expect(
      pauseFor(v0, { ...v0, phase: 'playing', lastTrick: { ...trick, points: 0 } }),
    ).toBeNull();
    const handOver: View = {
      ...v0,
      phase: 'handOver',
      handScores: [0, 26, 0],
      moon: 0,
      scores: [0, 26, 0],
    };
    expect(handWords(handOver).detail).toBe(
      'Ann shot the moon! This hand: Ann 0, Bob 26, Cat 0. Totals: Ann 0, Bob 26, Cat 0.',
    );
    expect(pauseFor(v0, handOver)?.title).toBe('Hand 1 over');
    expect(pauseFor(handOver, handOver)).toBeNull();
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    expect(handoffLabel(game)).toBe('Continue online: Ann hosts, Bob, Cat join by invite');
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ann, Bob, Cat');
    expect(resumeLabel({ kind: 'guest', code: 'ABCD', name: 'x' } as never)).toBe(
      'Rejoin room ABCD',
    );
  });
});
