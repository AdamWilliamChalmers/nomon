const LumenWidget = (() => {
  const SIGNAL_COLORS = {
    handoff: "#3478c5",
    loop: "#2d9e4e",
    drift: "#d4921a",
    mismatch: "#7b5cbf",
    depth: "#3478c5",
  };

  let popoverOpen = false;
  let dismissedReconsider = new Set();
  let activeReconsider = null;
  let lastEvaluation = null;
  let fabDrag = { active: false, moved: false, suppressClick: false, pointerId: null, offsetX: 0, offsetY: 0 };

  const OVERLAY_HTML = `
      <div id="lumen-reconsider" class="lumen-reconsider">
        <div class="lumen-reconsider-panel lumen-signal-handoff">
          <div class="lumen-reconsider-kicker" id="lumen-reconsider-kicker">Lumen · hand-off</div>
          <h2 class="lumen-reconsider-title" id="lumen-reconsider-title">Start with your own version?</h2>
          <p class="lumen-reconsider-body" id="lumen-reconsider-body"></p>
          <div id="lumen-reconsider-choices" class="lumen-reconsider-actions">
            <button type="button" class="lumen-reconsider-btn" id="lumen-reconsider-draft">I'll draft something first</button>
            <button type="button" class="lumen-reconsider-btn lumen-reconsider-btn--secondary" id="lumen-reconsider-continue">Continue — show AI answer</button>
          </div>
          <div id="lumen-reconsider-draft-mode" class="lumen-reconsider-draft-mode lumen-hidden">
            <textarea id="lumen-reconsider-textarea" class="lumen-reconsider-textarea" placeholder="Your rough draft — even one sentence…"></textarea>
            <button type="button" class="lumen-reconsider-btn" id="lumen-reconsider-submit">Submit my draft + ask AI</button>
          </div>
        </div>
      </div>`;

  function ensureHideStyles() {
    if (document.getElementById("lumen-hide-styles")) return;
    const style = document.createElement("style");
    style.id = "lumen-hide-styles";
    style.textContent = `
      .lumen-ai-hidden,
      [data-message-author-role="assistant"].lumen-ai-hidden,
      .agent-turn.lumen-ai-hidden,
      article.lumen-ai-hidden {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    ensureHideStyles();
    if (document.getElementById("lumen-root")) {
      ensureReconsiderShell();
      return;
    }
    const root = document.createElement("div");
    root.id = "lumen-root";
    root.innerHTML = `
      <div id="lumen-fab">
        <span id="lumen-fab-mark" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3" fill="white" opacity="0.95"/>
            <circle cx="9" cy="9" r="6" stroke="white" stroke-width="1.2" opacity="0.35"/>
            <circle cx="9" cy="9" r="8.5" stroke="white" stroke-width="0.6" opacity="0.15"/>
          </svg>
        </span>
        <span id="lumen-fab-dot"></span>
        <span id="lumen-fab-score">0</span>
      </div>
      <div id="lumen-popover">
        <div class="lumen-popover-head">
          <div class="lumen-popover-title">Engagement this session</div>
          <button id="lumen-pause-toggle" class="lumen-popover-pause" type="button">Pause</button>
        </div>
        <div class="lumen-popover-sparkline" id="lumen-sparkline"></div>
        <div class="lumen-popover-stat" title="Prompts you sent this session"><span>Messages</span><span class="lumen-popover-stat-value" id="lumen-stat-messages">0</span></div>
        <div class="lumen-popover-stat" title="Whole tasks you asked AI to do from scratch"><span>Hand-offs</span><span class="lumen-popover-stat-value" id="lumen-stat-handoff">0</span></div>
        <div class="lumen-popover-stat" title="Stretches of passive back-and-forth without questions"><span>Loops</span><span class="lumen-popover-stat-value" id="lumen-stat-loop">0</span></div>
        <div class="lumen-popover-stat" title="Conversations that wandered from your prompt"><span>Drift</span><span class="lumen-popover-stat-value" id="lumen-stat-drift">0</span></div>
        <div class="lumen-popover-stat" title="Prompts that conflicted with a goal you set"><span>Mismatch</span><span class="lumen-popover-stat-value" id="lumen-stat-mismatch">0</span></div>
        <div class="lumen-popover-stat" title="Moments worth thinking through before asking"><span>Depth</span><span class="lumen-popover-stat-value" id="lumen-stat-depth">0</span></div>
        <p class="lumen-popover-hint lumen-hidden" id="lumen-stats-empty">Lumen fills this in as you chat.</p>
        <label class="lumen-popover-label">Mode</label>
        <select id="lumen-mode-select" class="lumen-popover-select">
          <option value="ambient">Ambient</option>
          <option value="ghost">Ghost</option>
          <option value="active">Active</option>
          <option value="focus">Focus</option>
        </select>
        <p class="lumen-popover-hint" id="lumen-mode-hint"></p>
        <label class="lumen-popover-label">Protected goals</label>
        <textarea id="lumen-goals-input" class="lumen-popover-goals" placeholder="One goal per line"></textarea>
        <label class="lumen-popover-label">Focus goal (this session)</label>
        <input id="lumen-focus-input" class="lumen-popover-focus" type="text" placeholder="Today I'm trying to…" />
        <label class="lumen-popover-check">
          <input type="checkbox" id="lumen-llm-judge" />
          LLM second opinion (subtle cases)
        </label>
        <label class="lumen-popover-check">
          <input type="checkbox" id="lumen-study-participant" />
          Calibration study — post-session survey
        </label>
        <label class="lumen-popover-check">
          <input type="checkbox" id="lumen-share-data" />
          Share anonymised session summary (off by default)
        </label>
        <label class="lumen-popover-label">Backend URL (for judge / calibration / sharing)</label>
        <input id="lumen-backend-input" class="lumen-popover-focus" type="text" placeholder="http://localhost:3000" />
        <p class="lumen-popover-hint" id="lumen-judge-hint">Catches subtle hand-offs the rules miss · auto-on when the backend has a model key · cheap model, cached per message</p>
        <a id="lumen-calibration-link" class="lumen-popover-link" href="https://lumen.so/calibration" target="_blank" rel="noopener">Signal calibration dashboard ↗</a>
        <p class="lumen-popover-hint">Drag the Lumen pill to move it out of the way.</p>
        <button class="lumen-popover-reset" id="lumen-reset-session">Reset session</button>
        <div class="lumen-popover-divider"></div>
        <div class="lumen-popover-title">Why last flag</div>
        <p class="lumen-popover-why" id="lumen-last-why">No flags yet this session.</p>
        <div class="lumen-popover-divider"></div>
        <div class="lumen-popover-title" title="How you tend to work in each AI tool, built from your recent sessions">Your AI profile</div>
        <div class="lumen-profile" id="lumen-profile"></div>
        <div class="lumen-popover-divider"></div>
        <div class="lumen-popover-title">This week</div>
        <div class="lumen-popover-digest" id="lumen-digest"></div>
      </div>
      ${OVERLAY_HTML}
      <div id="lumen-onboarding" class="lumen-onboarding">
        <div class="lumen-onboarding-panel">
          <div class="lumen-onboarding-step" data-step="1">
            <h2>Set up Lumen</h2>
            <p>What do you mainly use AI for?</p>
            <div class="lumen-onboarding-options" id="lumen-use-cases">
              <label class="lumen-onboarding-option"><input type="checkbox" value="Research" /><span>Research</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Writing" /><span>Writing</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Coding" /><span>Coding</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Learning" /><span>Learning</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Admin" /><span>Admin</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Creative work" /><span>Creative work</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Work tasks" /><span>Work tasks</span></label>
            </div>
          </div>
          <div class="lumen-onboarding-step lumen-hidden" data-step="2">
            <h2>Anything to protect?</h2>
            <p>Optional. Pick any that apply — or add your own. Lumen only flags mismatch against goals you set yourself.</p>
            <div class="lumen-onboarding-options" id="lumen-goal-presets">
              <label class="lumen-onboarding-option"><input type="checkbox" value="Write my own first drafts" /><span>Write my own first drafts</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Make my own decisions" /><span>Make my own decisions</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Understand the code, not just copy it" /><span>Understand my code</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Do my own analysis and reasoning" /><span>Do my own analysis</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Think independently on strategy" /><span>Think independently on strategy</span></label>
              <label class="lumen-onboarding-option"><input type="checkbox" value="Form my own arguments before asking" /><span>Form my own arguments first</span></label>
            </div>
            <label class="lumen-popover-label" style="margin-top:14px;">Add your own</label>
            <textarea id="lumen-onboarding-goals" placeholder="One goal per line — e.g. I want to write my own first drafts."></textarea>
          </div>
          <div class="lumen-onboarding-step lumen-hidden" data-step="3">
            <h2>How visible should Lumen be?</h2>
            <select id="lumen-onboarding-mode">
              <option value="ambient">Ambient — subtle inline cues (default)</option>
              <option value="ghost">Ghost — weekly digest only, nothing in-session</option>
              <option value="active">Active — inline cues + reflection cards</option>
              <option value="focus">Focus — Active, plus a session goal</option>
            </select>
            <input id="lumen-onboarding-focus" class="lumen-hidden" type="text" placeholder="Today I'm trying to…" />
          </div>
          <div class="lumen-onboarding-actions">
            <button id="lumen-onboarding-skip" class="lumen-onboarding-btn lumen-onboarding-btn--ghost">Skip</button>
            <button id="lumen-onboarding-next" class="lumen-onboarding-btn">Continue</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    bindRootEvents();
    bindReconsiderEvents();
  }

  function ensureReconsiderShell() {
    const existing = document.getElementById("lumen-reconsider");
    if (existing) {
      if (!document.getElementById("lumen-reconsider-submit")) {
        existing.remove();
        reconsiderEventsBound = false;
      } else {
        return;
      }
    }
    document.getElementById("lumen-root")?.insertAdjacentHTML("beforeend", OVERLAY_HTML);
    bindReconsiderEvents();
  }

  function bindRootEvents() {
    bindFabDrag();

    document.getElementById("lumen-fab")?.addEventListener("click", (event) => {
      if (fabDrag.suppressClick) {
        fabDrag.suppressClick = false;
        return;
      }
      event.stopPropagation();
      togglePopover();
    });

    document.getElementById("lumen-reset-session")?.addEventListener("click", (event) => {
      event.stopPropagation();
      lastEvaluation = null;
      LumenSession.reset();
      updateBadge();
      closePopover();
    });

    document.getElementById("lumen-mode-select")?.addEventListener("change", (event) => {
      LumenGoals.save({ mode: event.target.value });
      updateModeHint();
      updateBadge();
    });

    document.getElementById("lumen-pause-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const nowPaused = !LumenGoals.isPaused();
      LumenGoals.setPaused(nowPaused);
      if (nowPaused) clearInjectedUI();
      syncSettingsUI();
      updateBadge();
    });

    document.getElementById("lumen-goals-input")?.addEventListener("change", (event) => {
      const goals = event.target.value.split("\n").map((line) => line.trim()).filter(Boolean);
      LumenGoals.save({ protectedGoals: goals });
    });

    document.getElementById("lumen-focus-input")?.addEventListener("change", (event) => {
      LumenGoals.save({ focusGoal: event.target.value.trim() || null });
    });

    document.getElementById("lumen-llm-judge")?.addEventListener("change", (event) => {
      LumenGoals.save({ llmJudgeEnabled: event.target.checked });
    });

    document.getElementById("lumen-study-participant")?.addEventListener("change", (event) => {
      LumenGoals.setStudyParticipant(event.target.checked);
    });

    document.getElementById("lumen-share-data")?.addEventListener("change", (event) => {
      LumenGoals.save({ shareAnonymisedData: event.target.checked });
    });

    document.getElementById("lumen-backend-input")?.addEventListener("change", (event) => {
      const url = event.target.value.trim().replace(/\/$/, "");
      LumenGoals.save({
        webAppUrl: LumenConfig.webAppUrl(url),
        judgeApiUrl: LumenConfig.judgeApiUrl(url),
      });
      syncSettingsUI();
    });

    document.addEventListener("mousedown", (event) => {
      if (!popoverOpen) return;
      const root = document.getElementById("lumen-root");
      if (root && !root.contains(event.target)) closePopover();
    });

    bindOnboardingEvents();
  }

  const FAB_MARGIN = 12;

  function clampFabPosition(left, top, fab) {
    const width = fab.offsetWidth || 120;
    const height = fab.offsetHeight || 40;
    return {
      left: Math.min(Math.max(FAB_MARGIN, left), window.innerWidth - width - FAB_MARGIN),
      top: Math.min(Math.max(FAB_MARGIN, top), window.innerHeight - height - FAB_MARGIN),
    };
  }

  function applyFabPosition() {
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;
    const pos = LumenGoals.get().fabPosition;
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      const clamped = clampFabPosition(pos.left, pos.top, fab);
      fab.style.left = `${clamped.left}px`;
      fab.style.top = `${clamped.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    } else {
      fab.style.left = "";
      fab.style.top = "";
      fab.style.right = "";
      fab.style.bottom = "";
    }
  }

  function bindFabDrag() {
    const fab = document.getElementById("lumen-fab");
    if (!fab || fab.dataset.dragBound) return;
    fab.dataset.dragBound = "1";

    fab.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = fab.getBoundingClientRect();
      fabDrag = {
        active: true,
        moved: false,
        suppressClick: false,
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
      };
      fab.classList.add("lumen-fab--dragging");
      fab.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    fab.addEventListener("pointermove", (event) => {
      if (!fabDrag.active || event.pointerId !== fabDrag.pointerId) return;
      const moved = Math.hypot(event.clientX - fabDrag.startX, event.clientY - fabDrag.startY);
      if (moved > 4) fabDrag.moved = true;
      if (!fabDrag.moved) return;

      const next = clampFabPosition(
        event.clientX - fabDrag.offsetX,
        event.clientY - fabDrag.offsetY,
        fab
      );
      fab.style.left = `${next.left}px`;
      fab.style.top = `${next.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      if (popoverOpen) positionPopover();
    });

    fab.addEventListener("pointerup", (event) => {
      if (!fabDrag.active || event.pointerId !== fabDrag.pointerId) return;
      fab.classList.remove("lumen-fab--dragging");
      fab.releasePointerCapture(event.pointerId);
      if (fabDrag.moved) {
        const left = parseInt(fab.style.left, 10);
        const top = parseInt(fab.style.top, 10);
        LumenGoals.save({ fabPosition: { left, top } });
        fabDrag.suppressClick = true;
      }
      fabDrag.active = false;
    });

    fab.addEventListener("pointercancel", () => {
      fab.classList.remove("lumen-fab--dragging");
      fabDrag.active = false;
    });

    window.addEventListener("resize", () => {
      const pos = LumenGoals.get().fabPosition;
      if (!pos) return;
      applyFabPosition();
      if (popoverOpen) positionPopover();
    });
  }

  let reconsiderEventsBound = false;

  function bindReconsiderEvents() {
    if (reconsiderEventsBound) return;
    reconsiderEventsBound = true;
    document.getElementById("lumen-reconsider-draft")?.addEventListener("click", (event) => {
      event.stopPropagation();
      showOverlayDraftMode();
    });
    document.getElementById("lumen-reconsider-continue")?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeSignalOverlay(true, "continue");
    });
    document.getElementById("lumen-reconsider-submit")?.addEventListener("click", (event) => {
      event.stopPropagation();
      submitOverlayDraft();
    });
  }

  function resetOverlayPanel() {
    document.getElementById("lumen-reconsider-choices")?.classList.remove("lumen-hidden");
    document.getElementById("lumen-reconsider-draft-mode")?.classList.add("lumen-hidden");
    const textarea = document.getElementById("lumen-reconsider-textarea");
    if (textarea) textarea.value = "";
  }

  function showOverlayDraftMode() {
    if (!activeReconsider) return;
    LumenSession.logLoopBreak("draft-first");
    document.getElementById("lumen-reconsider-choices")?.classList.add("lumen-hidden");
    document.getElementById("lumen-reconsider-draft-mode")?.classList.remove("lumen-hidden");
    document.getElementById("lumen-reconsider-textarea")?.focus();
  }

  function submitOverlayDraft() {
    if (!activeReconsider) return;
    const draft = document.getElementById("lumen-reconsider-textarea")?.value.trim();
    if (activeReconsider.overlayType === "depth") {
      if (draft) LumenSession.logDepthMoment(draft, "reflected");
      closeSignalOverlay(true, "reflected");
      return;
    }
    if (!draft) return;
    const combined = LumenNudges.buildCombinedPrompt(draft, activeReconsider.originalPrompt);
    activeReconsider.adapter.setChatInputText(combined);
    LumenSession.logLoopBreak("draft-submitted");
    closeSignalOverlay(false, "draft-submitted");
  }

  function closeSignalOverlay(showAi, action) {
    if (!activeReconsider) return;
    dismissedReconsider.add(activeReconsider.msgId);
    if (action === "continue") {
      LumenSession.logOverlayBypassed(activeReconsider.overlayType);
      if (activeReconsider.overlayType === "depth") {
        LumenSession.logDepthMoment(activeReconsider.originalPrompt || "", "skip");
      }
    }
    if (showAi) activeReconsider.hidden.show();
    else activeReconsider.hidden.stop();
    document.getElementById("lumen-reconsider")?.classList.remove("lumen-reconsider--open");
    resetOverlayPanel();
    activeReconsider = null;
  }

  function showSignalOverlay(msg, evaluation, adapter) {
    if (dismissedReconsider.has(msg.id)) return;
    if (activeReconsider?.msgId === msg.id) return;
    if (!evaluation.overlayType) return;

    ensureRoot();
    resetOverlayPanel();

    const copy =
      evaluation.overlayType === "handoff"
        ? LumenNudges.getHandOffOverlayCopy(evaluation.taskType || "general")
        : evaluation.overlayType === "depth"
          ? LumenNudges.getDepthOverlayCopy(evaluation.depth?.taskType || "default")
          : LumenNudges.getLoopOverlayCopy();

    const panel = document.querySelector(".lumen-reconsider-panel");
    panel?.classList.toggle("lumen-signal-handoff", evaluation.overlayType === "handoff");
    panel?.classList.toggle("lumen-signal-loop", evaluation.overlayType === "loop");
    panel?.classList.toggle("lumen-signal-depth", evaluation.overlayType === "depth");

    document.getElementById("lumen-reconsider-kicker").textContent = copy.kicker;
    document.getElementById("lumen-reconsider-title").textContent = copy.title;
    document.getElementById("lumen-reconsider-body").textContent = copy.body;
    document.getElementById("lumen-reconsider-draft").textContent = copy.draftLabel;
    document.getElementById("lumen-reconsider-continue").textContent = copy.continueLabel;
    document.getElementById("lumen-reconsider-submit").textContent = copy.submitLabel;
    document.getElementById("lumen-reconsider-textarea")?.setAttribute("placeholder", copy.draftPlaceholder);

    if (activeReconsider) {
      activeReconsider.hidden.show();
    }

    activeReconsider = {
      msgId: msg.id,
      overlayType: evaluation.overlayType,
      originalPrompt: msg.text,
      adapter,
      hidden: keepAssistantHidden(adapter, msg.el),
    };

    document.getElementById("lumen-reconsider")?.classList.add("lumen-reconsider--open");
  }

  function bindOnboardingEvents() {
    let step = 1;
    const panel = document.getElementById("lumen-onboarding");
    const nextBtn = document.getElementById("lumen-onboarding-next");
    const skipBtn = document.getElementById("lumen-onboarding-skip");
    const modeSelect = document.getElementById("lumen-onboarding-mode");
    const focusInput = document.getElementById("lumen-onboarding-focus");

    modeSelect?.addEventListener("change", () => {
      focusInput.classList.toggle("lumen-hidden", modeSelect.value !== "focus");
    });

    skipBtn?.addEventListener("click", () => {
      LumenGoals.skipOnboarding();
      panel.classList.remove("lumen-onboarding--open");
    });

    nextBtn?.addEventListener("click", () => {
      if (step < 3) {
        panel.querySelector(`[data-step="${step}"]`)?.classList.add("lumen-hidden");
        step += 1;
        panel.querySelector(`[data-step="${step}"]`)?.classList.remove("lumen-hidden");
        nextBtn.textContent = step === 3 ? "Finish" : "Continue";
        return;
      }

      const useCases = Array.from(document.querySelectorAll("#lumen-use-cases input:checked")).map(
        (input) => input.value
      );
      const presetGoals = Array.from(
        document.querySelectorAll("#lumen-goal-presets input:checked")
      ).map((input) => input.value);
      const typedGoals = document
        .getElementById("lumen-onboarding-goals")
        .value.split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const protectedGoals = Array.from(new Set([...presetGoals, ...typedGoals]));
      const mode = modeSelect.value;
      const focusGoal = mode === "focus" ? focusInput.value.trim() : null;

      LumenGoals.completeOnboarding({ useCases, protectedGoals, mode });
      if (focusGoal) LumenGoals.save({ focusGoal });
      panel.classList.remove("lumen-onboarding--open");
      syncSettingsUI();
    });
  }

  function showOnboardingIfNeeded() {
    const goals = LumenGoals.get();
    if (goals.onboardingComplete) return;
    document.getElementById("lumen-onboarding")?.classList.add("lumen-onboarding--open");
  }

  function syncSettingsUI() {
    const goals = LumenGoals.get();
    const modeSelect = document.getElementById("lumen-mode-select");
    const goalsInput = document.getElementById("lumen-goals-input");
    const focusInput = document.getElementById("lumen-focus-input");
    const judgeToggle = document.getElementById("lumen-llm-judge");
    const studyToggle = document.getElementById("lumen-study-participant");
    const shareToggle = document.getElementById("lumen-share-data");
    const backendInput = document.getElementById("lumen-backend-input");
    const calibrationLink = document.getElementById("lumen-calibration-link");
    const base = LumenConfig.webAppUrl(goals.webAppUrl);
    if (modeSelect) modeSelect.value = goals.mode;
    if (goalsInput) goalsInput.value = goals.protectedGoals.join("\n");
    if (focusInput) focusInput.value = goals.focusGoal || "";
    if (judgeToggle) judgeToggle.checked = Boolean(goals.llmJudgeEnabled);
    if (studyToggle) studyToggle.checked = Boolean(goals.studyParticipant);
    if (shareToggle) shareToggle.checked = Boolean(goals.shareAnonymisedData);
    if (backendInput) backendInput.value = base;
    if (calibrationLink) calibrationLink.href = `${base}/calibration`;

    const pauseBtn = document.getElementById("lumen-pause-toggle");
    if (pauseBtn) {
      const paused = LumenGoals.isPaused();
      pauseBtn.textContent = paused ? "Resume" : "Pause";
      pauseBtn.classList.toggle("lumen-popover-pause--on", paused);
    }
    const emptyHint = document.getElementById("lumen-stats-empty");
    if (emptyHint) emptyHint.classList.toggle("lumen-hidden", Boolean(LumenSession.get().messageCount));

    updateModeHint();
    renderLastWhyPopover();
  }

  function updateModeHint() {
    const hint = document.getElementById("lumen-mode-hint");
    if (!hint) return;
    if (LumenGoals.isPaused()) {
      hint.textContent = "Paused — no tracking or signals until you resume.";
      return;
    }
    hint.textContent = LumenGoals.modeMeta().blurb;
  }

  function clearInjectedUI() {
    document
      .querySelectorAll(".lumen-strip, .lumen-card, .lumen-why")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".lumen-ai-hidden")
      .forEach((el) => el.classList.remove("lumen-ai-hidden"));
  }

  function renderLastWhyPopover() {
    const el = document.getElementById("lumen-last-why");
    if (!el) return;
    if (!lastEvaluation?.evaluation?.primary) {
      el.textContent = "No flags yet this session.";
      return;
    }
    el.textContent = lastEvaluation.evaluation.explanation || "Flagged — no detail available.";
  }

  function engagementColor(engagement) {
    if (engagement >= 60) return SIGNAL_COLORS.loop;
    if (engagement >= 35) return SIGNAL_COLORS.handoff;
    return SIGNAL_COLORS.drift;
  }

  function updateBadge() {
    ensureRoot();
    applyFabPosition();
    const session = LumenSession.get();
    const fab = document.getElementById("lumen-fab");
    const dot = document.getElementById("lumen-fab-dot");
    const scoreEl = document.getElementById("lumen-fab-score");
    // sessionScore is a passive-acceptance score (higher = more offloading).
    // Surface the inverse so the badge reads as engagement: higher = better.
    const paused = LumenGoals.isPaused();
    const engagement = session.messageCount ? 100 - (session.sessionScore || 0) : 0;
    const color = session.messageCount ? engagementColor(engagement) : SIGNAL_COLORS.loop;
    if (dot) dot.style.background = paused ? "var(--lm-ghost)" : color;
    if (scoreEl) {
      scoreEl.textContent = paused ? "॥" : String(engagement);
      scoreEl.style.color = paused ? "var(--lm-haze)" : color;
      scoreEl.title = paused
        ? "Lumen is paused — click to open settings and resume"
        : "Engagement this session — higher means more active evaluation";
    }
    if (fab) {
      // Per-mode + paused looks are handled in CSS via these data attributes so
      // the user can see at a glance which mode they're in.
      fab.dataset.mode = LumenGoals.get().mode || "ambient";
      fab.dataset.paused = paused ? "true" : "false";
    }
  }

  function positionPopover() {
    const fab = document.getElementById("lumen-fab");
    const popover = document.getElementById("lumen-popover");
    if (!fab || !popover) return;
    const rect = fab.getBoundingClientRect();
    const gap = 12;
    popover.style.top = "auto";
    popover.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    popover.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    popover.style.left = "auto";
  }

  function renderSparkline(scores) {
    // Single implementation lives in sparkline.js (loaded before widget.js).
    return globalThis.LumenSparkline?.render?.(scores || []) ?? "";
  }

  function renderPopover() {
    const session = LumenSession.get();
    document.getElementById("lumen-sparkline").innerHTML = renderSparkline(
      (session.loopScores || []).map((s) => 100 - s)
    );
    document.getElementById("lumen-stat-messages").textContent = String(session.messageCount);
    document.getElementById("lumen-stat-handoff").textContent = String(session.handoffCount || 0);
    document.getElementById("lumen-stat-loop").textContent = String(session.loopCount);
    document.getElementById("lumen-stat-drift").textContent = String(session.driftCount);
    document.getElementById("lumen-stat-mismatch").textContent = String(session.mismatchCount);
    document.getElementById("lumen-stat-depth").textContent = String(session.depthCount);
    renderProfile();
    renderDigest();
    syncSettingsUI();
    positionPopover();
  }

  function renderProfileCard(tool) {
    if (!tool.ready) {
      return `<div class="lumen-profile-card lumen-profile-card--pending">
        <span class="lumen-profile-name">${tool.name}</span>
        <span class="lumen-profile-pending">Still learning</span>
      </div>`;
    }
    const pct = Math.max(4, Math.min(100, tool.postureScore));
    const usePart = tool.use ? tool.use : "a mix of tasks";
    return `<div class="lumen-profile-card">
      <div class="lumen-profile-row">
        <span class="lumen-profile-name">${tool.name}</span>
        <span class="lumen-profile-use">${usePart}</span>
      </div>
      <div class="lumen-profile-meter" title="${tool.posture} · ${tool.postureScore}/100 toward hand-off">
        <span style="left:${pct}%"></span>
      </div>
      <div class="lumen-profile-foot">
        <span class="lumen-profile-end">hands-on</span>
        <span class="lumen-profile-posture">${tool.posture}</span>
        <span class="lumen-profile-end">hand-off</span>
      </div>
    </div>`;
  }

  async function renderProfile() {
    const el = document.getElementById("lumen-profile");
    if (!el) return;
    const history = await LumenSession.loadHistory();
    const tools = LumenNudges.buildProfile(history);
    const contrast = LumenNudges.buildProfileContrast(history);
    if (!tools.length) {
      el.innerHTML = `<p class="lumen-popover-hint">Lumen builds this as you use different AI tools across the week.</p>`;
      return;
    }
    const canShare = tools.some((t) => t.ready);
    el.innerHTML = `
      ${contrast ? `<p class="lumen-profile-contrast">${contrast}</p>` : ""}
      ${tools.map(renderProfileCard).join("")}
      ${canShare ? `<button class="lumen-profile-share" id="lumen-profile-share" type="button">Share my profile</button>` : ""}
    `;
    if (canShare) {
      document.getElementById("lumen-profile-share")?.addEventListener("click", (event) => {
        event.stopPropagation();
        shareProfile(tools.filter((t) => t.ready), contrast).catch(() => {});
      });
    }
  }

  const SHARE_PALETTE = {
    bg: "#f4f3f9",
    surface: "#ffffff",
    card: "#f0eff5",
    border: "#e2e1ea",
    dusk: "#1a1825",
    slate: "#7b7a8a",
    haze: "#9896a8",
    ghost: "#b8b6c4",
    mismatch: "#7b5cbf",
    loop: "#2d9e4e",
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = (text || "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawLumenMark(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = SHARE_PALETTE.mismatch;
    ctx.fillStyle = SHARE_PALETTE.mismatch;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawShareCard(tools, contrast) {
    const W = 1080;
    const H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const font = (size, weight = 400) =>
      `${weight} ${size}px "Plus Jakarta Sans", -apple-system, Segoe UI, sans-serif`;

    ctx.fillStyle = SHARE_PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    const pad = 90;

    // Brand row
    drawLumenMark(ctx, pad + 25, pad + 28);
    ctx.fillStyle = SHARE_PALETTE.dusk;
    ctx.font = font(34, 600);
    ctx.textBaseline = "middle";
    ctx.fillText("Lumen", pad + 62, pad + 30);

    // Title
    ctx.fillStyle = SHARE_PALETTE.dusk;
    ctx.font = font(72, 700);
    ctx.textBaseline = "alphabetic";
    ctx.fillText("How I work with AI", pad, pad + 160);

    // Contrast line (wrapped)
    let y = pad + 230;
    if (contrast) {
      ctx.fillStyle = SHARE_PALETTE.slate;
      ctx.font = font(36, 500);
      wrapText(ctx, contrast, W - pad * 2).forEach((ln) => {
        ctx.fillText(ln, pad, y);
        y += 50;
      });
      y += 30;
    } else {
      y += 10;
    }

    // Tool cards
    const cardH = 150;
    const cardW = W - pad * 2;
    tools.slice(0, 3).forEach((t) => {
      ctx.fillStyle = SHARE_PALETTE.card;
      roundRect(ctx, pad, y, cardW, cardH, 22);
      ctx.fill();

      ctx.fillStyle = SHARE_PALETTE.dusk;
      ctx.font = font(40, 600);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t.name, pad + 36, y + 58);

      const use = t.use ? t.use.toUpperCase() : "A MIX";
      ctx.font = font(24, 600);
      ctx.fillStyle = SHARE_PALETTE.mismatch;
      const useW = ctx.measureText(use).width;
      ctx.fillText(use, pad + cardW - 36 - useW, y + 56);

      // meter track
      const mx = pad + 36;
      const mw = cardW - 72;
      const my = y + 90;
      const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      grad.addColorStop(0, "#e8f7ee");
      grad.addColorStop(1, "#ede9f8");
      ctx.fillStyle = grad;
      roundRect(ctx, mx, my, mw, 8, 4);
      ctx.fill();

      const pct = Math.max(4, Math.min(100, t.postureScore)) / 100;
      const dotX = mx + mw * pct;
      ctx.fillStyle = SHARE_PALETTE.surface;
      ctx.beginPath();
      ctx.arc(dotX, my + 4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SHARE_PALETTE.dusk;
      ctx.beginPath();
      ctx.arc(dotX, my + 4, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = font(22, 500);
      ctx.fillStyle = SHARE_PALETTE.haze;
      ctx.fillText("hands-on", mx, my + 44);
      ctx.fillStyle = SHARE_PALETTE.slate;
      ctx.font = font(22, 600);
      const postureW = ctx.measureText(t.posture).width;
      ctx.fillText(t.posture, mx + (mw - postureW) / 2, my + 44);
      ctx.fillStyle = SHARE_PALETTE.haze;
      ctx.font = font(22, 500);
      const hoW = ctx.measureText("hand-off").width;
      ctx.fillText("hand-off", mx + mw - hoW, my + 44);

      y += cardH + 24;
    });

    // Footer
    ctx.fillStyle = SHARE_PALETTE.haze;
    ctx.font = font(28, 500);
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Your AI cognition mirror", pad, H - pad + 8);
    const url = "lumen.so";
    const urlW = ctx.measureText(url).width;
    ctx.fillStyle = SHARE_PALETTE.mismatch;
    ctx.font = font(28, 600);
    ctx.fillText(url, W - pad - urlW, H - pad + 8);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob((blob) => resolve(blob), "image/png");
      else resolve(null);
    });
  }

  async function shareProfile(tools, contrast) {
    const canvas = drawShareCard(tools, contrast);
    const blob = await canvasToBlob(canvas);
    if (!blob) return;

    // Best effort: copy straight to the clipboard (one-click paste into a post).
    let copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        copied = true;
      }
    } catch (_) {
      copied = false;
    }

    // Always offer the file too, so there's a reliable path on every browser.
    try {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "lumen-ai-profile.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (_) {
      // ignore
    }

    const btn = document.getElementById("lumen-profile-share");
    if (btn) {
      btn.textContent = copied ? "Copied to clipboard ✓" : "Saved image ✓";
      setTimeout(() => {
        btn.textContent = "Share my profile";
      }, 2200);
    }
  }

  async function renderDigest() {
    const history = await LumenSession.loadHistory();
    const digest = LumenNudges.buildDigest({
      history,
      session: LumenSession.get(),
      digestLog: LumenSession.getDigestLog(),
    });
    const el = document.getElementById("lumen-digest");
    if (!el) return;
    el.innerHTML = `
      <p class="lumen-digest-line">${digest.headline}</p>
      ${
        digest.platforms?.length
          ? `<p class="lumen-digest-label" title="Lumen tracks every supported AI tool — this is your message split this week">Across tools</p>
      <p class="lumen-digest-line">${digest.platforms.map((p) => `${p.name} ${p.count}`).join(" · ")}</p>`
          : ""
      }
      ${
        digest.profile?.length
          ? `<p class="lumen-digest-label" title="How you tend to work in each tool — what you use it for and how hands-on you are">How you work</p>
      ${digest.profile.map((t) => `<p class="lumen-digest-line">${t.line}</p>`).join("")}`
          : ""
      }
      <p class="lumen-digest-label" title="How your questioning, prompt length and passive replies trended this week">Drift analysis</p>
      ${digest.driftLines.map((line) => `<p class="lumen-digest-line">${line}</p>`).join("")}
      <p class="lumen-digest-label" title="Times a prompt conflicted with a goal you set">Mismatch</p>
      <p class="lumen-digest-line">${digest.mismatchSummary}</p>
      <p class="lumen-digest-label" title="How often you engaged with a nudge instead of skipping it">Your responses</p>
      <p class="lumen-digest-line">${digest.responses.line}</p>
      <p class="lumen-digest-label" title="A reflection prompt to take away from the week">Sit with</p>
      <p class="lumen-digest-line lumen-digest-prompt">${digest.prompt}</p>
    `;
  }

  function togglePopover() {
    popoverOpen = !popoverOpen;
    const popover = document.getElementById("lumen-popover");
    if (popoverOpen) {
      renderPopover();
      popover.classList.add("lumen-popover--open");
    } else {
      popover.classList.remove("lumen-popover--open");
    }
  }

  function closePopover() {
    popoverOpen = false;
    document.getElementById("lumen-popover")?.classList.remove("lumen-popover--open");
  }

  function shouldShowSignal(signal, evaluation) {
    const mode = LumenGoals.get().mode;
    if (mode === "ghost") return false;
    if (signal === "mismatch" || signal === "depth") return LumenGoals.isActive() && evaluation[signal]?.active;
    return evaluation[signal]?.active;
  }

  function createFeedbackButton(msgId, evaluation, promptText) {
    const btn = document.createElement("button");
    btn.className = "lumen-fb-btn";
    btn.setAttribute("aria-label", "This signal was wrong");
    btn.setAttribute("title", "Wrong signal?");
    btn.textContent = "✕";
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const signalType = evaluation.primary;
      const taskType = evaluation.taskType || "general";
      const wrongCount = LumenSession.recordFeedback({
        messageId: msgId,
        signalType,
        score: evaluation.loopScore,
        verdict: "wrong",
        taskType,
        promptSnippet: promptText,
      });
      btn.textContent = "noted";
      btn.disabled = true;
      if (wrongCount >= 3) {
        showExemptionProposal(taskType, msgId);
      }
    });
    return btn;
  }

  function showExemptionProposal(taskType, msgId) {
    if (document.querySelector(`.lumen-exemption-card[data-task-type="${taskType}"]`)) return;
    const label = LumenGoals.taskTypeLabel(taskType);
    const card = document.createElement("div");
    card.className = "lumen-card lumen-exemption-card";
    card.setAttribute("data-task-type", taskType);
    card.innerHTML = `
      <div class="lumen-card-body">This looks like ${label}. Should I stop flagging this for you?</div>
      <div class="lumen-card-actions">
        <button class="lumen-card-btn" data-action="yes">Yes — ${label} is fine to delegate</button>
        <button class="lumen-card-btn lumen-card-btn--secondary" data-action="no">No, keep flagging</button>
      </div>
    `;
    card.querySelector('[data-action="yes"]')?.addEventListener("click", () => {
      LumenGoals.addTaskTypeExemption(taskType);
      card.remove();
    });
    card.querySelector('[data-action="no"]')?.addEventListener("click", () => card.remove());
    const strip = document.querySelector(`.lumen-strip[data-lumen-msg-id="${msgId}"]`);
    (strip || document.getElementById("lumen-root")).insertAdjacentElement("afterend", card);
  }

  function injectMessageUI(msg, evaluation, adapter, options = {}) {
    if (LumenGoals.isGhost()) return;

    const wrapper = adapter.findUserMessageWrapper(msg.el);
    if (!wrapper) return;

    const bubble =
      wrapper.querySelector(".markdown, .prose, [class*='markdown']")?.parentElement || wrapper;

    const strip = renderStrip(msg.id, evaluation, msg.text);
    if (strip && !strip.isConnected) bubble.insertAdjacentElement("afterend", strip);
    updateWhyLine(msg.id, evaluation);

    if (evaluation.primary) {
      lastEvaluation = {
        msgId: msg.id,
        evaluation,
        snippet: msg.text.slice(0, 120),
      };
    } else if (options.fromJudge && lastEvaluation?.msgId === msg.id) {
      lastEvaluation = {
        msgId: msg.id,
        evaluation,
        snippet: msg.text.slice(0, 120),
      };
    }

    // Only the loop reconsider overlay reaches here (active/focus mode, sustained
    // passivity). Hand-off and Depth never gate the answer.
    if (evaluation.overlayType && !dismissedReconsider.has(msg.id)) {
      const isFresh = msg.timestamp && Date.now() - msg.timestamp < 8000;
      const shouldOverlay =
        options.fromJudge ||
        ((options.isNewMessage || isFresh) && evaluation.confidence !== "gray");
      if (shouldOverlay) {
        showSignalOverlay(msg, evaluation, adapter);
      }
    }

    if (
      LumenGoals.isActive() &&
      evaluation.primary === "mismatch" &&
      evaluation.mismatch?.active
    ) {
      const isFresh = msg.timestamp && Date.now() - msg.timestamp < 8000;
      renderCard(msg.id, evaluation, strip || bubble, msg.el, adapter, {
        pauseAi: Boolean(options.isNewMessage || isFresh),
      });
    } else if (
      LumenGoals.isActive() &&
      evaluation.primary === "depth" &&
      evaluation.depth?.active &&
      evaluation.overlayType !== "depth"
    ) {
      const isFresh = msg.timestamp && Date.now() - msg.timestamp < 120000;
      renderCard(msg.id, evaluation, strip || bubble, msg.el, adapter, {
        pauseAi: Boolean(options.isNewMessage || isFresh),
      });
    }
  }

  function keepAssistantHidden(adapter, msgEl) {
    let restore = adapter.hideAssistantResponsesAfter(msgEl);
    const container = adapter.getMessageContainer?.() || document.body;
    const observer = new MutationObserver(() => {
      restore();
      restore = adapter.hideAssistantResponsesAfter(msgEl);
    });
    observer.observe(container, { childList: true, subtree: true });
    return {
      stop() {
        observer.disconnect();
      },
      show() {
        observer.disconnect();
        restore();
      },
    };
  }

  function resolveStripDisplay(evaluation) {
    if (evaluation.primary === "mismatch" && evaluation.mismatch?.active && LumenGoals.isActive()) {
      return {
        signal: "mismatch",
        label: evaluation.mismatch.label,
        color: SIGNAL_COLORS.mismatch,
      };
    }
    if (evaluation.primary === "depth" && evaluation.depth?.active && LumenGoals.isActive()) {
      return {
        signal: "depth",
        label: evaluation.depth.label,
        color: SIGNAL_COLORS.depth,
      };
    }
    if (evaluation.primary === "handoff" && evaluation.handoff?.active) {
      return {
        signal: "handoff",
        label: evaluation.handoff.label,
        color: SIGNAL_COLORS.handoff,
      };
    }
    if (evaluation.primary === "drift" && evaluation.drift?.active) {
      return {
        signal: "drift",
        label: evaluation.drift.label,
        color: SIGNAL_COLORS.drift,
      };
    }
    if (evaluation.primary === "loop" && evaluation.loop?.active) {
      const score = evaluation.loopScore || 0;
      return {
        signal: "loop",
        label: evaluation.loop.label,
        color: score >= 40 ? SIGNAL_COLORS.handoff : SIGNAL_COLORS.loop,
      };
    }

    return null;
  }

  function updateWhyLine(msgId, evaluation) {
    const existing = document.querySelector(`.lumen-why[data-lumen-msg-id="${msgId}"]`);
    const explanation = evaluation.explanation?.trim();
    if (!explanation || !evaluation.primary) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.textContent = explanation;
      return;
    }
    const strip = document.querySelector(`.lumen-strip[data-lumen-msg-id="${msgId}"]`);
    if (!strip) return;
    const why = document.createElement("div");
    why.className = "lumen-why";
    why.setAttribute("data-lumen-msg-id", msgId);
    why.textContent = explanation;
    strip.insertAdjacentElement("afterend", why);
  }

  function renderStrip(msgId, evaluation, promptText) {
    if (LumenGoals.isGhost()) return null;

    const display = resolveStripDisplay(evaluation);
    const existing = document.querySelector(`.lumen-strip[data-lumen-msg-id="${msgId}"]`);

    if (!display) {
      existing?.remove();
      document.querySelector(`.lumen-why[data-lumen-msg-id="${msgId}"]`)?.remove();
      return null;
    }

    const { label, color } = display;

    if (existing) {
      existing.querySelector(".lumen-strip-dot").style.background = color;
      existing.querySelector(".lumen-strip-state").textContent = LumenNudges.truncate(label);
      existing.querySelector(".lumen-strip-state").style.color = color;
      existing.querySelector(".lumen-strip-state").style.opacity = "0.7";
      return existing;
    }

    const strip = document.createElement("div");
    strip.className = "lumen-strip";
    strip.setAttribute("data-lumen-msg-id", msgId);
    strip.innerHTML = `
      <span class="lumen-strip-dot" style="background:${color}"></span>
      <span class="lumen-strip-state" style="color:${color};opacity:0.7">${LumenNudges.truncate(label)}</span>
    `;
    strip.appendChild(createFeedbackButton(msgId, evaluation, promptText || ""));
    return strip;
  }

  function renderCard(msgId, evaluation, anchor, msgEl, adapter, cardOptions = {}) {
    if (LumenGoals.isGhost() || !LumenGoals.isActive()) return;

    document.querySelector(`.lumen-card[data-lumen-msg-id="${msgId}"]`)?.remove();

    if (!LumenGoals.isActive()) return;

    if (evaluation.primary === "mismatch" && evaluation.mismatch.active) {
      const session = LumenSession.get();
      const copy = LumenNudges.getMismatchCardCopy(
        evaluation.mismatch.goal,
        session.mismatchCount
      );
      const card = document.createElement("div");
      card.className = "lumen-card lumen-card--mismatch";
      card.setAttribute("data-lumen-msg-id", msgId);
      card.innerHTML = `
        <div class="lumen-card-title">${copy.title}</div>
        <div class="lumen-card-body">${copy.body}</div>
        <div class="lumen-card-actions">
          <button class="lumen-card-btn lumen-card-btn--secondary" data-action="continue">${copy.continueLabel}</button>
          <button class="lumen-card-btn" data-action="keep">${copy.keepLabel}</button>
        </div>
      `;
      card.querySelector('[data-action="keep"]')?.addEventListener("click", () => {
        LumenSession.logMismatchEvent(evaluation.mismatch.goal, "kept");
        card.remove();
      });
      card.querySelector('[data-action="continue"]')?.addEventListener("click", () => {
        LumenGoals.removeProtectedGoal(evaluation.mismatch.goal);
        LumenSession.logMismatchEvent(evaluation.mismatch.goal, "goal-changed");
        card.remove();
        syncSettingsUI();
      });
      anchor.insertAdjacentElement("afterend", card);
    }

    if (evaluation.primary === "depth" && evaluation.depth.active) {
      const copy = LumenNudges.getDepthCardCopy(
        evaluation.depth.taskType,
        evaluation.depth.warm
      );
      const card = document.createElement("div");
      card.className = "lumen-card lumen-card--depth" + (evaluation.depth.warm ? " lumen-card--warm" : "");
      card.setAttribute("data-lumen-msg-id", msgId);
      card.innerHTML = `
        <div class="lumen-card-title">${copy.title}</div>
        <div class="lumen-card-body">${copy.body}</div>
        <textarea class="lumen-card-reflection" placeholder="${copy.placeholder}"></textarea>
        <div class="lumen-card-actions">
          <button class="lumen-card-btn" data-action="think">${copy.thinkLabel}</button>
          <button class="lumen-card-btn lumen-card-btn--secondary" data-action="skip">${copy.skipLabel}</button>
        </div>
      `;

      // Depth is additive — the AI response is never hidden or delayed.
      card.querySelector('[data-action="think"]')?.addEventListener("click", () => {
        card.querySelector(".lumen-card-reflection")?.focus();
      });
      card.querySelector('[data-action="skip"]')?.addEventListener("click", () => {
        LumenSession.logDepthMoment(msgEl?.textContent || "", "skip");
        card.remove();
      });
      card.querySelector(".lumen-card-reflection")?.addEventListener("blur", () => {
        const text = card.querySelector(".lumen-card-reflection")?.value.trim();
        if (!text) return;
        LumenSession.logDepthMoment(text, "reflected");
        card.remove();
      });
      anchor.insertAdjacentElement("afterend", card);
    }
  }

  function init() {
    ensureRoot();
    applyFabPosition();
    showOnboardingIfNeeded();
    updateBadge();
  }

  return {
    init,
    updateBadge,
    injectMessageUI,
  };
})();

globalThis.LumenWidget = LumenWidget;
