// Exercises the real youtube-blocker.js against fake YouTube shelves in jsdom.
// Run from the repo root, with jsdom installed somewhere scratch:
//   npm --prefix /tmp/flow-yt-test i jsdom
//   NODE_PATH=/tmp/flow-yt-test/node_modules node tests/youtube-shelves.test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { JSDOM } = createRequire(import.meta.url)('jsdom');

const blockerSrc = readFileSync(new URL('../youtube-blocker.js', import.meta.url), 'utf8');

function makePage(bodyHtml, settings) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${bodyHtml}</body></html>`, {
    url: 'https://www.youtube.com/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // Minimal chrome storage stub matching how the blocker uses it.
  window.chrome = {
    storage: {
      sync: {
        get: (keys, cb) => {
          const out = {};
          (Array.isArray(keys) ? keys : Object.keys(keys || {})).forEach(k => { out[k] = settings[k]; });
          if (typeof cb === 'function') cb(out);
          return Promise.resolve(out);
        },
      },
      onChanged: { addListener: () => {} },
    },
  };
  window.eval(blockerSrc);
  return window;
}

const shelf = (id, title, inner = '<ytd-rich-item-renderer><a href="/watch?v=1">A normal video</a></ytd-rich-item-renderer>') =>
  `<ytd-rich-section-renderer id="${id}"><ytd-rich-shelf-renderer><div id="title">${title}</div>${inner}</ytd-rich-shelf-renderer></ytd-rich-section-renderer>`;

const BODY = [
  shelf('s-play', 'Play while you watch'),
  shelf('s-featured', 'YouTube Featured'),
  shelf('s-explore', 'Explore more topics'),
  shelf('s-relevant', 'Most relevant'),
  shelf('s-breaking', 'Breaking news'),
  shelf('s-trending', 'Trending'),
  shelf('s-normal', 'Your subscriptions', '<ytd-rich-item-renderer><a href="/watch?v=2">Breaking news in this video title only</a></ytd-rich-item-renderer>'),
  `<ytd-rich-item-renderer id="loose-featured"><yt-lockup-view-model>YouTube featured — Try for free</yt-lockup-view-model></ytd-rich-item-renderer>`,
  `<ytd-rich-item-renderer id="loose-normal"><yt-lockup-view-model>Just a video card</yt-lockup-view-model></ytd-rich-item-renderer>`,
].join('\n');

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (display="${actual}", want "${expected}")`);
}
const disp = (w, id) => w.document.getElementById(id)?.style.display ?? '(missing)';

// Case 1: everything on — all titled shelves hidden, normal shelf + normal card stay.
{
  const w = makePage(BODY, { yt_playables: true, yt_featured: true, yt_explore: true, yt_news: true });
  check('Play while you watch hidden by Playables toggle', disp(w, 's-play'), 'none');
  check('YouTube Featured hidden', disp(w, 's-featured'), 'none');
  check('Explore more topics hidden', disp(w, 's-explore'), 'none');
  check('Most relevant hidden', disp(w, 's-relevant'), 'none');
  check('Breaking news hidden', disp(w, 's-breaking'), 'none');
  check('Trending hidden', disp(w, 's-trending'), 'none');
  check('Normal shelf untouched (title-word in video title is not a shelf title)', disp(w, 's-normal'), '');
  check('Loose Featured card hidden', disp(w, 'loose-featured'), 'none');
  check('Loose normal card untouched', disp(w, 'loose-normal'), '');
}

// Case 2: only Featured on — news/explore/play shelves stay.
{
  const w = makePage(BODY, { yt_featured: true });
  check('Only Featured on: Featured hidden', disp(w, 's-featured'), 'none');
  check('Only Featured on: Breaking news stays', disp(w, 's-breaking'), '');
  check('Only Featured on: Play shelf stays', disp(w, 's-play'), '');
  check('Only Featured on: Explore stays', disp(w, 's-explore'), '');
}

// Case 3: nothing on — nothing hidden (no crash on missing/empty titles).
{
  const w = makePage(BODY + '<ytd-rich-section-renderer id="s-empty"></ytd-rich-section-renderer>', {});
  check('Nothing on: Featured stays', disp(w, 's-featured'), '');
  check('Nothing on: empty shelf does not crash', disp(w, 's-empty'), '');
}

// Case 3b: auto-hide hides a shelf nobody named yet, but never a lone video.
{
  const w = makePage(
    shelf('s-future', 'Podcasts you might like') + '<ytd-rich-item-renderer id="lone-video"><a href="/watch?v=9">A video I chose</a></ytd-rich-item-renderer>',
    { yt_auto_shelves: true }
  );
  check('Auto-hide: unnamed future shelf hidden', disp(w, 's-future'), 'none');
  check('Auto-hide: lone video outside any shelf untouched', disp(w, 'lone-video'), '');
}

// Case 4: shelf added after load gets hidden by the watcher.
{
  const w = makePage('<div id="feed"></div>', { yt_news: true });
  const feed = w.document.getElementById('feed');
  const div = w.document.createElement('div');
  div.innerHTML = shelf('s-late', 'Top news');
  feed.appendChild(div.firstChild);
  await new Promise(r => setTimeout(r, 350));
  check('Late-added Top news shelf hidden by watcher', disp(w, 's-late'), 'none');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
