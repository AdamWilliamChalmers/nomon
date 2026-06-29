// Single source of truth for where the extension talks to the Lumen backend.
//
// Production default ships in the published extension. For local development,
// open the Lumen pill → settings and set the "Backend URL" field to
// http://localhost:3000 — that override is stored per-user and wins over this
// default everywhere (judge, calibration, session sharing).
//
// To change the production backend, edit DEFAULT_WEB_APP_URL here only.
const LumenConfig = (() => {
  const DEFAULT_WEB_APP_URL = "https://lumen.so";

  function normalize(url) {
    return String(url || DEFAULT_WEB_APP_URL).replace(/\/$/, "");
  }

  function webAppUrl(override) {
    return normalize(override || DEFAULT_WEB_APP_URL);
  }

  function judgeApiUrl(override) {
    return `${webAppUrl(override)}/api/judge`;
  }

  return { DEFAULT_WEB_APP_URL, normalize, webAppUrl, judgeApiUrl };
})();

globalThis.LumenConfig = LumenConfig;
