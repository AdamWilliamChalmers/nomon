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
    { value: "focus", label: "Focus", blurb: "Active, plus a goal you declare for this session." },
  ];

  const DEFAULTS = {
    onboardingComplete: false,
    mode: "ambient",
    // True off-switch: pauses tracking and nudges everywhere until resumed.
    paused: false,
    useCases: [],
    protectedGoals: [],
    focusGoal: null,
    llmJudgeEnabled: false,
    judgeApiUrl: LumenConfig.judgeApiUrl(),
    webAppUrl: LumenConfig.webAppUrl(),
    studyParticipant: false,
    // Privacy-by-default: no session data leaves the device unless the user
    // explicitly opts in. Gates postSessionSummary egress (see session.js).
    shareAnonymisedData: false,
    crowdCalibration: null,
    fabPosition: null,
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
    return save({ onboardingComplete: true, mode: "ambient", protectedGoals: [] });
  }

  function removeProtectedGoal(goal) {
    const protectedGoals = cache.protectedGoals.filter((item) => item !== goal);
    return save({ protectedGoals });
  }

  function isGhost() {
    return cache.mode === "ghost";
  }

  function isActive() {
    return cache.mode === "active" || cache.mode === "focus";
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

  return {
    get,
    load,
    save,
    completeOnboarding,
    skipOnboarding,
    removeProtectedGoal,
    addTaskTypeExemption,
    getTaskTypeExemptions,
    taskTypeLabel,
    isGhost,
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
  };
})();

globalThis.LumenGoals = LumenGoals;
