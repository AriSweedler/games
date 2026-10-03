// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic). The first game booted through the shared boot alone (docs/design/briscola.md D18;
// web/shared/edge/boot.ts `bootShell`, docs/design/shared-shell.md §4.5): the browser's page
// (`browserPage`), the real Transport, the ICE loader, `Math.random` (or the harness's
// `window.__rng`), Web Audio, vibration and the wake lock, handed to the reducer (src/ui/state.ts)
// through `runEffect`, to the sessions (src/net) through their deps, and to the paint
// (src/ui/render.ts). This file passes what is briscola's: its reducer, painters, sessions, shell
// config, sound-font key, the Italian suit sprite the glyph faces `<use>` (inlined once here, so it
// cannot drift from suits.ts), the card-pack and language-pack guards, the rules and About copy,
// the stories page's early return, and the members of `window.__briscola` (the documented test
// hook, D19) beyond the boot's (`act`, `view`, `setup`, `legal` among them): `events`, `cardPack`,
// `cardPackName`, `lang`, `langName`.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import type { Store } from '../../shared/edge/storage.ts';
import { aboutHtml } from '../../shared/ui/glossary.ts';
import { badCardPackMsg, isCardPackFor } from '../../shared/lib/cards/packs.ts';
import { badLanguageMsg, isLanguagePack } from '../../shared/lib/lang/packs.ts';
import { SUIT_SPRITE_SVG } from '../../shared/ui/cardFace.ts';
import IMPACT_SPRITE_SVG from './impact/impact-sprite.svg?raw';
import { legalActions, type GameEvent } from './src/engine/index.ts';
import { GuestSession, HostSession } from './src/net/sessions.ts';
import { isEphemeral, isGuestFrame } from './src/protocol.ts';
import { DECK_KIND, STORAGE_KEYS } from './src/storage.ts';
import { ABOUT_PARAGRAPHS } from './src/ui/about.ts';
import { GLOSSARY } from './src/ui/glossary.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { rulesItemsHtml } from './src/ui/rules.ts';
import {
  BRISCOLA,
  guestContextOf,
  hostContextOf,
  initialApp,
  readHome,
  reduce,
  runEffect,
  type App,
  type Briscola,
} from './src/ui/state.ts';

/**
 * The card pack (docs/design/card-packs.md §2): a value the console left in storage that names no
 * pack of the Italian deck is logged and dropped before every home read, so the deck's default
 * stands and a reload logs it once.
 */
const dropBadCardPack = (store: Store): void => {
  const stored = store.readText(STORAGE_KEYS.cardPack);
  if (stored.ok && !isCardPackFor(DECK_KIND, stored.value)) {
    console.error(badCardPackMsg(STORAGE_KEYS.cardPack, DECK_KIND, stored.value));
    store.remove(STORAGE_KEYS.cardPack);
  }
};

/** The language pack (docs/design/language-packs.md §3): the same guard over `briscola_lang`, so Italian stands. */
const dropBadLang = (store: Store): void => {
  const stored = store.readText(STORAGE_KEYS.lang);
  if (stored.ok && !isLanguagePack(stored.value)) {
    console.error(badLanguageMsg(STORAGE_KEYS.lang, stored.value));
    store.remove(STORAGE_KEYS.lang);
  }
};

const boot = (): void => {
  // The stories page (docs/design/briscola-board.md §7; docs/ARCHITECTURE.md "Documented test
  // hooks"): `?story=<id>` paints one catalogued table state and constructs no adapter at all. The
  // catalogue arrives as its own chunk (a dynamic import), so the game's entry carries none of it.
  const params = new URLSearchParams(location.search);
  const story = params.get('story');
  if (story !== null) {
    void import('./src/stories/boot.ts').then((stories) => {
      stories.bootStory(document, story, params.has('nav'), params.has('live'));
    });
    return;
  }
  // The host context is the shell's plus `seats` (the codec's welcome lists the table past two seats), and the seated adapter names each guest frame's seat (n-seat-sessions.md §7).
  bootShell<Briscola, App>({
    page: browserPage(),
    // PeerJS log level 0 as the other shell pages (e2e expectPeerOptions pins it, tools/games.ts REGISTRY).
    game: { hook: '__briscola', title: 'Briscola', debug: 0 },
    sound: { fontKey: STORAGE_KEYS.soundFont },
    reducer: { initialApp, reduce, runEffect, readHome, hostContextOf, guestContextOf },
    paint: { paint, bindAll },
    config: BRISCOLA,
    // The rules into both slots and the About copy (ui/rules.ts, ui/about.ts).
    copy: { rules: rulesItemsHtml(), about: aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY) },
    // `isEphemeral` names the live intent's lane, sent by both sides (briscola-battle.md §4.5).
    net: { Host: HostSession, Guest: GuestSession, isGuestFrame, isEphemeral },
    legal: legalActions,
    hooks: {
      home: (store) => {
        dropBadCardPack(store);
        dropBadLang(store);
      },
      // The four Italian suit symbols the glyph faces and the trump badge `<use>`, and the clash's
      // impact frames (impact/impact-sprite.svg, docs/design/briscola-battle.md §3.5), once, before
      // any paint, so nothing is fetched during play.
      render: () => {
        document.body.insertAdjacentHTML('afterbegin', SUIT_SPRITE_SVG);
        document.body.insertAdjacentHTML('afterbegin', IMPACT_SPRITE_SVG);
      },
      // `events` my view's event stream (the sounds' and the history's one source); `cardPack`
      // shows and remembers a pack of the Italian deck; `lang` names the cards in a language pack
      // and remembers it.
      hook: ({ app, dispatch }) => ({
        events: (): ReadonlyArray<GameEvent> => app().shell.view?.events ?? [],
        cardPack: (name: string): void => {
          if (!isCardPackFor(DECK_KIND, name)) {
            console.error(badCardPackMsg(STORAGE_KEYS.cardPack, DECK_KIND, name));
            return;
          }
          dispatch({ type: 'cardPack/set', pack: name });
        },
        cardPackName: (): string => app().table.cardPack,
        lang: (name: string): void => {
          if (!isLanguagePack(name)) {
            console.error(badLanguageMsg(STORAGE_KEYS.lang, name));
            return;
          }
          dispatch({ type: 'lang/set', name });
        },
        langName: (): string => app().table.lang,
      }),
    },
  });
};

boot();
