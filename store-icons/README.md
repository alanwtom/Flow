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
| `flow-bird.svg` | Vector master — stroked paths, uses `currentColor` |

AMO resizes anything larger to 128×128, so upload the 128 rather than the 512 to
avoid an extra resampling pass.

## Regenerating

Derive everything from `flow-bird.svg`. **Never** from `images/bird-active-128.png`.

That PNG is itself blurry — about 26% of its pixels sit in the soft middle of the
alpha ramp, because it was upscaled from small art (`images/bird.png` is only
24×24). Anything resampled from it inherits the blur.

`flow-bird.svg` is a redraw, not a trace. An earlier attempt auto-traced the
bitmap, which produced *filled outlines* whose thickness wobbled visibly — hard
edges, but lumpy strokes. Line art needs to be **stroked** paths of constant
width, so the bird is now seven paths plus a circle, on a 100×100 grid, with
`stroke-width: 5.2`, round caps and round joins. That is why the file is 616
bytes rather than 5 KB, and why it stays clean at any size.

The finished 128px icons measure 0.9% soft midtones against the source's 26.1%.

Two things to watch if you ever re-derive the raster icons:

- Keep the glyph around 70% of the canvas. Shrinking it thins the strokes, which
  is what made the first version look fuzzy at small sizes.
- The plate corner radius is 0.2237 of the icon size, the iOS/macOS ratio.
