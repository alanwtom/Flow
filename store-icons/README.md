# Store icons

Listing icons for AMO and the Chrome Web Store. These are **not** the extension's
own icons — `images/bird*.png` are the toolbar icons referenced by the manifests.
Nothing here is shipped inside the extension package.

| File | Use |
| --- | --- |
| `flow-icon-blue.png` | **Upload this to AMO.** White bird on `#3b82f6` |
| `flow-icon-dark.png` | Blue bird on `#121212`, matches the popup |
| `flow-icon-light.png` | Blue bird on white |
| `flow-icon-transparent.png` | No plate |
| `*@512.png` | README art, CWS promo tiles |
| `flow-bird.svg` | Vector master, uses `currentColor` |
| `LUCIDE-LICENSE` | ISC licence for the bird artwork — keep it alongside the SVG |

AMO resizes anything larger to 128×128, so upload the 128 rather than the 512 to
avoid an extra resampling pass.

## Where the bird comes from

`flow-bird.svg` is **Lucide's `bird` icon, mirrored horizontally** — the six
upstream paths wrapped in a `scale(-1 1)` transform. It is not a trace and not a
redraw. https://lucide.dev/icons/bird

The extension's own `images/bird*.png` came from the same icon, flipped in commit
`c2e3b5f` ("flip extension icons left"), then exported at a size that left them
blurry.

Identified by rendering candidate bird icons from ~200 sets via the Iconify
search API and scoring silhouette overlap against `images/bird-active-128.png`:
Lucide scored **88.1% IoU** mirrored, against 54.9% for the runner-up. The path
data corroborates it exactly — `M16 7h.01` is the eye, `m20 7 2 .5-2 .5` the
beak, `M10 18v3` and `M14 17.75V21` the two legs, `H12` the branch, `L2 20` the
tail.

## Regenerating

Derive every size from `flow-bird.svg`.

**Never** derive from `images/bird-active-128.png`. That file is blurry — roughly
26% of its pixels sit in the soft middle of the alpha ramp, and 19% sit at alpha
1–31, an invisible noise halo that also makes `getbbox()` report bounds ~17%
larger than the real ink. Earlier icon attempts inherited both problems: soft
edges, and a bird rendered too small inside the plate.

Rendered from the vector, the 128px icons measure 0.9% soft midtones.

Two things to keep if you rebuild the rasters:

- Glyph at ~64% of the canvas (0.92 for the transparent variant).
- Plate corner radius 0.2237 of the icon size, the iOS/macOS ratio.

Since the real vector is available now, `images/bird*.png` could also be
regenerated crisply from it at 16/48/128 — that has not been done.
