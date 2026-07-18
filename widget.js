const LumenWidget = (() => {
  // Aurora Grayscale: signals differentiate by label + weight, never hue. The
  // inline strip carries a single NEUTRAL dot; the signal name does the work.
  // Kept as a per-signal map (same keys) so callers stay unchanged.
  // Logo-mark hues identify each Mirror signal (same four dots as the Badge mark).
  // Hand-off shares amber with Drift — both are “letting go” signals; Loop stays green.
  const SIGNAL_COLORS_LIGHT = {
    handoff: "#e5a33d",
    loop: "#5ba85c",
    drift: "#e5a33d",
    mismatch: "#8e6fd8",
    depth: "#5b9bd5",
  };
  const SIGNAL_COLORS_DARK = {
    handoff: "#e5a33d",
    loop: "#5ba85c",
    drift: "#e5a33d",
    mismatch: "#8e6fd8",
    depth: "#5b9bd5",
  };

  let cachedHostDark = null;
  let hostThemeObserver = null;

  function parseRgb(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
    const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }

  function relativeLuminance({ r, g, b }) {
    const lin = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  // Detect the AI site's theme from page background (and color-scheme as a
  // hint). Re-checked cheaply; Gemini can flip light↔dark without a reload.
  function isHostDark(force = false) {
    if (!force && cachedHostDark !== null) return cachedHostDark;

    const root = document.documentElement;
    const body = document.body;
    const scheme = `${getComputedStyle(root).colorScheme || ""} ${
      body ? getComputedStyle(body).colorScheme || "" : ""
    }`.toLowerCase();
    if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) {
      cachedHostDark = true;
      return true;
    }

    const samples = [body, root, document.querySelector("main"), document.querySelector('[role="main"]')].filter(
      Boolean
    );
    for (const el of samples) {
      const rgb = parseRgb(getComputedStyle(el).backgroundColor);
      if (!rgb) continue;
      cachedHostDark = relativeLuminance(rgb) < 0.35;
      return cachedHostDark;
    }

    cachedHostDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return cachedHostDark;
  }

  function signalColors() {
    return isHostDark() ? SIGNAL_COLORS_DARK : SIGNAL_COLORS_LIGHT;
  }

  function stripInkOpacity() {
    return isHostDark() ? "0.95" : "0.7";
  }

  function refreshStripTheme() {
    const prev = cachedHostDark;
    const next = isHostDark(true);
    if (prev === next) return;
    const theme = next ? "dark" : "light";
    document.querySelectorAll(".lumen-strip[data-lumen-msg-id]").forEach((strip) => {
      strip.setAttribute("data-lumen-theme", theme);
    });
    document.querySelectorAll(".lumen-why").forEach((el) => {
      el.setAttribute("data-lumen-theme", theme);
    });
    document.querySelectorAll(".lumen-attest-row").forEach((row) => {
      row.setAttribute("data-lumen-theme", theme);
    });
    document.querySelectorAll("#lumen-cost-coach").forEach((el) => {
      el.setAttribute("data-lumen-theme", theme);
    });
  }

  function watchHostTheme() {
    if (hostThemeObserver || typeof MutationObserver === "undefined") return;
    hostThemeObserver = new MutationObserver(() => {
      cachedHostDark = null;
      refreshStripTheme();
    });
    hostThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-scheme", "data-color-mode"],
    });
    if (document.body) {
      hostThemeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-color-scheme", "data-color-mode"],
      });
    }
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      cachedHostDark = null;
      refreshStripTheme();
    });
  }

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
  let openAttestMsgId = null;
  let activeReconsider = null;
  let lastEvaluation = null;
  let fabDisplaySignal = null;
  let fabSignalTimer = null;
  // Last posture band shown on the FAB — used so we only flash on change
  // (plus hand-off), not on every quiet message.
  let lastFabPostureBand = null;

  const FAB_SIGNAL_LABELS = {
    loop: "Loop · still with it?",
    drift: "Drift · fewer questions",
    mismatch: "Mismatch · conflicts with a goal",
    depth: "Depth · worth thinking first?",
  };
  const FAB_SIGNALS = new Set(Object.keys(FAB_SIGNAL_LABELS));
  // Option E — transient session posture (3s), separate from signal labels.
  const FAB_POSTURE_LABELS = {
    "hands-on": "Hands-on",
    "in-between": "In between",
    "ai-led": "AI-led",
  };
  const FAB_POSTURE_MIN_MESSAGES = 3;
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

  function migrateFabMarkup() {
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;
    document.getElementById("lumen-fab-focus")?.remove();
    document.querySelector("#lumen-fab .lumen-fab-hint")?.remove();
    document.getElementById("lumen-fab-rail")?.remove();
    document.querySelectorAll("#lumen-popover .lumen-fab-pin").forEach((el) => el.remove());
    ensurePillarTabs();
    migrateModeStripCompact();
    fab.classList.remove("lumen-fab--open");
    fab.title = "Nomon — drag to move, click to open";
  }

  function migrateModeStripCompact() {
    const strip = document.getElementById("lumen-mode-strip");
    const statsBlock = document.querySelector("#lumen-popover .lumen-popover-stats");
    const scroll = document.querySelector("#lumen-popover .lumen-popover-scroll");
    if (
      strip &&
      statsBlock &&
      scroll &&
      statsBlock.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_PRECEDING
    ) {
      // Mode was above scores — flip so scores lead.
      scroll.insertBefore(statsBlock, strip);
      const statsEmpty = document.getElementById("lumen-stats-empty");
      if (statsEmpty) scroll.insertBefore(statsEmpty, strip);
    }
    if (strip && !strip.querySelector(".lumen-mode-row")) {
      const seg = document.getElementById("lumen-mode-seg");
      const label = strip.querySelector(":scope > .lumen-popover-label");
      if (seg && label) {
        const row = document.createElement("div");
        row.className = "lumen-mode-row";
        label.classList.add("lumen-mode-label");
        label.textContent = "Mode";
        strip.insertBefore(row, strip.firstChild);
        row.appendChild(label);
        row.appendChild(seg);
      }
    }
    const label =
      strip?.querySelector(".lumen-mode-label") ||
      strip?.querySelector(":scope > .lumen-popover-label");
    if (label) label.textContent = "Mode";
    const guard = document.getElementById("lumen-guard-toggle");
    if (guard) {
      guard.title =
        "Brief hold before send when a prompt clearly conflicts with a protected goal. Always bypassable.";
      guard.querySelector(".lumen-guard-toggle-meta")?.remove();
      const nestedTitle = guard.querySelector(".lumen-guard-toggle-text .lumen-guard-toggle-title");
      if (nestedTitle && !guard.querySelector(":scope > .lumen-guard-toggle-title")) {
        guard.insertBefore(nestedTitle, guard.firstChild);
        guard.querySelector(".lumen-guard-toggle-text")?.remove();
      }
      if (!guard.querySelector(".lumen-guard-toggle-state")) {
        const state = document.createElement("span");
        state.className = "lumen-guard-toggle-state";
        state.setAttribute("aria-hidden", "true");
        state.textContent = guard.classList.contains("lumen-guard-toggle--on") ? "On" : "Off";
        const sw = guard.querySelector(".lumen-guard-toggle-switch");
        if (sw) guard.insertBefore(state, sw);
        else guard.appendChild(state);
      }
    }
    const hint = document.getElementById("lumen-mode-hint");
    if (hint && guard && hint.nextElementSibling === guard) {
      guard.insertAdjacentElement("afterend", hint);
    }
  }

  function ensurePillarTabs() {
    const chrome = document.querySelector("#lumen-popover .lumen-popover-chrome");
    const head = chrome?.querySelector(".lumen-popover-head") || document.querySelector("#lumen-popover .lumen-popover-head");
    if (!head) return;
    let tabs = document.getElementById("lumen-pillar-tabs");
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.id = "lumen-pillar-tabs";
      tabs.className = "lumen-pillar-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Nomon pillars");
      tabs.innerHTML = `
      <button type="button" class="lumen-pillar-tab" data-pillar="mirror" role="tab" aria-selected="true">Mirror</button>
      <button type="button" class="lumen-pillar-tab" data-pillar="badge" role="tab" aria-selected="false">Badge</button>
      <button type="button" class="lumen-pillar-tab" data-pillar="cost" role="tab" aria-selected="false">Cost</button>
    `;
    }
    // Keep tabs in the sticky chrome, directly under the header.
    if (tabs.previousElementSibling !== head) {
      head.insertAdjacentElement("afterend", tabs);
    }
  }

  function ensureRoot() {
    ensureHideStyles();
    let existing = document.getElementById("lumen-root");
    // Rebuild if this tab still has a pre–mode-seg / pre–badge-toggle popover,
    // or a pre–inline-savings / pre–pillar-scope layout (extension update without reload).
    if (
      existing &&
      (!document.getElementById("lumen-mode-seg") ||
        !document.getElementById("lumen-badge-seg") ||
        !document.getElementById("lumen-cost-inline") ||
        !document.querySelector("#lumen-popover [data-pillar-scope]"))
    ) {
      existing.remove();
      existing = null;
      reconsiderEventsBound = false;
      guardHoldEventsBound = false;
      tourEventsBound = false;
    }
    if (existing) {
      migrateFabMarkup();
      ensureReconsiderShell();
      ensureGuardHoldShell();
      ensureTourShell();
      ensureAttestationsPopover();
      return;
    }
    const root = document.createElement("div");
    root.id = "lumen-root";
    root.innerHTML = `
      <div id="lumen-fab" data-side="right" data-focus="mirror" title="Nomon — drag to move, click to open">
        <span id="lumen-fab-digest" aria-hidden="true"></span>
        <span id="lumen-fab-mark" aria-hidden="true">
          <span class="lumen-dot-spin">
            <span class="lumen-dot lumen-dot-green" style="--rx:-9px;--ry:-5px;--ex:0px;--ey:-8px;"></span>
            <span class="lumen-dot lumen-dot-amber" style="--rx:0px;--ry:-5px;--ex:8px;--ey:0px;"></span>
            <span class="lumen-dot lumen-dot-purple" style="--rx:9px;--ry:-5px;--ex:0px;--ey:8px;"></span>
            <span class="lumen-dot lumen-dot-blue" style="--rx:0px;--ry:4px;--ex:-8px;--ey:0px;"></span>
          </span>
        </span>
        <span id="lumen-fab-lead" aria-hidden="true"></span>
        <span id="lumen-fab-engagement" class="lumen-fab-engagement" aria-live="polite">
          <span id="lumen-fab-label" class="lumen-fab-label lumen-fab-label--empty"></span>
          <span id="lumen-fab-trend" class="lumen-fab-trend lumen-hidden" aria-hidden="true"></span>
        </span>
      </div>
      <div id="lumen-popover">
        <div class="lumen-popover-chrome">
          <div class="lumen-popover-head">
            <span class="lumen-popover-mark" aria-hidden="true">
              <span class="lumen-dot lumen-dot-green" style="--rx:-7px;--ry:-4px"></span>
              <span class="lumen-dot lumen-dot-amber" style="--rx:0;--ry:-4px"></span>
              <span class="lumen-dot lumen-dot-purple" style="--rx:7px;--ry:-4px"></span>
              <span class="lumen-dot lumen-dot-blue" style="--rx:0;--ry:4px"></span>
            </span>
            <div class="lumen-popover-head-text">
              <div class="lumen-popover-title">Nomon</div>
              <div class="lumen-popover-sub">Today · across all AIs</div>
            </div>
            <button id="lumen-pause-toggle" class="lumen-popover-pause" type="button">Pause</button>
          </div>

          <div id="lumen-pillar-tabs" class="lumen-pillar-tabs" role="tablist" aria-label="Nomon pillars">
            <button type="button" class="lumen-pillar-tab" data-pillar="mirror" role="tab" aria-selected="true">Mirror</button>
            <button type="button" class="lumen-pillar-tab" data-pillar="badge" role="tab" aria-selected="false">Badge</button>
            <button type="button" class="lumen-pillar-tab" data-pillar="cost" role="tab" aria-selected="false">Cost</button>
          </div>
        </div>

        <div class="lumen-popover-scroll">
          <div class="lumen-popover-stats" data-pillar-scope="mirror" aria-label="Today's stats">
            <div class="lumen-popover-mini">
              <div class="lumen-popover-mini-stat" title="Your prompts today across ChatGPT, Gemini, Claude, and other connected tools">
                <div class="lumen-popover-mini-v" id="lumen-stat-messages">0</div>
                <div class="lumen-popover-mini-l">Messages</div>
              </div>
              <div class="lumen-popover-mini-stat" title="Whole tasks you asked AI to do from scratch">
                <div class="lumen-popover-mini-v" id="lumen-stat-handoff">0</div>
                <div class="lumen-popover-mini-l">Hand-offs</div>
              </div>
              <div class="lumen-popover-mini-stat" title="Prompts that conflicted with a goal you set">
                <div class="lumen-popover-mini-v" id="lumen-stat-mismatch">0</div>
                <div class="lumen-popover-mini-l">Mismatch</div>
              </div>
            </div>
            <div class="lumen-popover-mini lumen-popover-mini--signals">
              <div class="lumen-popover-mini-stat" title="Passive back-and-forth loops">
                <div class="lumen-popover-mini-v" id="lumen-stat-loop">0</div>
                <div class="lumen-popover-mini-l">Loops</div>
              </div>
              <div class="lumen-popover-mini-stat" title="Shorter prompts, fewer questions, or more passive replies than usual">
                <div class="lumen-popover-mini-v" id="lumen-stat-drift">0</div>
                <div class="lumen-popover-mini-l">Drift</div>
              </div>
              <div class="lumen-popover-mini-stat" title="High-stakes prompts worth sitting with">
                <div class="lumen-popover-mini-v" id="lumen-stat-depth">0</div>
                <div class="lumen-popover-mini-l">Depth</div>
              </div>
            </div>
          </div>
          <p class="lumen-popover-hint lumen-hidden" id="lumen-stats-empty" data-pillar-scope="mirror">Nomon fills this in as you chat.</p>

          <div class="lumen-mode-strip" id="lumen-mode-strip" data-pillar-scope="mirror">
            <div class="lumen-mode-row">
              <label class="lumen-popover-label lumen-mode-label">Mode</label>
              <div class="lumen-mode-seg" id="lumen-mode-seg" role="radiogroup" aria-label="Nomon mode">
                <button type="button" class="lumen-mode-seg-btn" data-mode="ambient" role="radio" aria-checked="false" title="Subtle inline cues only">Ambient</button>
                <button type="button" class="lumen-mode-seg-btn" data-mode="ghost" role="radio" aria-checked="false" title="Weekly digest only — nothing in-session">Ghost</button>
                <button type="button" class="lumen-mode-seg-btn" data-mode="active" role="radio" aria-checked="true" title="Inline cues plus reflection cards when it matters">Active</button>
              </div>
            </div>
            <select id="lumen-mode-select" class="lumen-popover-select lumen-sr-only" aria-hidden="true" tabindex="-1">
              <option value="ambient">Ambient</option>
              <option value="ghost">Ghost</option>
              <option value="active">Active</option>
              <option value="guard">Guard</option>
            </select>
            <button
              type="button"
              class="lumen-guard-toggle"
              id="lumen-guard-toggle"
              aria-pressed="false"
              title="Brief hold before send when a prompt clearly conflicts with a protected goal. Always bypassable."
            >
              <span class="lumen-guard-toggle-title">Guard</span>
              <span class="lumen-guard-toggle-state" aria-hidden="true">Off</span>
              <span class="lumen-guard-toggle-switch" aria-hidden="true"></span>
            </button>
            <p class="lumen-popover-hint lumen-hidden" id="lumen-mode-hint"></p>
          </div>

          <!-- MIRROR -->
          <div class="lumen-pillar-block" id="lumen-pillar-mirror" data-pillar-panel="mirror" role="tabpanel">
            <label class="lumen-popover-label">Protected goals · <span class="lumen-popover-label-accent">on by default</span></label>
            <p class="lumen-popover-hint" id="lumen-goals-hint">Tap to turn off what doesn't apply.</p>
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
          </div>

          <!-- BADGE -->
          <div class="lumen-pillar-block" id="lumen-pillar-badge" data-pillar-panel="badge" role="tabpanel">
            <div class="lumen-pillar-block-head">
              <span class="lumen-pillar-block-tag" id="lumen-badge-tag">0 this week</span>
            </div>
            <label class="lumen-popover-label">Disclosure</label>
            <div class="lumen-badge-seg" id="lumen-badge-seg" role="group" aria-label="Disclosure badge">
              <button type="button" class="lumen-badge-seg-btn" data-badge="off">Off</button>
              <button type="button" class="lumen-badge-seg-btn" data-badge="on">On</button>
            </div>
            <select id="lumen-badge-select" class="lumen-popover-select lumen-sr-only" aria-hidden="true" tabindex="-1">
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
            <p class="lumen-popover-hint" id="lumen-badge-hint">Off by default. Turn on to show a Disclose strip under long AI replies.</p>
            <label class="lumen-popover-label">Your disclosures</label>
            <p class="lumen-popover-hint">Tap “Disclose” under any long reply to add one.</p>
            <p class="lumen-popover-hint lumen-hidden" id="lumen-attestations-empty">No disclosures yet.</p>
            <div class="lumen-attestations" id="lumen-attestations"></div>
            <button type="button" class="lumen-attest-recopy lumen-hidden" id="lumen-attest-recopy">Re-copy latest</button>
          </div>

          <!-- COST -->
          <div class="lumen-pillar-block" id="lumen-pillar-cost" data-pillar-panel="cost" role="tabpanel">
            <div class="lumen-pillar-block-head">
              <span class="lumen-pillar-block-tag lumen-pillar-block-tag--cost" id="lumen-cost-tag">Off</span>
            </div>
            <label class="lumen-popover-label">Coach</label>
            <div class="lumen-cost-seg" id="lumen-cost-seg" role="group" aria-label="Cost coach level">
              <button type="button" class="lumen-cost-seg-btn" data-cost="off">Off</button>
              <button type="button" class="lumen-cost-seg-btn" data-cost="subtle">Quiet</button>
              <button type="button" class="lumen-cost-seg-btn" data-cost="full">Loud</button>
            </div>
            <select id="lumen-cost-select" class="lumen-popover-select lumen-sr-only" aria-hidden="true" tabindex="-1">
              <option value="off">Off</option>
              <option value="subtle">On · quiet tip</option>
              <option value="full">On · tips + details</option>
            </select>
            <p class="lumen-popover-hint" id="lumen-cost-hint">Off by default. Quiet = spend only. Loud = tips + savings.</p>
            <div id="lumen-cost-auto-row" class="lumen-cost-auto-row lumen-hidden">
              <label class="lumen-popover-check">
                <input type="checkbox" id="lumen-cost-auto" />
                Auto switch · apply recommended model
              </label>
              <p class="lumen-popover-hint" id="lumen-cost-auto-hint">When Cost coach suggests Instant / Haiku / Flash-Lite / etc., switch the host picker automatically and log the save.</p>
            </div>
            <div class="lumen-cost-inline" id="lumen-cost-inline">
              <label class="lumen-popover-label">Estimated spend</label>
              <p class="lumen-popover-hint">Refined after each reply from prompt + answer length. Estimates only.</p>
              <div class="lumen-cost-savings-stats" id="lumen-cost-spend-stats"></div>
              <p class="lumen-popover-hint lumen-hidden" id="lumen-cost-spend-meta"></p>

              <label class="lumen-popover-label" style="margin-top:12px;">Tip savings</label>
              <p class="lumen-popover-hint">Logged when you Switch, Auto-switch, or tap Log on a tip.</p>
              <div class="lumen-cost-savings-stats" id="lumen-cost-savings-stats"></div>
              <div class="lumen-cost-savings-list" id="lumen-cost-savings-list"></div>
              <p class="lumen-popover-hint" id="lumen-cost-savings-footnote">Not a receipt · API-equivalent rates.</p>
              <button type="button" class="lumen-popover-reset" id="lumen-cost-savings-clear">Clear Cost history</button>
            </div>
            <p class="lumen-popover-hint" id="lumen-cost-privacy-hint">Estimates stay on this device — never uploaded for cost analysis.</p>
          </div>

          <details class="lumen-popover-more" data-pillar-scope="mirror">
            <summary>Charts &amp; this week</summary>
            <label class="lumen-popover-label" id="lumen-session-chart-label" title="Each bar is one message today">Today's messages</label>
            <div class="lumen-popover-sparkline" id="lumen-sparkline"></div>
            <label class="lumen-popover-label" title="Your engagement across recent days">Recent days</label>
            <div class="lumen-popover-sparkline" id="lumen-trend-sparkline"></div>
            <p class="lumen-popover-hint lumen-hidden" id="lumen-trend-empty">A few days of use and your trend shows up here.</p>
            <div class="lumen-popover-title">Why last flag</div>
            <p class="lumen-popover-why" id="lumen-last-why">No flags yet this session.</p>
            <div class="lumen-popover-title" title="How you tend to work in each AI tool">Your AI profile</div>
            <div class="lumen-profile" id="lumen-profile"></div>
            <div class="lumen-popover-title">This week</div>
            <div class="lumen-popover-digest" id="lumen-digest"></div>
            <p class="lumen-popover-hint">Drag the Nomon pill to move it out of the way.</p>
            <button class="lumen-popover-reset" id="lumen-reset-session">Reset session</button>
          </details>

          <button type="button" class="lumen-popover-setup-cta" id="lumen-setup-cta" data-pillar-scope="mirror">Set up Nomon →</button>
          <button type="button" class="lumen-popover-howto" id="lumen-tutorial-cta" data-pillar-scope="mirror">How it works</button>

          <button
            type="button"
            id="lumen-privacy-toggle"
            class="lumen-privacy-toggle"
            data-pillar-scope="mirror"
            aria-expanded="false"
            aria-controls="lumen-privacy-panel"
          >
            <span>Privacy &amp; data</span>
            <span class="lumen-privacy-toggle-chevron" aria-hidden="true">›</span>
          </button>
          <div id="lumen-privacy-panel" class="lumen-privacy-panel lumen-hidden" data-pillar-scope="mirror">
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
          <div class="lumen-weekly-hero">
            <div class="lumen-weekly-kicker">Nomon · weekly review</div>
            <div id="lumen-weekly-shape" class="lumen-weekly-shape-badge lumen-hidden"></div>
            <h2 class="lumen-weekly-headline" id="lumen-weekly-headline">This week</h2>
          </div>
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
            <p>What do you use AI for? Most start on — Coding and Admin are off until you need them. Switch anything else that doesn't fit.</p>
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
      <label class="lumen-usecase-chip lumen-usecase-chip--on" aria-pressed="true">
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
    if (select.value !== normalized) {
      suppressModeSelectChange = true;
      select.value = normalized;
      queueMicrotask(() => {
        suppressModeSelectChange = false;
      });
    }
    syncModeSegUI(normalized);
  }

  function syncModeSegUI(mode) {
    const normalized = LumenGoals.normalizeMode?.(mode) ?? mode ?? "active";
    const presence = normalized === "guard" ? "active" : normalized;
    document.querySelectorAll("#lumen-mode-seg .lumen-mode-seg-btn").forEach((btn) => {
      const on = btn.getAttribute("data-mode") === presence;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    const guardBtn = document.getElementById("lumen-guard-toggle");
    if (guardBtn) {
      const guardOn = normalized === "guard";
      guardBtn.classList.toggle("lumen-guard-toggle--on", guardOn);
      guardBtn.setAttribute("aria-pressed", guardOn ? "true" : "false");
      const stateEl = guardBtn.querySelector(".lumen-guard-toggle-state");
      if (stateEl) stateEl.textContent = guardOn ? "On" : "Off";
    }
  }

  function applyPresenceMode(mode) {
    const next = mode === "ambient" || mode === "ghost" || mode === "active" ? mode : "active";
    const current = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode;
    // Segment picks always turn Guard off (even when Active was already highlighted under Guard).
    if (next === current) {
      syncModeSegUI(next);
      return;
    }
    LumenGoals.save({ mode: next });
    updateModeHint();
    morphFabMark();
    setModeSelectValue(document.getElementById("lumen-mode-select"), next);
  }

  function toggleGuardMode() {
    const current = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode;
    const next = current === "guard" ? "active" : "guard";
    if (next === "guard" && !(LumenGoals.get().protectedGoals || []).length) {
      updateModeHint();
      // Still allow enabling — hint already warns about needing a goal.
    }
    LumenGoals.save({ mode: next });
    updateModeHint();
    morphFabMark();
    syncModeSegUI(next);
    setModeSelectValue(document.getElementById("lumen-mode-select"), next);
  }

  function bindGoalsSync() {
    if (goalsChangeBound) return;
    goalsChangeBound = true;
    LumenGoals.onChange?.(() => {
      syncSettingsUI();
      if (!LumenGoals.isBadgeEnabled?.()) clearAttestUI();
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
      const pillar = normalizeFabPillar(LumenGoals.get().fabPillar);
      if (popoverOpen) closePopover();
      else openPopoverToPillar(pillar);
    });

    document.getElementById("lumen-popover")?.addEventListener("click", (event) => {
      const tab = event.target.closest?.(".lumen-pillar-tab[data-pillar]");
      if (!tab) return;
      event.stopPropagation();
      setFabPillar(tab.getAttribute("data-pillar"));
      if (popoverOpen) positionPopover();
    });

    document.getElementById("lumen-reset-session")?.addEventListener("click", (event) => {
      event.stopPropagation();
      lastEvaluation = null;
      LumenSession.reset();
      updateBadge();
      closePopover();
    });

    document.getElementById("lumen-attest-recopy")?.addEventListener("click", (event) => {
      event.stopPropagation();
      recopyLatestAttestation();
    });

    document.getElementById("lumen-mode-select")?.addEventListener("change", (event) => {
      if (suppressModeSelectChange) return;
      const next = event.target.value;
      if (next === LumenGoals.get().mode) return;
      LumenGoals.save({ mode: next });
      updateModeHint();
      morphFabMark();
      syncModeSegUI(next);
    });

    document.getElementById("lumen-mode-seg")?.addEventListener("click", (event) => {
      const btn = event.target.closest?.(".lumen-mode-seg-btn[data-mode]");
      if (!btn) return;
      event.stopPropagation();
      applyPresenceMode(btn.getAttribute("data-mode"));
    });

    document.getElementById("lumen-guard-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleGuardMode();
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
      syncChipOnState("#lumen-goal-chips");
    });

    document.getElementById("lumen-custom-goals")?.addEventListener("change", (event) => {
      const input = event.target;
      if (input?.type !== "checkbox" || input.checked) return;
      const goal = input.value;
      LumenGoals.save({
        protectedGoals: (LumenGoals.get().protectedGoals || []).filter((item) => item !== goal),
      });
      renderCustomGoalChips();
      syncChipOnState("#lumen-custom-goals");
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
      syncChipOnState("#lumen-usecases");
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

    document.getElementById("lumen-cost-select")?.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "off") {
        LumenGoals.save({ costEnabled: false });
        clearCostCoach();
      } else {
        LumenGoals.save({ costEnabled: true, costLevel: value === "full" ? "full" : "subtle" });
        // Don't wait on chrome.storage round-trip — refresh immediately.
        globalThis.LumenCostCoach?.refresh?.();
      }
      syncSettingsUI();
      updateBadge();
    });

    document.getElementById("lumen-cost-seg")?.addEventListener("click", (event) => {
      const btn = event.target.closest?.("[data-cost]");
      if (!btn) return;
      event.stopPropagation();
      const value = btn.getAttribute("data-cost");
      const select = document.getElementById("lumen-cost-select");
      if (!select || !value) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.getElementById("lumen-badge-select")?.addEventListener("change", (event) => {
      const on = event.target.value !== "off";
      LumenGoals.save({ badgeEnabled: on });
      if (!on) clearAttestUI();
      syncSettingsUI();
      updateBadge();
    });

    document.getElementById("lumen-badge-seg")?.addEventListener("click", (event) => {
      const btn = event.target.closest?.("[data-badge]");
      if (!btn) return;
      event.stopPropagation();
      const value = btn.getAttribute("data-badge");
      const select = document.getElementById("lumen-badge-select");
      if (!select || !value) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.getElementById("lumen-cost-auto")?.addEventListener("change", (event) => {
      setCostAutoSwitch(Boolean(event.target.checked));
    });

    document.getElementById("lumen-cost-savings-clear")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!globalThis.LumenCostLedger) return;
      if (
        !confirm(
          "Clear estimated spend and tip savings on this device? This cannot be undone."
        )
      ) {
        return;
      }
      globalThis.LumenCostLedger.clear();
      renderCostSavingsPanel();
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

  const FAB_MARGIN = 16;
  /** Collapsed mark-only pill size used for clamp / side detection (rail hidden). */
  const FAB_REST_W = 56;
  const FAB_REST_H = 44;

  function clampFabPosition(left, top, fab) {
    const width = Math.min(fab.offsetWidth || FAB_REST_W, FAB_REST_W + 8);
    const height = Math.min(fab.offsetHeight || FAB_REST_H, FAB_REST_H + 8);
    return {
      left: Math.min(Math.max(FAB_MARGIN, left), window.innerWidth - width - FAB_MARGIN),
      top: Math.min(Math.max(FAB_MARGIN, top), window.innerHeight - height - FAB_MARGIN),
    };
  }

  /**
   * Anchor the FAB so the rail always expands toward the screen centre.
   * Right half → position with `right` + rail before the mark (grows left).
   * Left half  → position with `left`  + rail after the mark (grows right).
   * Call while collapsed (or during drag) so the mark does not jump.
   */
  function syncFabAnchor(fab) {
    if (!fab) return;
    const rect = fab.getBoundingClientRect();
    const mark = document.getElementById("lumen-fab-mark");
    const markRect = mark?.getBoundingClientRect();
    const centerX = markRect
      ? markRect.left + markRect.width / 2
      : rect.left + Math.min(rect.width, FAB_REST_W) / 2;
    const onRight = centerX >= window.innerWidth / 2;
    fab.dataset.side = onRight ? "right" : "left";

    if (onRight) {
      const right = Math.max(FAB_MARGIN, window.innerWidth - rect.right);
      fab.style.left = "auto";
      fab.style.right = `${Math.round(right)}px`;
      fab.style.top = `${Math.round(rect.top)}px`;
      fab.style.bottom = "auto";
    } else {
      fab.style.left = `${Math.round(rect.left)}px`;
      fab.style.right = "auto";
      fab.style.top = `${Math.round(rect.top)}px`;
      fab.style.bottom = "auto";
    }
  }

  function applyFabPosition() {
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;
    const pos = LumenGoals.get().fabPosition;
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      // Measure / clamp as the resting pill so an expanded rail cannot push us off-screen.
      const wasDragging = fab.classList.contains("lumen-fab--dragging");
      fab.classList.add("lumen-fab--dragging");
      const clamped = clampFabPosition(pos.left, pos.top, fab);
      fab.style.left = `${clamped.left}px`;
      fab.style.top = `${clamped.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      // Force layout before reading rect for anchor conversion.
      void fab.offsetWidth;
      syncFabAnchor(fab);
      if (!wasDragging) fab.classList.remove("lumen-fab--dragging");
    } else {
      fab.style.left = "";
      fab.style.top = "";
      fab.style.right = "";
      fab.style.bottom = "";
      fab.dataset.side = "right";
    }
  }

  function bindFabDrag() {
    const fab = document.getElementById("lumen-fab");
    if (!fab || fab.dataset.dragBound) return;
    fab.dataset.dragBound = "1";
    if (!fab.dataset.side) fab.dataset.side = "right";

    fab.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      // Rail buttons open a pillar — don't start a drag from them.
      if (event.target.closest?.("[data-pillar]")) return;
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
      // Capture immediately: the mark is tiny, so without capture the cursor
      // leaves it after ~1px and pointermove stops firing (drag snaps back).
      // Capture does NOT block the click on release when we never moved.
      try {
        fab.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
    });

    fab.addEventListener("pointermove", (event) => {
      if (!fabDrag.active || event.pointerId !== fabDrag.pointerId) return;
      const moved = Math.hypot(event.clientX - fabDrag.startX, event.clientY - fabDrag.startY);
      if (!fabDrag.moved) {
        if (moved <= 4) return;
        fabDrag.moved = true;
        // Drag started: lock to left/top coordinates.
        const rect = fab.getBoundingClientRect();
        fab.style.left = `${rect.left}px`;
        fab.style.top = `${rect.top}px`;
        fab.style.right = "auto";
        fab.style.bottom = "auto";
        fabDrag.offsetX = event.clientX - rect.left;
        fabDrag.offsetY = event.clientY - rect.top;
        fab.classList.add("lumen-fab--dragging");
      }

      const next = clampFabPosition(
        event.clientX - fabDrag.offsetX,
        event.clientY - fabDrag.offsetY,
        fab
      );
      fab.style.left = `${next.left}px`;
      fab.style.top = `${next.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      fab.dataset.side = next.left + FAB_REST_W / 2 >= window.innerWidth / 2 ? "right" : "left";
      if (popoverOpen) positionPopover();
      if (digestReady) positionDigestToast();
    });

    fab.addEventListener("pointerup", (event) => {
      if (!fabDrag.active || event.pointerId !== fabDrag.pointerId) return;
      if (fabDrag.moved) {
        try {
          fab.releasePointerCapture(event.pointerId);
        } catch (_) {
          /* ignore */
        }
        const rect = fab.getBoundingClientRect();
        LumenGoals.save({ fabPosition: { left: Math.round(rect.left), top: Math.round(rect.top) } });
        fabDrag.suppressClick = true;
        syncFabAnchor(fab);
      }
      fabDrag.active = false;
      fab.classList.remove("lumen-fab--dragging");
    });

    fab.addEventListener("pointercancel", () => {
      fab.classList.remove("lumen-fab--dragging");
      fabDrag.active = false;
      syncFabAnchor(fab);
    });

    window.addEventListener("resize", () => {
      const pos = LumenGoals.get().fabPosition;
      if (!pos) {
        fab.dataset.side = "right";
        return;
      }
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
    // On a fresh setup, apply DEFAULT_USE_CASES (Coding + Admin start off).
    function prefill() {
      const goals = LumenGoals.get();
      const useCases = new Set(goals.useCases || []);
      const useCasesDefault =
        !goals.onboardingComplete && useCases.size === 0
          ? new Set(LumenGoals.listDefaultUseCases?.() || [])
          : useCases;
      document.querySelectorAll("#lumen-use-cases input").forEach((input) => {
        input.checked = useCasesDefault.has(input.value);
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
      target: () => document.getElementById("lumen-mode-seg") || document.getElementById("lumen-mode-select"),
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

  function syncChipOnState(rootSelector) {
    document.querySelectorAll(`${rootSelector} .lumen-usecase-chip`).forEach((chip) => {
      const input = chip.querySelector('input[type="checkbox"]');
      chip.classList.toggle("lumen-usecase-chip--on", Boolean(input?.checked));
      chip.setAttribute("aria-pressed", input?.checked ? "true" : "false");
    });
  }

  function syncSettingsUI() {
    const goals = LumenGoals.get();
    const modeSelect = document.getElementById("lumen-mode-select");
    const costSelect = document.getElementById("lumen-cost-select");
    const judgeToggle = document.getElementById("lumen-llm-judge");
    const studyToggle = document.getElementById("lumen-study-participant");
    const shareToggle = document.getElementById("lumen-share-data");
    const backendInput = document.getElementById("lumen-backend-input");
    const base = LumenConfig.webAppUrl(goals.webAppUrl);
    if (modeSelect) setModeSelectValue(modeSelect, goals.mode);
    else syncModeSegUI(goals.mode);
    if (costSelect) {
      costSelect.value = goals.costEnabled
        ? goals.costLevel === "full"
          ? "full"
          : "subtle"
        : "off";
    }
    syncCostSegUI(costSelect?.value || "off");
    const badgeSelect = document.getElementById("lumen-badge-select");
    if (badgeSelect) badgeSelect.value = goals.badgeEnabled ? "on" : "off";
    syncBadgeSegUI(badgeSelect?.value || "off");
    const autoRow = document.getElementById("lumen-cost-auto-row");
    const autoToggle = document.getElementById("lumen-cost-auto");
    if (autoRow) autoRow.classList.toggle("lumen-hidden", !goals.costEnabled);
    if (autoToggle) autoToggle.checked = Boolean(goals.costEnabled && goals.costAutoSwitch);

    const storedGoals = goals.protectedGoals || [];
    // Before setup, empty storage means "all presets on" — same as the guided cards.
    // Once the user has saved any list (including empty), respect that list.
    const goalsDefaultAll = !goals.onboardingComplete && storedGoals.length === 0;
    document.querySelectorAll("#lumen-goal-chips input").forEach((input) => {
      input.checked = goalsDefaultAll || storedGoals.includes(input.value);
    });
    syncChipOnState("#lumen-goal-chips");
    renderCustomGoalChips();

    const useCases = new Set(goals.useCases || []);
    const useCasesDefault =
      !goals.onboardingComplete && useCases.size === 0
        ? new Set(LumenGoals.listDefaultUseCases?.() || [])
        : useCases;
    document.querySelectorAll("#lumen-usecases input").forEach((input) => {
      input.checked = useCasesDefault.has(input.value);
    });
    syncChipOnState("#lumen-usecases");
    syncChipOnState("#lumen-custom-goals");

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

    syncPillarTags();
    syncFabFocusUI();
    updateModeHint();
    renderLastWhyPopover();
    syncCostSavingsBlurb();
  }

  function syncCostSegUI(value) {
    const level = value === "full" || value === "subtle" || value === "off" ? value : "off";
    document.querySelectorAll("#lumen-cost-seg .lumen-cost-seg-btn").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-cost") === level);
    });
    const tag = document.getElementById("lumen-cost-tag");
    if (tag) {
      tag.textContent =
        level === "full" ? "Loud" : level === "subtle" ? "Quiet" : "Off";
    }
  }

  function syncBadgeSegUI(value) {
    const on = value !== "off";
    document.querySelectorAll("#lumen-badge-seg .lumen-badge-seg-btn").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-badge") === (on ? "on" : "off"));
    });
    const hint = document.getElementById("lumen-badge-hint");
    if (hint) {
      hint.textContent = on
        ? "Disclose strips appear under long AI replies."
        : "Off by default. Turn on to show a Disclose strip under long AI replies.";
    }
  }

  function syncPillarTags() {
    const badgeTag = document.getElementById("lumen-badge-tag");
    if (badgeTag) {
      if (!LumenGoals.get().badgeEnabled) {
        badgeTag.textContent = "Off";
      } else {
        const n = (LumenSession.getAttestations?.() || []).length;
        badgeTag.textContent = n === 1 ? "1 this week" : `${n} this week`;
      }
    }
  }

  function syncCostSavingsBlurb() {
    renderCostSavingsPanel();
  }

  function renderCostSavingsPanel() {
    const spendStats = document.getElementById("lumen-cost-spend-stats");
    const spendMeta = document.getElementById("lumen-cost-spend-meta");
    const stats = document.getElementById("lumen-cost-savings-stats");
    const list = document.getElementById("lumen-cost-savings-list");
    if (!stats || !list) return;

    const formatUsd = globalThis.LumenCost?.formatUsd || ((n) => `$${n}`);
    const formatTokens = globalThis.LumenCost?.formatTokens || String;
    const summary = globalThis.LumenCostLedger?.summarize?.() || {
      eventCount: 0,
      usdAllTime: 0,
      usdThisWeek: 0,
      recent: [],
      spend: {
        callCount: 0,
        callsThisWeek: 0,
        usdAllTime: 0,
        usdThisWeek: 0,
        emaOutputTokens: null,
        outputSampleCount: 0,
      },
    };
    const spend = summary.spend || {
      callCount: 0,
      callsThisWeek: 0,
      usdAllTime: 0,
      usdThisWeek: 0,
      emaOutputTokens: null,
      outputSampleCount: 0,
    };

    if (spendStats) {
      spendStats.innerHTML = `
        <div class="lumen-cost-savings-stat">
          <span class="lumen-cost-savings-stat-label">This week</span>
          <span class="lumen-cost-savings-stat-value">${escapeHtml(
            formatUsd(spend.usdThisWeek || 0)
          )}</span>
        </div>
        <div class="lumen-cost-savings-stat">
          <span class="lumen-cost-savings-stat-label">All time</span>
          <span class="lumen-cost-savings-stat-value">${escapeHtml(
            formatUsd(spend.usdAllTime || 0)
          )}</span>
        </div>
      `;
    }
    if (spendMeta) {
      const calls = spend.callsThisWeek || 0;
      const ema = spend.emaOutputTokens;
      const samples = spend.outputSampleCount || 0;
      if (!spend.callCount) {
        spendMeta.textContent = "Send a prompt with Cost on — spend fills in after the reply.";
        spendMeta.classList.remove("lumen-hidden");
      } else {
        const parts = [
          `${calls} call${calls === 1 ? "" : "s"} this week`,
          `${spend.callCount} logged`,
        ];
        if (ema && samples >= 3) {
          parts.push(`avg reply ~${formatTokens(Math.round(ema))} tok`);
        }
        spendMeta.textContent = parts.join(" · ");
        spendMeta.classList.remove("lumen-hidden");
      }
    }

    stats.innerHTML = `
      <div class="lumen-cost-savings-stat">
        <span class="lumen-cost-savings-stat-label">This week</span>
        <span class="lumen-cost-savings-stat-value">${escapeHtml(formatUsd(summary.usdThisWeek))}</span>
      </div>
      <div class="lumen-cost-savings-stat">
        <span class="lumen-cost-savings-stat-label">All time</span>
        <span class="lumen-cost-savings-stat-value">${escapeHtml(formatUsd(summary.usdAllTime))}</span>
      </div>
    `;

    if (!summary.recent.length) {
      list.innerHTML = `<p class="lumen-cost-savings-empty">No tip saves yet. Tap <strong>Switch</strong> on a tip — or Log after you use one.</p>`;
      return;
    }

    list.innerHTML = summary.recent
      .slice(0, 8)
      .map((e) => {
        const when = new Date(e.at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        const host = (e.host || "").replace(/^www\./, "");
        const via =
          e.source === "auto-switched"
            ? " · auto"
            : e.source === "switched"
              ? " · switched"
              : e.source === "applied"
                ? " · applied"
                : "";
        return `<div class="lumen-cost-savings-row">
          <div>
            <div class="lumen-cost-savings-row-title">${escapeHtml(e.title)}</div>
            <div class="lumen-cost-savings-row-meta">${escapeHtml(when)}${
          host ? ` · ${escapeHtml(host)}` : ""
        }${via}${e.tokens ? ` · ~${escapeHtml(formatTokens(e.tokens))} tok` : ""}</div>
          </div>
          <div class="lumen-cost-savings-row-usd">${escapeHtml(formatUsd(e.usd))}</div>
        </div>`;
      })
      .join("");
  }

  function updateModeHint() {
    const hint = document.getElementById("lumen-mode-hint");
    if (!hint) return;
    // Keep Mode compact — only surface warnings; blurbs live on control titles.
    if (LumenGoals.isPaused()) {
      hint.textContent = "Paused — no tracking or signals until you resume.";
      hint.classList.remove("lumen-hidden");
      return;
    }
    if (LumenGoals.isGuard() && !LumenGoals.get().protectedGoals.length) {
      hint.textContent =
        "Guard needs at least one protected goal below — or switch mode.";
      hint.classList.remove("lumen-hidden");
      return;
    }
    hint.textContent = "";
    hint.classList.add("lumen-hidden");
  }

  function ensureAttestationsPopover() {
    const popover = document.getElementById("lumen-popover");
    if (!popover || document.getElementById("lumen-attestations")) return;
    const anchor = document.getElementById("lumen-privacy-toggle");
    if (!anchor) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="lumen-popover-divider"></div>
      <div class="lumen-popover-title">Disclosures</div>
      <p class="lumen-popover-hint lumen-hidden" id="lumen-attestations-empty">No disclosures yet. Tap “Disclose how you used AI” under a long AI reply.</p>
      <div class="lumen-attestations" id="lumen-attestations"></div>
      <button type="button" class="lumen-attest-recopy lumen-hidden" id="lumen-attest-recopy">Re-copy latest</button>
      <div class="lumen-popover-divider"></div>
    `;
    while (wrap.firstChild) popover.insertBefore(wrap.firstChild, anchor);
    document.getElementById("lumen-attest-recopy")?.addEventListener("click", (event) => {
      event.stopPropagation();
      recopyLatestAttestation();
    });
  }

  function clearInjectedUI() {
    document
      .querySelectorAll(".lumen-strip, .lumen-card, .lumen-why, .lumen-attest-row, .lumen-card--attest")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".lumen-ai-hidden")
      .forEach((el) => el.classList.remove("lumen-ai-hidden"));
    clearCostCoach();
  }

  function clearCostCoach() {
    document.getElementById("lumen-cost-coach")?.remove();
  }

  function clearAttestUI() {
    openAttestMsgId = null;
    document.querySelectorAll(".lumen-attest-row, .lumen-card--attest").forEach((el) => el.remove());
  }

  function logCostSave(match, analysis, source) {
    const ledger = globalThis.LumenCostLedger;
    if (!ledger || !match?.estimate) return null;
    // Per-call estimate is the honest unit when logging a single tip use.
    const usd = Number(match.estimate.usdPerCall) || 0;
    if (usd <= 0) return null;
    const event = ledger.recordApplied({
      ruleId: match.ruleId,
      title: match.title,
      usd,
      tokens: match.estimate.tokens || 0,
      modelId: analysis?.model?.id || null,
      fromModelId: match.fromModelId || analysis?.model?.id || null,
      toModelId: match.targetModelId || match.switchAction?.targetModelId || null,
      host: location.hostname,
      source,
    });
    if (source === "switched" || source === "auto-switched") {
      queueCostSaveCoin(usd);
    }
    return event;
  }

  /** Pending “coin into FAB” after a model switch — plays on the next send. */
  let pendingCostSaveCoin = null;

  function queueCostSaveCoin(usd) {
    const n = Number(usd);
    if (!Number.isFinite(n) || n <= 0) return;
    pendingCostSaveCoin = { usd: n, at: Date.now() };
  }

  function playPendingCostSaveCoin() {
    if (!LumenGoals.isCostEnabled?.()) {
      pendingCostSaveCoin = null;
      return;
    }
    const pending = pendingCostSaveCoin;
    if (!pending) return;
    if (Date.now() - pending.at > 10 * 60 * 1000) {
      pendingCostSaveCoin = null;
      return;
    }
    pendingCostSaveCoin = null;
    playCostSaveCoin(pending.usd);
  }

  function playCostSaveCoin(usd) {
    ensureRoot();
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;

    const formatUsd = globalThis.LumenCost?.formatUsd || ((n) => `$${n.toFixed(4)}`);
    const label = `+${formatUsd(usd)}`;
    const coin = document.createElement("div");
    coin.className = "lumen-cost-coin";
    coin.setAttribute("aria-hidden", "true");
    coin.textContent = label;
    // Append to body so host transforms / overflow on #lumen-root can't clip it.
    document.body.appendChild(coin);

    const fabRect = fab.getBoundingClientRect();
    const startX = window.innerWidth / 2;
    const startY = Math.max(120, window.innerHeight * 0.55);
    const endX = fabRect.left + fabRect.width / 2;
    const endY = fabRect.top + fabRect.height / 2;

    coin.style.left = `${startX}px`;
    coin.style.top = `${startY}px`;

    // Force layout, then animate toward the FAB.
    void coin.offsetWidth;
    coin.style.setProperty("--lumen-coin-dx", `${endX - startX}px`);
    coin.style.setProperty("--lumen-coin-dy", `${endY - startY}px`);
    coin.classList.add("lumen-cost-coin--fly");

    window.setTimeout(() => {
      coin.remove();
      pulseFabMark();
      syncCostSavingsBlurb();
    }, 1900);
  }

  // Page-console friendly test (content scripts are isolated from `LumenWidget`):
  //   document.dispatchEvent(new CustomEvent("lumen-debug-cost-coin", { detail: { usd: 0.0061 } }))
  document.addEventListener("lumen-debug-cost-coin", (event) => {
    const usd = Number(event?.detail?.usd);
    playCostSaveCoin(Number.isFinite(usd) && usd > 0 ? usd : 0.0061);
  });

  /** Armed when user starts a Nomon-advised model switch; confirms on picker change. */
  let pendingCostSwitch = null;
  /** Per-draft keys already auto-switched (avoid loops / fighting a manual revert). */
  const autoSwitchDone = new Set();
  let autoSwitchInFlight = false;

  function clearAutoSwitchMemory() {
    autoSwitchDone.clear();
    autoSwitchInFlight = false;
  }

  function autoSwitchDraftKey(text, match, fromModelId) {
    const t = String(text || "");
    const target =
      match?.targetModelId ||
      match?.switchAction?.targetModelId ||
      match?.switchAction?.value ||
      "";
    return `${t.length}:${t.slice(0, 40)}:${t.slice(-40)}|${target}|${fromModelId || ""}`;
  }

  function armPendingCostSwitch(match, analysis, auto = false) {
    if (!match?.switchAction && !match?.targetModelId) return;
    pendingCostSwitch = {
      match,
      analysis,
      fromModelId: analysis?.model?.id || match.fromModelId || null,
      targetModelId: match.targetModelId || match.switchAction?.targetModelId || null,
      armedAt: Date.now(),
      auto: Boolean(auto),
    };
  }

  function clearPendingCostSwitch() {
    pendingCostSwitch = null;
  }

  /**
   * If the user finishes a Nomon-advised switch in the host picker, log the save.
   * @returns {boolean} true if a switch was confirmed and logged
   */
  function confirmPendingCostSwitch(analysis) {
    if (!pendingCostSwitch) return false;
    if (Date.now() - pendingCostSwitch.armedAt > 90_000) {
      clearPendingCostSwitch();
      return false;
    }
    const targetId = pendingCostSwitch.targetModelId;
    const currentId = analysis?.model?.id;
    if (!targetId || !currentId || currentId === pendingCostSwitch.fromModelId) {
      return false;
    }
    // Accept exact target, or a cheaper tier in the same family (Instant→Luna).
    const hit =
      currentId === targetId ||
      (pendingCostSwitch.match?.switchAction?.kind === "intelligence" &&
        currentId !== pendingCostSwitch.fromModelId);
    if (!hit) return false;

    const src = pendingCostSwitch.auto ? "auto-switched" : "switched";
    logCostSave(pendingCostSwitch.match, analysis, src);
    clearPendingCostSwitch();
    syncCostSavingsBlurb();
    return true;
  }

  function setCostAutoSwitch(on) {
    clearAutoSwitchMemory();
    LumenGoals.save({ costAutoSwitch: Boolean(on) });
    syncSettingsUI();
    if (on) globalThis.LumenCostCoach?.refresh?.();
  }

  /**
   * Compose-time Cost coach strip (+ optional tip). Same family as Mirror
   * signal strips — compact, theme-aware, one surface. Never blocks send.
   */
  function renderCostCoach(analysis, adapter) {
    clearCostCoach();
    if (!analysis?.show || !LumenGoals.isCostEnabled?.()) return;
    if (LumenGoals.isPaused()) return;

    const input = adapter?.findChatInput?.();
    if (!input?.isConnected) return;

    // User may have finished a Switch in the host picker after we armed it.
    confirmPendingCostSwitch(analysis);

    const LumenCost = globalThis.LumenCost;
    const formatUsd = LumenCost?.formatUsd || ((n) => `$${n}`);
    const formatTokens = LumenCost?.formatTokens || ((n) => String(n));
    const level = analysis.level || "subtle";
    const top = analysis.top;
    const autoOn = Boolean(LumenGoals.isCostAutoSwitch?.() || LumenGoals.get().costAutoSwitch);
    const draftText = adapter.getChatInputText?.() || "";
    const theme = isHostDark() ? "dark" : "light";

    const shell = document.createElement("div");
    shell.id = "lumen-cost-coach";
    shell.className = "lumen-cost-coach";
    shell.setAttribute("data-lumen-cost-level", level);
    shell.setAttribute("data-lumen-theme", theme);
    shell.setAttribute("role", "status");

    const tokensLabel = formatTokens(analysis.inputTokens || 0);
    const saveUsd = top ? formatUsd(top.estimate?.usdPerCall || 0) : null;
    const meterPct = Math.max(
      8,
      Math.min(92, Math.round(((analysis.inputTokens || 0) / 3200) * 100))
    );

    const swapLabel =
      top?.switchAction?.buttonLabel ||
      (top?.switchAction?.uiLabel ? `Use ${top.switchAction.uiLabel}` : null) ||
      (top ? "Try lighter model" : null);

    // Loud: one primary swap on the strip. Quiet: spend only (+ Tips if a tip exists).
    const showSwap = Boolean(!autoOn && top?.switchAction && level === "full");
    const showTipsLink = Boolean(level === "subtle" && top);

    const lineHtml =
      level === "full" && top && saveUsd
        ? `≈ <b>${escapeHtml(tokensLabel)} tokens</b> · lighter model saves ~<b>${escapeHtml(
            saveUsd
          )}</b>`
        : `≈ <b>${escapeHtml(tokensLabel)} tokens</b>`;

    // Loud tip: top match only, one suggestion line — no stacked dark panel.
    let tipHtml = "";
    if (level === "full" && top) {
      const tipParts = [];
      if (top.rewrittenPrompt) {
        tipParts.push(
          `<button type="button" class="lumen-cost-apply" data-tip-idx="0">Apply rewrite</button>`
        );
      }
      if (!showSwap && top.switchAction && !autoOn) {
        tipParts.push(
          `<button type="button" class="lumen-cost-switch" data-tip-idx="0">${escapeHtml(
            top.switchAction.buttonLabel || "Switch"
          )}</button>`
        );
      }
      tipParts.push(
        `<button type="button" class="lumen-cost-log" data-tip-idx="0">Log save</button>`
      );
      tipHtml = `
        <div class="lumen-cost-coach-panel">
          <div class="lumen-cost-tip" data-tip-idx="0">
            <div class="lumen-cost-tip-head">
              <span class="lumen-cost-tip-title">${escapeHtml(top.title)}</span>
              <span class="lumen-cost-tip-save">${escapeHtml(
                formatUsd(top.estimate?.usdPerMonth || 0)
              )}/mo</span>
            </div>
            <p class="lumen-cost-tip-suggestion">${escapeHtml(top.suggestion || top.summary || "")}</p>
            <div class="lumen-cost-tip-actions">${tipParts.join("")}</div>
          </div>
        </div>`;
    }

    const actionsHtml = `
      <div class="lumen-cost-coach-actions">
        ${
          showSwap
            ? `<button type="button" class="lumen-cost-coach-swap" title="${escapeHtml(
                top.switchAction.buttonLabel || "Switch model"
              )}">${escapeHtml(swapLabel)}</button>`
            : ""
        }
        ${
          level === "full"
            ? `<button type="button" class="lumen-cost-coach-auto${
                autoOn ? " lumen-cost-coach-auto--on" : ""
              }" aria-pressed="${autoOn ? "true" : "false"}" title="${
                autoOn
                  ? "Auto switch on — tap to turn off"
                  : "Auto switch off — tap to apply recommended models automatically"
              }">Auto</button>`
            : ""
        }
        ${
          showTipsLink
            ? `<button type="button" class="lumen-cost-coach-more" title="Show cost tip">Tips</button>`
            : ""
        }
        <button type="button" class="lumen-cost-coach-dismiss" title="Hide for this draft" aria-label="Hide cost tip">×</button>
      </div>`;

    shell.innerHTML = `
      <div class="lumen-cost-coach-card">
        <div class="lumen-cost-coach-strip">
          <span class="lumen-cost-coach-dot" aria-hidden="true"></span>
          <div class="lumen-cost-coach-bd">
            <div class="lumen-cost-coach-ln">${lineHtml}</div>
            ${
              level === "full"
                ? `<div class="lumen-cost-coach-meter" aria-hidden="true"><i style="width:${meterPct}%"></i></div>`
                : `<div class="lumen-cost-coach-sb">On-device estimate</div>`
            }
          </div>
          ${actionsHtml}
        </div>
        ${tipHtml}
      </div>
    `;

    const host =
      input.closest("form") ||
      input.closest("[class*='composer']") ||
      input.closest("[class*='input']") ||
      input.parentElement;
    if (host?.parentElement) {
      host.insertAdjacentElement("afterend", shell);
    } else {
      input.insertAdjacentElement("afterend", shell);
    }

    shell.querySelector(".lumen-cost-coach-dismiss")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearCostCoach();
    });

    shell.querySelector(".lumen-cost-coach-auto")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setCostAutoSwitch(!autoOn);
    });

    shell.querySelector(".lumen-cost-coach-more")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      LumenGoals.save({ costLevel: "full" });
      syncSettingsUI();
      const next = globalThis.LumenCost?.analyze?.(
        adapter.getChatInputText?.() || "",
        LumenGoals.get(),
        {
          hostname: location.hostname,
          selectedModel: adapter.getSelectedModel?.() || null,
        }
      );
      if (next) renderCostCoach(next, adapter);
    });

    const flashLog = (btn, label = "Logged ✓") => {
      if (!btn) return;
      btn.textContent = label;
      btn.disabled = true;
      syncCostSavingsBlurb();
    };

    const runSwitch = async (match, btn, opts = {}) => {
      if (!match?.switchAction) return { ok: false };
      const label = match.switchAction.buttonLabel || "Switch";
      const auto = Boolean(opts.auto);
      if (btn) {
        btn.disabled = true;
        btn.textContent = auto ? "Auto…" : "Switching…";
      }
      armPendingCostSwitch(match, analysis, auto);

      let result = { ok: false };
      try {
        if (typeof adapter?.switchModel === "function") {
          result = (await adapter.switchModel(match.switchAction)) || { ok: false };
        }
      } catch (_) {
        result = { ok: false };
      }

      if (result.ok) {
        logCostSave(match, analysis, auto ? "auto-switched" : "switched");
        clearPendingCostSwitch();
        flashLog(btn, auto ? "Auto · saved ✓" : "Switched · saved ✓");
        setTimeout(() => globalThis.LumenCostCoach?.refresh?.(), 280);
        return result;
      }

      // Menu may be open — keep pending armed so a manual pick still logs.
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
        btn.title =
          result.message ||
          match.switchAction.hint ||
          "Pick the suggested option in the menu — Nomon will log the save";
      }
      return result;
    };

    shell.querySelector(".lumen-cost-coach-switch")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runSwitch(top, event.currentTarget);
    });
    shell.querySelector(".lumen-cost-coach-swap")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runSwitch(top, event.currentTarget);
    });

    shell.querySelectorAll(".lumen-cost-switch").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(btn.getAttribute("data-tip-idx"));
        runSwitch(analysis.matches?.[idx], btn);
      });
    });

    shell.querySelectorAll(".lumen-cost-log").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(btn.getAttribute("data-tip-idx"));
        const match = analysis.matches?.[idx];
        if (!match) return;
        logCostSave(match, analysis, "logged");
        flashLog(btn);
      });
    });

    shell.querySelectorAll(".lumen-cost-apply").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(btn.getAttribute("data-tip-idx"));
        const match = analysis.matches?.[idx];
        const rewrite = match?.rewrittenPrompt;
        if (rewrite && adapter?.setChatInputText) {
          adapter.setChatInputText(rewrite);
          logCostSave(match, analysis, "applied");
          flashLog(btn, "Applied ✓");
          const next = globalThis.LumenCost?.analyze?.(rewrite, LumenGoals.get(), {
            hostname: location.hostname,
            selectedModel: adapter.getSelectedModel?.() || null,
          });
          if (next) renderCostCoach(next, adapter);
          else syncCostSavingsBlurb();
        }
      });
    });

    // Auto switch: once per draft+target while enabled; never loops if user reverts.
    if (autoOn && !autoSwitchInFlight && top?.switchAction) {
      const key = autoSwitchDraftKey(draftText, top, analysis.model?.id);
      const alreadyOnTarget =
        top.targetModelId && analysis.model?.id === top.targetModelId;
      if (!alreadyOnTarget && !autoSwitchDone.has(key)) {
        autoSwitchDone.add(key);
        autoSwitchInFlight = true;
        Promise.resolve(runSwitch(top, null, { auto: true })).finally(() => {
          autoSwitchInFlight = false;
        });
      }
    }
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
    if (fab) {
      delete fab.dataset.signal;
      delete fab.dataset.posture;
    }
  }

  // 0–100 offload estimate for *this session* (higher = more AI-led).
  // Lightweight cousin of nudges.postureScore — uses counts already on the session.
  function sessionOffloadScore() {
    const session = LumenSession.get();
    const m = Math.max(session.messageCount || 0, 1);
    const handoffRate = (session.handoffCount || 0) / m;
    const mismatchRate = (session.mismatchCount || 0) / m;
    const depthRate = (session.depthCount || 0) / m;
    const loopRate = (session.loopCount || 0) / m;
    const avgLoop = session.loopScores?.length
      ? session.loopScores.reduce((a, b) => a + b, 0) / session.loopScores.length
      : 40;
    const passiveProxy = Math.min(1, avgLoop / 100);

    let offload = 0;
    offload += Math.min(1, handoffRate * 3) * 38;
    offload += Math.min(1, mismatchRate * 4) * 7;
    offload += Math.min(1, loopRate * 3) * 12;
    offload += passiveProxy * 33;
    offload -= Math.min(1, depthRate * 5) * 10;
    return Math.max(0, Math.min(100, Math.round(offload)));
  }

  /** @returns {"hands-on"|"in-between"|"ai-led"|null} */
  function sessionPostureBand() {
    if ((LumenSession.get().messageCount || 0) < FAB_POSTURE_MIN_MESSAGES) return null;
    const score = sessionOffloadScore();
    if (score < 40) return "hands-on";
    if (score < 70) return "in-between";
    return "ai-led";
  }

  // Signal-reactive FAB label (nomon-fab.md): at rest = dots only; on signal =
  // short copy for 4s. Hand-off uses the posture flash instead (AI-led / …).
  // Ghost mode is dots-only like other modes (dashed pill styling).
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
    delete fab.dataset.posture;
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

  // Transient session posture — Hands-on / In between / AI-led — ~3s then rest.
  function showFabPosture(band) {
    if (LumenGoals.isGhost() || LumenGoals.isPaused()) return;
    const label = FAB_POSTURE_LABELS[band];
    if (!label) return;
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;

    window.clearTimeout(fabSignalTimer);
    fabDisplaySignal = `posture:${band}`;
    fab.dataset.signal = "posture";
    fab.dataset.posture = band;
    syncFabLabelFromState();
    syncFabAccessibility();
    pulseFabMark();

    fabSignalTimer = window.setTimeout(() => {
      fabDisplaySignal = null;
      delete fab.dataset.signal;
      delete fab.dataset.posture;
      syncFabLabelFromState();
      syncFabAccessibility();
    }, 3000);
  }

  // Decide FAB flash after a scored message: specific signals win; otherwise
  // posture on hand-off or when the session band changes.
  function flashFabForEvaluation(evaluation, options = {}) {
    if (!options.isNewMessage && !options.fromJudge) return;
    if (LumenGoals.isGhost() || LumenGoals.isPaused()) return;

    const primary = evaluation?.primary || null;
    if (primary && FAB_SIGNALS.has(primary)) {
      showFabSignal(primary);
      const band = sessionPostureBand();
      if (band) lastFabPostureBand = band;
      return;
    }

    const band = sessionPostureBand();
    if (!band) {
      if (primary === "handoff") pulseFabMark();
      return;
    }

    const bandChanged = band !== lastFabPostureBand;
    lastFabPostureBand = band;

    if (primary === "handoff" || bandChanged) {
      showFabPosture(band);
      return;
    }

    pulseFabMark();
  }

  function normalizeFabPillar(value) {
    return value === "badge" || value === "cost" || value === "mirror" ? value : "mirror";
  }

  function setFabPillar(pillar) {
    const next = normalizeFabPillar(pillar);
    LumenGoals.save({ fabPillar: next });
    syncFabFocusUI();
  }

  function fabFocusStatus(pillar) {
    const goals = LumenGoals.get();
    if (pillar === "badge") {
      if (!goals.badgeEnabled) return "Off";
      const n = (LumenSession.getAttestations?.() || []).length;
      return n === 1 ? "1 this week" : `${n} this week`;
    }
    if (pillar === "cost") {
      if (!goals.costEnabled) return "Off";
      return goals.costLevel === "full" ? "Loud" : "Quiet";
    }
    const mode = LumenGoals.normalizeMode?.(goals.mode) ?? goals.mode ?? "active";
    return { ambient: "Ambient", active: "Active", ghost: "Ghost", guard: "Guard" }[mode] || "Active";
  }

  function syncFabFocusUI() {
    const fab = document.getElementById("lumen-fab");
    const popover = document.getElementById("lumen-popover");
    const pillar = normalizeFabPillar(LumenGoals.get().fabPillar);
    if (fab) fab.dataset.focus = pillar;
    if (popover) popover.dataset.pillar = pillar;

    document.querySelectorAll(".lumen-pillar-tab[data-pillar]").forEach((btn) => {
      const on = btn.getAttribute("data-pillar") === pillar;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("lumen-pillar-tab--on", on);
    });

    const panels = {
      mirror: document.getElementById("lumen-pillar-mirror"),
      badge: document.getElementById("lumen-pillar-badge"),
      cost: document.getElementById("lumen-pillar-cost"),
    };
    Object.entries(panels).forEach(([key, panel]) => {
      if (!panel) return;
      panel.setAttribute("data-pillar-panel", key);
      const on = key === pillar;
      panel.classList.toggle("lumen-hidden", !on);
      panel.hidden = !on;
    });

    // Mirror-only sections use [data-pillar-scope] + CSS on #lumen-popover[data-pillar]
    // so their own lumen-hidden state (stats empty, privacy open) is preserved.

    // Collapse Privacy when leaving Mirror so it doesn't reopen expanded on return.
    if (pillar !== "mirror") {
      const privacyBtn = document.getElementById("lumen-privacy-toggle");
      if (privacyBtn?.getAttribute("aria-expanded") === "true") {
        togglePrivacyPanel(false);
      }
    }
  }

  function syncFabLabelFromState() {
    const labelEl = document.getElementById("lumen-fab-label");
    if (!labelEl) return;

    if (fabDisplaySignal && FAB_SIGNAL_LABELS[fabDisplaySignal]) {
      labelEl.textContent = FAB_SIGNAL_LABELS[fabDisplaySignal];
      labelEl.classList.remove("lumen-fab-label--empty");
      return;
    }

    if (typeof fabDisplaySignal === "string" && fabDisplaySignal.startsWith("posture:")) {
      const band = fabDisplaySignal.slice("posture:".length);
      const postureLabel = FAB_POSTURE_LABELS[band];
      if (postureLabel) {
        labelEl.textContent = postureLabel;
        labelEl.classList.remove("lumen-fab-label--empty");
        return;
      }
    }

    if (LumenGoals.isPaused()) {
      labelEl.textContent = "paused";
      labelEl.classList.remove("lumen-fab-label--empty");
      return;
    }

    labelEl.textContent = "";
    labelEl.classList.add("lumen-fab-label--empty");
  }

  function syncFabAccessibility() {
    const fab = document.getElementById("lumen-fab");
    if (!fab) return;
    const paused = LumenGoals.isPaused();
    const mode = LumenGoals.normalizeMode?.(LumenGoals.get().mode) ?? LumenGoals.get().mode;
    const pillar = normalizeFabPillar(LumenGoals.get().fabPillar);
    const label = { mirror: "Mirror", badge: "Badge", cost: "Cost" }[pillar];
    if (paused) {
      fab.title = "Nomon is paused — click to open settings and resume";
      fab.setAttribute("aria-label", "Nomon paused");
      return;
    }
    if (fabDisplaySignal) {
      if (String(fabDisplaySignal).startsWith("posture:")) {
        const band = fabDisplaySignal.slice("posture:".length);
        const postureLabel = FAB_POSTURE_LABELS[band] || "posture";
        fab.title = `Nomon — ${postureLabel}`;
        fab.setAttribute("aria-label", `Nomon ${mode} mode, ${postureLabel}`);
        return;
      }
      fab.title = `Nomon — ${fabDisplaySignal} signal`;
      fab.setAttribute("aria-label", `Nomon ${mode} mode, ${fabDisplaySignal} signal`);
      return;
    }
    fab.title = `Nomon — ${label} · ${fabFocusStatus(pillar)}. Drag to move, click to open.`;
    fab.setAttribute("aria-label", `Nomon ${label}`);
  }

  // The four-dot mark has fixed brand colours (mode is shown by the pill's
  // border/ring), so a mode switch just replays one processing loop as feedback.
  function morphFabMark() {
    updateBadge();
    pulseFabMark();
  }

  function openPopoverToPillar(pillar) {
    const next = normalizeFabPillar(pillar);
    if (normalizeFabPillar(LumenGoals.get().fabPillar) !== next) {
      LumenGoals.save({ fabPillar: next });
    }
    if (!popoverOpen) {
      popoverOpen = true;
      renderPopover();
      document.getElementById("lumen-popover")?.classList.add("lumen-popover--open");
      if (digestReady) {
        hideDigestToast();
        observeDigestView();
      }
      maybeAutoStartTour();
    } else {
      renderPopover();
    }
    syncFabFocusUI();
    positionPopover();
    window.requestAnimationFrame(() => {
      positionPopover();
      if (!tourActive) scrollPopoverToActivePillar();
    });
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
      fab.dataset.cost = LumenGoals.isCostEnabled?.() ? "on" : "off";
      fab.dataset.focus = normalizeFabPillar(LumenGoals.get().fabPillar);
      if (paused || mode === "ghost") clearFabSignal();
    }

    if (paused || !LumenGoals.isCostEnabled?.()) clearCostCoach();

    syncFabLabelFromState();
    syncFabAccessibility();
  }

  function positionPopover() {
    const fab = document.getElementById("lumen-fab");
    const popover = document.getElementById("lumen-popover");
    if (!fab || !popover) return;

    const rect = fab.getBoundingClientRect();
    const gap = 12;
    const edge = 12;
    const cssMax = Math.min(560, window.innerHeight - edge * 2);
    const width = popover.offsetWidth || 360;

    // Measure with CSS max in play so height reflects the real panel.
    popover.style.maxHeight = `${cssMax}px`;
    const height = Math.min(popover.scrollHeight || cssMax, cssMax);

    let right = Math.max(edge, window.innerWidth - rect.right);
    const maxRight = Math.max(edge, window.innerWidth - width - edge);
    if (right > maxRight) right = maxRight;
    popover.style.left = "auto";
    popover.style.right = `${right}px`;

    const spaceAbove = rect.top - edge - gap;
    const spaceBelow = window.innerHeight - rect.bottom - edge - gap;

    // Prefer above the FAB when there's room; otherwise below; else center.
    if (spaceAbove >= Math.min(height, 220) && spaceAbove >= spaceBelow) {
      const bottom = window.innerHeight - rect.top + gap;
      const topEdge = window.innerHeight - bottom - height;
      if (topEdge >= edge) {
        popover.style.top = "auto";
        popover.style.bottom = `${bottom}px`;
        popover.style.maxHeight = `${Math.min(cssMax, spaceAbove)}px`;
      } else {
        // Would clip the top — pin to the viewport top and shrink to fit above FAB.
        popover.style.top = `${edge}px`;
        popover.style.bottom = "auto";
        popover.style.maxHeight = `${Math.max(160, rect.top - gap - edge)}px`;
      }
    } else if (spaceBelow >= 160) {
      popover.style.top = `${rect.bottom + gap}px`;
      popover.style.bottom = "auto";
      popover.style.maxHeight = `${Math.min(cssMax, spaceBelow)}px`;
    } else {
      const h = Math.min(cssMax, window.innerHeight - edge * 2);
      popover.style.top = `${Math.max(edge, Math.round((window.innerHeight - h) / 2))}px`;
      popover.style.bottom = "auto";
      popover.style.maxHeight = `${h}px`;
    }
  }

  function scrollPopoverToActivePillar() {
    const scroll =
      document.querySelector("#lumen-popover .lumen-popover-scroll") ||
      document.getElementById("lumen-popover");
    if (!scroll) return;
    scroll.scrollTop = 0;
  }

  function renderSparkline(scores, barColors) {
    // Single implementation lives in sparkline.js (loaded before widget.js).
    return globalThis.LumenSparkline?.render?.(scores || [], 120, 32, barColors) ?? "";
  }

  function signalBarColor(primary) {
    // Sparkline bars use the same logo-dot hues as the inline strips.
    const colors = SIGNAL_COLORS_LIGHT;
    if (primary && colors[primary]) return colors[primary];
    return "#9a9aa5";
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
    renderAttestationsList();
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
    mismatch: "#83838d",
    loop: "#5ba85c",
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
      { c: "#8e6fd8", x: 0.37 * S, y: -0.2 * S },
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
      grad.addColorStop(0, "#e8e8ec");
      grad.addColorStop(1, "#f2f2f4");
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
    const costSummary = globalThis.LumenCostLedger?.summarize?.();
    const digest = LumenNudges.buildDigest({
      history,
      session: LumenSession.get(),
      digestLog: LumenSession.getDigestLog(),
      costUsdWeek: costSummary?.usdThisWeek || 0,
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

  function renderWeeklyMark({ run = false, scale = 1 } = {}) {
    const runClass = run ? " lumen-weekly-mark--run" : "";
    const style = scale !== 1 ? ` style="transform:scale(${scale})"` : "";
    return `<span class="lumen-weekly-mark${runClass}"${style} aria-hidden="true"><span class="lumen-dot-spin">
      <span class="lumen-dot lumen-dot-green" style="--rx:-7px;--ry:-4px;--ex:0;--ey:-6px"></span>
      <span class="lumen-dot lumen-dot-amber" style="--rx:0;--ry:-4px;--ex:6px;--ey:0"></span>
      <span class="lumen-dot lumen-dot-purple" style="--rx:7px;--ry:-4px;--ex:0;--ey:6px"></span>
      <span class="lumen-dot lumen-dot-blue" style="--rx:0;--ry:4px;--ex:-6px;--ey:0"></span>
    </span></span>`;
  }

  function bindWeeklyTabs(scope) {
    scope?.querySelectorAll(".lumen-weekly-tab").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.stopPropagation();
        const target = tab.dataset.tab;
        scope.querySelectorAll(".lumen-weekly-tab").forEach((el) => {
          el.classList.toggle("on", el.dataset.tab === target);
        });
        scope.querySelectorAll(".lumen-weekly-tabpane").forEach((el) => {
          el.classList.toggle("on", el.dataset.pane === target);
        });
      });
    });
  }

  function profileInitial(name) {
    const n = String(name || "?").trim();
    if (!n) return "?";
    if (n.toLowerCase() === "chatgpt") return "G";
    return n.charAt(0).toUpperCase();
  }

  function profileSubline(tool) {
    if (!tool.ready) return tool.line;
    const use = tool.use ? `Mostly ${tool.use}` : "Mixed";
    const posture =
      tool.posture === "hands-on"
        ? "you draft, then refine"
        : tool.posture === "hand-off heavy"
          ? "asking it to explain, not do"
          : tool.posture === "mixed"
            ? "half delegating, half steering"
            : "back-and-forth";
    return `${use} · ${posture}`;
  }

  function renderWeeklyProfileCards(profile = []) {
    if (!profile.length) {
      return `<p class="lumen-weekly-text">Still learning how you work across tools.</p>`;
    }
    return profile
      .map((tool) => {
        if (!tool.ready) {
          return `<div class="lumen-weekly-profile-card lumen-weekly-profile-card--pending"><p class="lumen-weekly-text">${escapeHtml(tool.line)}</p></div>`;
        }
        const left = Math.max(4, Math.min(96, tool.postureScore ?? 50));
        return `<div class="lumen-weekly-profile-card">
          <div class="lumen-weekly-profile-ai">${escapeHtml(profileInitial(tool.name))}</div>
          <div class="lumen-weekly-profile-meta">
            <div class="lumen-weekly-profile-name">${escapeHtml(tool.name)}</div>
            <div class="lumen-weekly-profile-sub">${escapeHtml(profileSubline(tool))}</div>
            <div class="lumen-weekly-axis"><i style="left:${left}%"></i></div>
            <div class="lumen-weekly-axis-legend"><span>Learning</span><span>Mixed</span><span>Hands-on</span></div>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderWeeklyGoalRows() {
    const goals = LumenGoals.get().protectedGoals || [];
    if (!goals.length) {
      return `<p class="lumen-weekly-text">No protected goals yet — set them in the pill or during setup.</p>`;
    }
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const events = (LumenSession.getDigestLog().mismatchEvents || []).filter((e) => (e.at || 0) >= since);
    return goals
      .map((goal) => {
        const flagged = events.filter((e) => e.goal === goal).length;
        const ok = flagged === 0;
        const tick = ok
          ? `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16v.5"/></svg>`;
        return `<div class="lumen-weekly-goal-row${ok ? "" : " flagged"}">
          <span class="lumen-weekly-goal-tick">${tick}</span>
          <span class="lumen-weekly-goal-text">${escapeHtml(goal)}</span>
          <span class="lumen-weekly-goal-count">${ok ? "0 mismatches" : `${flagged} flagged`}</span>
        </div>`;
      })
      .join("");
  }

  function renderWeeklyEmpty(history) {
    const headline = document.getElementById("lumen-weekly-headline");
    if (headline) {
      headline.innerHTML = `Your first week is taking <em>shape</em>.`;
    }
    const shape = document.getElementById("lumen-weekly-shape");
    if (shape) shape.classList.add("lumen-hidden");

    const body = document.getElementById("lumen-weekly-body");
    if (!body) return;

    const scores = trendScores(history);
    const bars = (scores.length ? scores.slice(-7) : [20, 35, 25, 50, 30, 60, 40])
      .map((score) => {
        const h = score == null ? 20 : Math.max(20, Math.min(85, Math.round(score * 0.85)));
        return `<i style="height:${h}%"></i>`;
      })
      .join("");

    body.innerHTML = `
      <div class="lumen-weekly-empty">
        ${renderWeeklyMark({ run: true, scale: 1.7 })}
        <h3 class="lumen-weekly-empty-title">A few more days and your mirror fills in</h3>
        <p class="lumen-weekly-empty-text">Shapes, wins and prompts appear once Nomon has seen a handful of sessions. Nothing to do — just keep working.</p>
        <div class="lumen-weekly-spark">${bars}</div>
      </div>`;
  }

  function renderWeeklyReview(digest, history) {
    const headline = document.getElementById("lumen-weekly-headline");
    if (headline) {
      headline.innerHTML = digest.shapeHeadline || digest.headline || "This week";
    }

    const shapeBadge = document.getElementById("lumen-weekly-shape");
    if (shapeBadge) {
      if (digest.shape && digest.hasWeekData) {
        shapeBadge.classList.remove("lumen-hidden");
        shapeBadge.innerHTML = `<span class="lumen-weekly-shape-text">You were a <b>${escapeHtml(digest.shape)}</b> this week</span>`;
      } else {
        shapeBadge.classList.add("lumen-hidden");
        shapeBadge.innerHTML = "";
      }
    }

    const body = document.getElementById("lumen-weekly-body");
    if (!body) return;

    if (countActiveDays(history) < DIGEST_MIN_ACTIVE_DAYS || !digest.hasWeekData) {
      renderWeeklyEmpty(history);
      return;
    }

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

    const pills = (digest.statPills || [])
      .map(
        (pill) =>
          `<span class="lumen-weekly-stat-pill"><b>${escapeHtml(pill.value)}</b> ${escapeHtml(pill.label)}</span>`
      )
      .join("");

    const profileIntro =
      digest.profileContrast ||
      "You work differently in each tool — hands-on where you know the terrain, learning where you don't.";

    body.innerHTML = `
      <div class="lumen-weekly-win">
        <div class="lumen-weekly-win-label">Biggest win</div>
        <div class="lumen-weekly-win-text">${escapeHtml(digest.biggestWin || digest.headline)}</div>
      </div>
      <div class="lumen-weekly-tabs">
        <button type="button" class="lumen-weekly-tab on" data-tab="week">This week</button>
        <button type="button" class="lumen-weekly-tab" data-tab="profile">AI profile</button>
        <button type="button" class="lumen-weekly-tab" data-tab="goals">Goals</button>
      </div>
      <div class="lumen-weekly-tabpane on" data-pane="week">
        <div class="lumen-weekly-pill-row">${pills}</div>
        <div class="lumen-weekly-sit-with">
          <div class="lumen-weekly-label">Sit with</div>
          <div class="lumen-weekly-prompt">${escapeHtml(digest.prompt)}</div>
        </div>
      </div>
      <div class="lumen-weekly-tabpane" data-pane="profile">
        <p class="lumen-weekly-contrast">${escapeHtml(profileIntro)}</p>
        ${renderWeeklyProfileCards(digest.profile)}
      </div>
      <div class="lumen-weekly-tabpane" data-pane="goals">
        ${renderWeeklyGoalRows()}
        <p class="lumen-weekly-goals-foot">Nomon only flags prompts against goals you set.${
          digest.weeklyMismatchCount
            ? ` ${digest.weeklyMismatchCount} nudge${digest.weeklyMismatchCount === 1 ? "" : "s"} this week.`
            : ""
        }</p>
      </div>
      ${setupBlock}`;

    bindWeeklyTabs(body);

    if (reviewDue) {
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
      positionPopover();
      // The toast has done its job once the pill is open; hide it but keep the
      // dot until the digest is actually scrolled into view.
      if (digestReady) {
        hideDigestToast();
        observeDigestView();
      }
      // First time the pill is opened, run the highlight tour once (in context,
      // never a load-time interrupt).
      maybeAutoStartTour();
      window.requestAnimationFrame(() => {
        positionPopover();
        if (!tourActive) scrollPopoverToActivePillar();
      });
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

  function formatAttestAgo(iso) {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return "";
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (_) {
        return false;
      }
    }
  }

  async function copyRichToClipboard(html, plain) {
    const wrapped = NomonBadge.wrapHtmlForClipboard?.(html) || html;
    try {
      if (navigator.clipboard?.write && globalThis.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([wrapped], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        return true;
      }
    } catch (_) {
      // fall through to plain text
    }
    return copyToClipboard(plain);
  }

  function renderAttestationsList() {
    const list = document.getElementById("lumen-attestations");
    const empty = document.getElementById("lumen-attestations-empty");
    const recopy = document.getElementById("lumen-attest-recopy");
    if (!list) return;

    const items = LumenSession.getAttestations?.() || [];
    if (empty) empty.classList.toggle("lumen-hidden", items.length > 0);
    if (recopy) recopy.classList.toggle("lumen-hidden", items.length === 0);

    if (!items.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = items
      .slice(0, 8)
      .map(
        (a) => `<button type="button" class="lumen-attest-history-item" data-attest-id="${a.id}">
          <span class="lumen-attest-history-level">${a.levelLabel || a.level}${a.process?.crossAi ? " · multi-AI" : ""}</span>
          <span class="lumen-attest-history-meta">${a.process?.platformLabel || a.process?.platform || "AI"} · ${formatAttestAgo(a.createdAt)} · ${NomonBadge.formatWordCount(a.artifact?.wordCount || 0)}</span>
        </button>`
      )
      .join("");

    list.querySelectorAll(".lumen-attest-history-item").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const id = btn.getAttribute("data-attest-id");
        const att = items.find((a) => a.id === id);
        if (att?.exports?.html && att?.exports?.plaintext) {
          await copyRichToClipboard(att.exports.html, att.exports.plaintext);
        } else if (att?.exports?.plaintext) {
          await copyToClipboard(att.exports.plaintext);
        }
      });
    });
  }

  async function recopyLatestAttestation() {
    const latest = (LumenSession.getAttestations?.() || [])[0];
    if (!latest?.exports) return;
    if (latest.exports.html && latest.exports.plaintext) {
      await copyRichToClipboard(latest.exports.html, latest.exports.plaintext);
      return;
    }
    if (latest.exports.plaintext) await copyToClipboard(latest.exports.plaintext);
  }

  function closeAttestComposer(msgId) {
    if (openAttestMsgId === msgId) openAttestMsgId = null;
    document.querySelector(`.lumen-card--attest[data-lumen-msg-id="${msgId}"]`)?.remove();
    const row = document.querySelector(`.lumen-attest-row[data-lumen-msg-id="${msgId}"]`);
    row?.querySelector(".lumen-attest-strip")?.classList.remove("lumen-hidden");
  }

  function renderAttestSuccess(card, msgId) {
    card.innerHTML = `
      <div class="lumen-card-body lumen-attest-success">Copied — paste at the end of your email or document.</div>
      <div class="lumen-card-body lumen-attest-success-hint">If formatting looks wrong, use “Copy plain text” instead. Saved in Nomon → Disclosures.</div>
      <div class="lumen-card-actions">
        <button class="lumen-card-btn" data-action="done">Done</button>
      </div>
    `;
    card.querySelector('[data-action="done"]')?.addEventListener("click", () => {
      closeAttestComposer(msgId);
      document.querySelector(`.lumen-attest-row[data-lumen-msg-id="${msgId}"]`)?.remove();
    });
  }

  function openAttestComposer(msg, messages, adapter, anchor) {
    if (openAttestMsgId === msg.id) return;
    openAttestMsgId = msg.id;

    document.querySelectorAll(".lumen-card--attest").forEach((el) => {
      if (el.getAttribute("data-lumen-msg-id") !== msg.id) el.remove();
    });

    const session = LumenSession.get();
    const ctx = NomonBadge.buildContext(msg, messages, session);
    let selectedLevel = ctx.defaultLevel;
    const selectedPlatforms = new Set(ctx.defaultSelectedPlatforms);

    const card = document.createElement("div");
    card.className = "lumen-card lumen-card--attest";
    card.setAttribute("data-lumen-msg-id", msg.id);

    function selectedPlatformObjs() {
      return ctx.todayPlatforms.filter((p) => selectedPlatforms.has(p.host));
    }

    function levelChips() {
      return NomonBadge.LEVELS.map((level) => {
        const meta = NomonBadge.LEVEL_META[level];
        const on = level === selectedLevel ? " lumen-level-chip--on" : "";
        return `<button type="button" class="lumen-level-chip${on}" data-level="${level}">${meta.label}</button>`;
      }).join("");
    }

    function platformChips() {
      return ctx.todayPlatforms
        .map((p) => {
          const on = selectedPlatforms.has(p.host) ? " lumen-platform-chip--on" : "";
          const locked = p.isCurrent ? " lumen-platform-chip--locked" : "";
          const detail = p.isCurrent
            ? "this reply"
            : `${p.messageCount} msg${p.messageCount === 1 ? "" : "s"} today`;
          return `<button type="button" class="lumen-platform-chip${on}${locked}" data-platform="${escapeHtml(p.host)}" ${
            p.isCurrent ? 'aria-disabled="true"' : ""
          } title="${p.isCurrent ? "Always included — you are disclosing this reply" : "Toggle whether this tool was part of your workflow"}">
            <span class="lumen-platform-chip-label">${escapeHtml(p.label)}</span>
            <span class="lumen-platform-chip-meta">${detail}</span>
          </button>`;
        })
        .join("");
    }

    function observedHtml() {
      const current = ctx.todayPlatforms.find((p) => p.isCurrent);
      const replyLine = current
        ? `<div>${escapeHtml(current.label)} · this reply · ${ctx.wordCountLabel}</div>`
        : "";
      const threadLine = `<div>Your prompts in this thread · ${ctx.threadUserMessages}</div>
        <div>Engagement · ${ctx.engagementSummary}</div>`;
      return `${replyLine}${threadLine}`;
    }

    function previewHtml() {
      const meta = NomonBadge.LEVEL_META[selectedLevel];
      const review = meta.humanReviewed ? "human reviewed" : "minimal human revision";
      const labels = NomonBadge.formatPlatformsLabel(selectedPlatformObjs());
      const crossAi =
        selectedPlatformObjs().length > 1
          ? ` · ${selectedPlatformObjs().length} tools`
          : "";
      return `<span class="lumen-attest-preview-pill">${meta.label}</span>
        <span class="lumen-attest-preview-text">${labels} · ${review}${crossAi} · Disclosed via Nomon</span>`;
    }

    function renderComposerBody() {
      const toolsSection = ctx.crossAiAvailable
        ? `<div class="lumen-attest-section-label">Other tools today (optional)</div>
           <p class="lumen-attest-tools-hint">${escapeHtml(NomonBadge.formatOptionalToolsHint(ctx.otherPlatformsToday))}</p>
           <div class="lumen-platform-chips">${platformChips()}</div>`
        : "";

      card.innerHTML = `
      <div class="lumen-card-title">AI disclosure badge</div>
      <div class="lumen-card-body">Tell readers how AI helped with this output. Nomon fills in what it saw in this thread — add other tools only if they helped you make this.</div>
      <div class="lumen-attest-section-label">How was AI involved?</div>
      <div class="lumen-level-chips">${levelChips()}</div>
      <div class="lumen-attest-section-label">This reply</div>
      <div class="lumen-attest-observed">${observedHtml()}</div>
      ${toolsSection}
      <p class="lumen-attest-scope">${NomonBadge.SCOPE_DISCLAIMER}</p>
      <div class="lumen-attest-section-label">Process note (optional)</div>
      <textarea class="lumen-card-reflection lumen-attest-note" maxlength="200" placeholder="e.g. Outlined in Claude; final draft in ChatGPT"></textarea>
      <div class="lumen-attest-section-label">Preview</div>
      <div class="lumen-attest-preview">${previewHtml()}</div>
      <div class="lumen-card-actions lumen-attest-actions">
        <button class="lumen-card-btn" data-action="copy-html">Copy for email &amp; docs</button>
        <button class="lumen-card-btn lumen-card-btn--secondary" data-action="copy-text">Copy plain text</button>
        <button class="lumen-card-btn lumen-card-btn--ghost" data-action="copy-json">Copy JSON</button>
        <button class="lumen-card-btn lumen-card-btn--ghost" data-action="cancel">Cancel</button>
      </div>
    `;

      bindLevelChips(card);
      bindPlatformChips(card);
      card.querySelector('[data-action="copy-html"]')?.addEventListener("click", () => finalizeCopy("html"));
      card.querySelector('[data-action="copy-text"]')?.addEventListener("click", () => finalizeCopy("text"));
      card.querySelector('[data-action="copy-json"]')?.addEventListener("click", () => finalizeCopy("json"));
      card.querySelector('[data-action="cancel"]')?.addEventListener("click", () => closeAttestComposer(msg.id));
    }

    function bindLevelChips(root) {
      root.querySelectorAll(".lumen-level-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          selectedLevel = chip.getAttribute("data-level");
          root.querySelector(".lumen-level-chips").innerHTML = levelChips();
          root.querySelector(".lumen-attest-preview").innerHTML = previewHtml();
          bindLevelChips(root);
        });
      });
    }

    function bindPlatformChips(root) {
      root.querySelectorAll(".lumen-platform-chip:not(.lumen-platform-chip--locked)").forEach((chip) => {
        chip.addEventListener("click", () => {
          const host = chip.getAttribute("data-platform");
          if (!host || host === ctx.platform) return;
          if (selectedPlatforms.has(host)) selectedPlatforms.delete(host);
          else selectedPlatforms.add(host);
          selectedPlatforms.add(ctx.platform);
          const chips = root.querySelector(".lumen-platform-chips");
          if (chips) chips.innerHTML = platformChips();
          root.querySelector(".lumen-attest-preview").innerHTML = previewHtml();
          bindPlatformChips(root);
        });
      });
    }

    renderComposerBody();

    async function finalizeCopy(kind) {
      const processNote = card.querySelector(".lumen-attest-note")?.value || "";
      const attestation = await NomonBadge.buildAttestation({
        msg,
        level: selectedLevel,
        processNote,
        messages,
        session,
        selectedPlatforms: Array.from(selectedPlatforms),
      });
      LumenSession.saveAttestation(attestation);
      renderAttestationsList();

      let ok = false;
      if (kind === "html") {
        ok = await copyRichToClipboard(attestation.exports.html, attestation.exports.plaintext);
      } else if (kind === "json") {
        ok = await copyToClipboard(NomonBadge.exportJson(attestation));
      } else {
        ok = await copyToClipboard(attestation.exports.plaintext);
      }
      if (ok) renderAttestSuccess(card, msg.id);
      else card.querySelector(".lumen-attest-actions")?.insertAdjacentHTML("beforebegin", `<p class="lumen-attest-error">Could not copy — select and copy manually from preview.</p>`);
    }

    anchor.insertAdjacentElement("afterend", card);
    card.querySelector(".lumen-attest-note")?.focus();
  }

  function injectAttestUI(msg, messages, adapter) {
    if (!globalThis.NomonBadge || !adapter?.findAssistantMessageWrapper) return;
    if (LumenGoals.isPaused()) return;
    if (!LumenGoals.isBadgeEnabled?.()) {
      document.querySelector(`.lumen-attest-row[data-lumen-msg-id="${msg.id}"]`)?.remove();
      document.querySelector(`.lumen-card--attest[data-lumen-msg-id="${msg.id}"]`)?.remove();
      return;
    }

    const attestedIds = new Set(
      (LumenSession.getAttestations?.() || [])
        .map((a) => a.artifact?.messageId)
        .filter(Boolean)
    );
    if (!NomonBadge.isBadgeable(msg, attestedIds)) {
      document.querySelector(`.lumen-attest-row[data-lumen-msg-id="${msg.id}"]`)?.remove();
      return;
    }

    const wrapper = adapter.findAssistantMessageWrapper(msg.el);
    if (!wrapper) return;

    const bubble =
      wrapper.querySelector(".markdown, .prose, [class*='markdown']")?.parentElement || wrapper;

    let row = document.querySelector(`.lumen-attest-row[data-lumen-msg-id="${msg.id}"]`);
    if (!row) {
      row = document.createElement("div");
      row.className = "lumen-attest-row";
      row.setAttribute("data-lumen-msg-id", msg.id);
      row.innerHTML = `<button type="button" class="lumen-attest-strip" title="Add a Nomon disclosure badge — say how you used AI for this reply">
        <span class="lumen-attest-mark" aria-hidden="true">
          <span class="lumen-attest-dot lumen-attest-dot--g"></span>
          <span class="lumen-attest-dot lumen-attest-dot--a"></span>
          <span class="lumen-attest-dot lumen-attest-dot--p"></span>
          <span class="lumen-attest-dot lumen-attest-dot--b"></span>
        </span>
        <span class="lumen-attest-strip-body">
          <span class="lumen-attest-strip-brand">Nomon</span>
          <span class="lumen-attest-strip-label">Disclose how you used AI</span>
          <span class="lumen-attest-strip-hint">works across all your AIs</span>
        </span>
        <span class="lumen-attest-strip-chevron" aria-hidden="true">›</span>
      </button>`;
      row.setAttribute("data-lumen-theme", isHostDark() ? "dark" : "light");
      bubble.insertAdjacentElement("afterend", row);
      row.querySelector(".lumen-attest-strip")?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (openAttestMsgId === msg.id) {
          closeAttestComposer(msg.id);
          return;
        }
        openAttestComposer(msg, messages, adapter, row);
      });
    }

    if (openAttestMsgId === msg.id && !document.querySelector(`.lumen-card--attest[data-lumen-msg-id="${msg.id}"]`)) {
      openAttestComposer(msg, messages, adapter, row);
    }

    row.setAttribute("data-lumen-theme", isHostDark() ? "dark" : "light");
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
      if (options.isNewMessage || options.fromJudge) flashFabForEvaluation(evaluation, options);
    } else if (options.fromJudge && lastEvaluation?.msgId === msg.id) {
      lastEvaluation = {
        msgId: msg.id,
        evaluation,
        snippet: msg.text.slice(0, 120),
      };
    } else if (options.isNewMessage) {
      flashFabForEvaluation(evaluation, options);
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
    const colors = signalColors();
    if (evaluation.primary === "mismatch" && evaluation.mismatch?.active && LumenGoals.isActive()) {
      return {
        signal: "mismatch",
        label: evaluation.mismatch.label,
        color: colors.mismatch,
      };
    }
    if (evaluation.primary === "depth" && evaluation.depth?.active && LumenGoals.isActive()) {
      return {
        signal: "depth",
        label: evaluation.depth.label,
        color: colors.depth,
      };
    }
    if (evaluation.primary === "handoff" && evaluation.handoff?.active) {
      return {
        signal: "handoff",
        label: evaluation.handoff.label,
        color: colors.handoff,
      };
    }
    if (evaluation.primary === "drift" && evaluation.drift?.active) {
      return {
        signal: "drift",
        label: evaluation.drift.label,
        color: colors.drift,
      };
    }
    if (evaluation.primary === "loop" && evaluation.loop?.active) {
      const score = evaluation.loopScore || 0;
      return {
        signal: "loop",
        label: evaluation.loop.label,
        color: score >= 40 ? colors.handoff : colors.loop,
      };
    }

    return null;
  }

  const STRIP_SIGNAL_NAMES = {
    handoff: "Hand-off",
    loop: "Loop",
    drift: "Drift",
    mismatch: "Mismatch",
    depth: "Depth",
  };

  function splitStripLabel(signal, label) {
    const raw = String(label || "").trim();
    const parts = raw.split(/\s*·\s*/);
    const name = STRIP_SIGNAL_NAMES[signal] || (parts[0] ? parts[0].replace(/^\w/, (c) => c.toUpperCase()) : "Signal");
    const sub = parts.length > 1 ? `· ${parts.slice(1).join(" · ")}` : "";
    return { name, sub };
  }

  function stripTipHtml(signal, label, explanation) {
    const name = STRIP_SIGNAL_NAMES[signal] || "Signal";
    const body = (explanation || label || "").trim();
    const safeBody = escapeHtml(body);
    return `<b>${escapeHtml(name)}.</b> ${safeBody}`;
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

    const { label, signal, color } = display;
    const theme = isHostDark() ? "dark" : "light";
    const { name, sub } = splitStripLabel(signal, label);
    const tip = stripTipHtml(signal, label, evaluation.explanation);
    const stateText = LumenNudges.truncate(label);
    const dotColor = color || SIGNAL_COLORS_LIGHT[signal] || "#9a9aa5";

    if (existing) {
      existing.setAttribute("data-lumen-signal", signal);
      existing.setAttribute("data-lumen-theme", theme);
      const nameEl = existing.querySelector(".lumen-strip-name");
      const subEl = existing.querySelector(".lumen-strip-sub");
      const stateEl = existing.querySelector(".lumen-strip-state");
      const tipEl = existing.querySelector(".lumen-strip-tip");
      const dotEl = existing.querySelector(".lumen-strip-dot");
      if (nameEl) nameEl.textContent = name;
      if (subEl) {
        subEl.textContent = sub;
        subEl.classList.toggle("lumen-hidden", !sub);
      }
      if (stateEl) stateEl.textContent = stateText;
      if (tipEl) tipEl.innerHTML = tip;
      if (dotEl) dotEl.style.background = dotColor;
      return existing;
    }

    const strip = document.createElement("div");
    strip.className = "lumen-strip";
    strip.setAttribute("data-lumen-msg-id", msgId);
    strip.setAttribute("data-lumen-signal", signal);
    strip.setAttribute("data-lumen-theme", theme);
    strip.innerHTML = `
      <span class="lumen-strip-dot" style="background:${dotColor}" aria-hidden="true"></span>
      <span class="lumen-strip-name">${escapeHtml(name)}</span>
      <span class="lumen-strip-sub${sub ? "" : " lumen-hidden"}">${escapeHtml(sub)}</span>
      <span class="lumen-strip-state lumen-hidden">${escapeHtml(stateText)}</span>
      <span class="lumen-strip-arrow" aria-hidden="true">›</span>
      <span class="lumen-strip-tip">${tip}</span>
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
    watchHostTheme();
    // Note: onboarding is intentionally NOT shown here. init() runs before
    // storage has loaded, when goals still hold defaults (onboardingComplete
    // === false), so showing it now would re-open the setup cards for returning
    // users on every load. content.js calls showOnboardingIfNeeded() once
    // storage has loaded.
    updateBadge();
    playFabLoadAnimation();
    globalThis.LumenCostLedger?.onChange?.(() => {
      syncCostSavingsBlurb();
    });
  }

  return {
    init,
    updateBadge,
    refreshPopover,
    showOnboardingIfNeeded,
    startTour,
    injectMessageUI,
    injectAttestUI,
    maybeShowDigestReady,
    showGuardHold,
    renderCostCoach,
    clearCostCoach,
    playPendingCostSaveCoin,
    /** Dev/test: force the piggy-bank animation, e.g. LumenWidget.debugCostCoin(0.006) */
    debugCostCoin: (usd = 0.0061) => playCostSaveCoin(usd),
  };
})();

globalThis.LumenWidget = LumenWidget;
