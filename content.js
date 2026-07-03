(() => {
  "use strict";

  const g = globalThis;

  function adapterRegistry() {
    return [
      g.LumenAdapterChatGPT,
      g.LumenAdapterClaude,
      g.LumenAdapterGemini,
      g.LumenAdapterGrok,
      g.LumenAdapterCopilot,
      g.LumenAdapterPerplexity,
    ].filter(Boolean);
  }

  function deps() {
    return {
      adapter: adapterRegistry()[0],
      session: g.LumenSession,
      goals: g.LumenGoals,
      engine: g.LumenEngine,
      widget: g.LumenWidget,
    };
  }

  function getAdapter() {
    return adapterRegistry().find((a) => a?.matches?.()) || null;
  }

  function logMissingModules() {
    const d = deps();
    const missing = Object.entries(d)
      .filter(([, mod]) => !mod)
      .map(([name]) => name);
    if (missing.length) {
      console.warn(
        "[Lumen] Scripts failed to load:",
        missing.join(", "),
        "— remove and re-load unpacked extension from ~/Desktop/Lumen, then hard-refresh."
      );
    }
  }

  let adapter = null;
  let messages = [];
  let history = [];
  let debounceTimer = null;
  let lastSendAt = 0;

  // Capture the real moment the user sends a prompt so live messages get an
  // accurate timestamp (the MutationObserver fires slightly later). Historical
  // messages have no real send time and are left as null — the engine skips
  // velocity/dwell scoring when a timestamp is absent, rather than inventing one.
  function bindSendCapture() {
    const stamp = () => {
      lastSendAt = Date.now();
    };
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        const input = adapter.findChatInput?.();
        const active = document.activeElement;
        if (input && (input === active || input.contains?.(active))) stamp();
      },
      true
    );
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            'button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="send" i]'
          )
        ) {
          stamp();
        }
      },
      true
    );
  }

  let domBreakWarned = false;

  function syncMessagesFromDom() {
    let domMessages;
    try {
      domMessages = adapter.buildMessageList();
    } catch (err) {
      // A site DOM change can break selectors — fail soft, keep the last known
      // state rather than throwing and killing the processing loop.
      if (!domBreakWarned) {
        console.warn("[Lumen] adapter.buildMessageList failed — DOM may have changed:", err?.message);
        domBreakWarned = true;
      }
      return messages;
    }
    if (!Array.isArray(domMessages)) return messages;
    const existingById = new Map(messages.map((m) => [m.id, m]));
    const now = Date.now();
    const isInitialBulk = domMessages.length > 1 && existingById.size === 0;
    const freshSend = lastSendAt && now - lastSendAt < 10000 ? lastSendAt : now;

    messages = domMessages.map((msg, index) => {
      const prevByIndex = messages[index];
      const existing =
        existingById.get(msg.id) ||
        (prevByIndex?.role === msg.role && prevByIndex?.text === msg.text ? prevByIndex : null);
      if (existing) return { ...msg, id: existing.id, timestamp: existing.timestamp };
      // Historical bulk load: real send time is unknown → null (no fake timing).
      // Live new message: use the captured send moment.
      return { ...msg, timestamp: isInitialBulk ? null : freshSend };
    });

    return messages;
  }

  function processMessages() {
    const { session: LumenSession, goals: LumenGoals, engine: LumenEngine, widget: LumenWidget } =
      deps();
    if (!LumenSession || !LumenGoals || !LumenEngine || !LumenWidget || !adapter) return;

    // Paused is a true off-switch: no scoring, no snapshots, no nudges. The FAB
    // stays (dimmed) so the user can resume.
    if (LumenGoals.isPaused()) {
      LumenWidget.updateBadge();
      return;
    }

    syncMessagesFromDom();
    const session = LumenSession.get();
    const currentMetrics = LumenSession.computeSessionMetrics(messages);

    if (LumenGoals.isGhost()) {
      LumenWidget.updateBadge();
      return;
    }

    messages.forEach((msg, index) => {
      if (msg.role !== "user") return;

      const evaluation = LumenEngine.evaluateMessage(msg, messages, index, {
        history,
        currentMetrics,
        scoredIds: session.scoredMessageIds,
        sessionMismatchCount: session.mismatchCount,
        priorLoopScores: session.loopScores,
        sessionSensitivity: LumenSession.getSessionSensitivity(),
        taskTypeExempt: LumenGoals.getTaskTypeExemptions(),
        crowdCalibration: LumenGoals.getCrowdCalibration(),
      });

      const alreadyScored = session.scoredMessageIds.includes(msg.id);
      if (!alreadyScored) {
        // Don't fabricate a time: live messages already carry the real send
        // moment; historical messages stay null so timing signals are skipped
        // and old messages are never treated as "fresh" (no overlay on load).
        LumenSession.recordMessage(msg.id, evaluation.loopScore, evaluation.primary, evaluation.taskType);
      }

      LumenWidget.injectMessageUI(msg, evaluation, adapter, { isNewMessage: !alreadyScored });

      const judgeOn = LumenGoals.get().llmJudgeEnabled || LumenGoals.isJudgeAvailable();
      const passiveLater = index > 2 && Boolean(LumenEngine.isPassiveContinuation?.(msg.text));
      if (
        judgeOn &&
        !alreadyScored &&
        g.LumenRules?.shouldConsultJudge?.(evaluation, msg.text, { passiveLater })
      ) {
        g.LumenJudge?.classify(msg.text, evaluation).then((verdict) => {
          if (!verdict) return;
          const merged = g.LumenJudge.mergeVerdict(evaluation, verdict);
          LumenSession.reviseMessageSignal(msg.id, evaluation.primary, merged.primary);
          LumenWidget.injectMessageUI(msg, merged, adapter, {
            isNewMessage: false,
            fromJudge: true,
          });
          LumenWidget.updateBadge();
        });
      }
    });

    LumenSession.saveSessionSnapshot(messages).then((updated) => {
      history = updated;
    });
    LumenWidget.updateBadge();
  }

  function debouncedProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processMessages, 150);
  }

  async function init() {
    if (window.__lumenInitialized) return;

    const { session: LumenSession, goals: LumenGoals, engine: LumenEngine, widget: LumenWidget } =
      deps();
    adapter = getAdapter();

    if (!adapter || !LumenSession || !LumenGoals || !LumenEngine || !LumenWidget) {
      logMissingModules();
      return;
    }

    window.__lumenInitialized = true;

    // Show badge + onboarding immediately — don't wait on storage
    LumenWidget.init();

    // Wire up message detection FIRST so prompts always register, even if the
    // async loads below are slow, blocked, or throw (e.g. the localhost web
    // app is offline and a best-effort fetch rejects).
    bindSendCapture();
    adapter.onNewMessage(debouncedProcess);
    debouncedProcess();

    try {
      await LumenGoals.load();
      await LumenGoals.loadStudyParticipant();
      await LumenSession.load();
      history = await LumenSession.loadHistory();
    } catch (err) {
      console.warn("[Lumen] init load step failed — continuing with defaults:", err?.message);
    }

    // Crowd calibration + judge-capability probe are best-effort and
    // network-bound; never let them block or abort init (the web app may be
    // offline during normal use).
    Promise.resolve(LumenGoals.fetchCrowdCalibration()).catch(() => {});
    Promise.resolve(LumenGoals.fetchJudgeCapability())
      .then(() => LumenWidget.updateBadge())
      .catch(() => {});

    LumenWidget.updateBadge();
    debouncedProcess();

    // Weekly digest nudge: once storage is loaded, surface the "digest ready"
    // indicator on the first launch of a new ISO week (best-effort, async).
    Promise.resolve(LumenWidget.maybeShowDigestReady?.()).catch(() => {});

    window.addEventListener("beforeunload", () => {
      LumenSession.saveSessionSnapshot(messages);
      LumenSession.postSessionSummary();
      LumenSession.triggerPostSessionSurvey();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
