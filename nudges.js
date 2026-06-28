const LumenNudges = (() => {
  const HANDOFF_LABEL = "hand-off · what do you already know?";

  const LOOP_NUDGES = {
    default: "loop · still reading?",
    mid: "loop · what would you change here?",
    high: "loop · reading this, or moving on?",
    passive: (count) => `loop · ${count} messages, mostly passive`,
    promptLength: "loop · what do you already know?",
    velocity: "loop · what's the core question?",
    passiveAcceptance: "loop · what surprised you?",
  };

  const DEPTH_PLACEHOLDERS = {
    decision: "What's your instinct before the AI answers?",
    learning: "What do you already know that's relevant here?",
    authorship: "What would you write differently here, even in rough notes?",
    default: "What's worth sitting with before you ask?",
  };

  const TASK_TYPE_PHRASES = {
    essay_writing: "an essay",
    argument_building: "an argument",
    literature_search: "research with citations",
    code_generation: "code",
    email_drafting: "an email",
    general: "this task",
  };

  const DIGEST_PROMPTS = [
    "What did you figure out yourself this week, without AI?",
    "Was there a moment where you surprised yourself?",
    "What would you do differently if AI disappeared tomorrow?",
    "When did you engage most critically with an answer this week?",
  ];

  function truncate(text, max = 40) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "…";
  }

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function taskTypePhrase(taskType) {
    return TASK_TYPE_PHRASES[taskType] || TASK_TYPE_PHRASES.general;
  }

  function getHandOffLabel() {
    return truncate(HANDOFF_LABEL);
  }

  function getLoopLabel(signals, loopScore, passiveCount) {
    if (loopScore >= 70) return truncate(LOOP_NUDGES.high);
    if (loopScore >= 40) return truncate(LOOP_NUDGES.mid);
    if (passiveCount >= 3) return truncate(LOOP_NUDGES.passive(passiveCount));

    let dominant = "promptLength";
    let max = signals.promptLength;
    for (const key of ["velocity", "passiveAcceptance", "taskFraming"]) {
      if (signals[key] > max) {
        max = signals[key];
        dominant = key;
      }
    }
    if (max >= 60 && LOOP_NUDGES[dominant]) return truncate(LOOP_NUDGES[dominant]);
    return truncate(LOOP_NUDGES.default);
  }

  function getHandOffOverlayCopy(taskType) {
    return {
      kicker: "Lumen · hand-off",
      title: "Before you hand this over",
      body: `You're asking for ${taskTypePhrase(taskType)} in one go — which is fine. Even a rough paragraph first changes what you get back.`,
      draftLabel: "I'll draft something",
      continueLabel: "Continue — show answer",
      draftPlaceholder: "Your rough draft — even one sentence…",
      submitLabel: "Submit my draft + ask AI",
    };
  }

  function getLoopOverlayCopy() {
    return {
      kicker: "Lumen · loop",
      title: "Still evaluating?",
      body: "Last few messages: short requests, long responses, no questions back. Not a problem — just worth noticing. Still tracking the reasoning?",
      draftLabel: "Let me think first",
      continueLabel: "Continue — show answer",
      draftPlaceholder: "What's your take so far — even one sentence…",
      submitLabel: "Submit my thoughts + continue",
    };
  }

  function buildCombinedPrompt(userDraft, originalPrompt) {
    return `Here's my starting point:\n\n"${userDraft}"\n\n${originalPrompt}`;
  }

  function getMismatchLabel(goal) {
    const short = goal.length > 22 ? goal.slice(0, 19) + "…" : goal;
    return truncate(`mismatch · this conflicts with your goal`);
  }

  function getMismatchCardCopy(goal, mismatchCount) {
    if (mismatchCount >= 3) {
      return {
        title: "You said something different",
        body: `When you set up Lumen, you said: "${goal}". You've handed this over ${mismatchCount} times today. Still the plan?`,
        keepLabel: "Still my goal",
        continueLabel: "My goal changed — stop flagging",
      };
    }
    return {
      title: "You said something different",
      body: `When you set up Lumen, you said: "${goal}". This prompt hands that over. Still the plan?`,
      keepLabel: "Still my goal",
      continueLabel: "My goal changed — stop flagging",
    };
  }

  function getDepthCardCopy(taskType, warm) {
    if (warm) {
      return {
        title: "This one might be worth thinking through",
        body: "This is the kind of question where your instinct matters. Worth a thought before you read the answer?",
        placeholder: DEPTH_PLACEHOLDERS[taskType] || DEPTH_PLACEHOLDERS.default,
        thinkLabel: "Let me think first",
        skipLabel: "Skip",
      };
    }
    return {
      title: "This one might be worth thinking through",
      body: "This is the kind of question where your instinct matters. Worth a thought before you read the answer?",
      placeholder: DEPTH_PLACEHOLDERS[taskType] || DEPTH_PLACEHOLDERS.default,
      thinkLabel: "Let me think first",
      skipLabel: "Skip",
    };
  }

  function getDepthOverlayCopy(taskType) {
    return {
      kicker: "Lumen · depth",
      title: "This one might be worth thinking through",
      body: "This is the kind of question where your instinct matters. Worth a thought before you read the answer?",
      draftLabel: "Let me think first",
      continueLabel: "Skip — show answer",
      draftPlaceholder: DEPTH_PLACEHOLDERS[taskType] || DEPTH_PLACEHOLDERS.default,
      submitLabel: "Done thinking — show answer",
    };
  }

  function detectDepthTaskType(text) {
    if (/should i|how do i decide|is it worth|what career/i.test(text)) return "decision";
    if (/i want to understand|help me learn/i.test(text)) return "learning";
    if (/write my|create my/i.test(text)) return "authorship";
    return "default";
  }

  function isHighStakesDepth(text) {
    return /should i|what career|how do i decide|write my|create my/i.test(text);
  }

  // Efficacy = did a nudge change the next action? We count the concrete
  // engaged responses the user already logged (drafted first / reflected /
  // paused) against the times they skipped or bypassed.
  function summariseResponses(digestLog = {}) {
    const breaks = digestLog.loopBreaks || [];
    const depthLog = digestLog.depthMoments || [];
    const mismatchLog = digestLog.mismatchEvents || [];
    const overlayLog = digestLog.overlayEvents || [];

    const drafted = breaks.filter(
      (b) => b.action === "draft-first" || b.action === "draft-submitted"
    ).length;
    const reflected = depthLog.filter((d) => d.action === "reflected").length;
    const paused = mismatchLog.filter((m) => m.choice === "kept" || m.choice === "pause").length;
    const engaged = drafted + reflected + paused;

    const skipped =
      depthLog.filter((d) => d.action === "skip").length +
      overlayLog.filter((o) => o.overlayBypassed).length;

    const total = engaged + skipped;
    const rate = total ? Math.round((engaged / total) * 100) : 0;
    const line = total
      ? `You engaged on ${engaged} of ${total} nudges (${rate}%) — drafted ${drafted}, reflected ${reflected}, reaffirmed ${paused}.`
      : "No nudges to respond to yet — keep going.";

    return { engaged, skipped, total, rate, drafted, reflected, paused, line };
  }

  function buildDigest({ history, session, digestLog }) {
    const week = history.slice(-7);
    const avgQuestion =
      week.length ? week.reduce((s, e) => s + e.questionRatio, 0) / week.length : 0;
    const prior = history.slice(-14, -7);
    const priorQuestion =
      prior.length ? prior.reduce((s, e) => s + e.questionRatio, 0) / prior.length : avgQuestion;

    let headline = "Mostly steady engagement this week.";
    if (avgQuestion < priorQuestion - 0.08) headline = "Slightly more passive than last week.";
    if (avgQuestion > priorQuestion + 0.08) headline = "More questioning and critical engagement this week.";

    const loopTrend = session.loopScores.slice(-7);
    const driftLines = week.length
      ? [
          `Questions: ${Math.round(avgQuestion * 100)}% of messages`,
          `Avg prompt length: ${Math.round(week.reduce((s, e) => s + e.avgPromptLength, 0) / week.length)} words`,
          `Passive replies: ${Math.round(week.reduce((s, e) => s + e.passiveRate, 0) / week.length * 100)}%`,
        ]
      : ["Not enough data yet — keep chatting with Lumen active."];

    return {
      headline,
      loopTrend,
      driftLines,
      depthMoments: (digestLog.depthMoments || []).slice(-3),
      mismatchSummary: `${session.mismatchCount || 0} intention checks this session`,
      responses: summariseResponses(digestLog),
      prompt: pickRandom(DIGEST_PROMPTS),
    };
  }

  return {
    truncate,
    getHandOffLabel,
    getLoopLabel,
    getHandOffOverlayCopy,
    getLoopOverlayCopy,
    buildCombinedPrompt,
    getMismatchLabel,
    getMismatchCardCopy,
    getDepthCardCopy,
    getDepthOverlayCopy,
    detectDepthTaskType,
    isHighStakesDepth,
    summariseResponses,
    buildDigest,
  };
})();

globalThis.LumenNudges = LumenNudges;
