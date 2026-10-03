// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). UNO boots through the shared boot (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5): the browser's page (`browserPage`: the document, the window,
// the navigator, localStorage, the clock), the real Transport, `Math.random` (or the harness's
// `window.__rng`), Web Audio, vibration and the wake lock, handed to the reducer (src/ui/state.ts),
// the sessions (src/net) and the paint (src/ui/render.ts). This file passes what is UNO's: its
// reducer, painters, sessions, shell config, sound-font key, the rules and About copy, and the one
// member of `window.__uno` (the documented test hook) beyond the boot's (`act`, `view`, `setup`,
// `legal` among them): `playable`, my playable ids.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { aboutHtml } from '../../shared/ui/glossary.ts';
import { legalActions } from './src/engine/view.ts';
import { GuestSession, HostSession } from './src/net/sessions.ts';
import { isGuestFrame } from './src/protocol.ts';
import { STORAGE_KEYS } from './src/storage.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, rulesItemsHtml } from './src/ui/rules.ts';
import {
  UNO,
  guestContextOf,
  hostContextOf,
  initialApp,
  readHome,
  reduce,
  runEffect,
  type App,
  type Uno,
} from './src/ui/state.ts';

bootShell<Uno, App>({
  page: browserPage(),
  game: { hook: '__uno', title: 'UNO', debug: 0 },
  sound: { fontKey: STORAGE_KEYS.soundFont },
  reducer: { initialApp, reduce, runEffect, readHome, hostContextOf, guestContextOf },
  paint: { paint, bindAll },
  config: UNO,
  copy: { rules: rulesItemsHtml(), about: aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY) },
  net: { Host: HostSession, Guest: GuestSession, isGuestFrame },
  legal: legalActions,
  hooks: {
    hook: ({ app }) => ({
      playable: (): ReadonlyArray<string> => app().shell.view?.playable ?? [],
    }),
  },
});
