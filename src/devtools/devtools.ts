// Registers the JS Grabber panel in DevTools.
// Runs in the devtools page context — browser.devtools.* is available here.
//
// IMPORTANT: the third argument must be a path RELATIVE to the extension root,
// not a runtime.getURL() absolute URL. The API rejects full URLs.
import browser from 'webextension-polyfill'

browser.devtools.panels
  .create('JS Grabber', 'icons/icon16.png', 'src/panel/index.html')
  .then((panel) => console.log('[JS Grabber] DevTools panel registered.', panel))
  .catch((err) => console.error('[JS Grabber] Panel creation failed:', err))
