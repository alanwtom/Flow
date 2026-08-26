# Store screenshots

Listing screenshots for AMO and the Chrome Web Store, 2400×1800 (AMO's maximum
and recommended size). Not shipped inside the extension package.

| File | Shows |
| --- | --- |
| `01-youtube.png` | YouTube options — the fullest panel, good lead image |
| `02-global.png` | Global settings, reversible "Enable All Blockers" |
| `03-reddit.png` | Reddit options |
| `04-x.png` | X / Twitter options |

Upload `01-youtube.png` first; AMO uses the first screenshot as the primary.

## Regenerating

These are real renders of `popup.html`, not mockups — the panel is loaded in an
iframe and driven by clicking its actual dropdown, so the UI can never drift out
of sync with the code.

Rendered with headless Chrome at `--window-size=1200,900` and
`--force-device-scale-factor=2`, which yields exactly 2400×1800.

Three presentation overrides are injected into the iframe, and they are the only
places the image departs from the shipping UI:

- The dark palette is pinned, so the shot does not depend on the renderer's
  `prefers-color-scheme`.
- `.sub-options` has its `max-height` removed, so the whole option list is
  visible instead of a scroll-clipped half row.
- The 24×24 `cockatiel.gif` in the header is swapped for `flow-bird.svg`, since
  a 24px GIF magnified 1.5× looks like mush.
