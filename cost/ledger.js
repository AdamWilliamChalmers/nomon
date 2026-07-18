/**
 * Local Cost ledgers (chrome.storage.local / localStorage — never uploaded):
 * - events: tip savings the user applied / logged / switched
 * - spend: post-reply call estimates (input + actual answer length)
 */
const LumenCostLedger = (() => {
  const STORAGE_KEY = "lumenCostSavings";
  const MAX_EVENTS = 500;
  const MAX_SPEND = 800;
  const chromeApi = globalThis.chrome;

  /** @type {{ version: number, events: object[], spend: object[], emaOutputTokens: number|null, outputSampleCount: number, fitMemory: Record<string, object> }} */
  let cache = {
    version: 2,
    events: [],
    spend: [],
    emaOutputTokens: null,
    outputSampleCount: 0,
    fitMemory: {},
  };
  let loaded = false;
  const listeners = new Set();

  function emptyCache() {
    return {
      version: 2,
      events: [],
      spend: [],
      emaOutputTokens: null,
      outputSampleCount: 0,
      fitMemory: {},
    };
  }

  function normalize(data) {
    if (!data || typeof data !== "object") return emptyCache();
    const fitMemory =
      data.fitMemory && typeof data.fitMemory === "object" && !Array.isArray(data.fitMemory)
        ? data.fitMemory
        : {};
    return {
      version: 2,
      events: Array.isArray(data.events) ? data.events.slice(-MAX_EVENTS) : [],
      spend: Array.isArray(data.spend) ? data.spend.slice(-MAX_SPEND) : [],
      emaOutputTokens:
        Number.isFinite(Number(data.emaOutputTokens)) && Number(data.emaOutputTokens) > 0
          ? Number(data.emaOutputTokens)
          : null,
      outputSampleCount: Math.max(0, Math.round(Number(data.outputSampleCount) || 0)),
      fitMemory,
    };
  }

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
    const payload = normalize(cache);
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
        cache = normalize(data);
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
      cache = normalize(changes[STORAGE_KEY].newValue);
      notify();
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

  const lastEmaAtByMessage = new Map();

  function noteOutputTokens(outputTokens, messageId = null) {
    const n = Math.max(1, Math.round(Number(outputTokens) || 0));
    if (!Number.isFinite(n) || n < 24) return;
    if (messageId) {
      const prevAt = lastEmaAtByMessage.get(messageId) || 0;
      if (Date.now() - prevAt < 2800) return;
      lastEmaAtByMessage.set(messageId, Date.now());
    }
    const prev = cache.emaOutputTokens;
    const count = cache.outputSampleCount || 0;
    // Warm up with early samples, then EMA.
    if (prev == null || count < 3) {
      cache.emaOutputTokens = prev == null ? n : (prev * count + n) / (count + 1);
    } else {
      cache.emaOutputTokens = prev * 0.88 + n * 0.12;
    }
    cache.outputSampleCount = count + 1;
  }

  /**
   * Upsert a post-reply spend estimate keyed by assistant message id.
   * Streaming replies refine the same row as the answer grows.
   */
  function recordSpend({
    messageId,
    userMessageId = null,
    inputTokens = 0,
    outputTokens = 0,
    usd = 0,
    modelId = null,
    modelLabel = null,
    host = null,
  }) {
    const id = String(messageId || "").trim();
    if (!id) return null;
    const inTok = Math.max(0, Math.round(Number(inputTokens) || 0));
    const outTok = Math.max(0, Math.round(Number(outputTokens) || 0));
    const usdNum = Number(usd);
    if (!Number.isFinite(usdNum) || usdNum < 0) return null;
    if (inTok + outTok < 8) return null;

    const hostName = host || (typeof location !== "undefined" ? location.hostname : "");
    const existing = cache.spend.find((e) => e.messageId === id);
    if (existing) {
      // Only grow / refine — ignore shrinks from transient DOM glitches.
      if (outTok < (existing.outputTokens || 0) * 0.85 && outTok < existing.outputTokens) {
        return existing;
      }
      existing.at = Date.now();
      existing.inputTokens = inTok;
      existing.outputTokens = Math.max(existing.outputTokens || 0, outTok);
      existing.tokens = existing.inputTokens + existing.outputTokens;
      existing.usd = usdNum;
      existing.modelId = modelId || existing.modelId;
      existing.modelLabel = modelLabel || existing.modelLabel;
      existing.host = hostName || existing.host;
      noteOutputTokens(existing.outputTokens, id);
      persist();
      return existing;
    }

    const event = {
      id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      messageId: id,
      userMessageId: userMessageId || null,
      at: Date.now(),
      host: hostName,
      modelId: modelId || null,
      modelLabel: modelLabel || null,
      inputTokens: inTok,
      outputTokens: outTok,
      tokens: inTok + outTok,
      usd: usdNum,
    };
    cache.spend.push(event);
    noteOutputTokens(outTok, id);
    persist();
    return event;
  }

  function clear() {
    cache = emptyCache();
    persist();
  }

  function clearSavings() {
    cache.events = [];
    persist();
  }

  function clearSpend() {
    cache.spend = [];
    persist();
  }

  /**
   * On-device fit learning from tip outcomes. No network.
   * outcome: accepted | dismissed
   * fit: save | upgrade
   */
  function recordFitOutcome({ taskType, fit, outcome }) {
    const key = String(taskType || "general").slice(0, 40);
    const f = fit === "upgrade" ? "upgrade" : fit === "save" ? "save" : null;
    const o = outcome === "accepted" || outcome === "dismissed" ? outcome : null;
    if (!f || !o) return null;
    if (!cache.fitMemory || typeof cache.fitMemory !== "object") cache.fitMemory = {};
    const row = cache.fitMemory[key] || {
      saveAccept: 0,
      saveDismiss: 0,
      upgradeAccept: 0,
      upgradeDismiss: 0,
    };
    if (f === "save" && o === "accepted") row.saveAccept += 1;
    if (f === "save" && o === "dismissed") row.saveDismiss += 1;
    if (f === "upgrade" && o === "accepted") row.upgradeAccept += 1;
    if (f === "upgrade" && o === "dismissed") row.upgradeDismiss += 1;
    // Cap so old habits can fade if we later add decay; keep memory bounded.
    for (const k of Object.keys(row)) {
      row[k] = Math.min(12, row[k]);
    }
    cache.fitMemory[key] = row;
    persist();
    return row;
  }

  /** Score delta from local history: negative leans save, positive leans upgrade. */
  function fitScoreAdjust(taskType) {
    const key = String(taskType || "general");
    const row = cache.fitMemory?.[key];
    if (!row) return 0;
    let adj = 0;
    adj -= Math.min(2, (row.saveAccept || 0) * 0.45);
    adj += Math.min(1.5, (row.saveDismiss || 0) * 0.4);
    adj += Math.min(2, (row.upgradeAccept || 0) * 0.45);
    adj -= Math.min(2.5, (row.upgradeDismiss || 0) * 0.7);
    return adj;
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

  function sumSince(list, since) {
    return list.filter((e) => e.at >= since).reduce((n, e) => n + (e.usd || 0), 0);
  }

  function summarizeSavings() {
    const now = Date.now();
    const week = sumSince(cache.events, startOfIsoWeek(now));
    const month = sumSince(cache.events, startOfMonth(now));
    const all = cache.events.reduce((n, e) => n + (e.usd || 0), 0);
    const tokens = cache.events.reduce((n, e) => n + (e.tokens || 0), 0);
    return {
      eventCount: cache.events.length,
      usdAllTime: all,
      usdThisWeek: week,
      usdThisMonth: month,
      tokensAllTime: tokens,
      recent: [...cache.events].reverse().slice(0, 20),
    };
  }

  function summarizeSpend() {
    const now = Date.now();
    const week = sumSince(cache.spend, startOfIsoWeek(now));
    const month = sumSince(cache.spend, startOfMonth(now));
    const all = cache.spend.reduce((n, e) => n + (e.usd || 0), 0);
    const tokens = cache.spend.reduce((n, e) => n + (e.tokens || 0), 0);
    const callsWeek = cache.spend.filter((e) => e.at >= startOfIsoWeek(now)).length;
    return {
      callCount: cache.spend.length,
      callsThisWeek: callsWeek,
      usdAllTime: all,
      usdThisWeek: week,
      usdThisMonth: month,
      tokensAllTime: tokens,
      emaOutputTokens: cache.emaOutputTokens,
      outputSampleCount: cache.outputSampleCount || 0,
      recent: [...cache.spend].reverse().slice(0, 12),
    };
  }

  function summarize() {
    const savings = summarizeSavings();
    const spend = summarizeSpend();
    return {
      loaded,
      // Back-compat fields (tip savings) — existing callers keep working.
      eventCount: savings.eventCount,
      usdAllTime: savings.usdAllTime,
      usdThisWeek: savings.usdThisWeek,
      usdThisMonth: savings.usdThisMonth,
      tokensAllTime: savings.tokensAllTime,
      recent: savings.recent,
      savings,
      spend,
      suggestedAssumedOutput:
        spend.emaOutputTokens && spend.outputSampleCount >= 3
          ? Math.round(spend.emaOutputTokens)
          : null,
      fitMemory: cache.fitMemory || {},
    };
  }

  return {
    load,
    recordApplied,
    recordSpend,
    recordFitOutcome,
    fitScoreAdjust,
    clear,
    clearSavings,
    clearSpend,
    summarize,
    summarizeSavings,
    summarizeSpend,
    onChange,
  };
})();

globalThis.LumenCostLedger = LumenCostLedger;
