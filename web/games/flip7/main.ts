// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects
// them; no logic). Flip 7 boots through the shared shell (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5): the browser's page (`browserPage`), the real Transport, the
// ICE loader, `Math.random` (or the harness's `window.__rng`), Web Audio, vibration and the wake
// lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and the paint
// (src/ui/render.ts). This file passes what is Flip 7's: its reducer, painters, sessions, shell
// config, sound-font key, the rules and About copy, and the one member of `window.__flip7` (the
// documented test hook) beyond the boot's (`act`, `view`, `setup`, `legal` among them): `game`,
// the engine state on this device (the host's or the phone's, null at a guest).
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { aboutHtml } from '../../shared/ui/glossary.ts';
import { legalActions, type State } from './src/engine/index.ts';
import { GuestSession, HostSession } from './src/net/sessions.ts';
import { isGuestFrame } from './src/protocol.ts';
import { STORAGE_KEYS } from './src/storage.ts';
import { ABOUT_PARAGRAPHS } from './src/ui/about.ts';
import { GLOSSARY } from './src/ui/glossary.ts';
import { bindAll, paint } from './src/ui/render.ts';
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
  page: browserPage(),
  game: { hook: '__flip7', title: 'Flip 7', debug: 0 },
  sound: { fontKey: STORAGE_KEYS.soundFont },
  reducer: { initialApp, reduce, runEffect, readHome, hostContextOf, guestContextOf },
  paint: { paint, bindAll },
  config: FLIP7,
  copy: { rules: rulesItemsHtml(), about: aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY) },
  net: { Host: HostSession, Guest: GuestSession, isGuestFrame },
  legal: legalActions,
  hooks: {
    hook: ({ app }) => ({
      game: (): State | null => app().shell.game,
    }),
  },
});
