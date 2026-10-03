// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects
// them; no logic). The shared boot (web/shared/edge/boot.ts `bootShell`, docs/design/shared-shell.md
// §4.5, §5 C3) builds what gin's main.ts and this one spelled line for line (design §5.3 "main.ts
// boot", docs/design/backgammon-board.md §5.2): the browser's page (`browserPage`), the real
// Transport (web/shared/edge/transport.ts, which bundles PeerJS and honours `?peer=`), the ICE
// loader, `Math.random` (or the harness's `window.__rng`, read before anything draws so a seeded
// opening roll is the seeded one, R27), Web Audio, vibration and the wake lock, handed to the
// reducer (src/ui/state.ts) through `runEffect`, to the sessions (src/net) through their deps, and
// to the paint (src/ui/render.ts). This file passes what is this game's: its reducer, painters,
// sessions, shell config, and its shell config again as `shell`: its
// `orientation: 'landscape'` has the boot watch the phone's orientation and paint the turn gate
// (docs/design/shared-shell.md "Playing sideways", docs/design/backgammon-landscape.md §5D).
// `window.__backgammon` (the documented test hook, design Q5) is the boot's: `act`, `view`,
// `setup`, `legal` and the shared rest. After the boot, the safe-area map on the root
// (src/safeArea.ts): the rail's side sideways.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { legalActions } from './src/engine/index.ts';
import { SESSIONS } from './src/net/sessions.ts';
import { bindAll, paint, toastMarks } from './src/ui/render.ts';
import { watchSafeArea } from './src/safeArea.ts';
import { BACKGAMMON, reducer, type App, type Backgammon } from './src/ui/state.ts';

bootShell<Backgammon, App>({
  page: browserPage(),
  // PeerJS log level 0 as gin's page (e2e expectPeerOptions pins it, tools/games.ts REGISTRY).
  game: { hook: '__backgammon', title: 'Sheshbesh', debug: 0 },
  reducer,
  // The Kapará toast wears `hit` (`toastMarks`).
  paint: { paint, bindAll, toastMarks },
  config: BACKGAMMON,
  net: SESSIONS,
  legal: legalActions,
  shell: BACKGAMMON,
});
watchSafeArea(document, window);
