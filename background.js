chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "lumenFetch") return;

  const { url, options = {} } = message;
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
