/* global globalThis */
/**
 * Fetch localhost APIs from the extension service worker so ChatGPT pages
 * don't hit Private Network Access / loopback blocks on content-script fetch.
 */
const LumenNet = (() => {
  function viaBackground(url, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "lumenFetch", url, options }, (response) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("No response from extension background"));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve({
          ok: response.ok,
          status: response.status,
          json: () => Promise.resolve(JSON.parse(response.body)),
          text: () => Promise.resolve(response.body),
        });
      });
    });
  }

  async function fetch(url, options = {}) {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        return await viaBackground(url, options);
      } catch (_) {
        // Fall through if background unavailable (e.g. unpacked reload race).
      }
    }
    return globalThis.fetch(url, options);
  }

  return { fetch };
})();

globalThis.LumenNet = LumenNet;
