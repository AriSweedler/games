// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects
// them; no logic). Flip 7 boots through the shared shell (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5): the real Transport, the ICE loader, localStorage, the clock,
// `Math.random` (or the harness's `window.__rng`), Web Audio, vibration and the wake lock, handed to
// the reducer (src/ui/state.ts), the sessions (src/net) and the paint (src/ui/render.ts). This file
// passes the page's objects and what is Flip 7's: its reducer, painters, sessions, the rules and
// About copy, and the members of `window.__flip7` (the documented test hook) beyond the shared
// ones: `act`, `view`, `game` and `setup`.
import { bootShell } from '../../shared/edge/boot.ts';
import { realClock } from '../../shared/edge/clock.ts';
import { browserStore } from '../../shared/edge/storage.ts';
import { aboutHtml } from '../../shared/ui/glossary.ts';
import { paintSound, renderCopy } from '../../shared/ui/shellPaint.ts';
import { legalActions, type Action, type State, type View } from './src/engine/index.ts';
import { GuestSession, HostSession } from './src/net/sessions.ts';
import { isGuestFrame } from './src/protocol.ts';
import { STORAGE_KEYS, soundEnabled } from './src/storage.ts';
import { ABOUT_PARAGRAPHS } from './src/ui/about.ts';
import { GLOSSARY } from './src/ui/glossary.ts';
import { bindAll, fillNameInputs, fillP2NameInput, paint, setCodeInput } from './src/ui/render.ts';
import { rulesItemsHtml } from './src/ui/rules.ts';
import {
  FLIP7,
  guestContextOf,
  hostContextOf,
  initialApp,
  readHome,
  reduce,
  runEffect,
  type App,
  type Flip7,
} from './src/ui/state.ts';

bootShell<Flip7, App>({
  page: { doc: document, win: window, nav: navigator, store: browserStore(), clock: realClock },
  game: { hook: '__flip7', title: 'Flip 7', debug: 0 },
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
  config: FLIP7,
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
    // `act` through the reducer; `view` my view; `game` the engine state on this device (the host's
    // or the phone's, null at a guest); `setup` seats a position (pass-and-play only).
    hook: ({ app, dispatch }) => ({
      act: (action: Action) => {
        dispatch({ type: 'act', action });
      },
      view: (): View | null => app().shell.view,
      game: (): State | null => app().shell.game,
      setup: (state: unknown) => {
        dispatch({ type: 'position/load', state });
      },
    }),
  },
});
