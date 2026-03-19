// Registers the JS Grabber panel in Chrome DevTools.
// Runs in the devtools page context — chrome.devtools.* is available here.
//
// IMPORTANT: the third argument must be a path RELATIVE to the extension root,
// not a chrome.runtime.getURL() absolute URL. The API rejects full URLs.
chrome.devtools.panels.create(
  'JS Grabber',
  'icons/icon16.png',
  'src/panel/index.html',
  (panel) => {
    if (chrome.runtime.lastError) {
      console.error('[JS Grabber] Panel creation failed:', chrome.runtime.lastError.message)
      return
    }
    console.log('[JS Grabber] DevTools panel registered.', panel)
  },
)
