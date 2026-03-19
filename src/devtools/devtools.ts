// Registers the JS Grabber panel in Chrome DevTools.
// This file runs in the devtools page context — chrome.devtools.* is available here.
//
// Note on panel URL: vite-plugin-web-extension builds src/panel/index.html to
// dist/src/panel/index.html, so chrome.runtime.getURL('src/panel/index.html')
// resolves correctly within the packed extension.
chrome.devtools.panels.create(
  'JS Grabber',
  '', // icon — leave empty to use the extension's default action icon
  chrome.runtime.getURL('src/panel/index.html'),
)
