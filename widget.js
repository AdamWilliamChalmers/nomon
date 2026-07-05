const LumenWidget = (() => {
  const SIGNAL_COLORS = {
    handoff: "#5eb0d9",
    loop: "#2d9e4e",
    drift: "#d4921a",
    mismatch: "#7b5cbf",
    depth: "#3478c5",
  };

  let popoverOpen = false;
  let suppressModeSelectChange = false;
  let dismissedReconsider = new Set();
  // Message ids whose Mismatch card the user has resolved this session (either
  // "still my goal" or "my goal changed"). Without this, the card re-injects on
  // the next processing tick and the buttons appear to do nothing.
  let dismissedMismatch = new Set();
  // Same pattern as dismissedMismatch — without this, Skip on a Depth card
  // removes it once then injectMessageUI re-creates it on the next DOM tick.
  let dismissedDepth = new Set();
  let activeReconsider = null;
  let lastEvaluation = null;
  let fabDisplaySignal = null;
  let fabSignalTimer = null;

  const FAB_SIGNAL_LABELS = {
    loop: "loop · still with it?",
    drift: "drift · fewer questions",
    mismatch: "mismatch · conflicts with your goal",
    depth: "depth · worth thinking first?",
  };
  const FAB_SIGNALS = new Set(Object.keys(FAB_SIGNAL_LABELS));
  // Cached digest + history for the weekly review overlay (so Share doesn't
  // recompute) and the toast teaser.
  let weeklyContext = null;
  let fabDrag = { active: false, moved: false, suppressClick: false, pointerId: null, offsetX: 0, offsetY: 0 };
  // Assigned by bindOnboardingEvents so openSetup() can prefill + reset + open
  // the guided setup cards on demand (first-run invitation or later editing).
  let openOnboardingPanel = null;

  const OVERLAY_HTML = `
      <div id="lumen-reconsider" class="lumen-reconsider">
        <div class="lumen-reconsider-panel lumen-signal-handoff">
          <div class="lumen-reconsider-kicker" id="lumen-reconsider-kicker">Nomon · hand-off</div>
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

  const GUARD_HOLD_HTML = `
      <div id="lumen-guard-hold" class="lumen-guard-hold">
        <div class="lumen-guard-hold-panel">
          <div class="lumen-guard-hold-kicker" id="lumen-guard-hold-kicker">Nomon · guard</div>
          <h2 class="lumen-guard-hold-title" id="lumen-guard-hold-title">This hands over something you wanted to protect</h2>
          <p class="lumen-guard-hold-body" id="lumen-guard-hold-body"></p>
          <div id="lumen-guard-hold-choices" class="lumen-guard-hold-actions">
            <button type="button" class="lumen-guard-hold-btn" id="lumen-guard-hold-draft">Draft something first</button>
            <button type="button" class="lumen-guard-hold-btn lumen-guard-hold-btn--secondary" id="lumen-guard-hold-send">Send anyway</button>
            <button type="button" class="lumen-guard-hold-btn lumen-guard-hold-btn--ghost" id="lumen-guard-hold-goal">Remove this goal from settings</button>
          </div>
          <div id="lumen-guard-hold-draft-mode" class="lumen-guard-hold-draft-mode lumen-hidden">
            <textarea id="lumen-guard-hold-textarea" class="lumen-guard-hold-textarea" placeholder="Your rough draft — even one sentence…"></textarea>
            <button type="button" class="lumen-guard-hold-btn" id="lumen-guard-hold-submit">Add my draft and send</button>
          </div>
        </div>
      </div>`;

  let activeGuardHold = null;
  let guardHoldEventsBound = false;

  // "How it works" is a coach-mark tour, NOT a blocking modal. It highlights the
  // real controls inside the pill's popover one at a time (Modes, aims, goals,
  // setup) with a small callout explaining each. The page dims behind, the
  // popover stays bright, and the whole thing is user-initiated — launched from
  // the pill (or once, the first time the user opens the pill). These three
  // elements are siblings of the popover so the ring/tip can layer above it
  // while the scrim dims only the page behind.
  const TOUR_HTML = `
      <div id="lumen-tour-scrim" class="lumen-tour-scrim"></div>
      <div id="lumen-tour-ring" class="lumen-tour-ring" aria-hidden="true"></div>
      <div id="lumen-tour-tip" class="lumen-tour-tip" role="dialog" aria-live="polite">
        <button type="button" class="lumen-tour-close" id="lumen-tour-close" aria-label="End tour">×</button>
        <div class="lumen-tour-kicker">How it works</div>
        <h3 class="lumen-tour-title" id="lumen-tour-title"></h3>
        <p class="lumen-tour-body" id="lumen-tour-body"></p>
        <div class="lumen-tour-foot">
          <span class="lumen-tour-count" id="lumen-tour-count"></span>
          <div class="lumen-tour-actions">
            <button type="button" class="lumen-tour-btn lumen-tour-btn--ghost lumen-hidden" id="lumen-tour-back">Back</button>
            <button type="button" class="lumen-tour-btn" id="lumen-tour-next">Next</button>
          </div>
        </div>
      </div>`;

  let tourEventsBound = false;
  let tourActive = false;
  let tourIndex = 0;

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
      ensureGuardHoldShell();
      ensureTourShell();
      return;
    }
    const root = document.createElement("div");
    root.id = "lumen-root";
    root.innerHTML = `
      <div id="lumen-fab">
        <span id="lumen-fab-mark" aria-hidden="true">
          <span class="lumen-dot-spin">
            <span class="lumen-dot lumen-dot-green" style="--rx:-9px;--ry:-5px;--ex:0px;--ey:-8px;"></span>
            <span class="lumen-dot lumen-dot-amber" style="--rx:0px;--ry:-5px;--ex:8px;--ey:0px;"></span>
            <span class="lumen-dot lumen-dot-purple" style="--rx:9px;--ry:-5px;--ex:0px;--ey:8px;"></span>
            <span class="lumen-dot lumen-dot-blue" style="--rx:0px;--ry:4px;--ex:-8px;--ey:0px;"></span>
          </span>
        </span>
        <span id="lumen-fab-engagement" class="lumen-fab-engagement" aria-live="polite">
          <span id="lumen-fab-label" class="lumen-fab-label lumen-fab-label--empty"></span>
          <span id="lumen-fab-trend" class="lumen-fab-trend lumen-hidden" aria-hidden="true"></span>
        </span>
        <span id="lumen-fab-digest" aria-hidden="true"></span>
      </div>
      <div id="lumen-popover">
        <div class="lumen-popover-head">
          <div class="lumen-popover-title">Today across all AIs</div>
          <button id="lumen-pause-toggle" class="lumen-popover-pause" type="button">Pause</button>
        </div>
        <label class="lumen-popover-label" id="lumen-session-chart-label" title="Each bar is one message today — colour matches the signal on that prompt">Today's messages</label>
        <div class="lumen-popover-sparkline" id="lumen-sparkline"></div>
        <label class="lumen-popover-label" title="Your engagement across recent days — a mirror to notice trends, not a target to chase">Recent days</label>
        <div class="lumen-popover-sparkline" id="lumen-trend-sparkline"></div>
        <p class="lumen-popover-hint lumen-hidden" id="lumen-trend-empty">A few days of use and your trend shows up here.</p>
        <div class="lumen-popover-stat" title="Your prompts today across ChatGPT, Gemini, Claude, and other connected tools"><span>Messages</span><span class="lumen-popover-stat-value" id="lumen-stat-messages">0</span></div>
        <div class="lumen-popover-stat" title="Whole tasks you asked AI to do from scratch"><span>Hand-offs</span><span class="lumen-popover-stat-value" id="lumen-stat-handoff">0</span></div>
        <div class="lumen-popover-stat" title="Stretches of passive back-and-forth without questions"><span>Loops</span><span class="lumen-popover-stat-value" id="lumen-stat-loop">0</span></div>
        <div class="lumen-popover-stat" title="Conversations that wandered from your prompt"><span>Drift</span><span class="lumen-popover-stat-value" id="lumen-stat-drift">0</span></div>
        <div class="lumen-popover-stat" title="Prompts that conflicted with a goal you set"><span>Mismatch</span><span class="lumen-popover-stat-value" id="lumen-stat-mismatch">0</span></div>
        <div class="lumen-popover-stat" title="Moments worth thinking through before asking"><span>Depth</span><span class="lumen-popover-stat-value" id="lumen-stat-depth">0</span></div>
        <p class="lumen-popover-hint lumen-hidden" id="lumen-stats-empty">Nomon fills this in as you chat.</p>
        <button type="button" class="lumen-popover-setup-cta" id="lumen-setup-cta">Set up Nomon →</button>
        <button type="button" class="lumen-popover-howto" id="lumen-tutorial-cta">How it works</button>
        <label class="lumen-popover-label">Mode</label>
        <select id="lumen-mode-select" class="lumen-popover-select">
          <option value="ambient">Ambient</option>
          <option value="ghost">Ghost</option>
          <option value="active">Active</option>
          <option value="guard">Guard</option>
        </select>
        <p class="lumen-popover-hint" id="lumen-mode-hint"></p>
        <label class="lumen-popover-label">What you use AI for</label>
        <div class="lumen-popover-usecases" id="lumen-usecases">
          <label class="lumen-usecase-chip"><input type="checkbox" value="Research" /><span>Research</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Writing" /><span>Writing</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Coding" /><span>Coding</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Learning" /><span>Learning</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Admin" /><span>Admin</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Creative work" /><span>Creative work</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Work tasks" /><span>Work tasks</span></label>
        </div>
        <label class="lumen-popover-label">Protected goals</label>
        <p class="lumen-popover-hint" id="lumen-goals-hint">All on by default — tap to turn off what doesn't apply.</p>
        <div class="lumen-popover-usecases" id="lumen-goal-chips">
          <label class="lumen-usecase-chip"><input type="checkbox" value="Write my own first drafts" /><span>Write my own first drafts</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Make my own decisions" /><span>Make my own decisions</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Understand the code, not just copy it" /><span>Understand my code</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Do my own analysis and reasoning" /><span>Do my own analysis</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Think independently on strategy" /><span>Think independently</span></label>
          <label class="lumen-usecase-chip"><input type="checkbox" value="Form my own arguments before asking" /><span>Form my own arguments</span></label>
        </div>
        <label class="lumen-popover-label" style="margin-top:8px;">Add your own</label>
        <p class="lumen-popover-hint" id="lumen-custom-goals-hint">Saved goals apply on every AI where Nomon runs.</p>
        <div class="lumen-popover-usecases" id="lumen-custom-goals"></div>
        <div class="lumen-custom-goal-add-row">
          <input id="lumen-custom-goal-input" class="lumen-popover-focus" type="text" placeholder="e.g. Write my own emails" />
          <button type="button" id="lumen-custom-goal-add" class="lumen-custom-goal-add-btn">Add</button>
        </div>
        <p class="lumen-popover-hint lumen-hidden" id="lumen-custom-goals-status" role="status" aria-live="polite"></p>
        <p class="lumen-popover-hint">Drag the Nomon pill to move it out of the way.</p>
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
        <div class="lumen-popover-divider"></div>
        <button
          type="button"
          id="lumen-privacy-toggle"
          class="lumen-privacy-toggle"
          aria-expanded="false"
          aria-controls="lumen-privacy-panel"
        >
          <span>Privacy &amp; data</span>
          <span class="lumen-privacy-toggle-chevron" aria-hidden="true">›</span>
        </button>
        <div id="lumen-privacy-panel" class="lumen-privacy-panel lumen-hidden">
          <p class="lumen-popover-hint">Scoring runs locally. Turn off anything below you don't want sent to Nomon's servers.</p>
          <label class="lumen-popover-check">
            <input type="checkbox" id="lumen-llm-judge" />
            LLM second opinion · catches subtle hand-offs
          </label>
          <p class="lumen-popover-hint" id="lumen-judge-hint">On by default · borderline prompts only · cached per message · turn off to stay fully on-device</p>
          <label class="lumen-popover-check">
            <input type="checkbox" id="lumen-study-participant" />
            Calibration study — post-session survey
          </label>
          <p class="lumen-popover-hint">On by default · opens a short survey when you leave a tab · turn off any time</p>
          <label class="lumen-popover-check">
            <input type="checkbox" id="lumen-share-data" />
            Share anonymised session summary
          </label>
          <p class="lumen-popover-hint">On by default · daily counts and feedback snippets only, not full chats</p>
          <div id="lumen-advanced" class="lumen-advanced lumen-hidden">
            <label class="lumen-popover-label">Backend URL (for judge / calibration / sharing)</label>
            <input id="lumen-backend-input" class="lumen-popover-focus" type="text" placeholder="http://localhost:3000" />
            <p class="lumen-popover-hint">Developer setting. Set localStorage <code>lumenDev=1</code> to show this.</p>
          </div>
        </div>
      </div>
      <div id="lumen-digest-toast" class="lumen-digest-toast" role="status" aria-live="polite">
        <span class="lumen-digest-toast-mark" aria-hidden="true"></span>
        <div class="lumen-digest-toast-text">
          <span class="lumen-digest-toast-title">Your weekly digest is ready</span>
          <span class="lumen-digest-toast-sub" id="lumen-digest-toast-sub">A look at how you worked with AI this week.</span>
        </div>
        <button type="button" class="lumen-digest-toast-view" id="lumen-digest-toast-view">View</button>
        <button type="button" class="lumen-digest-toast-dismiss" id="lumen-digest-toast-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div id="lumen-weekly" class="lumen-weekly">
        <div class="lumen-weekly-panel">
          <button type="button" class="lumen-weekly-close" id="lumen-weekly-close" aria-label="Close">×</button>
          <div class="lumen-weekly-kicker">Nomon · weekly review</div>
          <h2 class="lumen-weekly-headline" id="lumen-weekly-headline">This week</h2>
          <div class="lumen-weekly-body" id="lumen-weekly-body"></div>
          <div class="lumen-weekly-actions">
            <button type="button" class="lumen-weekly-btn" id="lumen-weekly-share">Share this week</button>
            <button type="button" class="lumen-weekly-btn lumen-weekly-btn--secondary" id="lumen-weekly-done">Done</button>
          </div>
        </div>
      </div>
      ${OVERLAY_HTML}
      ${GUARD_HOLD_HTML}
      <div id="lumen-onboarding" class="lumen-onboarding">
        <div class="lumen-onboarding-panel">
          <button type="button" class="lumen-onboarding-close" id="lumen-onboarding-close" aria-label="Close setup">×</button>
          <div class="lumen-onboarding-head">
            <span class="lumen-onboarding-mark" aria-hidden="true">
              <span class="lm-d lm-d-green"></span>
              <span class="lm-d lm-d-amber"></span>
              <span class="lm-d lm-d-purple"></span>
              <span class="lm-d lm-d-blue"></span>
            </span>
            <div class="lumen-onboarding-progress" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1">
              <span class="lumen-onboarding-pip" data-pip="1"></span>
              <span class="lumen-onboarding-pip" data-pip="2"></span>
              <span class="lumen-onboarding-pip" data-pip="3"></span>
            </div>
          </div>
          <div class="lumen-onboarding-step" data-step="1">
            <h2>Set up Nomon</h2>
            <p>What do you use AI for? These are all on by default — switch off anything that doesn't fit.</p>
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
            <p>These are all on by default — switch off any that aren't yours, or add your own. Nomon only flags a mismatch against goals you set.</p>
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
            <h2>How visible should Nomon be?</h2>
            <select id="lumen-onboarding-mode">
              <option value="active">Active — inline cues + reflection cards (default)</option>
              <option value="ambient">Ambient — subtle inline cues only</option>
              <option value="ghost">Ghost — weekly digest only, nothing in-session</option>
              <option value="guard">Guard — optional hold before send on clear goal conflicts</option>
            </select>
            <p class="lumen-popover-hint lumen-hidden" id="lumen-onboarding-guard-hint" style="margin-top:14px;">Guard is optional — a fifth mode you opt into. Nomon stays a mirror by default. If you choose Guard, send pauses briefly when a prompt clearly conflicts with a protected goal you wrote. Always bypassable; add at least one goal in the previous step.</p>
            <p class="lumen-popover-hint" style="margin-top:14px;">Smarter detection, the calibration study, and anonymised sharing are on by default — turn any off under Privacy &amp; data in the pill.</p>
          </div>
          <div class="lumen-onboarding-actions">
            <button id="lumen-onboarding-skip" class="lumen-onboarding-btn lumen-onboarding-btn--ghost">Not now</button>
            <div class="lumen-onboarding-actions-right">
              <button id="lumen-onboarding-back" class="lumen-onboarding-btn lumen-onboarding-btn--ghost lumen-hidden">Back</button>
              <button id="lumen-onboarding-next" class="lumen-onboarding-btn">Continue</button>
            </div>
          </div>
        </div>
      </div>
      ${TOUR_HTML}
    `;
    document.body.appendChild(root);
    bindRootEvents();
    bindReconsiderEvents();
    bindGuardHoldEvents();
    bindTourEvents();
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

  function ensureGuardHoldShell() {
    if (document.getElementById("lumen-guard-hold")) return;
    document.getElementById("lumen-root")?.insertAdjacentHTML("beforeend", GUARD_HOLD_HTML);
    guardHoldEventsBound = false;
    bindGuardHoldEvents();
  }

  function ensureTourShell() {
    if (document.getElementById("lumen-tour-tip")) return;
    document.getElementById("lumen-root")?.insertAdjacentHTML("beforeend", TOUR_HTML);
    tourEventsBound = false;
    bindTourEvents();
  }

  let goalsChangeBound = false;
  let customGoalsStatusTimer = null;

  function readPresetGoalsFromUI() {
    return Array.from(document.querySelectorAll("#lumen-goal-chips input:checked")).map(
      (input) => input.value
    );
  }

  function readStoredCustomGoals() {
    return LumenGoals.splitProtectedGoals(LumenGoals.get().protectedGoals || []).customGoals;
  }

  function saveProtectedGoalsFromUI() {
    LumenGoals.save({
      protectedGoals: LumenGoals.mergeProtectedGoals({
        presetGoals: readPresetGoalsFromUI(),
        customGoals: readStoredCustomGoals(),
      }),
    });
    updateModeHint();
  }

  function showCustomGoalsStatus(message) {
    const status = document.getElementById("lumen-custom-goals-status");
    if (!status) return;
    status.textContent = message;
    status.classList.remove("lumen-hidden");
    window.clearTimeout(customGoalsStatusTimer);
    customGoalsStatusTimer = window.setTimeout(() => {
      status.classList.add("lumen-hidden");
      status.textContent = "";
    }, 3200);
  }

  function renderCustomGoalChips() {
    const container = document.getElementById("lumen-custom-goals");
    if (!container) return;
    const customGoals = readStoredCustomGoals();
    if (!customGoals.length) {
      container.innerHTML = "";
      container.classList.add("lumen-hidden");
      return;
    }
    container.classList.remove("lumen-hidden");
    container.innerHTML = customGoals
      .map(
        (goal) => `
      <label class="lumen-usecase-chip">
        <input type="checkbox" value="${escapeHtml(goal)}" checked />
        <span>${escapeHtml(goal)}</span>
      </label>`
      )
      .join("");
  }

  function addCustomGoalFromInput() {
    const input = document.getElementById("lumen-custom-goal-input");
    const text = input?.value.trim();
    if (!text) {
      input?.focus();
      return;
    }
    const presetSet = new Set(LumenGoals.listPresetGoals());
    const stored = LumenGoals.get().protectedGoals || [];
    if (presetSet.has(text) || stored.includes(text)) {
      showCustomGoalsStatus("Already in your goals");
      input.select();
      return;
    }
    LumenGoals.save({ protectedGoals: [...stored, text] });
    if (input) input.value = "";
    renderCustomGoalChips();
    showCustomGoalsStatus("Saved · syncs across your AI tabs");
    updateModeHint();
  }

  function setModeSelectValue(select, mode) {
    if (!select) return;
    const normalized = LumenGoals.normalizeMode?.(mode) ?? mode;
    if (select.value === normalized) return;
    suppressModeSelectChange = true;
    select.value = normalized;
    queueMicrotask(() => {
      suppressModeSelectChange = false;
    });
  }

  function bindGoalsSync() {
    if (goalsChangeBound) return;
    goalsChangeBound = true;
    LumenGoals.onChange?.(() => {
      syncSettingsUI();
      if (popoverOpen) renderPopover();
    });
  }

  function togglePrivacyPanel(forceOpen) {
    const btn = document.getElementById("lumen-privacy-toggle");
    const panel = document.getElementById("lumen-privacy-panel");
    if (!btn || !panel) return;
    const open = typeof forceOpen === "boolean" ? forceOpen : btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("lumen-hidden", !open);
    btn.classList.toggle("lumen-privacy-toggle--open", open);
  }

  function bindRootEvents() {
    bindFabDrag();
    bindGoalsSync();

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
      if (suppressModeSelectChange) return;
      const next = event.target.value;
      if (next === LumenGoals.get().mode) return;
      LumenGoals.save({ mode: next });
      updateModeHint();
      morphFabMark();
    });

    document.getElementById("lumen-pause-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const nowPaused = !LumenGoals.isPaused();
      LumenGoals.setPaused(nowPaused);
      if (nowPaused) clearInjectedUI();
      syncSettingsUI();
      updateBadge();
    });

    document.getElementById("lumen-goal-chips")?.addEventListener("change", () => {
      saveProtectedGoalsFromUI();
    });

    document.getElementById("lumen-custom-goals")?.addEventListener("change", (event) => {
      const input = event.target;
      if (input?.type !== "checkbox" || input.checked) return;
      const goal = input.value;
      LumenGoals.save({
        protectedGoals: (LumenGoals.get().protectedGoals || []).filter((item) => item !== goal),
      });
      renderCustomGoalChips();
      showCustomGoalsStatus("Removed");
      updateModeHint();
    });

    document.getElementById("lumen-custom-goal-add")?.addEventListener("click", (event) => {
      event.stopPropagation();
      addCustomGoalFromInput();
    });

    document.getElementById("lumen-custom-goal-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        addCustomGoalFromInput();
      }
    });

    document.getElementById("lumen-usecases")?.addEventListener("change", () => {
      const useCases = Array.from(
        document.querySelectorAll("#lumen-usecases input:checked")
      ).map((input) => input.value);
      LumenGoals.setUseCases(useCases);
    });

    document.getElementById("lumen-setup-cta")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openSetup();
    });

    document.getElementById("lumen-tutorial-cta")?.addEventListener("click", (event) => {
      event.stopPropagation();
      startTour();
    });

    document.getElementById("lumen-privacy-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePrivacyPanel();
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

    document.getElementById("lumen-digest-toast-view")?.addEventListener("click", (event) => {
      event.stopPropagation();
      // "View" opens the focused weekly review — the moment, not the settings.
      openWeeklyReview();
    });

    document.getElementById("lumen-digest-toast-dismiss")?.addEventListener("click", (event) => {
      event.stopPropagation();
      // Explicit dismissal counts as done for the week.
      markDigestViewed();
    });

    document.getElementById("lumen-weekly-close")?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeWeeklyReview();
    });

    document.getElementById("lumen-weekly-done")?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeWeeklyReview();
    });

    document.getElementById("lumen-weekly-share")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (weeklyContext) shareWeekly(weeklyContext.digest, weeklyContext.history).catch(() => {});
    });

    document.getElementById("lumen-weekly")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeWeeklyReview();
    });

    document.addEventListener("mousedown", (event) => {
      if (!popoverOpen) return;
      const root = document.getElementById("lumen-root");
      if (root && !root.contains(event.target)) closePopover();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (tourActive) {
        endTour();
      } else if (document.getElementById("lumen-weekly")?.classList.contains("lumen-weekly--open")) {
        closeWeeklyReview();
      } else if (popoverOpen) {
        closePopover();
      }
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
      if (digestReady) positionDigestToast();
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
      if (digestReady) positionDigestToast();
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

  function resetGuardHoldPanel() {
    document.getElementById("lumen-guard-hold-choices")?.classList.remove("lumen-hidden");
    document.getElementById("lumen-guard-hold-draft-mode")?.classList.add("lumen-hidden");
    const textarea = document.getElementById("lumen-guard-hold-textarea");
    if (textarea) textarea.value = "";
  }

  function closeGuardHold() {
    document.getElementById("lumen-guard-hold")?.classList.remove("lumen-guard-hold--open");
    resetGuardHoldPanel();
    activeGuardHold = null;
  }

  function showGuardHold({ text, result, adapter, onProceed }) {
    ensureRoot();
    resetGuardHoldPanel();

    const copy = LumenNudges.getGuardHoldCopy(result.mismatch?.goal || "your goal");
    document.getElementById("lumen-guard-hold-kicker").textContent = copy.kicker;
    document.getElementById("lumen-guard-hold-title").textContent = copy.title;
    document.getElementById("lumen-guard-hold-body").textContent = copy.body;
    document.getElementById("lumen-guard-hold-draft").textContent = copy.draftLabel;
    document.getElementById("lumen-guard-hold-send").textContent = copy.sendAnywayLabel;
    document.getElementById("lumen-guard-hold-goal").textContent = copy.goalChangedLabel;
    document.getElementById("lumen-guard-hold-submit").textContent = copy.submitLabel;
    document.getElementById("lumen-guard-hold-textarea")?.setAttribute("placeholder", copy.draftPlaceholder);

    activeGuardHold = { text, result, adapter, onProceed };
    LumenSession.logGuardEvent("hold-shown", result.mismatch?.goal);
    document.getElementById("lumen-guard-hold")?.classList.add("lumen-guard-hold--open");
  }

  function bindGuardHoldEvents() {
    if (guardHoldEventsBound) return;
    guardHoldEventsBound = true;

    document.getElementById("lumen-guard-hold-draft")?.addEventListener("click", (event) => {
      event.stopPropagation();
      document.getElementById("lumen-guard-hold-choices")?.classList.add("lumen-hidden");
      document.getElementById("lumen-guard-hold-draft-mode")?.classList.remove("lumen-hidden");
      document.getElementById("lumen-guard-hold-textarea")?.focus();
    });

    document.getElementById("lumen-guard-hold-send")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!activeGuardHold) return;
      LumenSession.logGuardEvent("bypassed", activeGuardHold.result.mismatch?.goal);
      const proceed = activeGuardHold.onProceed;
      const text = activeGuardHold.text;
      closeGuardHold();
      proceed?.(text);
    });

    document.getElementById("lumen-guard-hold-goal")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!activeGuardHold) return;
      const goal = activeGuardHold.result.mismatch?.goal;
      if (goal) {
        LumenGoals.removeProtectedGoal(goal);
        LumenSession.logMismatchEvent(goal, "goal-changed");
        LumenSession.logGuardEvent("goal-changed", goal);
      }
      closeGuardHold();
      syncSettingsUI();
    });

    document.getElementById("lumen-guard-hold-submit")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!activeGuardHold) return;
      const draft = document.getElementById("lumen-guard-hold-textarea")?.value.trim();
      if (!draft) {
        document.getElementById("lumen-guard-hold-textarea")?.focus();
        return;
      }
      const combined = LumenNudges.buildCombinedPrompt(draft, activeGuardHold.text);
      LumenSession.logGuardEvent("draft-submitted", activeGuardHold.result.mismatch?.goal);
      const proceed = activeGuardHold.onProceed;
      closeGuardHold();
      proceed?.(combined);
    });
  }

  function bindOnboardingEvents() {
    let step = 1;
    const panel = document.getElementById("lumen-onboarding");
    const nextBtn = document.getElementById("lumen-onboarding-next");
    const backBtn = document.getElementById("lumen-onboarding-back");
    const skipBtn = document.getElementById("lumen-onboarding-skip");
    const closeBtn = document.getElementById("lumen-onboarding-close");
    const progress = panel?.querySelector(".lumen-onboarding-progress");
    const modeSelect = document.getElementById("lumen-onboarding-mode");
    const guardHint = document.getElementById("lumen-onboarding-guard-hint");

    const TOTAL_STEPS = 3;
    function showStep(n) {
      step = Math.min(TOTAL_STEPS, Math.max(1, n));
      for (let i = 1; i <= TOTAL_STEPS; i += 1) {
        panel
          .querySelector(`[data-step="${i}"]`)
          ?.classList.toggle("lumen-hidden", i !== step);
      }
      nextBtn.textContent = step === TOTAL_STEPS ? "Finish" : "Continue";
      backBtn?.classList.toggle("lumen-hidden", step === 1);
      panel.querySelectorAll(".lumen-onboarding-pip").forEach((pip, i) => {
        pip.classList.toggle("is-active", i + 1 === step);
        pip.classList.toggle("is-done", i + 1 < step);
      });
      progress?.setAttribute("aria-valuenow", String(step));
    }

    // Pre-fill the cards from whatever is already saved, so reopening setup to
    // edit answers shows the user's current choices rather than a blank slate.
    // On a fresh setup (nothing saved yet), every option starts selected — the
    // user opts out by deselecting or adds their own via the text field.
    function prefill() {
      const goals = LumenGoals.get();
      const useCases = new Set(goals.useCases || []);
      const useCasesDefaultAll = !goals.onboardingComplete && useCases.size === 0;
      document.querySelectorAll("#lumen-use-cases input").forEach((input) => {
        input.checked = useCasesDefaultAll || useCases.has(input.value);
      });
      const presetValues = new Set(
        Array.from(document.querySelectorAll("#lumen-goal-presets input")).map((i) => i.value)
      );
      const protectedGoals = goals.protectedGoals || [];
      const goalsDefaultAll = !goals.onboardingComplete && protectedGoals.length === 0;
      document.querySelectorAll("#lumen-goal-presets input").forEach((input) => {
        input.checked = goalsDefaultAll || protectedGoals.includes(input.value);
      });
      const custom = protectedGoals.filter((goal) => !presetValues.has(goal));
      const typed = document.getElementById("lumen-onboarding-goals");
      if (typed) typed.value = custom.join("\n");
      if (modeSelect) setModeSelectValue(modeSelect, goals.mode || "active");
      guardHint?.classList.toggle("lumen-hidden", (goals.mode || "active") !== "guard");
    }

    // Exposed to the module so openSetup() can prefill, reset to step 1, and
    // open the guided cards on explicit user action (never auto-opened).
    openOnboardingPanel = () => {
      prefill();
      showStep(1);
      panel.classList.add("lumen-onboarding--open");
    };

    modeSelect?.addEventListener("change", () => {
      guardHint?.classList.toggle("lumen-hidden", modeSelect.value !== "guard");
    });

    // Dismiss the setup card without committing to it. Nomon stays un-set-up;
    // the setup button keeps a quiet pulse until the user finishes or skips.
    function dismissSetup() {
      panel.classList.remove("lumen-onboarding--open");
      syncSettingsUI();
    }

    skipBtn?.addEventListener("click", dismissSetup);
    closeBtn?.addEventListener("click", dismissSetup);
    // Backdrop click (outside the card) dismisses; clicks inside the card don't.
    panel?.addEventListener("click", (event) => {
      if (event.target === panel) dismissSetup();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel?.classList.contains("lumen-onboarding--open")) {
        dismissSetup();
      }
    });

    backBtn?.addEventListener("click", () => {
      if (step > 1) showStep(step - 1);
    });

    nextBtn?.addEventListener("click", () => {
      if (step < TOTAL_STEPS) {
        showStep(step + 1);
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

      if (mode === "guard" && !protectedGoals.length) {
        guardHint.textContent =
          "Guard needs at least one protected goal — go back and add one, or pick another mode.";
        guardHint.classList.remove("lumen-hidden");
        return;
      }

      LumenGoals.completeOnboarding({ useCases, protectedGoals, mode });
      panel.classList.remove("lumen-onboarding--open");
      syncSettingsUI();
    });

    showStep(1);
  }

  // First run is a quiet invitation, not a wall. The popover setup button carries
  // a very subtle pulse until onboarding is complete or skipped.
  function showOnboardingIfNeeded() {
    const goals = LumenGoals.get();
    if (goals.onboardingComplete) return;
    if (!goals.setupInviteSeen) {
      LumenGoals.markSetupInviteSeen?.();
    }
    syncSettingsUI();
  }

  // The only path that opens the guided setup cards — always user-initiated
  // (the "Set up / Review setup" popover button).
  function openSetup() {
    ensureRoot();
    closePopover();
    if (openOnboardingPanel) {
      openOnboardingPanel();
    } else {
      document.getElementById("lumen-onboarding")?.classList.add("lumen-onboarding--open");
    }
  }

  // ── "How it works" coach-mark tour ────────────────────────────────────────
  // Each step points at a real control inside the popover (or the pill itself)
  // and explains it. Copy for the Modes step is composed from goals.js so it
  // never drifts. This is launched by the user — never a load-time interrupt.
  function tourModesBody() {
    const modes = LumenGoals.listModes?.() || [];
    const line = modes.map((m) => `${m.label} — ${m.blurb}`).join(" ");
    return (
      line ||
      "Mode sets how present Nomon is, from a silent weekly digest to a brief hold before send."
    );
  }

  const TOUR_STEPS = [
    {
      target: () => document.getElementById("lumen-fab"),
      title: "This is Nomon",
      body: "A quiet mirror for how you work with AI. The label shows your engagement today across every AI you use — click the pill any time to open this panel.",
    },
    {
      target: () => document.getElementById("lumen-mode-select"),
      title: "Modes — how present Nomon is",
      body: tourModesBody,
    },
    {
      target: () => document.getElementById("lumen-usecases"),
      title: "What you use AI for",
      body: "Everything starts switched on. Tap a chip to deselect what doesn't apply — it tunes how Nomon reads your prompts.",
    },
    {
      target: () => document.getElementById("lumen-custom-goal-input"),
      title: "Protected goals",
      body: "Everything starts switched on. Tap a chip to turn off what doesn't apply. Type your own goal and click Add — it saves and syncs across ChatGPT, Claude, and every AI where Nomon runs.",
    },
    {
      target: () => document.getElementById("lumen-setup-cta"),
      title: "Guided setup, any time",
      body: "Prefer a step-by-step walkthrough to set these up? Run guided setup here whenever you like.",
    },
    {
      // Falls back to the digest container while its "Open weekly review →"
      // button is still rendering (it's built asynchronously from history).
      target: () =>
        document.getElementById("lumen-digest-open") || document.getElementById("lumen-digest"),
      title: "Open weekly review",
      body: "After a few days, open your weekly review here — a calm recap of how you worked with AI across every tool, with a card you can share.",
    },
  ];

  function positionTour() {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourIndex];
    const target = step?.target?.();
    const ring = document.getElementById("lumen-tour-ring");
    const tip = document.getElementById("lumen-tour-tip");
    if (!target || !ring || !tip) return;

    const r = target.getBoundingClientRect();
    const pad = 6;
    ring.style.top = `${r.top - pad}px`;
    ring.style.left = `${r.left - pad}px`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;

    // Prefer placing the callout to the LEFT of the target (the popover hugs the
    // right edge). Fall back to below, then above — always clamped on-screen.
    const tipW = tip.offsetWidth || 288;
    const tipH = tip.offsetHeight || 150;
    const gap = 14;
    const margin = 12;
    let left = r.left - gap - tipW;
    let top = r.top + r.height / 2 - tipH / 2;
    if (left < margin) {
      left = Math.min(Math.max(margin, r.left), window.innerWidth - tipW - margin);
      top = r.bottom + gap;
      if (top + tipH > window.innerHeight - margin) top = r.top - gap - tipH;
    }
    top = Math.min(Math.max(margin, top), window.innerHeight - tipH - margin);
    left = Math.min(Math.max(margin, left), window.innerWidth - tipW - margin);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }

  function showTourStep(i) {
    tourIndex = Math.min(TOUR_STEPS.length - 1, Math.max(0, i));
    const step = TOUR_STEPS[tourIndex];
    const body = typeof step.body === "function" ? step.body() : step.body;
    const titleEl = document.getElementById("lumen-tour-title");
    const bodyEl = document.getElementById("lumen-tour-body");
    const countEl = document.getElementById("lumen-tour-count");
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = body;
    if (countEl) countEl.textContent = `${tourIndex + 1} / ${TOUR_STEPS.length}`;
    document.getElementById("lumen-tour-back")?.classList.toggle("lumen-hidden", tourIndex === 0);
    const nextBtn = document.getElementById("lumen-tour-next");
    if (nextBtn) nextBtn.textContent = tourIndex === TOUR_STEPS.length - 1 ? "Done" : "Next";

    // Bring the target into view inside the scrollable popover, then measure.
    const target = step.target?.();
    try {
      target?.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (_) {
      // older engines: ignore
    }
    requestAnimationFrame(() => requestAnimationFrame(positionTour));
  }

  function startTour() {
    ensureRoot();
    // The tour spotlights controls inside the popover, so make sure it's open.
    if (!popoverOpen) {
      renderPopover();
      document.getElementById("lumen-popover")?.classList.add("lumen-popover--open");
      popoverOpen = true;
    }
    tourActive = true;
    tourIndex = 0;
    document.getElementById("lumen-root")?.classList.add("lumen-touring");
    // Dedup listeners (same fn reference) so replaying never stacks handlers.
    window.removeEventListener("resize", positionTour);
    window.addEventListener("resize", positionTour);
    document.getElementById("lumen-popover")?.removeEventListener("scroll", positionTour);
    document.getElementById("lumen-popover")?.addEventListener("scroll", positionTour);
    showTourStep(0);
  }

  function endTour() {
    tourActive = false;
    document.getElementById("lumen-root")?.classList.remove("lumen-touring");
    window.removeEventListener("resize", positionTour);
    document.getElementById("lumen-popover")?.removeEventListener("scroll", positionTour);
  }

  function bindTourEvents() {
    if (tourEventsBound) return;
    if (!document.getElementById("lumen-tour-tip")) return;
    tourEventsBound = true;

    document.getElementById("lumen-tour-close")?.addEventListener("click", (event) => {
      event.stopPropagation();
      endTour();
    });
    document.getElementById("lumen-tour-back")?.addEventListener("click", (event) => {
      event.stopPropagation();
      showTourStep(tourIndex - 1);
    });
    document.getElementById("lumen-tour-next")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tourIndex >= TOUR_STEPS.length - 1) endTour();
      else showTourStep(tourIndex + 1);
    });
    // Clicking the dimmed page ends the tour (the popover stays open).
    document.getElementById("lumen-tour-scrim")?.addEventListener("click", (event) => {
      event.stopPropagation();
      endTour();
    });
  }

  // First run only: the very first time the user opens the pill, run the tour
  // once so it's discovered in context — never a blocking load-time modal.
  function maybeAutoStartTour() {
    if (LumenGoals.isTutorialSeen?.()) return;
    LumenGoals.markTutorialSeen?.();
    requestAnimationFrame(() => startTour());
  }

  // Gate for developer-only popover controls (e.g. the Backend URL override).
  // Off for normal users; devs flip it on once via the console.
  function isDevMode() {
    try {
      return (
        localStorage.getItem("lumenDev") === "1" ||
        /[?&]lumendev=1\b/.test(location.search)
      );
    } catch (_) {
      return false;
    }
  }

  function syncSettingsUI() {
    const goals = LumenGoals.get();
    const modeSelect = document.getElementById("lumen-mode-select");
    const judgeToggle = document.getElementById("lumen-llm-judge");
    const studyToggle = document.getElementById("lumen-study-participant");
    const shareToggle = document.getElementById("lumen-share-data");
    const backendInput = document.getElementById("lumen-backend-input");
    const base = LumenConfig.webAppUrl(goals.webAppUrl);
    if (modeSelect) setModeSelectValue(modeSelect, goals.mode);

    const storedGoals = goals.protectedGoals || [];
    document.querySelectorAll("#lumen-goal-chips input").forEach((input) => {
      input.checked = storedGoals.includes(input.value);
    });
    renderCustomGoalChips();

    const useCases = new Set(goals.useCases || []);
    document.querySelectorAll("#lumen-usecases input").forEach((input) => {
      input.checked = useCases.has(input.value);
    });

    const setupCta = document.getElementById("lumen-setup-cta");
    if (setupCta) {
      setupCta.textContent = goals.onboardingComplete
        ? "Review setup →"
        : "Set up Nomon →";
      setupCta.classList.toggle("lumen-popover-setup-cta--pending", !goals.onboardingComplete);
    }

    if (judgeToggle) judgeToggle.checked = Boolean(goals.llmJudgeEnabled);
    if (studyToggle) studyToggle.checked = Boolean(goals.studyParticipant);
    if (shareToggle) shareToggle.checked = Boolean(goals.shareAnonymisedData);
    if (backendInput) backendInput.value = base;
    // Backend URL is a developer setting — hidden from the normal popover.
    // Reveal it with localStorage lumenDev=1 (or ?lumendev=1 in the URL).
    document.getElementById("lumen-advanced")?.classList.toggle("lumen-hidden", !isDevMode());

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
    if (LumenGoals.isGuard() && !LumenGoals.get().protectedGoals.length) {
      hint.textContent =
        "Guard mode needs at least one protected goal below — or switch to another mode.";
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

  // Play exactly one loop of the four-dot processing animation (converge →
  // pulse → orbit → return). One loop per event, never infinite on the FAB —
  // a perpetually animating pill would be a nag ("mirror, not nanny").
  let fabPulseTimer = null;
  function pulseFabMark() {
    const mark = document.getElementById("lumen-fab-mark");
    if (!mark) return;
    // Restart the one-shot animation even if it's mid-flight.
    mark.classList.remove("lumen-mark-active");
    void mark.offsetWidth;
    mark.classList.add("lumen-mark-active");
    window.clearTimeout(fabPulseTimer);
    fabPulseTimer = window.setTimeout(
      () => mark.classList.remove("lumen-mark-active"),
      5200
    );
  }

  function clearFabSignal() {
    window.clearTimeout(fabSignalTimer);
    fabSignalTimer = null;
    fabDisplaySignal = null;
    const fab = document.getElementById("lumen-fab");
    if (fab) delete fab.dataset.signal;
  }

  // Signal-reactive FAB label (nomon-fab.md): at rest = dots only; on signal =
  // short copy for 4s; ghost mode = static "ghost". Hand-off still animates
  // the mark but does not expand the label.
  function showFabSignal(signal) {
    if (LumenGoals.isGhost() || LumenGoals.isPaused()) return;
    if (!signal || signal === "handoff") {
      pulseFabMark();
      return;
    }
    if (!FAB_SIGNALS.has(signal)) {
      pulseFabMark();
      return;
    }
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;

    window.clearTimeout(fabSignalTimer);
    fabDisplaySignal = signal;
    fab.dataset.signal = signal;
    syncFabLabelFromState();
    syncFabAccessibility();
    pulseFabMark();

    fabSignalTimer = window.setTimeout(() => {
      fabDisplaySignal = null;
      delete fab.dataset.signal;
      syncFabLabelFromState();
      syncFabAccessibility();
    }, 4000);
  }

  function syncFabLabelFromState() {
    const labelEl = document.getElementById("lumen-fab-label");
    if (!labelEl) return;

    if (fabDisplaySignal && FAB_SIGNAL_LABELS[fabDisplaySignal]) {
      labelEl.textContent = FAB_SIGNAL_LABELS[fabDisplaySignal];
      labelEl.classList.remove("lumen-fab-label--empty");
      return;
    }

    const paused = LumenGoals.isPaused();
    const mode = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode;

    if (paused) {
      labelEl.textContent = "paused";
      labelEl.classList.remove("lumen-fab-label--empty");
      return;
    }

    if (mode === "ghost") {
      labelEl.textContent = "ghost";
      labelEl.classList.remove("lumen-fab-label--empty");
      return;
    }

    labelEl.textContent = "";
    labelEl.classList.add("lumen-fab-label--empty");
  }

  function syncFabAccessibility() {
    const engagementEl = document.getElementById("lumen-fab-engagement");
    if (!engagementEl) return;
    const paused = LumenGoals.isPaused();
    const mode = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode;
    if (paused) {
      engagementEl.title = "Nomon is paused — click to open settings and resume";
      engagementEl.setAttribute("aria-label", "Nomon paused");
      return;
    }
    if (mode === "ghost") {
      engagementEl.title = "Ghost mode — in-session signals off; weekly digest only";
      engagementEl.setAttribute("aria-label", "Nomon ghost mode");
      return;
    }
    if (fabDisplaySignal) {
      engagementEl.title = `Nomon — ${fabDisplaySignal} signal`;
      engagementEl.setAttribute("aria-label", `Nomon ${mode} mode, ${fabDisplaySignal} signal`);
      return;
    }
    engagementEl.title = `Nomon — ${mode} mode`;
    engagementEl.setAttribute("aria-label", `Nomon ${mode} mode`);
  }

  // The four-dot mark has fixed brand colours (mode is shown by the pill's
  // border/ring), so a mode switch just replays one processing loop as feedback.
  function morphFabMark() {
    updateBadge();
    pulseFabMark();
  }

  function updateBadge() {
    ensureRoot();
    applyFabPosition();
    const fab = document.getElementById("lumen-fab");
    const paused = LumenGoals.isPaused();
    const mode = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode ?? "active";

    if (fab) {
      fab.dataset.mode = mode;
      fab.dataset.paused = paused ? "true" : "false";
      if (paused || mode === "ghost") clearFabSignal();
    }

    syncFabLabelFromState();
    syncFabAccessibility();
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

  function renderSparkline(scores, barColors) {
    // Single implementation lives in sparkline.js (loaded before widget.js).
    return globalThis.LumenSparkline?.render?.(scores || [], 120, 32, barColors) ?? "";
  }

  function signalBarColor(primary) {
    if (primary && SIGNAL_COLORS[primary]) return SIGNAL_COLORS[primary];
    return "#d8d7e0";
  }

  // Escape user-typed text (e.g. protected goals) before it goes into innerHTML.
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        default: return "&#39;";
      }
    });
  }

  async function renderTrend() {
    const el = document.getElementById("lumen-trend-sparkline");
    const empty = document.getElementById("lumen-trend-empty");
    if (!el) return;
    const history = await LumenSession.loadHistory();
    // Per-day engagement is the inverse of that day's passive-acceptance rate,
    // matching the FAB badge (higher = more active evaluation). This is a
    // mirror of the trend, deliberately neutral — no goal line, no target.
    const scores = (history || [])
      .filter((entry) => (entry.messageCount || 0) > 0)
      .map((entry) => Math.round((1 - (entry.passiveRate || 0)) * 100));
    const hasTrend = scores.length >= 2;
    el.classList.toggle("lumen-hidden", !hasTrend);
    if (empty) empty.classList.toggle("lumen-hidden", hasTrend);
    el.innerHTML = hasTrend ? renderSparkline(scores) : "";
  }

  function renderPopover() {
    const session = LumenSession.get();
    const engagementScores = (session.loopScores || []).map((s) => 100 - s);
    const barColors = (session.scoredMessageIds || []).map((id) =>
      signalBarColor(session.messageSignals?.[id]?.primary)
    );
    document.getElementById("lumen-sparkline").innerHTML = renderSparkline(
      engagementScores,
      barColors
    );
    document.getElementById("lumen-stat-messages").textContent = String(session.messageCount);
    document.getElementById("lumen-stat-handoff").textContent = String(session.handoffCount || 0);
    document.getElementById("lumen-stat-loop").textContent = String(session.loopCount);
    document.getElementById("lumen-stat-drift").textContent = String(session.driftCount);
    document.getElementById("lumen-stat-mismatch").textContent = String(session.mismatchCount);
    document.getElementById("lumen-stat-depth").textContent = String(session.depthCount);
    renderTrend();
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
    const tools = LumenNudges.buildProfile(history, { currentHost: window.location.hostname });
    const contrast = LumenNudges.buildProfileContrast(history);
    if (!tools.length) {
      el.innerHTML = `<p class="lumen-popover-hint">Nomon builds this as you use different AI tools across the week.</p>`;
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

  // Four-dot mark (T formation) for share cards. Drawn opaque — cards are light.
  function drawLumenMark(ctx, cx, cy) {
    const S = 50;
    const r = S * 0.125;
    const dots = [
      { c: "#5ba85c", x: -0.37 * S, y: -0.2 * S },
      { c: "#e5a33d", x: 0, y: -0.2 * S },
      { c: "#8e44ad", x: 0.37 * S, y: -0.2 * S },
      { c: "#5b9bd5", x: 0, y: 0.17 * S },
    ];
    ctx.save();
    dots.forEach((d) => {
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(cx + d.x, cy + d.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
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
    ctx.fillText("Nomon", pad + 62, pad + 30);

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
          ? `<p class="lumen-digest-label" title="Nomon tracks every supported AI tool — this is your message split this week">Across tools</p>
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
      ${
        digest.guardSummary
          ? `<p class="lumen-digest-label" title="Guard mode holds — only when you opted in">Guard</p>
      <p class="lumen-digest-line">${digest.guardSummary}</p>`
          : ""
      }
      <p class="lumen-digest-label" title="How often you engaged with a nudge instead of skipping it">Your responses</p>
      <p class="lumen-digest-line">${digest.responses.line}</p>
      <p class="lumen-digest-label" title="A reflection prompt to take away from the week">Sit with</p>
      <p class="lumen-digest-line lumen-digest-prompt">${digest.prompt}</p>
      <button type="button" class="lumen-digest-open" id="lumen-digest-open">Open weekly review →</button>
    `;
    document.getElementById("lumen-digest-open")?.addEventListener("click", (event) => {
      event.stopPropagation();
      closePopover();
      openWeeklyReview();
    });
  }

  // ── Weekly digest "ready" indicator ──────────────────────────────────────
  // Minimum bar: at least this many days with activity before we surface a
  // digest, so week-one (or a thin week) never fires an empty nudge.
  const DIGEST_MIN_ACTIVE_DAYS = 2;
  let digestReady = false;

  function countActiveDays(history) {
    return (history || []).filter((entry) => (entry.messageCount || 0) > 0).length;
  }

  function positionDigestToast() {
    const fab = document.getElementById("lumen-fab");
    const toast = document.getElementById("lumen-digest-toast");
    if (!fab || !toast) return;
    const rect = fab.getBoundingClientRect();
    const gap = 12;
    toast.style.top = "auto";
    toast.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    toast.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    toast.style.left = "auto";
  }

  function showDigestReady(digest) {
    ensureRoot();
    digestReady = true;
    const fab = document.getElementById("lumen-fab");
    if (fab) fab.dataset.digestReady = "true";

    // Teaser: lead with the actual week-over-week headline so the nudge says
    // something specific, not "your digest is ready". Ghost mode still gets a
    // stronger visual cue (it's their only touchpoint).
    const ghost = LumenGoals.isGhost();
    const toast = document.getElementById("lumen-digest-toast");
    const sub = document.getElementById("lumen-digest-toast-sub");
    if (sub) {
      sub.textContent =
        digest?.headline || "A look at how you worked with AI this week.";
    }
    if (toast) {
      toast.classList.toggle("lumen-digest-toast--ghost", ghost);
      positionDigestToast();
      toast.classList.add("lumen-digest-toast--open");
    }
    pulseFabMark();
  }

  // Hide just the toast bubble — its attention job is done once the pill opens —
  // without marking the week seen. The corner dot and "ready" state linger until
  // the digest itself is actually viewed (or explicitly dismissed).
  function hideDigestToast() {
    document.getElementById("lumen-digest-toast")?.classList.remove("lumen-digest-toast--open");
  }

  // Stamp the week seen and clear every indicator. Only called once the user has
  // actually laid eyes on the digest (it scrolled into view) or dismissed it.
  let digestViewObserver = null;
  function markDigestViewed() {
    if (digestViewObserver) {
      digestViewObserver.disconnect();
      digestViewObserver = null;
    }
    if (!digestReady) return;
    digestReady = false;
    hideDigestToast();
    const fab = document.getElementById("lumen-fab");
    if (fab) fab.dataset.digestReady = "false";
    LumenGoals.markDigestSeen();
  }

  // Watch the digest block inside the scrollable popover and mark the week seen
  // the instant it scrolls into view. The popover is display:none when closed,
  // so this never fires until the pill is open and the user reaches the digest.
  function observeDigestView() {
    if (!digestReady || typeof IntersectionObserver === "undefined") return;
    const el = document.getElementById("lumen-digest");
    const root = document.getElementById("lumen-popover");
    if (!el || !root) return;
    if (digestViewObserver) digestViewObserver.disconnect();
    digestViewObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) markDigestViewed();
      },
      { root, threshold: 0.5 }
    );
    digestViewObserver.observe(el);
  }

  function stopObservingDigestView() {
    if (digestViewObserver) {
      digestViewObserver.disconnect();
      digestViewObserver = null;
    }
  }

  // Per-day engagement (inverse of passive-reply rate), matching the FAB badge
  // and popover trend — the neutral mirror used across the digest surfaces.
  function trendScores(history) {
    return (history || [])
      .filter((entry) => (entry.messageCount || 0) > 0)
      .map((entry) => Math.round((1 - (entry.passiveRate || 0)) * 100));
  }

  async function buildCurrentDigest() {
    const history = await LumenSession.loadHistory();
    const digest = LumenNudges.buildDigest({
      history,
      session: LumenSession.get(),
      digestLog: LumenSession.getDigestLog(),
    });
    weeklyContext = { history, digest };
    return weeklyContext;
  }

  async function maybeShowDigestReady() {
    if (LumenGoals.isPaused()) return;
    if (!LumenGoals.isDigestUnseenThisWeek()) return;
    const history = await LumenSession.loadHistory();
    if (countActiveDays(history) < DIGEST_MIN_ACTIVE_DAYS) return;
    const { digest } = await buildCurrentDigest();
    showDigestReady(digest);
  }

  function renderWeeklyReview(digest, history) {
    const headline = document.getElementById("lumen-weekly-headline");
    if (headline) headline.textContent = digest.headline;
    const body = document.getElementById("lumen-weekly-body");
    if (!body) return;

    const scores = trendScores(history);
    const hasTrend = scores.length >= 2;
    const statRow = (line) => {
      const parts = line.split(":");
      const label = parts.shift();
      const value = parts.join(":").trim();
      return `<div class="lumen-weekly-stat"><span class="lumen-weekly-stat-label">${label}</span>${
        value ? `<span class="lumen-weekly-stat-value">${value}</span>` : ""
      }</div>`;
    };

    // Gentle, ~monthly invitation to revisit setup — folded into the weekly
    // review the user already chose to open, never a separate interrupt.
    const reviewDue = LumenGoals.isSetupReviewDue();
    const goals = LumenGoals.get().protectedGoals || [];
    const setupBlock = reviewDue
      ? `<div class="lumen-weekly-setup">
           <p class="lumen-weekly-label">Still the right goals?</p>
           <p class="lumen-weekly-text">${
             goals.length
               ? goals.map((g) => escapeHtml(g)).join(" · ")
               : "You haven't set any goals to protect yet."
           }</p>
           <button type="button" class="lumen-weekly-setup-btn" id="lumen-weekly-setup">${
             goals.length ? "Update setup →" : "Set up goals →"
           }</button>
         </div>`
      : "";

    body.innerHTML = `
      ${
        hasTrend
          ? `<div class="lumen-weekly-trend">${renderSparkline(scores)}</div>
             <p class="lumen-weekly-caption">Engagement · recent days</p>`
          : ""
      }
      <div class="lumen-weekly-stats">
        ${digest.driftLines.map(statRow).join("")}
      </div>
      ${
        digest.platforms?.length
          ? `<p class="lumen-weekly-label">Across tools</p>
             <p class="lumen-weekly-text">${digest.platforms.map((p) => `${p.name} ${p.count}`).join(" · ")}</p>`
          : ""
      }
      ${
        digest.profile?.length
          ? `<p class="lumen-weekly-label">How you work</p>
             ${digest.profile.map((t) => `<p class="lumen-weekly-text">${t.line}</p>`).join("")}`
          : ""
      }
      <p class="lumen-weekly-label">Mismatch</p>
      <p class="lumen-weekly-text">${digest.mismatchSummary}</p>
      ${setupBlock}
      <p class="lumen-weekly-label">Sit with</p>
      <p class="lumen-weekly-prompt">${digest.prompt}</p>
    `;

    if (reviewDue) {
      // Stamp now so the invitation won't reappear for ~a month, regardless of
      // whether the user acts on it.
      LumenGoals.markSetupReviewSeen();
      document.getElementById("lumen-weekly-setup")?.addEventListener("click", (event) => {
        event.stopPropagation();
        closeWeeklyReview();
        openSetup();
      });
    }
  }

  async function openWeeklyReview() {
    ensureRoot();
    // Opening the review is the clearest "viewed" signal — mark the week seen.
    markDigestViewed();
    const overlay = document.getElementById("lumen-weekly");
    if (overlay) {
      const headline = document.getElementById("lumen-weekly-headline");
      if (headline) headline.textContent = "This week";
      const body = document.getElementById("lumen-weekly-body");
      if (body) body.innerHTML = `<p class="lumen-weekly-caption">Gathering your week…</p>`;
      overlay.classList.add("lumen-weekly--open");
    }
    const { history, digest } = await buildCurrentDigest();
    renderWeeklyReview(digest, history);
  }

  function closeWeeklyReview() {
    document.getElementById("lumen-weekly")?.classList.remove("lumen-weekly--open");
  }

  function drawWeeklyCard(digest, history) {
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

    drawLumenMark(ctx, pad + 25, pad + 28);
    ctx.fillStyle = SHARE_PALETTE.dusk;
    ctx.font = font(34, 600);
    ctx.textBaseline = "middle";
    ctx.fillText("Nomon", pad + 62, pad + 30);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = SHARE_PALETTE.dusk;
    ctx.font = font(72, 700);
    ctx.fillText("My week with AI", pad, pad + 160);

    let y = pad + 226;
    ctx.fillStyle = SHARE_PALETTE.slate;
    ctx.font = font(34, 500);
    wrapText(ctx, digest.headline, W - pad * 2).forEach((ln) => {
      ctx.fillText(ln, pad, y);
      y += 48;
    });
    y += 24;

    const scores = trendScores(history);
    if (scores.length >= 2) {
      const tx = pad;
      const tw = W - pad * 2;
      const th = 190;
      const ty = y;
      ctx.fillStyle = SHARE_PALETTE.card;
      roundRect(ctx, tx, ty, tw, th, 22);
      ctx.fill();

      const innerPad = 34;
      const plotW = tw - innerPad * 2;
      const plotH = th - innerPad * 2;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = Math.max(1, max - min);
      const pointX = (i) => tx + innerPad + (scores.length === 1 ? plotW / 2 : (plotW * i) / (scores.length - 1));
      const pointY = (s) => ty + innerPad + plotH - plotH * ((s - min) / range);

      ctx.strokeStyle = SHARE_PALETTE.loop;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      scores.forEach((s, i) => {
        const px = pointX(i);
        const py = pointY(s);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.fillStyle = SHARE_PALETTE.loop;
      ctx.beginPath();
      ctx.arc(pointX(scores.length - 1), pointY(scores[scores.length - 1]), 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = SHARE_PALETTE.haze;
      ctx.font = font(22, 500);
      ctx.fillText("Engagement · recent days", tx + innerPad, ty + th + 36);
      y = ty + th + 78;
    }

    digest.driftLines.forEach((line) => {
      const parts = line.split(":");
      const label = parts.shift();
      const value = parts.join(":").trim();
      ctx.fillStyle = SHARE_PALETTE.slate;
      ctx.font = font(30, 500);
      ctx.fillText(label, pad, y);
      if (value) {
        ctx.fillStyle = SHARE_PALETTE.dusk;
        ctx.font = font(30, 700);
        const vw = ctx.measureText(value).width;
        ctx.fillText(value, W - pad - vw, y);
      }
      y += 54;
    });

    ctx.fillStyle = SHARE_PALETTE.haze;
    ctx.font = font(28, 500);
    ctx.fillText("Your AI cognition mirror", pad, H - pad + 8);
    const url = "lumen.so";
    const urlW = ctx.measureText(url).width;
    ctx.fillStyle = SHARE_PALETTE.mismatch;
    ctx.font = font(28, 600);
    ctx.fillText(url, W - pad - urlW, H - pad + 8);

    return canvas;
  }

  async function shareWeekly(digest, history) {
    const canvas = drawWeeklyCard(digest, history);
    const blob = await canvasToBlob(canvas);
    if (!blob) return;

    let copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        copied = true;
      }
    } catch (_) {
      copied = false;
    }

    try {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "lumen-week.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (_) {
      // ignore
    }

    const btn = document.getElementById("lumen-weekly-share");
    if (btn) {
      btn.textContent = copied ? "Copied to clipboard ✓" : "Saved image ✓";
      setTimeout(() => {
        btn.textContent = "Share this week";
      }, 2200);
    }
  }

  function togglePopover() {
    popoverOpen = !popoverOpen;
    const popover = document.getElementById("lumen-popover");
    if (popoverOpen) {
      renderPopover();
      popover.classList.add("lumen-popover--open");
      // The toast has done its job once the pill is open; hide it but keep the
      // dot until the digest is actually scrolled into view.
      if (digestReady) {
        hideDigestToast();
        observeDigestView();
      }
      // First time the pill is opened, run the highlight tour once (in context,
      // never a load-time interrupt).
      maybeAutoStartTour();
    } else {
      popover.classList.remove("lumen-popover--open");
      stopObservingDigestView();
      if (tourActive) endTour();
    }
  }

  function closePopover() {
    popoverOpen = false;
    document.getElementById("lumen-popover")?.classList.remove("lumen-popover--open");
    stopObservingDigestView();
    if (tourActive) endTour();
  }

  // Repaint the popover's live stats (Messages, etc.) if it's currently open —
  // called when the shared session changes underneath us so an open popover
  // reflects activity from other AI tabs without being reopened.
  function refreshPopover() {
    if (popoverOpen) renderPopover();
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

    const stripEvaluation = LumenSession.getStripEvaluation(msg.id, evaluation);

    const wrapper = adapter.findUserMessageWrapper(msg.el);
    if (!wrapper) return;

    const bubble =
      wrapper.querySelector(".markdown, .prose, [class*='markdown']")?.parentElement || wrapper;

    const strip = renderStrip(msg.id, stripEvaluation, msg.text);
    if (strip && !strip.isConnected) bubble.insertAdjacentElement("afterend", strip);

    if (evaluation.primary) {
      lastEvaluation = {
        msgId: msg.id,
        evaluation,
        snippet: msg.text.slice(0, 120),
      };
      if (options.isNewMessage || options.fromJudge) showFabSignal(evaluation.primary);
    } else if (options.fromJudge && lastEvaluation?.msgId === msg.id) {
      lastEvaluation = {
        msgId: msg.id,
        evaluation,
        snippet: msg.text.slice(0, 120),
      };
    }

    // Only the loop reconsider overlay reaches here (active/guard mode, sustained
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
      evaluation.mismatch?.active &&
      !dismissedMismatch.has(msg.id)
    ) {
      const isFresh = msg.timestamp && Date.now() - msg.timestamp < 8000;
      renderCard(msg.id, evaluation, strip || bubble, msg.el, adapter, {
        pauseAi: Boolean(options.isNewMessage || isFresh),
      });
    } else if (
      LumenGoals.isGuard() &&
      evaluation.primary === "depth" &&
      evaluation.depth?.active &&
      evaluation.overlayType !== "depth" &&
      !dismissedDepth.has(msg.id)
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

    // Idempotent: if a card for this message is already on screen, leave it (and
    // its live click handlers) in place. injectMessageUI runs on every DOM
    // mutation, so rebuilding the card each tick was destroying the button the
    // user was trying to click — making the actions feel dead.
    if (document.querySelector(`.lumen-card[data-lumen-msg-id="${msgId}"]`)) return;

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
          <button class="lumen-card-btn lumen-card-btn--ghost" data-action="remove">${copy.removeLabel}</button>
          <button class="lumen-card-btn lumen-card-btn--secondary" data-action="dismiss">${copy.dismissLabel}</button>
          <button class="lumen-card-btn" data-action="keep">${copy.keepLabel}</button>
        </div>
      `;
      card.querySelector('[data-action="keep"]')?.addEventListener("click", () => {
        dismissedMismatch.add(msgId);
        LumenSession.logMismatchEvent(evaluation.mismatch.goal, "kept");
        card.remove();
      });
      card.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
        dismissedMismatch.add(msgId);
        LumenSession.logMismatchEvent(evaluation.mismatch.goal, "dismissed");
        card.remove();
      });
      card.querySelector('[data-action="remove"]')?.addEventListener("click", () => {
        dismissedMismatch.add(msgId);
        LumenGoals.removeProtectedGoal(evaluation.mismatch.goal);
        LumenSession.logMismatchEvent(evaluation.mismatch.goal, "goal-changed");
        syncSettingsUI();
        card.innerHTML = `<div class="lumen-card-body">Got it — removed that goal. You can re-add it any time in Nomon settings.</div>`;
        window.setTimeout(() => card.remove(), 2600);
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
        dismissedDepth.add(msgId);
        LumenSession.logDepthMoment(msgEl?.textContent || "", "skip");
        card.remove();
      });
      card.querySelector(".lumen-card-reflection")?.addEventListener("blur", () => {
        const text = card.querySelector(".lumen-card-reflection")?.value.trim();
        if (!text) return;
        dismissedDepth.add(msgId);
        LumenSession.logDepthMoment(text, "reflected");
        card.remove();
      });
      anchor.insertAdjacentElement("afterend", card);
    }
  }

  function playFabLoadAnimation() {
    // Defer until the FAB is painted so the one-shot dot cycle reliably starts.
    const raf = globalThis.requestAnimationFrame?.bind(globalThis);
    if (raf) {
      raf(() => raf(() => pulseFabMark()));
    } else {
      setTimeout(() => pulseFabMark(), 0);
    }
  }

  function init() {
    ensureRoot();
    applyFabPosition();
    // Note: onboarding is intentionally NOT shown here. init() runs before
    // storage has loaded, when goals still hold defaults (onboardingComplete
    // === false), so showing it now would re-open the setup cards for returning
    // users on every load. content.js calls showOnboardingIfNeeded() once
    // storage has loaded.
    updateBadge();
    playFabLoadAnimation();
  }

  return {
    init,
    updateBadge,
    refreshPopover,
    showOnboardingIfNeeded,
    startTour,
    injectMessageUI,
    maybeShowDigestReady,
    showGuardHold,
  };
})();

globalThis.LumenWidget = LumenWidget;
