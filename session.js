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

  function load() {
    return Promise.all([
      new Promise((resolve) => {
        const key = sessionStorageKey();
        const finish = (data) => {
          apply(data || defaultSession());
          resolve(session);
        };

        if (!chrome?.storage?.session?.get) {
          try {
            const raw = window.sessionStorage.getItem(key);
            finish(raw ? JSON.parse(raw) : null);
          } catch (_) {
            finish(null);
          }
          return;
        }

        chrome.storage.session.get(key, (result) => {
          if (chrome.runtime?.lastError || result == null) {
            try {
              const raw = window.sessionStorage.getItem(key);
              finish(raw ? JSON.parse(raw) : null);
            } catch (_) {
              finish(null);
            }
            return;
          }
          finish(result[key]);
        });
      }),
      loadDigestLog(),
    ]).then(([loadedSession]) => loadedSession);
  }

  function save() {
    const key = sessionStorageKey();
    try {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    } catch (_) {
      // ignore
    }
    if (chrome?.storage?.session?.set) {
      chrome.storage.session.set({ [key]: session }, () => void chrome.runtime?.lastError);
    }
  }

  function bumpSignalCount(signal, delta) {
    if (!signal || !delta) return;
    if (signal === "loop") session.loopCount = Math.max(0, session.loopCount + delta);
    if (signal === "handoff") session.handoffCount = Math.max(0, session.handoffCount + delta);
    if (signal === "drift") session.driftCount = Math.max(0, session.driftCount + delta);
    if (signal === "mismatch") session.mismatchCount = Math.max(0, session.mismatchCount + delta);
    if (signal === "depth") session.depthCount = Math.max(0, session.depthCount + delta);
  }

  function recordMessage(messageId, loopScore, signal) {
    if (session.scoredMessageIds.includes(messageId)) return false;

    session.scoredMessageIds.push(messageId);
    session.loopScores.push(loopScore);
    session.messageCount += 1;
    session.sessionScore = Math.round(
      session.loopScores.reduce((a, b) => a + b, 0) / session.loopScores.length
    );

    bumpSignalCount(signal, 1);
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

  function saveSessionSnapshot(messages) {
    const metrics = computeSessionMetrics(messages);
    const snapshot = {
      date: new Date().toISOString().slice(0, 10),
      ...metrics,
      messageCount: messages.filter((m) => m.role === "user").length,
    };

    return loadHistory().then((history) => {
      const filtered = history.filter((entry) => entry.date !== snapshot.date);
      filtered.push(snapshot);
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
    const base = (globalThis.LumenGoals?.get?.().webAppUrl || "http://localhost:3000").replace(/\/$/, "");

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

    const base = (goals.webAppUrl || "http://localhost:3000").replace(/\/$/, "");
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
    reset,
  };
})();

globalThis.LumenSession = LumenSession;
