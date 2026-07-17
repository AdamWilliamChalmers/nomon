const LumenGoals = (() => {
  const chrome = globalThis.chrome;
  const chromeApi = chrome;
  const STORAGE_KEY = "lumenUserGoals";
  const EXEMPTIONS_KEY = "lumenTaskTypeExemptions";

  // Mode is the single dial for how present Lumen is — it governs tracking,
  // nudges, and the FAB's look, not just "visibility". Copy lives here so the
  // popover helper line, onboarding, and landing page stay in sync.
  const MODES = [
    { value: "ambient", label: "Ambient", blurb: "Subtle inline cues beside your messages — never a pop-up." },
    { value: "ghost", label: "Ghost", blurb: "Nothing in-session — you only get the weekly digest." },
    { value: "active", label: "Active", blurb: "Inline cues plus reflection cards when it matters. The default." },
    {
      value: "guard",
      label: "Guard",
      blurb: "Active, plus a brief hold before send when a prompt clearly conflicts with a protected goal. Always bypassable.",
    },
  ];

  // Everything is opt-OUT by default: a fresh user starts with every AI use
  // case and every protected goal switched on, and trims down what doesn't
  // apply (rather than having to opt in). These must mirror the option lists in
  // the onboarding cards / popover so "select all" and "the defaults" match.
  const DEFAULT_USE_CASES = [
    "Research",
    "Writing",
    "Coding",
    "Learning",
    "Admin",
    "Creative work",
    "Work tasks",
  ];
  const DEFAULT_PROTECTED_GOALS = [
    "Write my own first drafts",
    "Make my own decisions",
    "Understand the code, not just copy it",
    "Do my own analysis and reasoning",
    "Think independently on strategy",
    "Form my own arguments before asking",
  ];

  const DEFAULTS = {
    onboardingComplete: false,
    mode: "active",
    // True off-switch: pauses tracking and nudges everywhere until resumed.
    paused: false,
    useCases: [...DEFAULT_USE_CASES],
    protectedGoals: [...DEFAULT_PROTECTED_GOALS],
    // On by default: the LLM "second opinion" catches the subtle hand-offs the
    // local rules miss. It sends only borderline prompts to the configured
    // backend — disclosed in onboarding + settings, and toggleable from the pill
    // (turn off to stay fully on-device).
    llmJudgeEnabled: true,
    judgeApiUrl: LumenConfig.judgeApiUrl(),
    webAppUrl: LumenConfig.webAppUrl(),
    // On by default (opt-out): post-session survey when leaving a tab.
    studyParticipant: true,
    // On by default (opt-out): anonymised session summaries shared on tab close.
    // Gates postSessionSummary egress (see session.js).
    shareAnonymisedData: true,
    crowdCalibration: null,
    fabPosition: null,
    // Which pillar the resting FAB represents (Mirror / Badge / Cost). Clicking
    // the pill opens the panel scrolled to that pillar; the pill's label/glyph
    // reflect that pillar's status. No hover-expand rail — keeps the FAB small
    // and draggable.
    fabPillar: "mirror",
    // ISO week (e.g. "2026-W27") the user last viewed or dismissed their weekly
    // digest for. Drives the "digest ready" FAB indicator: while this differs
    // from the current ISO week, the indicator persists across page loads until
    // the user opens the digest or dismisses it. Synced so the nudge doesn't
    // re-fire on every device.
    lastDigestSeenWeek: null,
    // First-run setup is now a quiet, optional invitation (not a blocking
    // modal). This flag records that the one-time gentle pill pulse/hello has
    // already played, so we never replay it on later loads.
    setupInviteSeen: false,
    // Records that the "How it works" tutorial has auto-run once. It opens a
    // single time on first use (then hands off to setup) and is otherwise
    // replay-only via the pill's "How it works" button. Synced so it doesn't
    // re-fire on another device/tab.
    tutorialSeen: false,
    // Timestamp (ms) the user last saw the "still the right goals?" prompt in
    // the weekly review. Drives a gentle ~monthly cadence so the invitation to
    // revisit setup never becomes a weekly nag.
    lastSetupReviewAt: null,
    // Runtime-only: set by fetchJudgeCapability(), never persisted.
    judgeAvailable: false,
    // Cost coach — OPT-IN. Orthogonal to Ghost/Ambient/Active/Guard.
    // When on, analyzes the composer draft on-device (never uploaded for cost).
    costEnabled: false,
    // "subtle" = one-line strip; "full" = strip + tip panel.
    costLevel: "subtle",
    // When on, Cost coach auto-clicks the host model picker for switch tips.
    costAutoSwitch: false,
    // Optional override; null → hostname heuristic (Claude→Sonnet, etc.).
    costPreferredModel: null,
    // Used for $/month projections in tips.
    costMonthlyVolume: 1000,
    costAssumedOutput: 400,
  };

  const VALID_MODES = new Set(MODES.map((m) => m.value));

  let cache = { ...DEFAULTS };
  let taskTypeExemptions = [];
  const changeListeners = new Set();
  // Bumped on every save() so an in-flight load() cannot apply stale sync data
  // over a mode (or other setting) the user just wrote.
  let storageGeneration = 0;

  function notifyChange() {
    changeListeners.forEach((cb) => {
      try {
        cb(get());
      } catch (_) {
        // ignore listener errors
      }
    });
  }

  function onChange(cb) {
    if (typeof cb !== "function") return () => {};
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  }

  function get() {
    return { ...cache };
  }

  function normalizeMode(mode) {
    if (mode === "focus") return "active";
    return VALID_MODES.has(mode) ? mode : DEFAULTS.mode;
  }

  function apply(data) {
    cache = { ...DEFAULTS, ...data };
    cache.mode = normalizeMode(cache.mode);
    delete cache.focusGoal;
    return cache;
  }

  function load() {
    const generation = storageGeneration;
    return new Promise((resolve) => {
      const finish = (goalsData, exemptions) => {
        if (generation !== storageGeneration) {
          resolve(cache);
          return;
        }
        apply(goalsData || DEFAULTS);
        taskTypeExemptions = exemptions || [];
        notifyChange();
        resolve(cache);
      };

      if (!chrome?.storage?.sync?.get) {
        try {
          finish(
            JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
            JSON.parse(localStorage.getItem(EXEMPTIONS_KEY) || "[]")
          );
        } catch (_) {
          finish(null, []);
        }
        return;
      }

      chrome.storage.sync.get([STORAGE_KEY, EXEMPTIONS_KEY], (result) => {
        if (chrome.runtime?.lastError || result == null) {
          try {
            finish(
              JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
              JSON.parse(localStorage.getItem(EXEMPTIONS_KEY) || "[]")
            );
          } catch (_) {
            finish(null, []);
          }
          return;
        }
        finish(result[STORAGE_KEY], result[EXEMPTIONS_KEY]);
      });
    });
  }

  function save(next) {
    storageGeneration += 1;
    const generationAtSave = storageGeneration;
    const includesMode = Object.prototype.hasOwnProperty.call(next, "mode");
    cache = { ...cache, ...next };
    if (includesMode) cache.mode = normalizeMode(cache.mode);

    const persistLocal = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      } catch (_) {
        // ignore
      }
    };

    const pushSync = (payload) => {
      if (chromeApi?.storage?.sync?.set) {
        chromeApi.storage.sync.set({ [STORAGE_KEY]: payload }, () => void chrome.runtime?.lastError);
      }
    };

    const finish = () => {
      persistLocal();
      pushSync(cache);
      notifyChange();
    };

    if (includesMode || !chromeApi?.storage?.sync?.get) {
      finish();
      return cache;
    }

    // Saving goals/toggles (not mode): merge the latest synced mode first so a
    // stale tab cannot clobber Ghost/Ambient/etc. set on another AI tab.
    chromeApi.storage.sync.get(STORAGE_KEY, (result) => {
      if (generationAtSave !== storageGeneration) return;
      const remote = result?.[STORAGE_KEY];
      if (remote?.mode) {
        const remoteMode = normalizeMode(remote.mode);
        if (remoteMode !== cache.mode) {
          cache.mode = remoteMode;
          persistLocal();
        }
      }
      finish();
    });
    return cache;
  }

  // Re-read synced settings from storage (e.g. after edits on another AI tab).
  function refresh() {
    return load();
  }

  if (chromeApi?.storage?.onChanged?.addListener) {
    chromeApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      if (!changes?.[STORAGE_KEY]) return;
      storageGeneration += 1;
      apply(changes[STORAGE_KEY].newValue || DEFAULTS);
      notifyChange();
    });
  }

  function completeOnboarding({ useCases, protectedGoals, mode }) {
    return save({
      onboardingComplete: true,
      useCases: useCases || [],
      protectedGoals: protectedGoals || [],
      mode: mode || "active",
    });
  }

  function skipOnboarding() {
    // Skipping just dismisses the setup flow — it must never wipe answers the
    // user may have already set inline (mode, protected goals, use cases).
    // Lumen simply runs on whatever is currently configured (Active default).
    return save({ onboardingComplete: true, mode: cache.mode || "active" });
  }

  function setUseCases(useCases) {
    return save({ useCases: Array.isArray(useCases) ? useCases : [] });
  }

  function removeProtectedGoal(goal) {
    const protectedGoals = cache.protectedGoals.filter((item) => item !== goal);
    return save({ protectedGoals });
  }

  function listPresetGoals() {
    return [...DEFAULT_PROTECTED_GOALS];
  }

  function splitProtectedGoals(protectedGoals = []) {
    const presetSet = new Set(DEFAULT_PROTECTED_GOALS);
    return {
      presetGoals: protectedGoals.filter((goal) => presetSet.has(goal)),
      customGoals: protectedGoals.filter((goal) => !presetSet.has(goal)),
    };
  }

  function mergeProtectedGoals({ presetGoals = [], customGoals = [] } = {}) {
    const presetSet = new Set(DEFAULT_PROTECTED_GOALS);
    const presets = presetGoals.filter((goal) => presetSet.has(goal));
    const custom = customGoals.filter((goal) => goal && !presetSet.has(goal));
    return Array.from(new Set([...presets, ...custom]));
  }

  function isGhost() {
    return cache.mode === "ghost";
  }

  function isGuard() {
    return cache.mode === "guard";
  }

  function isActive() {
    return cache.mode === "active" || cache.mode === "guard";
  }

  function isPaused() {
    return Boolean(cache.paused);
  }

  /** Cost coach master switch (respects Pause). Independent of Ghost mode. */
  function isCostEnabled() {
    return !isPaused() && Boolean(cache.costEnabled);
  }

  function costLevel() {
    if (!isCostEnabled()) return "off";
    return cache.costLevel === "full" ? "full" : "subtle";
  }

  /** Auto-switch recommended model in the host picker (requires Cost coach on). */
  function isCostAutoSwitch() {
    return isCostEnabled() && Boolean(cache.costAutoSwitch);
  }

  function setPaused(value) {
    return save({ paused: Boolean(value) });
  }

  function modeMeta(mode = cache.mode) {
    const normalized = normalizeMode(mode);
    return MODES.find((m) => m.value === normalized) || MODES.find((m) => m.value === DEFAULTS.mode);
  }

  function listModes() {
    return MODES.map((m) => ({ ...m }));
  }

  function addTaskTypeExemption(taskType) {
    if (!taskType || taskTypeExemptions.includes(taskType)) return taskTypeExemptions;
    taskTypeExemptions = [...taskTypeExemptions, taskType];
    try {
      localStorage.setItem(EXEMPTIONS_KEY, JSON.stringify(taskTypeExemptions));
    } catch (_) {
      // ignore
    }
    if (chrome?.storage?.sync?.set) {
      chrome.storage.sync.set({ [EXEMPTIONS_KEY]: taskTypeExemptions }, () => void chrome.runtime?.lastError);
    }
    return taskTypeExemptions;
  }

  function getTaskTypeExemptions() {
    return [...taskTypeExemptions];
  }

  function taskTypeLabel(taskType) {
    return (taskType || "general").replace(/_/g, " ");
  }

  function checkMismatch(text) {
    return LumenRules.checkMismatchGoals(text, cache.protectedGoals);
  }

  function setStudyParticipant(enabled) {
    cache.studyParticipant = Boolean(enabled);
    save({ studyParticipant: cache.studyParticipant });
    if (chrome?.storage?.sync?.set) {
      chrome.storage.sync.set({ studyParticipant: cache.studyParticipant }, () => void chrome.runtime?.lastError);
    }
  }

  async function loadStudyParticipant() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.sync?.get) {
        resolve(cache.studyParticipant);
        return;
      }
      chrome.storage.sync.get("studyParticipant", (result) => {
        if (typeof result?.studyParticipant === "boolean") {
          cache.studyParticipant = result.studyParticipant;
        }
        resolve(cache.studyParticipant);
      });
    });
  }

  async function fetchCrowdCalibration() {
    const base = LumenConfig.webAppUrl(cache.webAppUrl);
    try {
      const res = await globalThis.LumenNet.fetch(`${base}/api/calibration/weights`, {
        cache: "no-store",
      });
      if (!res.ok) return cache.crowdCalibration;
      const data = await res.json();
      if (data?.ok) {
        cache.crowdCalibration = {
          taskTypeModifiers: data.taskTypeModifiers || {},
          loopThreshold: data.loopThreshold,
          sampleCount: data.sampleCount,
          updatedAt: data.updatedAt,
        };
      }
    } catch (_) {
      // web app may be offline during normal use
    }
    return cache.crowdCalibration;
  }

  function getCrowdCalibration() {
    return cache.crowdCalibration;
  }

  // Probe the backend for a configured LLM key and auto-enable the judge when
  // present. Runtime-only (not persisted) so it never clobbers an explicit
  // user choice in settings. Best-effort: web app may be offline.
  async function fetchJudgeCapability() {
    const base = LumenConfig.webAppUrl(cache.webAppUrl);
    try {
      const res = await globalThis.LumenNet.fetch(`${base}/api/judge`, { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      cache.judgeAvailable = Boolean(data?.llm);
    } catch (_) {
      cache.judgeAvailable = false;
    }
    return cache.judgeAvailable;
  }

  function isJudgeAvailable() {
    return Boolean(cache.judgeAvailable);
  }

  // ISO-8601 week string (Monday-start weeks, e.g. "2026-W27"). Gives everyone
  // the same weekly rhythm for the digest nudge rather than a rolling window.
  function currentIsoWeek(input = new Date()) {
    const date = new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = date.getTime();
    date.setUTCMonth(0, 1);
    if (date.getUTCDay() !== 4) {
      date.setUTCMonth(0, 1 + ((4 - date.getUTCDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - date.getTime()) / 604800000);
    const year = new Date(firstThursday).getUTCFullYear();
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  // True when the user hasn't yet viewed/dismissed the digest for this ISO week.
  function isDigestUnseenThisWeek() {
    return cache.lastDigestSeenWeek !== currentIsoWeek();
  }

  // Called when the user views or dismisses the weekly digest — stamps the
  // current week so the indicator clears and won't re-appear until next week.
  function markDigestSeen() {
    return save({ lastDigestSeenWeek: currentIsoWeek() });
  }

  // One-time record that the gentle first-run pill hello has played, so it
  // never repeats on later page loads.
  function markSetupInviteSeen() {
    return save({ setupInviteSeen: true });
  }

  // Whether the first-run "How it works" tutorial has already auto-opened.
  function isTutorialSeen() {
    return Boolean(cache.tutorialSeen);
  }

  // Stamp the tutorial as auto-run once so it never re-opens on its own; the
  // user can still replay it from the pill's "How it works" button.
  function markTutorialSeen() {
    return save({ tutorialSeen: true });
  }

  // Gentle ~monthly cadence for the "still the right goals?" prompt in the
  // weekly review. True on the first eligible review and then only once every
  // 28 days — never a weekly nag.
  const SETUP_REVIEW_INTERVAL_MS = 28 * 24 * 60 * 60 * 1000;
  function isSetupReviewDue(now = Date.now()) {
    const last = cache.lastSetupReviewAt;
    if (!last) return true;
    return now - last >= SETUP_REVIEW_INTERVAL_MS;
  }

  // Stamp the setup-review prompt as shown so it won't reappear for ~a month.
  function markSetupReviewSeen(now = Date.now()) {
    return save({ lastSetupReviewAt: now });
  }

  return {
    get,
    load,
    save,
    refresh,
    onChange,
    completeOnboarding,
    skipOnboarding,
    setUseCases,
    removeProtectedGoal,
    listPresetGoals,
    splitProtectedGoals,
    mergeProtectedGoals,
    addTaskTypeExemption,
    getTaskTypeExemptions,
    taskTypeLabel,
    isGhost,
    isGuard,
    isActive,
    isPaused,
    setPaused,
    isCostEnabled,
    costLevel,
    isCostAutoSwitch,
    modeMeta,
    normalizeMode,
    listModes,
    checkMismatch,
    setStudyParticipant,
    loadStudyParticipant,
    fetchCrowdCalibration,
    getCrowdCalibration,
    fetchJudgeCapability,
    isJudgeAvailable,
    currentIsoWeek,
    isDigestUnseenThisWeek,
    markDigestSeen,
    markSetupInviteSeen,
    isTutorialSeen,
    markTutorialSeen,
    isSetupReviewDue,
    markSetupReviewSeen,
  };
})();

globalThis.LumenGoals = LumenGoals;
