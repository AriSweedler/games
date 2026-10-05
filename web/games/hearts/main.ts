// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic; docs/design/hearts.md §3). Hearts boots through the shared boot
// (web/shared/edge/boot.ts `bootShell`, docs/design/shared-shell.md §4.5): the browser's page
// (`browserPage`), the real Transport, `Math.random` (or the harness's `window.__rng`), Web Audio,
// vibration and the wake lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and
// the paint (src/ui/render.ts). `window.__hearts` (the documented test hook) is the boot's: `act`,
// `view`, `game`, `setup`, `legal` and the shared rest; a game's own members go under `hooks.hook`.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { legalActions } from './src/engine/view.ts';
import { SESSIONS } from './src/net/sessions.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './src/ui/rules.ts';
import { reducer, HEARTS, type App, type Hearts } from './src/ui/state.ts';

bootShell<Hearts, App>({
  page: browserPage(),
  game: { hook: '__hearts', title: 'Hearts', debug: 0 },
  reducer,
  paint: { paint, bindAll },
  config: HEARTS,
  copy: { rules: RULES_ITEMS, about: ABOUT_PARAGRAPHS, glossary: GLOSSARY },
  net: SESSIONS,
  legal: legalActions,
});
