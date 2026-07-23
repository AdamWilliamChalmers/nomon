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
      g.LumenAdapterMistral,
      g.LumenAdapterMeta,
      g.LumenAdapterDeepSeek,
      g.LumenAdapterQwen,
      g.LumenAdapterKimi,
      g.LumenAdapterMiniMax,
      g.LumenAdapterHuggingChat,
      g.LumenAdapterDoubao,
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

  // Coarse composer dynamics — local aggregates only (no keystroke streams).
  // firstKeyDwellRatio: time from AI reply appearing → first composer input,
  //   divided by expected read time (~250ms/word). pasted: boolean for this turn.
  const composerDynamics = {
    lastAssistantId: null,
    responseAppearedAt: null,
    responseWordCount: 0,
    firstKeyAt: null,
    firstKeyDwellRatio: null,
    pasted: false,
    pendingForSend: null,
    boundInput: null,
  };

  function wordCountLocal(text) {
    return (text || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function noteAssistantAppear(list) {
    let lastAssistant = null;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].role === "assistant") {
        lastAssistant = list[i];
        break;
      }
    }
    if (!lastAssistant?.id || lastAssistant.id === composerDynamics.lastAssistantId) return;

    composerDynamics.lastAssistantId = lastAssistant.id;
    composerDynamics.responseAppearedAt = Date.now();
    composerDynamics.responseWordCount = wordCountLocal(lastAssistant.text);
    composerDynamics.firstKeyAt = null;
    composerDynamics.firstKeyDwellRatio = null;
    composerDynamics.pasted = false;
  }

  function captureFirstComposerInput() {
    if (!composerDynamics.responseAppearedAt || composerDynamics.firstKeyAt) return;
    composerDynamics.firstKeyAt = Date.now();
    const elapsed = composerDynamics.firstKeyAt - composerDynamics.responseAppearedAt;
    const expected = composerDynamics.responseWordCount * 250;
    composerDynamics.firstKeyDwellRatio =
      expected > 0 ? Math.max(0, elapsed / expected) : 1;
  }

  function stashDynamicsForSend() {
    composerDynamics.pendingForSend = {
      firstKeyDwellRatio: composerDynamics.firstKeyDwellRatio,
      pasted: composerDynamics.pasted,
    };
  }

  function consumePendingDynamics() {
    const pending = composerDynamics.pendingForSend;
    composerDynamics.pendingForSend = null;
    composerDynamics.firstKeyAt = null;
    composerDynamics.firstKeyDwellRatio = null;
    composerDynamics.pasted = false;
    return pending || null;
  }

  function bindComposerDynamics() {
    const onInput = () => captureFirstComposerInput();
    const onPaste = () => {
      composerDynamics.pasted = true;
      captureFirstComposerInput();
    };

    const attach = () => {
      const input = adapter?.findChatInput?.();
      if (!input || input === composerDynamics.boundInput) return;
      if (composerDynamics.boundInput) {
        composerDynamics.boundInput.removeEventListener("input", onInput, true);
        composerDynamics.boundInput.removeEventListener("keydown", onInput, true);
        composerDynamics.boundInput.removeEventListener("paste", onPaste, true);
      }
      composerDynamics.boundInput = input;
      input.addEventListener("input", onInput, true);
      input.addEventListener("keydown", onInput, true);
      input.addEventListener("paste", onPaste, true);
    };

    attach();
    // AI hosts remount the composer; re-bind periodically without logging keys.
    setInterval(attach, 2000);
  }

  // Capture the real moment the user sends a prompt so live messages get an
  // accurate timestamp (the MutationObserver fires slightly later). Historical
  // messages have no real send time and are left as null — the engine skips
  // velocity/dwell scoring when a timestamp is absent, rather than inventing one.
  function bindSendCapture() {
    const stamp = () => {
      lastSendAt = Date.now();
      stashDynamicsForSend();
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

  let guardBypassUntil = 0;

  function bindPreSendGuard() {
    const { goals: LumenGoals, engine: LumenEngine, widget: LumenWidget } = deps();

    const inputFocused = () => {
      const input = adapter.findChatInput?.();
      const active = document.activeElement;
      return input && (input === active || input.contains?.(active));
    };

    const readComposerText = () => adapter.getChatInputText?.() || "";

    const isSendClick = (target) => {
      const btn = adapter.findSendButton?.();
      if (btn && (target === btn || btn.contains?.(target))) return true;
      return Boolean(
        target?.closest?.(
          'button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="send" i]'
        )
      );
    };

    const fireSendWhenReady = (attempt = 0) => {
      const btn = adapter.findSendButton?.();
      const disabled = btn?.disabled || btn?.getAttribute?.("aria-disabled") === "true";
      if (disabled && attempt < 12) {
        requestAnimationFrame(() => fireSendWhenReady(attempt + 1));
        return;
      }
      adapter.triggerSend?.();
    };

    const proceedSend = (textOverride) => {
      const text = (textOverride ?? readComposerText()).trim();
      if (!text) return;

      guardBypassUntil = Date.now() + 4000;
      lastSendAt = Date.now();
      stashDynamicsForSend();
      adapter.setChatInputText?.(text);
      requestAnimationFrame(() => fireSendWhenReady(0));
    };

    const maybeHoldSend = (event) => {
      if (Date.now() < guardBypassUntil) return true;

      const text = readComposerText().trim();
      if (!text) return true;

      if (!LumenGoals?.isGuard?.() || LumenGoals.isPaused()) return true;

      const result = LumenEngine.evaluatePreSend(text, LumenGoals.get(), {
        taskTypeExempt: LumenGoals.getTaskTypeExemptions(),
      });
      if (!result.block) return true;

      event.preventDefault();
      event.stopImmediatePropagation();
      LumenWidget.showGuardHold({
        text,
        result,
        adapter,
        onProceed: proceedSend,
      });
      return false;
    };

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        if (!inputFocused()) return;
        maybeHoldSend(event);
      },
      true
    );

    document.addEventListener(
      "click",
      (event) => {
        if (!isSendClick(event.target)) return;
        maybeHoldSend(event);
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
      if (existing) {
        return {
          ...msg,
          id: existing.id,
          timestamp: existing.timestamp,
          dynamics: existing.dynamics || null,
        };
      }
      // Historical bulk load: real send time is unknown → null (no fake timing).
      // Live new message: use the captured send moment + composer dynamics.
      const isLive = !isInitialBulk;
      const dynamics =
        isLive && msg.role === "user" && lastSendAt && now - lastSendAt < 10000
          ? consumePendingDynamics()
          : null;
      return {
        ...msg,
        timestamp: isLive ? freshSend : null,
        dynamics,
      };
    });

    noteAssistantAppear(messages);
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

    // Transparency badges are user-requested disclosure — available in Ghost mode.
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      LumenWidget.injectAttestUI(msg, messages, adapter);
    }

    if (LumenGoals.isGhost()) {
      messages.forEach((msg) => {
        if (msg.role === "user") LumenSession.recordPlatformPresence(msg.id);
      });
      LumenWidget.updateBadge();
      return;
    }

    const currentMetrics = LumenSession.computeSessionMetrics(messages);

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
        LumenSession.recordMessage(
          msg.id,
          evaluation.loopScore,
          evaluation.primary,
          evaluation.taskType,
          evaluation
        );
      } else if (evaluation.primary) {
        LumenSession.upsertMessageSignal(msg.id, evaluation);
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
          LumenSession.reviseMessageSignal(msg.id, evaluation.primary, merged.primary, merged);
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

    // Keep this tab's FAB/popover in sync with the shared daily session. Another
    // AI tab (or this one via SPA navigation) can bump the "Today across all AIs"
    // totals; repaint here so the numbers update live instead of only on reload.
    LumenSession.onChange(() => {
      LumenWidget.updateBadge();
      LumenWidget.refreshPopover?.();
    });

    // Background tabs miss some storage events; re-read the shared session when
    // the tab becomes visible or regains focus so it catches up on return.
    const resync = () => {
      if (document.visibilityState === "hidden") return;
      Promise.resolve(LumenSession.refresh?.()).catch(() => {});
      Promise.resolve(LumenGoals.refresh?.()).catch(() => {});
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);

    // Wire up message detection FIRST so prompts always register, even if the
    // async loads below are slow, blocked, or throw (e.g. the localhost web
    // app is offline and a best-effort fetch rejects).
    bindSendCapture();
    bindPreSendGuard();
    bindComposerDynamics();
    adapter.onNewMessage(debouncedProcess);
    debouncedProcess();

    try {
      await LumenGoals.load();
      // Now that goals are loaded, decide whether to show first-run onboarding.
      // (Deferred until here so returning users who completed it don't see it
      // flash on every page load.)
      LumenWidget.showOnboardingIfNeeded?.();
      await LumenGoals.loadStudyParticipant();
      await LumenSession.load();
      history = await LumenSession.loadHistory();
      LumenWidget.refreshPopover?.();
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
