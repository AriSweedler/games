// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects
// them; no logic). Flip 7 boots through the shared shell (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5): the browser's page (`browserPage`), the real Transport, the
// ICE loader, `Math.random` (or the harness's `window.__rng`), Web Audio, vibration and the wake
// lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and the paint
// (src/ui/render.ts). This file passes what is Flip 7's: its reducer, painters, shell config, the
// sessions over its protocol (web/shared/net/sessions.ts `seatedSessions`) and its copy tables.
// `window.__flip7` (the documented test hook) is the boot's: `act`, `view`, `game`, `setup`,
// `legal` and the shared rest.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { seatedSessions } from '../../shared/net/sessions.ts';
import { legalActions } from './src/engine/index.ts';
import { PROTOCOL } from './src/protocol.ts';
import { ABOUT_PARAGRAPHS } from './src/ui/about.ts';
import { GLOSSARY } from './src/ui/glossary.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { RULES_ITEMS } from './src/ui/rules.ts';
import { FLIP7, reducer, type App, type Flip7 } from './src/ui/state.ts';

bootShell<Flip7, App>({
  page: browserPage(),
  game: { hook: '__flip7', title: 'Flip 7', debug: 0 },
  reducer,
  paint: { paint, bindAll },
  config: FLIP7,
  copy: { rules: RULES_ITEMS, about: ABOUT_PARAGRAPHS, glossary: GLOSSARY },
  net: seatedSessions('flip7', PROTOCOL, FLIP7.opts.pick),
  legal: legalActions,
});
