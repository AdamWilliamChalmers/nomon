const LumenSession = (() => {
  const HISTORY_KEY = "lumenSessionHistory";
  const DIGEST_KEY = "lumenDigestLog";
  const ATTESTATIONS_KEY = "lumenAttestations";
  const MAX_ATTESTATIONS = 50;

  /** False after extension reload while an old content script is still alive. */
  function extensionAlive() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch (_) {
      return false;
    }
  }

  const defaultSession = () => ({
    loopScores: [],
    sessionScore: 0,
    messageCount: 0,
    loopCount: 0,
    handoffCount: 0,
    driftCount: 0,
    mismatchCount: 0,
    depthCount: 0,
    scoredMessageIds: [],
    // Frozen strip snapshot per message — survives re-evaluation / judge downgrades.
    messageSignals: {},
    feedback: [],
    taskTypeWrongCounts: {},
    sessionSensitivity: {},
    // Histogram of detected task types this session, used by the AI Profile to
    // say what you mostly use each tool for (see lumen-ai-profile.md).
    taskTypeCounts: {},
    sessionDate: new Date().toISOString().slice(0, 10),
    platform: window.location.hostname,
    // Per-host tallies for today's AI profile snapshot (cross-tab merged in sync()).
    platformStats: {},
    // Ghost mode: track which user messages already counted toward platformStats.
    platformPresenceIds: [],
  });

  let session = defaultSession();
  let digestLog = { depthMoments: [], mismatchEvents: [] };
  let attestations = [];

  // What we last read from / wrote to storage. Used to compute this tab's own
  // deltas so save() can merge them onto the freshest stored value instead of
  // clobbering concurrent increments from other AI tabs (last-writer-wins).
  let persisted = clone(session);

  // Persistence is serialised through this promise chain so overlapping
  // read-merge-write cycles (rapid messages, cross-tab events) never interleave.
  let syncChain = Promise.resolve();

  // Subscribers notified whenever the shared live session changes underneath us
  // (e.g. another AI tab records a message). Lets the FAB/popover repaint
  // without a full page reload.
  const changeListeners = new Set();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Order-independent serialisation (sorted keys) so two tabs that built the
  // same counts in a different insertion order still compare equal — otherwise
  // the write/notify guards would ping-pong forever.
  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  // Fingerprint of the mergeable content only. platform/sessionDate are
  // last-writer, tab-local fields — excluding them stops harmless writes from
  // bouncing between tabs on those fields alone.
  function sharedFingerprint(s) {
    const { platform, sessionDate, ...rest } = s;
    return stableStringify(rest);
  }

  function sessionStorageKey() {
    return `lumen_session_${new Date().toISOString().slice(0, 10)}`;
  }

  function get() {
    return session;
  }

  function getDigestLog() {
    return digestLog;
  }

  function apply(data) {
    const incoming = data || {};
    const { platform: _storedPlatform, ...shared } = incoming;
    session = { ...defaultSession(), ...shared, platform: tabPlatformKey() };
    // Loading establishes a clean baseline: nothing here is a local delta.
    persisted = clone(session);
    return session;
  }

  function notifyChange() {
    changeListeners.forEach((cb) => {
      try {
        cb(session);
      } catch (_) {
        // a listener throwing must not stop the others
      }
    });
  }

  function onChange(cb) {
    if (typeof cb !== "function") return () => {};
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  }

  // Re-read + reconcile the shared session from storage. Used on tab
  // focus/visibility so a tab that was in the background catches up (also
  // covers SPA navigation between conversations on the same site).
  function refresh() {
    return sync();
  }

  // Live cross-tab updates: when another AI tab writes the shared daily key,
  // reconcile so this tab's FAB catches up without a full page reload. Our own
  // writes echo here too, but sync() is a no-op when nothing actually changed.
  if (chrome?.storage?.onChanged?.addListener) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (!extensionAlive()) return;
        if (areaName !== "session" && areaName !== "local") return;
        if (!changes?.[sessionStorageKey()]) return;
        sync();
      });
    } catch (_) {
      /* extension context already gone */
    }
  }

  function loadDigestLog() {
    return new Promise((resolve) => {
      const finish = (data) => {
        digestLog = data || { depthMoments: [], mismatchEvents: [] };
        resolve(digestLog);
      };

      if (!chrome?.storage?.sync?.get) {
        try {
          const raw = localStorage.getItem(DIGEST_KEY);
          finish(raw ? JSON.parse(raw) : null);
        } catch (_) {
          finish(null);
        }
        return;
      }

      chrome.storage.sync.get(DIGEST_KEY, (result) => {
        if (chrome.runtime?.lastError || result == null) {
          try {
            const raw = localStorage.getItem(DIGEST_KEY);
            finish(raw ? JSON.parse(raw) : null);
          } catch (_) {
            finish(null);
          }
          return;
        }
        finish(result[DIGEST_KEY]);
      });
    });
  }

  function saveDigestLog() {
    try {
      localStorage.setItem(DIGEST_KEY, JSON.stringify(digestLog));
    } catch (_) {
      // ignore
    }
    if (chrome?.storage?.sync?.set) {
      chrome.storage.sync.set({ [DIGEST_KEY]: digestLog }, () => void chrome.runtime?.lastError);
    }
  }

  function logDepthMoment(text, action) {
    digestLog.depthMoments.push({ text: text.slice(0, 120), action, at: Date.now() });
    digestLog.depthMoments = digestLog.depthMoments.slice(-20);
    saveDigestLog();
  }

  function logMismatchEvent(goal, choice) {
    digestLog.mismatchEvents.push({ goal: goal.slice(0, 120), choice, at: Date.now() });
    digestLog.mismatchEvents = digestLog.mismatchEvents.slice(-20);
    saveDigestLog();
  }

  function logLoopBreak(action) {
    if (!digestLog.loopBreaks) digestLog.loopBreaks = [];
    digestLog.loopBreaks.push({ action, at: Date.now() });
    digestLog.loopBreaks = digestLog.loopBreaks.slice(-20);
    saveDigestLog();
  }

  function logOverlayBypassed(overlayType) {
    if (!digestLog.overlayEvents) digestLog.overlayEvents = [];
    digestLog.overlayEvents.push({ overlayType, overlayBypassed: true, at: Date.now() });
    digestLog.overlayEvents = digestLog.overlayEvents.slice(-20);
    saveDigestLog();
  }

  function loadAttestations() {
    return new Promise((resolve) => {
      const finish = (data) => {
        attestations = Array.isArray(data) ? data : [];
        resolve(attestations);
      };

      if (!chrome?.storage?.sync?.get) {
        try {
          const raw = localStorage.getItem(ATTESTATIONS_KEY);
          finish(raw ? JSON.parse(raw) : null);
        } catch (_) {
          finish(null);
        }
        return;
      }

      chrome.storage.sync.get(ATTESTATIONS_KEY, (result) => {
        if (chrome.runtime?.lastError || result == null) {
          try {
            const raw = localStorage.getItem(ATTESTATIONS_KEY);
            finish(raw ? JSON.parse(raw) : null);
          } catch (_) {
            finish(null);
          }
          return;
        }
        finish(result[ATTESTATIONS_KEY]);
      });
    });
  }

  function saveAttestationsList() {
    try {
      localStorage.setItem(ATTESTATIONS_KEY, JSON.stringify(attestations));
    } catch (_) {
      // ignore
    }
    if (chrome?.storage?.sync?.set) {
      chrome.storage.sync.set({ [ATTESTATIONS_KEY]: attestations }, () => void chrome.runtime?.lastError);
    }
  }

  function getAttestations() {
    return attestations;
  }

  function hasAttestationForMessage(messageId) {
    return attestations.some((a) => a.artifact?.messageId === messageId);
  }

  function saveAttestation(attestation) {
    if (!attestation?.id) return attestations;
    attestations = [attestation, ...attestations.filter((a) => a.id !== attestation.id)].slice(
      0,
      MAX_ATTESTATIONS
    );
    saveAttestationsList();
    return attestations;
  }

  function logGuardEvent(action, goal) {
    if (!digestLog.guardEvents) digestLog.guardEvents = [];
    digestLog.guardEvents.push({
      action,
      goal: goal ? goal.slice(0, 120) : null,
      at: Date.now(),
    });
    digestLog.guardEvents = digestLog.guardEvents.slice(-20);
    saveDigestLog();
  }

  // Live session must be shared across ChatGPT, Gemini, Claude, etc. Never use
  // window.sessionStorage for this — it is scoped to each site's origin, so a
  // fallback there made every new AI tab look like a fresh session.
  function readLiveSession(key) {
    return new Promise((resolve) => {
      const finish = (data) => resolve(data || null);

      const tryLocal = () => {
        if (!chrome?.storage?.local?.get) {
          finish(null);
          return;
        }
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime?.lastError) {
            finish(null);
            return;
          }
          finish(result?.[key]);
        });
      };

      if (!chrome?.storage?.session?.get) {
        tryLocal();
        return;
      }

      chrome.storage.session.get(key, (result) => {
        if (chrome.runtime?.lastError) {
          tryLocal();
          return;
        }
        if (result?.[key]) {
          finish(result[key]);
          return;
        }
        tryLocal();
      });
    });
  }

  function writeLiveSession(key, data) {
    const payload = { [key]: data };
    const ops = [];
    if (chrome?.storage?.session?.set) {
      ops.push(
        new Promise((resolve) =>
          chrome.storage.session.set(payload, () => {
            void chrome.runtime?.lastError;
            resolve();
          })
        )
      );
    }
    if (chrome?.storage?.local?.set) {
      ops.push(
        new Promise((resolve) =>
          chrome.storage.local.set(payload, () => {
            void chrome.runtime?.lastError;
            resolve();
          })
        )
      );
    }
    return Promise.all(ops);
  }

  // Additive counter maps (task-type tallies): merged = stored + this tab's own
  // change since it last persisted, per key.
  function mergeCountMap(stored = {}, base = {}, current = {}) {
    const out = { ...stored };
    new Set([...Object.keys(out), ...Object.keys(base), ...Object.keys(current)]).forEach((k) => {
      const delta = (current[k] || 0) - (base[k] || 0);
      const value = Math.max(0, (out[k] || 0) + delta);
      if (value) out[k] = value;
      else delete out[k];
    });
    return out;
  }

  // Sensitivity is multiplicative (each "wrong" halves it), so carry this tab's
  // change across as a ratio rather than a difference.
  function mergeRatioMap(stored = {}, base = {}, current = {}) {
    const out = { ...stored };
    new Set([...Object.keys(base), ...Object.keys(current)]).forEach((k) => {
      const from = base[k] ?? 1;
      const to = current[k] ?? 1;
      if (from === 0) {
        out[k] = to;
        return;
      }
      const ratio = to / from;
      if (ratio !== 1) out[k] = (out[k] ?? 1) * ratio;
    });
    return out;
  }

  function feedbackKey(f) {
    return `${f.messageId}|${f.timestamp}|${f.signalType}`;
  }

  // Feedback is append-only: keep everything already in storage, then add the
  // entries this tab created since it last persisted (deduped by identity).
  function mergeFeedback(stored = [], base = [], current = []) {
    const out = stored.slice();
    const have = new Set(out.map(feedbackKey));
    const baseHave = new Set(base.map(feedbackKey));
    current.forEach((f) => {
      const key = feedbackKey(f);
      if (!baseHave.has(key) && !have.has(key)) {
        out.push(f);
        have.add(key);
      }
    });
    return out;
  }

  // Reconcile our in-memory session with the freshest stored value: union the
  // append-only sets, apply this tab's counter deltas (session vs persisted) on
  // top of stored, and recompute derived fields. Order preserved: stored's
  // messages first, then any this tab scored since it last persisted.
  function mergeSession(stored) {
    const merged = { ...defaultSession() };

    const idToScore = new Map();
    const orderedIds = [];
    const addPair = (id, score) => {
      if (idToScore.has(id)) return;
      idToScore.set(id, typeof score === "number" ? score : 0);
      orderedIds.push(id);
    };
    (stored.scoredMessageIds || []).forEach((id, i) => addPair(id, (stored.loopScores || [])[i]));

    const persistedIds = new Set(persisted.scoredMessageIds || []);
    (session.scoredMessageIds || []).forEach((id, i) => {
      if (!persistedIds.has(id)) addPair(id, (session.loopScores || [])[i]);
    });

    merged.scoredMessageIds = orderedIds;
    merged.loopScores = orderedIds.map((id) => idToScore.get(id));
    merged.messageCount = orderedIds.length;
    merged.sessionScore = merged.loopScores.length
      ? Math.round(merged.loopScores.reduce((a, b) => a + b, 0) / merged.loopScores.length)
      : 0;

    ["loopCount", "handoffCount", "driftCount", "mismatchCount", "depthCount"].forEach((k) => {
      const delta = (session[k] || 0) - (persisted[k] || 0);
      merged[k] = Math.max(0, (stored[k] || 0) + delta);
    });

    merged.taskTypeCounts = mergeCountMap(stored.taskTypeCounts, persisted.taskTypeCounts, session.taskTypeCounts);
    merged.taskTypeWrongCounts = mergeCountMap(
      stored.taskTypeWrongCounts,
      persisted.taskTypeWrongCounts,
      session.taskTypeWrongCounts
    );
    merged.sessionSensitivity = mergeRatioMap(
      stored.sessionSensitivity,
      persisted.sessionSensitivity,
      session.sessionSensitivity
    );
    merged.feedback = mergeFeedback(stored.feedback, persisted.feedback, session.feedback);
    merged.messageSignals = mergeMessageSignals(stored.messageSignals, session.messageSignals);
    merged.platformStats = mergePlatformStats(
      stored.platformStats,
      persisted.platformStats,
      session.platformStats
    );

    // platform/sessionDate stay this tab's own (they are last-writer fields).
    merged.platform = tabPlatformKey();
    merged.sessionDate = session.sessionDate;

    const presenceIds = new Set(stored.platformPresenceIds || []);
    const persistedPresence = new Set(persisted.platformPresenceIds || []);
    (session.platformPresenceIds || []).forEach((id) => {
      if (!persistedPresence.has(id)) presenceIds.add(id);
    });
    merged.platformPresenceIds = [...presenceIds];

    return merged;
  }

  // One serialised read-merge-write cycle. Adopts the merged result in memory
  // (so this tab sees other AIs' activity), writes back only when the shared
  // content actually changed, and notifies subscribers to repaint.
  function sync() {
    syncChain = syncChain
      .then(() =>
        readLiveSession(sessionStorageKey()).then((raw) => {
          const stored = { ...defaultSession(), ...(raw || {}) };
          const before = sharedFingerprint(session);
          const merged = mergeSession(stored);
          const mergedPrint = sharedFingerprint(merged);

          session = merged;
          persisted = clone(merged);

          if (mergedPrint !== before) notifyChange();
          if (mergedPrint !== sharedFingerprint(stored)) {
            return writeLiveSession(sessionStorageKey(), merged);
          }
          return undefined;
        })
      )
      .catch(() => {});
    return syncChain;
  }

  function load() {
    return Promise.all([
      readLiveSession(sessionStorageKey()).then((data) => {
        apply(data || defaultSession());
        return session;
      }),
      loadDigestLog(),
      loadAttestations(),
    ]).then(([loadedSession]) => loadedSession);
  }

  function save() {
    return sync();
  }

  function signalPriority(primary) {
    return { mismatch: 5, depth: 4, handoff: 3, loop: 2, drift: 1 }[primary] || 0;
  }

  function freezeStripEvaluation(evaluation) {
    if (!evaluation?.primary) return null;
    return {
      primary: evaluation.primary,
      loopScore: evaluation.loopScore,
      handoff: evaluation.handoff,
      loop: evaluation.loop,
      drift: evaluation.drift,
      mismatch: evaluation.mismatch,
      depth: evaluation.depth,
    };
  }

  function mergeMessageSignals(stored = {}, current = {}) {
    const out = { ...stored };
    Object.entries(current).forEach(([id, snap]) => {
      if (!snap?.primary) return;
      const prev = out[id];
      if (!prev?.primary || signalPriority(snap.primary) >= signalPriority(prev.primary)) {
        out[id] = snap;
      }
    });
    return out;
  }

  function getStripEvaluation(messageId, liveEvaluation) {
    const frozen = session.messageSignals?.[messageId];
    if (!frozen?.primary) return liveEvaluation;
    return { ...liveEvaluation, ...frozen, primary: frozen.primary };
  }

  function upsertMessageSignal(messageId, evaluation) {
    if (!session.scoredMessageIds.includes(messageId)) return false;
    if (!evaluation?.primary) return false;

    const frozen = freezeStripEvaluation(evaluation);
    const existing = session.messageSignals[messageId];
    if (existing?.primary === frozen.primary) {
      session.messageSignals[messageId] = frozen;
      save();
      return true;
    }
    if (existing?.primary && signalPriority(frozen.primary) < signalPriority(existing.primary)) {
      return false;
    }

    if (existing?.primary && existing.primary !== frozen.primary) {
      bumpSignalCount(existing.primary, -1);
      bumpSignalCount(frozen.primary, 1);
      shiftPlatformSignal(sessionPlatformKey(), existing.primary, frozen.primary);
    } else if (!existing?.primary) {
      bumpSignalCount(frozen.primary, 1);
      addPlatformSignal(frozen.primary, evaluation.taskType);
    }

    session.messageSignals[messageId] = frozen;
    save();
    return true;
  }

  function emptyPlatformStat() {
    return {
      messageCount: 0,
      signalCounts: { handoff: 0, loop: 0, mismatch: 0, depth: 0, drift: 0 },
      taskTypeCounts: {},
    };
  }

  function mergePlatformStats(stored = {}, base = {}, current = {}) {
    const keys = new Set([
      ...Object.keys(stored || {}),
      ...Object.keys(base || {}),
      ...Object.keys(current || {}),
    ]);
    const out = {};
    keys.forEach((host) => {
      const s = stored[host] || emptyPlatformStat();
      const b = base[host] || emptyPlatformStat();
      const c = current[host] || emptyPlatformStat();
      const deltaMsg = (c.messageCount || 0) - (b.messageCount || 0);
      out[host] = {
        messageCount: Math.max(0, (s.messageCount || 0) + deltaMsg),
        signalCounts: mergeCountMap(s.signalCounts, b.signalCounts, c.signalCounts),
        taskTypeCounts: mergeCountMap(s.taskTypeCounts, b.taskTypeCounts, c.taskTypeCounts),
      };
    });
    return out;
  }

  function tabPlatformKey() {
    return globalThis.LumenNudges?.canonicalPlatformHost?.(window.location.hostname) || window.location.hostname;
  }

  function sessionPlatformKey() {
    // Always attribute activity to this tab's host. The shared session blob may
    // carry another tab's `platform` field (last writer) — using it credited
    // Claude messages to ChatGPT and hid Claude from cross-AI disclosure.
    return tabPlatformKey();
  }

  function bumpPlatformStat(signal, taskType) {
    const platform = sessionPlatformKey();
    if (!session.platformStats) session.platformStats = {};
    if (!session.platformStats[platform]) session.platformStats[platform] = emptyPlatformStat();
    const ps = session.platformStats[platform];
    ps.messageCount += 1;
    if (signal) ps.signalCounts[signal] = (ps.signalCounts[signal] || 0) + 1;
    if (taskType) ps.taskTypeCounts[taskType] = (ps.taskTypeCounts[taskType] || 0) + 1;
  }

  function addPlatformSignal(signal, taskType) {
    if (!signal && !taskType) return;
    const platform = sessionPlatformKey();
    if (!session.platformStats) session.platformStats = {};
    if (!session.platformStats[platform]) session.platformStats[platform] = emptyPlatformStat();
    const ps = session.platformStats[platform];
    if (signal) ps.signalCounts[signal] = (ps.signalCounts[signal] || 0) + 1;
    if (taskType) ps.taskTypeCounts[taskType] = (ps.taskTypeCounts[taskType] || 0) + 1;
  }

  function shiftPlatformSignal(platform, fromSignal, toSignal) {
    if (!fromSignal || fromSignal === toSignal || !platform) return;
    platform = globalThis.LumenNudges?.canonicalPlatformHost?.(platform) || platform;
    if (!session.platformStats?.[platform]) return;
    const ps = session.platformStats[platform];
    if (fromSignal) ps.signalCounts[fromSignal] = Math.max(0, (ps.signalCounts[fromSignal] || 0) - 1);
    if (toSignal) ps.signalCounts[toSignal] = (ps.signalCounts[toSignal] || 0) + 1;
  }

  function bumpSignalCount(signal, delta) {
    if (!signal || !delta) return;
    if (signal === "loop") session.loopCount = Math.max(0, session.loopCount + delta);
    if (signal === "handoff") session.handoffCount = Math.max(0, session.handoffCount + delta);
    if (signal === "drift") session.driftCount = Math.max(0, session.driftCount + delta);
    if (signal === "mismatch") session.mismatchCount = Math.max(0, session.mismatchCount + delta);
    if (signal === "depth") session.depthCount = Math.max(0, session.depthCount + delta);
  }

  function recordPlatformPresence(messageId) {
    if (!messageId) return false;
    session.platformPresenceIds = session.platformPresenceIds || [];
    if (session.platformPresenceIds.includes(messageId)) return false;

    session.platformPresenceIds.push(messageId);
    bumpPlatformStat(null, null);
    save();
    return true;
  }

  function recordMessage(messageId, loopScore, signal, taskType, evaluation) {
    if (session.scoredMessageIds.includes(messageId)) return false;

    session.scoredMessageIds.push(messageId);
    session.loopScores.push(loopScore);
    session.messageCount += 1;
    session.sessionScore = Math.round(
      session.loopScores.reduce((a, b) => a + b, 0) / session.loopScores.length
    );

    bumpSignalCount(signal, 1);
    if (session.platformPresenceIds?.includes(messageId)) {
      addPlatformSignal(signal, taskType);
    } else {
      bumpPlatformStat(signal, taskType);
    }
    if (signal && evaluation) {
      session.messageSignals[messageId] = freezeStripEvaluation(evaluation);
    }
    if (taskType) {
      session.taskTypeCounts = session.taskTypeCounts || {};
      session.taskTypeCounts[taskType] = (session.taskTypeCounts[taskType] || 0) + 1;
    }
    save();
    return true;
  }

  function reviseMessageSignal(messageId, previousSignal, newSignal, evaluation) {
    if (!session.scoredMessageIds.includes(messageId)) return false;
    if (previousSignal === newSignal) return false;
    // Judge can upgrade a signal but never strip a frozen one — that made loops
    // flash away after the async verdict returned "engaged".
    if (!newSignal) return false;
    bumpSignalCount(previousSignal, -1);
    bumpSignalCount(newSignal, 1);
    shiftPlatformSignal(sessionPlatformKey(), previousSignal, newSignal);
    if (evaluation) session.messageSignals[messageId] = freezeStripEvaluation(evaluation);
    save();
    return true;
  }

  function computeSessionMetrics(messages) {
    const userMessages = messages.filter((m) => m.role === "user");
    if (!userMessages.length) {
      return { questionRatio: 0, avgPromptLength: 0, passiveRate: 0 };
    }
    const engine = globalThis.LumenEngine;
    const wordCount = (text) => engine?.wordCount(text) ?? text.trim().split(/\s+/).filter(Boolean).length;
    const isPassive = (text) => engine?.isPassiveContinuation(text) ?? false;
    const withQuestion = userMessages.filter((m) => m.text.includes("?")).length;
    const avgPromptLength =
      userMessages.reduce((sum, m) => sum + wordCount(m.text), 0) / userMessages.length;
    const passive = userMessages.filter((m) => isPassive(m.text)).length;
    return {
      questionRatio: withQuestion / userMessages.length,
      avgPromptLength,
      passiveRate: passive / userMessages.length,
    };
  }

  // Weekly profile history must be shared across ChatGPT / Claude / Gemini / …
  // Prefer chrome.storage.local (same cross-origin store as the live session).
  // chrome.storage.sync has an 8KB-per-item limit that silently fails once
  // byPlatform grows — which made "Across tools" look ChatGPT-only while
  // strips still worked on every site. localStorage is origin-scoped and must
  // never be the primary store.
  function readHistoryFromLocalStorage() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function loadHistory() {
    return new Promise((resolve) => {
      const finish = (data) => resolve(Array.isArray(data) ? data : []);

      const migrateFromSync = (fallback) => {
        if (!extensionAlive() || !chrome?.storage?.sync?.get) {
          finish(fallback);
          return;
        }
        try {
          chrome.storage.sync.get(HISTORY_KEY, (result) => {
            try {
              if (chrome.runtime?.lastError) {
                finish(fallback);
                return;
              }
              const synced = result?.[HISTORY_KEY];
              if (Array.isArray(synced) && synced.length) {
                if (extensionAlive() && chrome?.storage?.local?.set) {
                  try {
                    chrome.storage.local.set({ [HISTORY_KEY]: synced }, () => {
                      void chrome.runtime?.lastError;
                    });
                  } catch (_) {
                    /* ignore */
                  }
                }
                finish(synced);
                return;
              }
              finish(fallback);
            } catch (_) {
              finish(fallback);
            }
          });
        } catch (_) {
          finish(fallback);
        }
      };

      if (!extensionAlive() || !chrome?.storage?.local?.get) {
        migrateFromSync(readHistoryFromLocalStorage());
        return;
      }

      try {
        chrome.storage.local.get(HISTORY_KEY, (result) => {
          try {
            if (chrome.runtime?.lastError) {
              migrateFromSync(readHistoryFromLocalStorage());
              return;
            }
            const local = result?.[HISTORY_KEY];
            if (Array.isArray(local) && local.length) {
              finish(local);
              return;
            }
            migrateFromSync(readHistoryFromLocalStorage());
          } catch (_) {
            finish(readHistoryFromLocalStorage());
          }
        });
      } catch (_) {
        finish(readHistoryFromLocalStorage());
      }
    });
  }

  function writeHistory(history) {
    const ops = [];
    if (extensionAlive() && chrome?.storage?.local?.set) {
      ops.push(
        new Promise((resolve) => {
          try {
            chrome.storage.local.set({ [HISTORY_KEY]: history }, () => {
              void chrome.runtime?.lastError;
              resolve();
            });
          } catch (_) {
            resolve();
          }
        })
      );
    }
    // Best-effort mirror for older builds / tests without chrome.storage.
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (_) {
      // ignore quota / privacy mode
    }
    return Promise.all(ops);
  }

  // Combine each platform's daily snapshot into one weighted-by-messages
  // aggregate, so the weekly digest reflects activity across every LLM used
  // that day rather than just the last one written.
  function sumCountMaps(maps) {
    const out = {};
    maps.forEach((map) => {
      Object.entries(map || {}).forEach(([key, value]) => {
        out[key] = (out[key] || 0) + (value || 0);
      });
    });
    return out;
  }

  function aggregatePlatforms(byPlatform) {
    const entries = Object.values(byPlatform || {});
    const totalMessages = entries.reduce((sum, e) => sum + (e.messageCount || 0), 0);
    if (!totalMessages) {
      return {
        messageCount: 0,
        questionRatio: 0,
        avgPromptLength: 0,
        passiveRate: 0,
        signalCounts: {},
        taskTypeCounts: {},
      };
    }
    const weighted = (key) =>
      entries.reduce((sum, e) => sum + (e[key] || 0) * (e.messageCount || 0), 0) / totalMessages;
    return {
      messageCount: totalMessages,
      questionRatio: weighted("questionRatio"),
      avgPromptLength: weighted("avgPromptLength"),
      passiveRate: weighted("passiveRate"),
      signalCounts: sumCountMaps(entries.map((e) => e.signalCounts)),
      taskTypeCounts: sumCountMaps(entries.map((e) => e.taskTypeCounts)),
    };
  }

  // Take the richer of two same-day platform snaps (message count wins; on a
  // tie, prefer the one with live engagement metrics). Prevents a ChatGPT tab
  // from wiping Claude/Gemini rows when history is rewritten.
  function pickRicherPlatformSnap(a, b) {
    if (!a) return b;
    if (!b) return a;
    const aCount = a.messageCount || 0;
    const bCount = b.messageCount || 0;
    if (bCount > aCount) return b;
    if (aCount > bCount) return a;
    const metricScore = (s) =>
      (typeof s.questionRatio === "number" ? 1 : 0) +
      (typeof s.avgPromptLength === "number" ? 1 : 0) +
      (typeof s.passiveRate === "number" ? 1 : 0);
    return metricScore(b) > metricScore(a) ? b : a;
  }

  function mergeDayByPlatform(...maps) {
    const out = {};
    maps.forEach((map) => {
      Object.entries(map || {}).forEach(([host, snap]) => {
        const key = globalThis.LumenNudges?.canonicalPlatformHost?.(host) || host;
        out[key] = pickRicherPlatformSnap(out[key], snap);
      });
    });
    return out;
  }

  // Serialise history writes so two AI tabs can't interleave read-modify-write
  // and drop each other's byPlatform entries.
  let historyWriteChain = Promise.resolve();

  function saveSessionSnapshot(messages) {
    const date = new Date().toISOString().slice(0, 10);
    const platform = sessionPlatformKey();
    const metrics = computeSessionMetrics(messages);
    const domUserCount = messages.filter((m) => m.role === "user").length;

    // Snapshot every host the shared live session already knows about — not
    // just this tab — so opening ChatGPT after Claude doesn't erase Claude.
    const fromLiveStats = {};
    Object.entries(session.platformStats || {}).forEach(([host, ps]) => {
      const key = globalThis.LumenNudges?.canonicalPlatformHost?.(host) || host;
      if (!(ps?.messageCount > 0)) return;
      fromLiveStats[key] = {
        questionRatio: 0,
        avgPromptLength: 0,
        passiveRate: 0,
        messageCount: ps.messageCount || 0,
        signalCounts: { ...(ps.signalCounts || {}) },
        taskTypeCounts: { ...(ps.taskTypeCounts || {}) },
      };
    });

    const ps = session.platformStats?.[platform] || emptyPlatformStat();
    fromLiveStats[platform] = {
      ...metrics,
      messageCount: Math.max(ps.messageCount || 0, domUserCount),
      signalCounts: { ...(ps.signalCounts || {}) },
      taskTypeCounts: { ...(ps.taskTypeCounts || {}) },
    };

    historyWriteChain = historyWriteChain
      .then(() => loadHistory())
      .then((history) => {
        const existing = history.find((entry) => entry.date === date);
        const byPlatform = mergeDayByPlatform(existing?.byPlatform, fromLiveStats);
        const entry = { date, byPlatform, ...aggregatePlatforms(byPlatform) };
        const filtered = history.filter((e) => e.date !== date);
        filtered.push(entry);
        const trimmed = filtered.slice(-28);
        return writeHistory(trimmed).then(() => trimmed);
      })
      .catch(() => loadHistory());

    return historyWriteChain;
  }

  function recordFeedback({ messageId, signalType, score, verdict, taskType, promptSnippet }) {
    session.feedback = session.feedback || [];
    session.feedback.push({
      messageId,
      signalType,
      score,
      verdict,
      taskType,
      promptSnippet: (promptSnippet || "").slice(0, 200),
      timestamp: Date.now(),
    });

    if (verdict === "wrong" && taskType) {
      session.taskTypeWrongCounts = session.taskTypeWrongCounts || {};
      session.taskTypeWrongCounts[taskType] = (session.taskTypeWrongCounts[taskType] || 0) + 1;
      session.sessionSensitivity = session.sessionSensitivity || {};
      const current = session.sessionSensitivity[taskType] ?? 1;
      session.sessionSensitivity[taskType] = current * 0.5;
    }

    save();
    return session.taskTypeWrongCounts[taskType] || 0;
  }

  function getWrongCountForTaskType(taskType) {
    return session.taskTypeWrongCounts?.[taskType] || 0;
  }

  function getSessionSensitivity() {
    return session.sessionSensitivity || {};
  }

  function buildSessionPayload() {
    const n = Math.max(session.loopScores.length, 1);
    return {
      sessionDate: session.sessionDate,
      platform: sessionPlatformKey(),
      messageCount: session.messageCount,
      compositeScore: session.sessionScore,
      loopCount: session.loopCount,
      driftCount: session.driftCount,
      mismatchCount: session.mismatchCount,
      depthCount: session.depthCount,
      feedback: session.feedback || [],
    };
  }

  function postSessionSummary() {
    // Egress gated on shareAnonymisedData (on by default, opt-out in Privacy & data).
    const goals = globalThis.LumenGoals?.get?.() || {};
    if (!goals.shareAnonymisedData) return;

    const payload = buildSessionPayload();
    if (!payload.messageCount && !(payload.feedback?.length)) return;

    const userId = globalThis.LumenUserId?.get?.() || "anonymous";
    const body = JSON.stringify({ userId, ...payload });
    const base = LumenConfig.webAppUrl(globalThis.LumenGoals?.get?.().webAppUrl);

    try {
      globalThis.LumenNet.fetch(`${base}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (_) {
      // ignore
    }
  }

  function triggerPostSessionSurvey() {
    const goals = globalThis.LumenGoals?.get?.() || {};
    if (!goals.studyParticipant) return;

    const base = LumenConfig.webAppUrl(goals.webAppUrl);
    const params = new URLSearchParams({
      date: session.sessionDate,
      platform: sessionPlatformKey(),
      score: String(Math.round(session.sessionScore || 0)),
    });
    const url = `${base}/survey?${params.toString()}`;
    try {
      window.open(url, "_blank", "noopener");
    } catch (_) {
      // ignore
    }
  }

  function reset() {
    session = defaultSession();
    persisted = clone(session);
    document.querySelectorAll(".lumen-strip, .lumen-card, .lumen-why").forEach((el) => el.remove());
    document.querySelectorAll(".lumen-ai-hidden").forEach((el) => el.classList.remove("lumen-ai-hidden"));
    // Explicit clear overwrites the shared key (no merge) so the reset actually
    // sticks; other tabs pick up the emptied session via storage.onChanged.
    const cleared = clone(session);
    syncChain = syncChain
      .then(() => writeLiveSession(sessionStorageKey(), cleared))
      .catch(() => {});
  }

  return {
    get,
    getDigestLog,
    load,
    save,
    refresh,
    onChange,
    recordMessage,
    recordPlatformPresence,
    reviseMessageSignal,
    getStripEvaluation,
    upsertMessageSignal,
    recordFeedback,
    getWrongCountForTaskType,
    getSessionSensitivity,
    postSessionSummary,
    triggerPostSessionSurvey,
    computeSessionMetrics,
    loadHistory,
    saveSessionSnapshot,
    logDepthMoment,
    logMismatchEvent,
    logLoopBreak,
    logOverlayBypassed,
    logGuardEvent,
    getAttestations,
    hasAttestationForMessage,
    saveAttestation,
    loadAttestations,
    reset,
  };
})();

globalThis.LumenSession = LumenSession;
