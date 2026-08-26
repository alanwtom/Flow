# Store icons

Listing icons for AMO and the Chrome Web Store. These are **not** the extension's
own icons — `images/bird*.png` are the toolbar icons and are referenced by the
manifests. Nothing here is shipped inside the extension package.

| File | Use |
| --- | --- |
| `flow-icon-blue.png` | **Upload this to AMO.** White bird on `#3b82f6` |
| `flow-icon-dark.png` | Blue bird on `#121212`, matches the popup |
| `flow-icon-light.png` | Blue bird on white |
| `flow-icon-transparent.png` | No plate |
| `*@512.png` | For README art / CWS promo tiles |
| `flow-bird.svg` | Vector master, uses `currentColor` |

AMO resizes anything larger to 128×128, so upload the 128 rather than the 512 to
avoid an extra resampling pass.

## Regenerating

Derive new sizes from `flow-bird.svg`, **not** from `images/bird-active-128.png`.

That PNG is itself blurry — roughly 26% of its pixels sit in the soft middle of
the alpha ramp, because it was upscaled from small art (`images/bird.png` is only
24×24). Anything resampled from it inherits that blur, which is why the first
version of these icons looked fuzzy.

`flow-bird.svg` was recovered from it by supersampling the alpha 8×,
re-thresholding to restore hard edges, smoothing the contour, and tracing to
Bezier paths. The finished 128px icons measure 0.9% soft midtones against the
source's 26.1%.

The trace is faithful to the original bird rather than a redraw, so at very large
sizes the contour is slightly organic. It reads as clean at 128px and below,
which covers every size the stores serve.
