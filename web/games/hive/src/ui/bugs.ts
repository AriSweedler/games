// The bugs on the tiles (docs/design/hive.md §7; the owner, 2026-10-02: "The SVG should display on
// the tiles (code this right)"): the five files under assets/bugs/ (100x100 line art in
// currentColor, one bug each) inlined once as `<symbol>`s in a sprite main.ts puts at the top of
// the body before any paint (as briscola inlines its suits), with the gradients and filters the
// tiles' bevel and shadow read. The engraving itself (the symbol's shape, the fit, the four `<use>`
// layers a tile draws a bug with: `bugHtml`) is ui/engrave.ts, pure over the art's text, so that
// tools/splash-hive.ts draws the link-preview card with the same code from the same files; this
// module is the one that knows the files, through Vite's `?raw`. Pure strings; render.ts places them.
import { BUGS, type Bug } from '../engine/pieces.ts';
import ANT from '../../assets/bugs/ant.svg?raw';
import BEETLE from '../../assets/bugs/beetle.svg?raw';
import GRASSHOPPER from '../../assets/bugs/grasshopper.svg?raw';
import QUEEN from '../../assets/bugs/queen.svg?raw';
import SPIDER from '../../assets/bugs/spider.svg?raw';
import { TILE_DEFS, symbolOf } from './engrave.ts';

export {
  BUG_FIT,
  ENGRAVE,
  LINE,
  RIM,
  TILE_DEFS,
  bugHtml,
  symbolId,
  symbolOf,
  type Fit,
} from './engrave.ts';

const FILES: Readonly<Record<Bug, string>> = {
  queen: QUEEN,
  beetle: BEETLE,
  grasshopper: GRASSHOPPER,
  spider: SPIDER,
  ant: ANT,
};

/** The sprite: zero-sized rather than `display: none`, which some browsers refuse to `<use>` from. */
export const BUG_SPRITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${TILE_DEFS}</defs>${BUGS.map(
  (bug) => symbolOf(bug, FILES[bug]),
).join('')}</svg>`;
