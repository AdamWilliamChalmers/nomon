// Anonymous install id for session/survey POSTs — UUID v4, persisted in localStorage.
const LumenUserId = (() => {
  const KEY = "lumenUserId";
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function fallbackUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function get() {
    let id = null;
    try {
      id = localStorage.getItem(KEY);
    } catch (_) {
      // ignore
    }
    if (id && UUID_RE.test(id)) return id;
    id = globalThis.crypto?.randomUUID?.() || fallbackUuid();
    try {
      localStorage.setItem(KEY, id);
    } catch (_) {
      // ignore
    }
    return id;
  }

  return { get };
})();

globalThis.LumenUserId = LumenUserId;
