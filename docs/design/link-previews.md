# Link previews: splash art per game, the join code in the card

Owner (2026-09-25): "when I text an invite link to my friends, I want the iMessage link to show
nice splash art. And when there's a JOIN code I want it to show that in the main area."

## 1. What iMessage needs

iMessage (and Messages on the Mac, Slack, Twitter, Facebook) unfurls a pasted link by fetching the
page once, as an anonymous GET with no JavaScript, and reading its `<head>`:

| Tag                                         | Value here                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `og:title`                                  | the game's name ("Gin Rummy", "Sheshbesh", "Briscola"); under `?join=CODE`: "Join Sheshbesh: code TNJQ" |
| `og:description`                            | one line on the game; under a code: "You're invited to Sheshbesh. Open the link to sit down; the room code is TNJQ." |
| `og:image`                                  | an **absolute** URL (relative ones are ignored): `https://games.sweedler.com/<game>/splash.png`         |
| `og:image:width`, `og:image:height`, `og:image:alt` | 1200 x 630 (the 1.91:1 large card), a sentence for screen readers                              |
| `og:url`                                    | the page's short URL; under a code, the invite itself                                                  |
| `og:type`                                   | `website`                                                                                              |
| `twitter:card`                              | `summary_large_image` (the image across the card's top, the title under it), with twitter:title, twitter:description, twitter:image repeating the og values for the readers that prefer them |

The image must be served same-origin as the page it is named from, with `content-type: image/png`
(GitHub Pages sets it from the extension; the Worker passes it through) and no redirect, at
1200 x 630, under about 1 MB. `<title>` is not part of the card and stays the page's.

**Two origins.** The Pages origin (`arisweedler.github.io/games/`) serves the
committed `index.html` bytes for every query string: its card is the same for `/gin-rummy/` and
`/gin-rummy/?join=TNJQ`. The Worker origin (`games.sweedler.com`, infra/games-proxy) sees the query
before it fetches upstream, so only it can vary the card by code. Both pages name the Worker origin
in `og:url` and `og:image` (the URLs the owner texts), so a Pages link previews with the same art.

## 2. The static card: one drawn SVG per game

`web/games/<game>/assets/splash.svg`, 1200 x 630, in the game's quiet theme (feedback: recognizable
at a glance, otherwise quiet): gin's felt with three plain cards and one gold hairline; the
Sheshbesh aegean panel with nacre type, a gold hairline, six olive-wood points and two plain
checkers; Briscola's sand and lagoon with the sand hairline between them, terracotta type, the honu
as a faint watermark and three plain cards on the water. Each carries the domain small.

The SVG is rendered once, locally, by `tools/splash.ts` (the repo's Playwright Chromium at device
scale 1: `node --experimental-strip-types tools/splash.ts`) to `web/public/games/<game>/splash.png`,
and the PNG is committed. It lives under `web/public/` because Vite copies that tree verbatim to
dist and a `<meta content>` URL is not an asset reference Vite would hash or copy; from there the
file ships at `games/<game>/splash.png` on both origins, which the Worker's catch-all maps for
`/<game>/splash.png` (and `/sheshbesh/splash.png` through the alias). No build step renders it: the
render needs a browser, the PNG changes only when its SVG does, and a committed image is what the
dist guard checks. `test/dist/link-previews.test.ts` reads the PNG's IHDR and holds it to the head's
1200 x 630, holds `og:image` absolute on the Worker origin and resolving through `mapPath` to a file
the build ships, `og:url` to the page's own short URL, and the card to `summary_large_image`.

**Hive's card is composed, not drawn** (the owner, 2026-10-02: "The richlink for hive still
contains the old art", "fix the splash pipeline first"). The hand-drawn hexagons with letters went
stale the day the engraved bug art landed, so `tools/splash-hive.ts` builds
`web/games/hive/assets/splash.svg` from what the page draws: the five files under
`web/games/hive/assets/bugs/` become the same `<symbol>`s the page's sprite holds, each tile is the
board's hexagon (`ui/board.ts cornersOf`) with the sheen and bevel and the bug's four engraving
layers (`ui/engrave.ts symbolOf`, `bugHtml`, `TILE_DEFS`: rim, shade, gleam, ink), the colours are
the tokens read off `web/games/hive/theme.css`, and the felt is the shared one. A flower of seven
tiles, White's Queen at the centre, every bug once, the amber name and one line of copy. The
composition is pure and deterministic, so the committed SVG stays the one source the renderer
reads and a test can recompose it.

