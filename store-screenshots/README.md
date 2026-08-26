# Store screenshots

Listing screenshots for AMO and the Chrome Web Store, 2400×1800 (AMO's maximum
and recommended size). Not shipped inside the extension package.

Upload in this order — AMO uses the first as the primary image.

| # | File | Caption used on the listing |
| --- | --- | --- |
| 1 | `01-youtube.png` | Turn off YouTube's homepage feed, Shorts, and the up-next sidebar. Search and subscriptions keep working. |
| 2 | `02-global.png` | Enable every blocker at once — and unchecking it restores your previous per-site settings. |
| 3 | `03-reddit.png` | Hide Reddit's home feed, comments, and right sidebar. Subreddits and search stay put. |
| 4 | `04-x.png` | Hide the timeline, What's happening, and Who to follow on X. |

Captions double as accessibility text on the listing, so they describe what the
panel shows rather than repeating the headline in the image.

## Regenerating

These are real renders of `popup.html`, not mockups — the panel loads in an
iframe and is driven by clicking its actual dropdown, so the images cannot drift
out of sync with the code.

Rendered with headless Chrome at `--window-size=1200,900` and
`--force-device-scale-factor=2`, which yields exactly 2400×1800.

Three presentation overrides are injected into the iframe. They are the only
places the image departs from the shipping UI:

- The dark palette is pinned, so the shot does not depend on the renderer's
  `prefers-color-scheme` (the popup follows the browser theme since 2.3).
- `.sub-options` has its `max-height` removed, so the whole option list shows
  instead of a scroll-clipped half row.
- The header's 24×24 `cockatiel.gif` is swapped for `flow-bird.svg`, since a
  24px GIF magnified 1.5× looks like mush.

## Why there are no before/after shots of the sites

Capturing the blockers working on real feeds needs a signed-in session, and
automation cannot get one honestly:

- Signed-out YouTube has an empty homepage — no feed to block.
- The signed-out watch page never finishes hydrating headless; the sidebar and
  comments stay as grey skeletons.
- Reddit serves a bot CAPTCHA to headless browsers.
- X is behind a login wall.

A signed-in capture would put a real account's feed, avatar, and subscriptions on
a public listing. If before/after shots are wanted, capture them by hand with the
blockers off and then on, and compose the pairs from those.
