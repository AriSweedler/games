// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). UNO boots through the shared boot (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5) as briscola does: the real Transport, localStorage, the clock,
// `Math.random` (or the harness's `window.__rng`), Web Audio, vibration and the wake lock, handed
// to the reducer (src/ui/state.ts), the sessions (src/net) and the paint (src/ui/render.ts). This
// file passes UNO's reducer, painters, sessions, cue table, sound key, the rules and About copy,
// and the members of `window.__uno` (the documented test hook) beyond the shared ones: `act`,
// `view`, `setup` and `playable`.
import { bootShell } from '../../shared/edge/boot.ts';
import { realClock } from '../../shared/edge/clock.ts';
import { browserStore } from '../../shared/edge/storage.ts';
import { aboutHtml } from '../../shared/ui/glossary.ts';
import { paintSound, renderCopy } from '../../shared/ui/shellPaint.ts';
import { legalActions, type Action, type View } from './src/engine/view.ts';
import { createFx } from './src/fx.ts';
import { GuestSession } from './src/net/guest.ts';
import { HostSession } from './src/net/host.ts';
import { isGuestFrame } from './src/protocol.ts';
import { STORAGE_KEYS, soundEnabled } from './src/storage.ts';
import { fillNameInputs, fillP2NameInput, setCodeInput } from './src/ui/home.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, rulesItemsHtml } from './src/ui/rules.ts';
import {
  guestContextOf,
  hostContextOf,
  initialApp,
  readHome,
  reduce,
  runEffect,
  type App,
  type HostContext,
  type Uno,
} from './src/ui/state.ts';

bootShell<Uno, App, object, HostContext>({
  page: { doc: document, win: window, nav: navigator, store: browserStore(), clock: realClock },
  game: { hook: '__uno', title: 'UNO', debug: 0 },
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
  net: { Host: HostSession, Guest: GuestSession, isGuestFrame, seats: true },
  legal: legalActions,
  deps: {},
  hooks: {
    render: () => {
      renderCopy(document, {
        rules: rulesItemsHtml(),
        about: aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY),
      });
    },
    // `act` through the reducer; `view` my seat's view; `setup` seats a position (pass-and-play
    // only: the shell's `position/load` over the engine's decoder); `playable` my playable ids.
    hook: ({ app, dispatch }) => ({
      act: (action: Action) => {
        dispatch({ type: 'act', action });
      },
      view: (): View | null => app().shell.view,
      setup: (state: unknown) => {
        dispatch({ type: 'position/load', state });
      },
      playable: (): ReadonlyArray<string> => app().shell.view?.playable ?? [],
    }),
  },
});