**The guard.** `tools/splash.ts` writes Hive's SVG, renders every card, then records each render in
a sidecar beside the SVG, `web/games/<game>/assets/splash.sha256`: the SHA-256 of the SVG and of
the PNG, in `shasum -a 256 -c` form. `tools/splash.test.ts` (harness suite) fails when Hive's SVG
is not the composition byte for byte, or when any game's SVG or PNG no longer matches its sidecar,
each with the one line to run: `node --experimental-strip-types tools/splash.ts`. So a bug file,
the engraving, Hive's palette or a hand-drawn SVG changed without a re-render fails CI, and a PNG
left uncommitted after one does too. Re-run the tool and commit the SVG, the PNG and the sidecar.

Fidice keeps its own head (its page is not composed by tools/shell-markup.ts) and has no splash
yet; the landing page is untouched. Both are one more SVG and a head edit when wanted.

## 3. The Worker: the code in the card

`infra/games-proxy/worker.ts`, on a `GET` whose `?join=` has a room code's shape (4 or 5 letters or
digits; web/shared/lib/roomCode.ts's alphabets fit, the test pins them) and whose upstream answer is
`200 text/html`: the body is read and `joinPreview(html, code, invite)` rewrites the `content` of
`og:title` and `twitter:title` to "Join <game>: code <CODE>" (the game read off the page's own
`og:title`), both descriptions to a line that says the code, and `og:url` to the invite (this
origin, the requested path, `?join=CODE` alone, so the harness's `?peer=`/`?ice=` never leak into a
card). `content-length` and `content-encoding` are dropped since the body changed; every other
header passes. A HEAD, a non-HTML answer, an error page, a code of the wrong shape or a page without
an `og:title` pass through untouched and still streamed.

**Why a string rewrite and not HTMLRewriter.** The same `fetch` handler runs in node: the table
tests (site suite, 95 % coverage floor on this file) and tools/proxy-dev.ts, which is the Playwright
`proxy` project's origin. Node has no HTMLRewriter, so using it would mean a fake for the tests and
an untested path in production. The pages are this repo's own composed markup with one meta per
line, `property`/`name` before `content`, so a targeted regex over the buffered page is exact and
about forty lines. A page is under 60 KB; buffering it for the one request that carries a code
costs nothing visible.

## 4. Decision: the code is text in this PR; the image with the code is a follow-up

The owner asked for the code "in the main area", the image. Composing a PNG at the edge with no
browser and no image library is possible but not a ten-minute change: the Worker would fetch the
splash as raw RGBA (1200 x 630 x 4 = 3 MB, cached with the Cache API) plus 36 pre-rendered glyph
tiles (raw RGBA too, about 150 KB each), blit the four or five tiles over the art, and write a PNG
by hand: one filter byte per row, deflate through `CompressionStream('deflate')` (available on
Workers), CRC32 for the chunks. About 250 lines of byte code with fixture tests, and a 3 MB
decode per uncached request. Alternatives that cost money: Cloudflare Images (paid) can overlay
text on a stored image by URL; Browser Rendering (paid Workers plan) can screenshot an SVG with
the code drawn in. Either would make `og:image` `https://games.sweedler.com/<game>/splash/<CODE>.png`.

This PR ships the text-only code preview: the card's image is the game's splash, its title line
"Join Sheshbesh: code TNJQ" says the code in the card's largest type below the art. The follow-up
is the composed image, by whichever of the three routes the owner picks; the head and the Worker
rewrite are already shaped for it (one more `setMeta('og:image', …)` and `twitter:image`).

## 5. Verifying

After the Worker is deployed (`npx wrangler deploy` in infra/games-proxy, the owner):
`curl -s 'https://games.sweedler.com/briscola/?join=TNJQ' | grep 'og:'` shows the code in the
titles, the descriptions and og:url; `curl -sI https://games.sweedler.com/briscola/splash.png`
answers `200` with `content-type: image/png`. Texting the link to oneself shows the card;
iMessage caches a URL's card, so a fresh code (a new URL) is needed to see a change.
