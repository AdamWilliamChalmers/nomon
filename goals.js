const LumenGoals = (() => {
  const STORAGE_KEY = "lumenUserGoals";
  const EXEMPTIONS_KEY = "lumenTaskTypeExemptions";

  // Mode is the single dial for how present Lumen is — it governs tracking,
  // nudges, and the FAB's look, not just "visibility". Copy lives here so the
  // popover helper line, onboarding, and landing page stay in sync.
  const MODES = [
    { value: "ambient", label: "Ambient", blurb: "Subtle inline cues beside your messages — never a pop-up. The default." },
    { value: "ghost", label: "Ghost", blurb: "Nothing in-session — you only get the weekly digest." },
    { value: "active", label: "Active", blurb: "Inline cues plus reflection cards when it matters." },
    {
      value: "guard",
      label: "Guard",
      blurb: "Active, plus a brief hold before send when a prompt clearly conflicts with a protected goal. Always bypassable.",
    },
  ];

  const DEFAULTS = {
    onboardingComplete: false,
    mode: "ambient",
    // True off-switch: pauses tracking and nudges everywhere until resumed.
    paused: false,
    useCases: [],
    protectedGoals: [],
    // On by default: the LLM "second opinion" catches the subtle hand-offs the
    // local rules miss. It sends only borderline prompts to the configured
    // backend — disclosed in onboarding + settings, and toggleable from the pill
    // (turn off to stay fully on-device).
    llmJudgeEnabled: true,
    judgeApiUrl: LumenConfig.judgeApiUrl(),
    webAppUrl: LumenConfig.webAppUrl(),
    studyParticipant: false,
    // Privacy-by-default: no session data leaves the device unless the user
    // explicitly opts in. Gates postSessionSummary egress (see session.js).
    shareAnonymisedData: false,
    crowdCalibration: null,
    fabPosition: null,
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
    // Timestamp (ms) the user last saw the "still the right goals?" prompt in
    // the weekly review. Drives a gentle ~monthly cadence so the invitation to
    // revisit setup never becomes a weekly nag.
    lastSetupReviewAt: null,
    // Runtime-only: set by fetchJudgeCapability(), never persisted.
    judgeAvailable: false,
  };

  let cache = { ...DEFAULTS };
  let taskTypeExemptions = [];

  function get() {
    return { ...cache };
  }

  function apply(data) {
    cache = { ...DEFAULTS, ...data };
    // Focus mode was removed; migrate anyone still on it (and its session goal)
    // to Active — the mode Focus was built on top of.
    if (cache.mode === "focus") cache.mode = "active";
    delete cache.focusGoal;
    return cache;
  }

  function load() {
    return new Promise((resolve) => {
      const finish = (goalsData, exemptions) => {
        apply(goalsData || DEFAULTS);
        taskTypeExemptions = exemptions || [];
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
    cache = { ...cache, ...next };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (_) {
      // ignore
    }
    if (chrome?.storage?.sync?.set) {
      chrome.storage.sync.set({ [STORAGE_KEY]: cache }, () => void chrome.runtime?.lastError);
    }
    return cache;
  }

  function completeOnboarding({ useCases, protectedGoals, mode }) {
    return save({
      onboardingComplete: true,
      useCases: useCases || [],
      protectedGoals: protectedGoals || [],
      mode: mode || "ambient",
    });
  }

  function skipOnboarding() {
    // Skipping just dismisses the setup flow — it must never wipe answers the
    // user may have already set inline (mode, protected goals, use cases).
    // Lumen simply runs on whatever is currently configured (Ambient default).
    return save({ onboardingComplete: true, mode: cache.mode || "ambient" });
  }

  function setUseCases(useCases) {
    return save({ useCases: Array.isArray(useCases) ? useCases : [] });
  }

  function removeProtectedGoal(goal) {
    const protectedGoals = cache.protectedGoals.filter((item) => item !== goal);
    return save({ protectedGoals });
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

  function setPaused(value) {
    return save({ paused: Boolean(value) });
  }

  function modeMeta(mode = cache.mode) {
    return MODES.find((m) => m.value === mode) || MODES[0];
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
    completeOnboarding,
    skipOnboarding,
    setUseCases,
    removeProtectedGoal,
    addTaskTypeExemption,
    getTaskTypeExemptions,
    taskTypeLabel,
    isGhost,
    isGuard,
    isActive,
    isPaused,
    setPaused,
    modeMeta,
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
    isSetupReviewDue,
    markSetupReviewSeen,
  };
})();

globalThis.LumenGoals = LumenGoals;
