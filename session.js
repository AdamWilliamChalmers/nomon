const LumenSession = (() => {
  const HISTORY_KEY = "lumenSessionHistory";
  const DIGEST_KEY = "lumenDigestLog";

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
    feedback: [],
    taskTypeWrongCounts: {},
    sessionSensitivity: {},
    // Histogram of detected task types this session, used by the AI Profile to
    // say what you mostly use each tool for (see lumen-ai-profile.md).
    taskTypeCounts: {},
    sessionDate: new Date().toISOString().slice(0, 10),
    platform: window.location.hostname,
  });

  let session = defaultSession();
  let digestLog = { depthMoments: [], mismatchEvents: [] };

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
    session = { ...defaultSession(), ...data };
    return session;
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
    if (chrome?.storage?.session?.set) {
      chrome.storage.session.set(payload, () => void chrome.runtime?.lastError);
    }
    if (chrome?.storage?.local?.set) {
      chrome.storage.local.set(payload, () => void chrome.runtime?.lastError);
    }
  }

  function load() {
    return Promise.all([
      readLiveSession(sessionStorageKey()).then((data) => {
        apply(data || defaultSession());
        return session;
      }),
      loadDigestLog(),
    ]).then(([loadedSession]) => loadedSession);
  }

  function save() {
    writeLiveSession(sessionStorageKey(), session);
  }

  function bumpSignalCount(signal, delta) {
    if (!signal || !delta) return;
    if (signal === "loop") session.loopCount = Math.max(0, session.loopCount + delta);
    if (signal === "handoff") session.handoffCount = Math.max(0, session.handoffCount + delta);
    if (signal === "drift") session.driftCount = Math.max(0, session.driftCount + delta);
    if (signal === "mismatch") session.mismatchCount = Math.max(0, session.mismatchCount + delta);
    if (signal === "depth") session.depthCount = Math.max(0, session.depthCount + delta);
  }

  function recordMessage(messageId, loopScore, signal, taskType) {
    if (session.scoredMessageIds.includes(messageId)) return false;

    session.scoredMessageIds.push(messageId);
    session.loopScores.push(loopScore);
    session.messageCount += 1;
    session.sessionScore = Math.round(
      session.loopScores.reduce((a, b) => a + b, 0) / session.loopScores.length
    );

    bumpSignalCount(signal, 1);
    if (taskType) {
      session.taskTypeCounts = session.taskTypeCounts || {};
      session.taskTypeCounts[taskType] = (session.taskTypeCounts[taskType] || 0) + 1;
    }
    save();
    return true;
  }

  function reviseMessageSignal(messageId, previousSignal, newSignal) {
    if (!session.scoredMessageIds.includes(messageId)) return false;
    if (previousSignal === newSignal) return false;
    bumpSignalCount(previousSignal, -1);
    bumpSignalCount(newSignal, 1);
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

  function loadHistory() {
    return new Promise((resolve) => {
      const finish = (data) => resolve(Array.isArray(data) ? data : []);

      if (!chrome?.storage?.sync?.get) {
        try {
          const raw = localStorage.getItem(HISTORY_KEY);
          finish(raw ? JSON.parse(raw) : []);
        } catch (_) {
          finish([]);
        }
        return;
      }

      chrome.storage.sync.get(HISTORY_KEY, (result) => {
        if (chrome.runtime?.lastError || result == null) {
          try {
            const raw = localStorage.getItem(HISTORY_KEY);
            finish(raw ? JSON.parse(raw) : []);
          } catch (_) {
            finish([]);
          }
          return;
        }
        finish(result[HISTORY_KEY]);
      });
    });
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

  function saveSessionSnapshot(messages) {
    const date = new Date().toISOString().slice(0, 10);
    const platform = session.platform || window.location.hostname;
    const platformSnap = {
      ...computeSessionMetrics(messages),
      messageCount: messages.filter((m) => m.role === "user").length,
      // Cumulative for this platform/day — the AI Profile reads these to
      // characterise how you work in each tool (lumen-ai-profile.md).
      signalCounts: {
        handoff: session.handoffCount || 0,
        loop: session.loopCount || 0,
        mismatch: session.mismatchCount || 0,
        depth: session.depthCount || 0,
      },
      taskTypeCounts: { ...(session.taskTypeCounts || {}) },
    };

    return loadHistory().then((history) => {
      const existing = history.find((entry) => entry.date === date);
      // Each process() call passes the full current-page message list, so the
      // per-platform entry is overwritten (not accumulated); only distinct
      // platforms add up across the day.
      const byPlatform = { ...(existing?.byPlatform || {}) };
      byPlatform[platform] = platformSnap;

      const entry = { date, byPlatform, ...aggregatePlatforms(byPlatform) };
      const filtered = history.filter((e) => e.date !== date);
      filtered.push(entry);
      const trimmed = filtered.slice(-28);

      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      } catch (_) {
        // ignore
      }

      if (chrome?.storage?.sync?.set) {
        chrome.storage.sync.set({ [HISTORY_KEY]: trimmed }, () => void chrome.runtime?.lastError);
      }

      return trimmed;
    });
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
      platform: session.platform,
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
    // Egress is opt-in only. With consent off, scoring stays entirely local.
    const goals = globalThis.LumenGoals?.get?.() || {};
    if (!goals.shareAnonymisedData) return;

    const payload = buildSessionPayload();
    if (!payload.messageCount && !(payload.feedback?.length)) return;

    const userId = localStorage.getItem("lumenUserId") || "anonymous";
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
      platform: session.platform,
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
    document.querySelectorAll(".lumen-strip, .lumen-card, .lumen-why").forEach((el) => el.remove());
    document.querySelectorAll(".lumen-ai-hidden").forEach((el) => el.classList.remove("lumen-ai-hidden"));
    save();
  }

  return {
    get,
    getDigestLog,
    load,
    save,
    recordMessage,
    reviseMessageSignal,
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
    reset,
  };
})();

globalThis.LumenSession = LumenSession;
