// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). Hive boots through the shared boot (web/shared/edge/boot.ts `bootShell`,
// docs/design/shared-shell.md §4.5) as briscola and UNO do: the browser's page (`browserPage`), the
// real Transport, `Math.random` (or the harness's `window.__rng`; Hive rolls nothing), Web Audio,
// vibration and the wake lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and
// the paint (src/ui/render.ts). This file passes what is Hive's: its reducer, painters, sessions,
// shell config, its copy tables (the rules grouped), and the bug sprite the tiles `<use>`
// (ui/bugs.ts, inlined once here before any paint, as briscola inlines its suits). `window.__hive`
// (the documented test hook) is the boot's: `act`, `view`, `setup`, `legal` and the shared rest.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { legalActions } from './src/engine/view.ts';
import { SESSIONS } from './src/net/sessions.ts';
import { BUG_SPRITE_SVG } from './src/ui/bugs.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULE_GROUPS } from './src/ui/rules.ts';
import { HIVE, reducer, type App, type Hive } from './src/ui/state.ts';

bootShell<Hive, App>({
  page: browserPage(),
  game: { hook: '__hive', title: 'Hive', debug: 0 },
  reducer,
  paint: { paint, bindAll },
  config: HIVE,
  copy: { rules: RULE_GROUPS, about: ABOUT_PARAGRAPHS, glossary: GLOSSARY },
  net: SESSIONS,
  legal: legalActions,
  hooks: {
    render: () => {
      document.body.insertAdjacentHTML('afterbegin', BUG_SPRITE_SVG);
    },
  },
});
