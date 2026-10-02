// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects
// them; no logic). Flip 7 pass-and-play (docs/design/flip7.md §7) is a solo page like the
// reaction game: no seats over the network, no room, no transport, so it boots itself rather than
// through the shared shell. `Math.random` (or the harness's `window.__rng`) is the only adapter
// the reducer needs; the paint (src/ui/render.ts) reads the page. `window.__flip7` is the
// documented test hook: `app` as a getter, `dispatch` and `game()`, so e2e/flip7.spec.ts plays a
// seeded game.
import { applyLayout, watchLayout } from '../../shared/edge/screen.ts';
import type { Rng } from '../../shared/lib/rng.ts';
import { bind, paint, paintSetup } from './src/ui/render.ts';
import {
  DEFAULT_SEATS,
  gameOf,
  initialApp,
  reduce,
  type App,
  type Intent,
} from './src/ui/state.ts';

type BootWindow = Readonly<{ __rng?: Rng; __flip7?: unknown }>;

const boot = (): void => {
  const doc = document;
  const win = window as unknown as BootWindow;
  const rng: Rng = win.__rng ?? Math.random;

  let app: App = initialApp;

  const dispatch = (intent: Intent): void => {
    app = reduce(app, intent, rng);
    paint(doc, app);
  };

  bind(doc, {
    dispatch,
    seats: (count) => {
      paintSetup(doc, count);
    },
  });
  paintSetup(doc, DEFAULT_SEATS);

  // The layout bucket on `<body data-layout>` (docs/design/layout-buckets.md §3), kept live over a
  // turn of the phone or a window dragged; theme.css lays the table out per bucket.
  const screenDoc = doc as unknown as Parameters<typeof applyLayout>[0];
  const screenWin = win as unknown as Parameters<typeof applyLayout>[1];
  applyLayout(screenDoc, screenWin);
  watchLayout(screenWin, () => {
    applyLayout(screenDoc, screenWin);
  });

  paint(doc, app);

  const hook = {
    get app() {
      return app;
    },
    dispatch,
    game: () => gameOf(app),
  };
  (win as unknown as Record<string, unknown>)['__flip7'] = hook;
};

boot();
