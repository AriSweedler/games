// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). Hive boots through the shared boot (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5) as briscola and UNO do: the real Transport, localStorage, the
// clock, `Math.random` (or the harness's `window.__rng`; Hive rolls nothing), Web Audio, vibration
// and the wake lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and the paint
// (src/ui/render.ts). This file passes Hive's reducer, painters, sessions, cue table, sound key, the
// rules and About copy, the bug sprite the tiles `<use>` (ui/bugs.ts, inlined once here before any
// paint, as briscola inlines its suits), and the members of `window.__hive` (the documented test
// hook) beyond the shared ones: `act`, `view`, `setup` and `legal`.
import { bootShell } from '../../shared/edge/boot.ts';
import { realClock } from '../../shared/edge/clock.ts';
import { browserStore } from '../../shared/edge/storage.ts';
import { legalActions, type Action, type View } from './src/engine/view.ts';
import { createFx } from './src/fx.ts';
import { GuestSession } from './src/net/guest.ts';
import { HostSession } from './src/net/host.ts';
import { isGuestFrame } from './src/protocol.ts';
import { STORAGE_KEYS, soundEnabled } from './src/storage.ts';
import { BUG_SPRITE_SVG } from './src/ui/bugs.ts';
import { fillNameInputs, fillP2NameInput, setCodeInput } from './src/ui/home.ts';
import { bindAll, paint, paintSound, renderAbout, renderRules } from './src/ui/render.ts';
import {
  guestContextOf,
  hostContextOf,
  initialApp,
  readHome,
  reduce,
  runEffect,
  type App,
  type Hive,
  type HostContext,
} from './src/ui/state.ts';

bootShell<Hive, App, object, HostContext>({
  page: { doc: document, win: window, nav: navigator, store: browserStore(), clock: realClock },
  game: { hook: '__hive', title: 'Hive', debug: 0 },
  sound: { enabled: soundEnabled, fontKey: STORAGE_KEYS.soundFont },
  reducer: { initialApp, reduce, runEffect, readHome, hostContextOf, guestContextOf },
  paint: {
    paint,
    bindAll,
    paintSound,
    fillName: fillNameInputs,
    fillP2Name: fillP2NameInput,
    setCode: setCodeInput,
  },
  fx: createFx,
  net: { Host: HostSession, Guest: GuestSession, isGuestFrame },
  legal: legalActions,
  deps: {},
  hooks: {
    render: () => {
      document.body.insertAdjacentHTML('afterbegin', BUG_SPRITE_SVG);
      renderRules(document);
      renderAbout(document);
    },
    // `act` through the reducer; `view` my seat's view; `setup` seats a position (pass-and-play
    // only: the shell's `position/load` over the engine's decoder); `legal` what my seat may do.
    hook: ({ app, dispatch }) => ({
      act: (action: Action) => {
        dispatch({ type: 'act', action });
      },
      view: (): View | null => app().shell.view,
      setup: (state: unknown) => {
        dispatch({ type: 'position/load', state });
      },
      legal: (): ReadonlyArray<Action> => {
        const view = app().shell.view;
        return view === null ? [] : legalActions(view);
      },
    }),
  },
});
