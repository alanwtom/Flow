// Stub `chrome.storage`/`chrome.tabs` so popup.html can be opened directly in a
// plain browser tab for layout work. No-op inside a real extension context.
//
// This lives in its own file rather than an inline <script> because MV3's default
// CSP (`script-src 'self'`) blocks inline scripts on extension pages.
//
// The shape here mirrors the real API as popup.js uses it: promise-returning,
// not callback-style. Firefox's `browser.*` namespace is promise-only, and
// Chromium's `chrome.*` returns a promise when no callback is passed.
if (typeof chrome === 'undefined' || !chrome.storage) {
  const mockData = {
    selectedSite: 'youtube',
    newTabBlockerEnabled: true,
    yt_homepage: true,
    yt_shorts: true,
    yt_posts: true,
    yt_sidebar: true,
    yt_comments: false,
    yt_endcards: false,
    yt_chat: false,
    yt_notifications: false,
    yt_create_button: false,
    yt_autoplay: false,
    yt_playables: false
  };

  const select = (keys) => {
    if (keys === null || keys === undefined) return { ...mockData };
    if (typeof keys === 'string') return { [keys]: mockData[keys] };
    if (Array.isArray(keys)) {
      const res = {};
      keys.forEach(k => { res[k] = mockData[k]; });
      return res;
    }
    // Object form: keys are names, values are defaults.
    const res = {};
    Object.entries(keys).forEach(([k, fallback]) => {
      res[k] = mockData[k] !== undefined ? mockData[k] : fallback;
    });
    return res;
  };

  const area = {
    get: (keys) => Promise.resolve(select(keys)),
    set: (data) => {
      Object.assign(mockData, data);
      return Promise.resolve();
    },
    remove: (keys) => {
      (Array.isArray(keys) ? keys : [keys]).forEach(k => { delete mockData[k]; });
      return Promise.resolve();
    }
  };

  window.chrome = {
    storage: {
      sync: area,
      session: area,
      onChanged: { addListener: () => {} }
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, url: 'https://www.youtube.com/' }]),
      get: (id) => Promise.resolve({ id }),
      update: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      onActivated: { addListener: () => {} },
      onCreated: { addListener: () => {} }
    },
    action: {
      setIcon: () => Promise.resolve()
    },
    runtime: {}
  };
}
