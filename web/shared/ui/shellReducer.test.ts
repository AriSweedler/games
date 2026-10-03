// shellReducer.ts: the boot's reducer block off a config and a table reducer, over the fake game
// of test-helpers.ts. Each member is pinned against the shell.ts function it delegates to, and
// the two seams (`before`, `after`) against the order they run in.
import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../lib/rng.ts';
import {
  guestContextOf,
  hostContextOf,
  initialShell,
  pure,
  readHome,
  resumeFor,
  step,
  type Ctx,
  type Intent,
  type ShellApp,
  type Step,
} from './shell.ts';
import type { ShellEffectDeps } from './shellEffects.ts';
import { shellReducer, type TableReducer } from './shellReducer.ts';
import { FAKE, FAKE_KEYS, type Fake, type FakeStore } from './test-helpers.ts';

type App = ShellApp<Fake>;

const NOW = 1_700_000_000_000;
const ctx: Ctx = { rng: mulberry32(7), now: () => NOW };

const marked = (app: App, mark: string): App => ({
  ...app,
  table: { ...app.table, marks: [...app.table.marks, mark] },
});

/** The fake's table reducer: an `own` intent marks the table and emits one `ownFx`. */
const tableIntent: TableReducer<Fake>['intent'] = (app, intent) =>
  step(marked(app, `own:${intent.mark}`), { type: 'ownFx', mark: intent.mark });

const OWN: Intent<Fake> = { type: 'own', mark: 'a' };
const TYPED: Intent<Fake> = { type: 'name/typed', value: 'Bo' };

/** The adapters an effect reaches, every one a stub but the store (`runShellEffect` writes a name through `prefs.name`). */
const depsOver = (store: FakeStore): ShellEffectDeps<Fake> =>
  ({ store }) as unknown as ShellEffectDeps<Fake>;

describe('shellReducer', () => {
  const reducer = shellReducer(FAKE, { intent: tableIntent });

  test('initialApp is the shell at rest over the config with the table at its initial', () => {
    expect(reducer.initialApp).toEqual({ shell: initialShell(FAKE), table: FAKE.table.initial });
  });

  test('reduce: a shell intent takes the shell’s step, the game’s intent the table’s', () => {
    const typed = reducer.reduce(reducer.initialApp, TYPED, ctx);
    expect(typed.app.shell.p1Name).toBe('Bo');
    expect(typed.effects.map((e) => e.type)).toEqual(['rememberName', 'fillName']);
    expect(typed.app.table.marks).toEqual([]);

    const own = reducer.reduce(reducer.initialApp, OWN, ctx);
    expect(own.app.table.marks).toEqual(['own:a']);
    expect(own.effects).toEqual([{ type: 'ownFx', mark: 'a' }]);
  });

  test('before: a Step ends the intent there, before the shell or the table sees it; null hands it on', () => {
    const gated = shellReducer(FAKE, {
      intent: tableIntent,
      before: (app, intent) =>
        intent.type === 'own' && intent.mark === 'stop' ? pure(marked(app, 'stopped')) : null,
    });
    const stopped = gated.reduce(gated.initialApp, { type: 'own', mark: 'stop' }, ctx);
    expect(stopped.app.table.marks).toEqual(['stopped']);
    expect(stopped.effects).toEqual([]);
    expect(gated.reduce(gated.initialApp, OWN, ctx).app.table.marks).toEqual(['own:a']);
    expect(gated.reduce(gated.initialApp, TYPED, ctx).app.shell.p1Name).toBe('Bo');
  });

  test('after: runs over the step, whichever took it, with the App the intent arrived at', () => {
    const seen: (readonly [string, ReadonlyArray<string>])[] = [];
    const wrapped = shellReducer(FAKE, {
      intent: tableIntent,
      before: (app, intent) => (intent.type === 'own' ? pure(marked(app, 'early')) : null),
      after: (before, s: Step<Fake>, intent): Step<Fake> => {
        seen.push([intent.type, before.table.marks]);
        return step(marked(s.app, 'after'), ...s.effects, { type: 'ownFx', mark: 'after' });
      },
    });
    const start = marked(wrapped.initialApp, 'start');
    const own = wrapped.reduce(start, OWN, ctx);
    expect(own.app.table.marks).toEqual(['start', 'early', 'after']);
    expect(own.effects).toEqual([{ type: 'ownFx', mark: 'after' }]);
    const typed = wrapped.reduce(start, TYPED, ctx);
    expect(typed.app.shell.p1Name).toBe('Bo');
    expect(typed.app.table.marks).toEqual(['start', 'after']);
    expect(typed.effects.map((e) => e.type)).toEqual(['rememberName', 'fillName', 'ownFx']);
    expect(seen).toEqual([
      ['own', ['start']],
      ['name/typed', ['start']],
    ]);
  });

  test('runEffect: a shell effect runs through the shell’s runner, the game’s through its own; a game with no runner drops its own', () => {
    const ran: string[] = [];
    const owned = shellReducer(FAKE, {
      intent: tableIntent,
      effect: (_app, effect) => {
        ran.push(effect.mark);
      },
    });
    const store: FakeStore = new Map();
    owned.runEffect(owned.initialApp, { type: 'rememberName', name: 'Bo' }, depsOver(store));
    expect(store.get(FAKE_KEYS.name)).toBe('Bo');
    owned.runEffect(owned.initialApp, { type: 'ownFx', mark: 'x' }, depsOver(store));
    expect(ran).toEqual(['x']);

    const bare: FakeStore = new Map();
    reducer.runEffect(reducer.initialApp, { type: 'ownFx', mark: 'x' }, depsOver(bare));
    reducer.runEffect(reducer.initialApp, { type: 'rememberName', name: 'Cy' }, depsOver(bare));
    expect([...bare.entries()]).toEqual([[FAKE_KEYS.name, 'Cy']]);
  });

  test('readHome, resumeFor and the two contexts are the shell’s over the config', () => {
    const store: FakeStore = new Map([
      [FAKE_KEYS.name, 'Bo'],
      [FAKE_KEYS.colour, 'gold'],
    ]);
    expect(reducer.readHome(store)).toEqual(readHome(store, FAKE));
    expect(reducer.readHome(store)).toMatchObject({ name: 'Bo', colour: 'gold' });

    const game = FAKE.engine.create(
      [
        { id: 'a', name: 'Bo' },
        { id: 'b', name: 'Cy' },
      ],
      { level: 2 },
      ctx.rng,
      ctx.now,
    );
    expect(reducer.resumeFor({ role: 'local', game })).toEqual(
      resumeFor({ role: 'local', game }, FAKE),
    );
    expect(reducer.resumeFor(null)).toBeNull();

    const app: App = {
      ...reducer.initialApp,
      shell: { ...reducer.initialApp.shell, role: 'host', code: 'ABCD', myName: 'Bo' },
    };
    expect(reducer.hostContextOf(app)).toEqual(hostContextOf(app.shell));
    expect(reducer.hostContextOf(app)).toMatchObject({ role: 'host', code: 'ABCD', level: 1 });
    expect(reducer.guestContextOf(app)).toEqual(guestContextOf(app.shell));
  });
});
