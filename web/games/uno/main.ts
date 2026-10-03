// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). UNO boots through the shared boot (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5): the browser's page (`browserPage`: the document, the window,
// the navigator, localStorage, the clock), the real Transport, `Math.random` (or the harness's
// `window.__rng`), Web Audio, vibration and the wake lock, handed to the reducer (src/ui/state.ts),
// the sessions (web/shared/net/sessions.ts `seatedSessions` over src/protocol.ts) and the paint
// (src/ui/render.ts). This file passes what is UNO's: its reducer, painters, shell config, its copy
// tables, and the one member of `window.__uno` (the documented test hook) beyond the boot's
// (`act`, `view`, `game`, `setup`, `legal` among them): `playable`, my playable ids.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { seatedSessions } from '../../shared/net/sessions.ts';
import { legalActions } from './src/engine/view.ts';
import { PROTOCOL } from './src/protocol.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './src/ui/rules.ts';
import { UNO, reducer, type App, type Uno } from './src/ui/state.ts';

bootShell<Uno, App>({
  page: browserPage(),
  game: { hook: '__uno', title: 'UNO', debug: 0 },
  reducer,
  paint: { paint, bindAll },
  config: UNO,
  copy: { rules: RULES_ITEMS, about: ABOUT_PARAGRAPHS, glossary: GLOSSARY },
  net: seatedSessions('uno', PROTOCOL, UNO.opts.pick),
  legal: legalActions,
  hooks: {
    hook: ({ app }) => ({
      playable: (): ReadonlyArray<string> => app().shell.view?.playable ?? [],
    }),
  },
});
