/**
 * Local ledger of Cost-coach savings the user applied or marked as used.
 * chrome.storage.local only — never uploaded.
 */
const LumenCostLedger = (() => {
  const STORAGE_KEY = "lumenCostSavings";
  const MAX_EVENTS = 500;
  const chromeApi = globalThis.chrome;

  /** @type {{ version: number, events: object[] }} */
  let cache = { version: 1, events: [] };
  let loaded = false;
  const listeners = new Set();

  function notify() {
    listeners.forEach((cb) => {
      try {
        cb(summarize());
      } catch (_) {
        /* ignore */
      }
    });
  }

  function onChange(cb) {
    if (typeof cb !== "function") return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function persist() {
    const payload = { version: 1, events: cache.events.slice(-MAX_EVENTS) };
    cache = payload;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
    if (chromeApi?.storage?.local?.set) {
      chromeApi.storage.local.set({ [STORAGE_KEY]: payload }, () => {
        void chromeApi.runtime?.lastError;
      });
    }
    notify();
  }

  function load() {
    return new Promise((resolve) => {
      const finish = (data) => {
        if (data && Array.isArray(data.events)) {
          cache = { version: 1, events: data.events.slice(-MAX_EVENTS) };
        } else {
          cache = { version: 1, events: [] };
        }
        loaded = true;
        notify();
        resolve(cache);
      };

      if (!chromeApi?.storage?.local?.get) {
        try {
          finish(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
        } catch (_) {
          finish(null);
        }
        return;
      }

      chromeApi.storage.local.get(STORAGE_KEY, (result) => {
        if (chromeApi.runtime?.lastError || result == null) {
          try {
            finish(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
          } catch (_) {
            finish(null);
          }
          return;
        }
        finish(result[STORAGE_KEY]);
      });
    });
  }

  if (chromeApi?.storage?.onChanged?.addListener) {
    chromeApi.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes?.[STORAGE_KEY]) return;
      const next = changes[STORAGE_KEY].newValue;
      if (next && Array.isArray(next.events)) {
        cache = { version: 1, events: next.events.slice(-MAX_EVENTS) };
        notify();
      }
    });
  }

  function fingerprint(event) {
    const day = new Date(event.at).toISOString().slice(0, 10);
    return `${event.ruleId}|${day}|${event.host}|${Math.round((event.usd || 0) * 1e6)}`;
  }

  /**
   * Record a save the user applied / confirmed / switched into.
   * Dedupes same tip+host+day so the strip doesn't spam the ledger.
   * A later "switched" upgrades a same-day "logged" entry.
   */
  function recordApplied({
    ruleId,
    title,
    usd,
    tokens = 0,
    modelId = null,
    host = null,
    source = "logged",
    fromModelId = null,
    toModelId = null,
  }) {
    const usdNum = Number(usd);
    if (!ruleId || !Number.isFinite(usdNum) || usdNum <= 0) return null;

    const src =
      source === "applied" || source === "switched" || source === "auto-switched"
        ? source
        : "logged";

    const event = {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: Date.now(),
      host: host || (typeof location !== "undefined" ? location.hostname : ""),
      modelId,
      fromModelId: fromModelId || null,
      toModelId: toModelId || null,
      ruleId,
      title: String(title || ruleId).slice(0, 120),
      usd: usdNum,
      tokens: Math.max(0, Math.round(Number(tokens) || 0)),
      source: src,
    };

    const fp = fingerprint(event);
    const recentDup = cache.events.find(
      (e) => fingerprint(e) === fp && Date.now() - e.at < 12 * 60 * 60 * 1000
    );
    if (recentDup) {
      if (src === "switched" || src === "auto-switched") {
        if (recentDup.source === "logged" || recentDup.source === "switched") {
          recentDup.source = src;
          recentDup.fromModelId = event.fromModelId;
          recentDup.toModelId = event.toModelId;
          recentDup.at = event.at;
          persist();
          return recentDup;
        }
      }
      return null;
    }

    cache.events.push(event);
    persist();
    return event;
  }

  function clear() {
    cache = { version: 1, events: [] };
    persist();
  }

  function startOfIsoWeek(ts = Date.now()) {
    const d = new Date(ts);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.getTime();
  }

  function startOfMonth(ts = Date.now()) {
    const d = new Date(ts);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function sumSince(since) {
    return cache.events
      .filter((e) => e.at >= since)
      .reduce((n, e) => n + (e.usd || 0), 0);
  }

  function summarize() {
    const now = Date.now();
    const week = sumSince(startOfIsoWeek(now));
    const month = sumSince(startOfMonth(now));
    const all = cache.events.reduce((n, e) => n + (e.usd || 0), 0);
    const tokens = cache.events.reduce((n, e) => n + (e.tokens || 0), 0);
    return {
      loaded,
      eventCount: cache.events.length,
      usdAllTime: all,
      usdThisWeek: week,
      usdThisMonth: month,
      tokensAllTime: tokens,
      recent: [...cache.events].reverse().slice(0, 20),
    };
  }

  return {
    load,
    recordApplied,
    clear,
    summarize,
    onChange,
  };
})();

globalThis.LumenCostLedger = LumenCostLedger;
