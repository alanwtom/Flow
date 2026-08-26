# Store screenshots

Listing screenshots, in one folder per store because the two have incompatible
requirements. Not shipped inside the extension package.

| | `mozilla/` (AMO) | `chrome/` (Chrome Web Store) |
| --- | --- | --- |
| Size | 2400×1800 (max & recommended) | 1280×800 (the other legal size is 640×400) |
| Aspect | 4:3 | 16:10 |
| Format | PNG, alpha allowed | **24-bit PNG, no alpha** (or JPEG) |
| Max count | — | 5 |
| Captions | set per screenshot | not supported |

The aspect ratios differ, so these are re-rendered per store rather than
resized — a 2400×1800 scaled to 1280×800 would letterbox or crop.

The Chrome set is rendered at 2×, downsampled to 1280×800, then flattened onto
an opaque background: the store rejects PNGs carrying an alpha channel, and
Chrome's headless screenshots include one by default.

Upload in filename order — AMO uses the first as the primary image.

| # | File | AMO caption |
| --- | --- | --- |
| 1 | `01-youtube.png` | Turn off YouTube's homepage feed, Shorts, and the up-next sidebar. Search and subscriptions keep working. |
| 2 | `02-global.png` | Enable every blocker at once — and unchecking it restores your previous per-site settings. |
| 3 | `03-reddit.png` | Hide Reddit's home feed, comments, and right sidebar. Subreddits and search stay put. |
| 4 | `04-x.png` | Hide the timeline, What's happening, and Who to follow on X. |

Captions double as accessibility text, so they describe what the panel shows
rather than repeating the headline burned into the image. The Chrome Web Store
has no caption field at all. `scripts/amo-captions.py` writes the AMO ones
through the API.

## Regenerating

Real renders of `popup.html`, not mockups — the panel loads in an iframe and is
driven by clicking its actual dropdown, so the images cannot drift from the
shipping UI. `preset=cws` in the query string switches the layout from AMO's
1200×900 to the Chrome Web Store's 1280×800.

Three presentation overrides are injected into the iframe, the only places these
depart from the shipping UI:

- The dark palette is pinned, so the shot does not depend on the renderer's
  `prefers-color-scheme` (the popup follows the browser theme since 2.3).
- `.sub-options` has its `max-height` removed, so the whole option list shows
  instead of a scroll-clipped half row.
- The header's 24×24 `cockatiel.gif` is swapped for `flow-bird.svg`, since a
  24px GIF magnified looks like mush.

## Why there are no before/after shots of the sites

Capturing the blockers working on real feeds needs a signed-in session, and
automation cannot get one honestly:

- Signed-out YouTube has an empty homepage — no feed to block.
- The signed-out watch page never finishes hydrating headless; sidebar and
  comments stay grey skeletons.
- Reddit serves a bot CAPTCHA to headless browsers.
- X is behind a login wall.

A signed-in capture would put a real account's feed, avatar and subscriptions on
a public listing. If before/after shots are wanted, capture them by hand with the
blockers off and then on, and compose the pairs from those.
