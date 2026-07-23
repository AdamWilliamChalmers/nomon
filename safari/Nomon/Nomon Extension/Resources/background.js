// Hosts the extension may fetch via the background proxy (kept in sync with
// manifest.json host_permissions).
const ALLOWED_FETCH_HOSTS = new Set([
  "nomon-app.com",
  "app.lumen.io",
  "lumen-web-vscp.onrender.com",
  "localhost",
]);

function isAllowedFetchUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol === "https:") {
      return ALLOWED_FETCH_HOSTS.has(url.hostname);
    }
    if (url.protocol === "http:" && url.hostname === "localhost") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "lumenFetch") return;

  const { url, options = {} } = message;
  if (!isAllowedFetchUrl(url)) {
    sendResponse({ ok: false, error: "fetch blocked: URL not allowlisted" });
    return;
  }

  fetch(url, options)
    .then(async (res) => {
      sendResponse({
        ok: res.ok,
        status: res.status,
        body: await res.text(),
      });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: err?.message || String(err) });
    });

  return true;
});
