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
      kicker: "Nomon · hand-off",
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
      kicker: "Nomon · loop",
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
    const actions = {
      keepLabel: "Still my goal",
      dismissLabel: "Just this once",
      removeLabel: "Remove this goal",
    };
    if (mismatchCount >= 3) {
      return {
        title: "You said something different",
        body: `When you set up Nomon, you said: "${goal}". You've handed this over ${mismatchCount} times today. Still the plan?`,
        ...actions,
      };
    }
    return {
      title: "You said something different",
      body: `When you set up Nomon, you said: "${goal}". This prompt hands that over. Still the plan?`,
      ...actions,
    };
  }

  function getDepthCardCopy(taskType, warm) {
    const placeholder = DEPTH_PLACEHOLDERS[taskType] || DEPTH_PLACEHOLDERS.default;
    // Guard-only card: the AI reply is never delayed, so copy must not imply a gate.
    if (warm) {
      return {
        title: "This one might be worth thinking through",
        body: "Your read matters here. Optional — jot a note while the answer loads.",
        placeholder,
        thinkLabel: "Add a note",
        skipLabel: "Got it — just asking",
      };
    }
    return {
      title: "This one might be worth thinking through",
      body: "Your read matters here. Optional — jot a note while the answer loads.",
      placeholder,
      thinkLabel: "Add a note",
      skipLabel: "Got it — just asking",
    };
  }

  function getDepthOverlayCopy(taskType) {
    return {
      kicker: "Nomon · depth",
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
  function getGuardHoldCopy(goal) {
    return {
      kicker: "Nomon · guard",
      title: "This hands over something you wanted to protect",
      body: `When you set up Nomon, you said: "${goal}". This prompt delegates that. You can always send anyway — Nomon is a mirror, not a lock.`,
      draftLabel: "Draft something first",
      sendAnywayLabel: "Send anyway",
      goalChangedLabel: "Remove this goal from settings",
      draftPlaceholder: "Your rough draft — even one sentence…",
      submitLabel: "Add my draft and send",
    };
  }

  function summariseGuardEvents(guardEvents = []) {
    const holds = guardEvents.filter((e) => e.action === "hold-shown").length;
    const bypassed = guardEvents.filter((e) => e.action === "bypassed").length;
    const drafted = guardEvents.filter((e) => e.action === "draft-submitted").length;
    if (!holds && !bypassed && !drafted) return null;
    return `${holds} hold${holds === 1 ? "" : "s"} · ${drafted} draft-first · ${bypassed} sent anyway`;
  }

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

  const PLATFORM_NAMES = {
    "chatgpt.com": "ChatGPT",
    "chat.openai.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
    "grok.com": "Grok",
    "x.com": "Grok",
    "copilot.microsoft.com": "Copilot",
    "m365.cloud.microsoft": "Copilot",
    "copilot.cloud.microsoft": "Copilot",
    "perplexity.ai": "Perplexity",
    "www.perplexity.ai": "Perplexity",
    "chat.mistral.ai": "Mistral",
    "meta.ai": "Meta AI",
    "www.meta.ai": "Meta AI",
    "chat.deepseek.com": "DeepSeek",
    "chat.qwen.ai": "Qwen",
    "qwen.ai": "Qwen",
    "kimi.com": "Kimi",
    "www.kimi.com": "Kimi",
    "kimi.moonshot.cn": "Kimi",
    "chat.minimax.io": "MiniMax",
    "agent.minimax.io": "MiniMax",
    "chat.minimaxi.com": "MiniMax",
    "minimax.io": "MiniMax",
    "minimaxi.com": "MiniMax",
    "huggingface.co": "HuggingChat",
    "doubao.com": "Doubao",
    "www.doubao.com": "Doubao",
  };

  function prettyPlatform(host) {
    const canonical = canonicalPlatformHost(host);
    if (PLATFORM_NAMES[canonical]) return PLATFORM_NAMES[canonical];
    if (PLATFORM_NAMES[host]) return PLATFORM_NAMES[host];
    return (canonical || host || "").replace(/^www\./, "").replace(/\.(com|ai|google\.com)$/, "");
  }

  // Merge hostname aliases so cross-tab / cross-AI session stats and disclosure
  // badges treat one product as one tool (e.g. x.com/i/grok → Grok, not "x.com").
  const PLATFORM_CANONICAL = {
    "chat.openai.com": "chatgpt.com",
    "www.perplexity.ai": "perplexity.ai",
    "www.meta.ai": "meta.ai",
    "www.kimi.com": "kimi.com",
    "kimi.moonshot.cn": "kimi.com",
    "www.doubao.com": "doubao.com",
    "m365.cloud.microsoft": "copilot.microsoft.com",
    "copilot.cloud.microsoft": "copilot.microsoft.com",
    "x.com": "grok.com",
    "qwen.ai": "chat.qwen.ai",
    "agent.minimax.io": "chat.minimax.io",
    "chat.minimaxi.com": "chat.minimax.io",
    "minimax.io": "chat.minimax.io",
    "minimaxi.com": "chat.minimax.io",
  };

  function canonicalPlatformHost(host) {
    if (!host) return host;
    return PLATFORM_CANONICAL[host] || host;
  }

  // Roll the week's per-platform message counts into "ChatGPT 40 · Claude 12"
  // style lines so users can see Nomon is tracking across every tool.
  function summarisePlatforms(week) {
    const totals = {};
    week.forEach((entry) => {
      const byPlatform = entry.byPlatform;
      if (byPlatform && Object.keys(byPlatform).length) {
        Object.entries(byPlatform).forEach(([host, snap]) => {
          totals[host] = (totals[host] || 0) + (snap.messageCount || 0);
        });
      } else if (entry.platform) {
        totals[entry.platform] = (totals[entry.platform] || 0) + (entry.messageCount || 0);
      }
    });
    return Object.entries(totals)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([host, count]) => ({ name: prettyPlatform(host), count }));
  }

  // ── AI Profile (lumen-ai-profile.md) ────────────────────────────────────
  // Characterise how you work in each tool: what you mostly use it for, and
  // whether you stay hands-on or tend to hand whole tasks off. Per-tool framing,
  // neutral/descriptive copy, gated on a minimum sample so we never put a
  // confident-but-wrong sentence in front of the user.
  const PROFILE_WINDOW_DAYS = 14;
  const MIN_PROFILE_MESSAGES = 10;
  const MIN_PROFILE_SESSIONS = 2;
  const MAX_PROFILE_TOOLS = 8;

  // Engine task types → the plain-language domain we show the user.
  const TASK_DOMAIN = {
    email_drafting: "writing",
    essay_writing: "writing",
    argument_building: "writing",
    creative_writing: "writing",
    code_generation: "code",
    debugging: "code",
    code_explanation: "code",
    research: "research",
    literature_search: "research",
    fact_checking: "research",
    summarisation: "research",
    data_analysis: "analysis",
    decision_making: "decisions",
    learning_concept: "learning",
    reflection: "reflection",
    scheduling: "admin",
    formatting: "admin",
    conversion: "admin",
    translation: "admin",
    general: null,
  };

  const POSTURE_COPY = {
    "hands-on": "You stay hands-on here — lots of questions and your own attempts.",
    collaborative: "Mostly a back-and-forth here.",
    mixed: "A mix of hands-on and hand-off here.",
    "hand-off heavy": "You tend to hand whole tasks off here.",
  };

  function accumulateByPlatform(week) {
    const acc = {};
    (week || []).forEach((entry) => {
      const platforms =
        entry.byPlatform && Object.keys(entry.byPlatform).length
          ? entry.byPlatform
          : entry.platform
          ? { [entry.platform]: entry }
          : {};
      Object.entries(platforms).forEach(([host, snap]) => {
        host = canonicalPlatformHost(host);
        const a =
          acc[host] ||
          (acc[host] = { messages: 0, sessions: 0, qSum: 0, plSum: 0, passSum: 0, signal: {}, task: {} });
        const mc = snap.messageCount || 0;
        a.messages += mc;
        a.sessions += 1;
        a.qSum += (snap.questionRatio || 0) * mc;
        a.plSum += (snap.avgPromptLength || 0) * mc;
        a.passSum += (snap.passiveRate || 0) * mc;
        Object.entries(snap.signalCounts || {}).forEach(([k, v]) => {
          a.signal[k] = (a.signal[k] || 0) + (v || 0);
        });
        Object.entries(snap.taskTypeCounts || {}).forEach(([k, v]) => {
          a.task[k] = (a.task[k] || 0) + (v || 0);
        });
      });
    });
    return acc;
  }

  // 0 = fully hands-on, 100 = hands whole tasks off. Hand-offs dominate;
  // passive replies, few questions and short prompts push it up; depth pulls down.
  function postureScore(a) {
    const m = Math.max(a.messages, 1);
    const handoffRate = (a.signal.handoff || 0) / m;
    const mismatchRate = (a.signal.mismatch || 0) / m;
    const passiveRate = a.passSum / m;
    const questionRatio = a.qSum / m;
    const avgPromptLen = a.plSum / m;
    const depthRate = (a.signal.depth || 0) / m;

    let offload = 0;
    offload += Math.min(1, handoffRate * 3) * 38;
    offload += Math.min(1, mismatchRate * 4) * 7;
    offload += Math.min(1, passiveRate) * 22;
    offload += (1 - Math.min(1, questionRatio)) * 18;
    offload += Math.min(1, Math.max(0, (18 - avgPromptLen) / 18)) * 15;
    offload -= Math.min(1, depthRate * 5) * 10;
    return Math.max(0, Math.min(100, Math.round(offload)));
  }

  function postureLabel(score) {
    if (score < 32) return "hands-on";
    if (score < 52) return "collaborative";
    if (score < 70) return "mixed";
    return "hand-off heavy";
  }

  // Name a dominant use only on a clear plurality, else "a mix".
  function dominantUse(task) {
    const entries = Object.entries(task || {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total) return null;
    const [topKey, topVal] = entries[0];
    const runnerVal = entries[1]?.[1] || 0;
    if (topVal / total >= 0.4 && topVal >= runnerVal * 1.5) return TASK_DOMAIN[topKey] || null;
    return null;
  }

  // Cross-cutting insight: which kind of work you stay most hands-on with vs.
  // hand off most — across every tool. We don't store task×signal crosses, so we
  // attribute each tool's posture to the domains it's used for, weighted by how
  // much of that tool's activity each domain represents.
  function buildProfileContrast(history, opts = {}) {
    const windowDays = opts.windowDays || PROFILE_WINDOW_DAYS;
    const minMessages = opts.minMessages ?? MIN_PROFILE_MESSAGES;
    const spread = opts.minSpread ?? 18;
    const acc = accumulateByPlatform((history || []).slice(-windowDays));

    const offload = {};
    const weight = {};
    Object.values(acc).forEach((a) => {
      if (a.messages < 3) return;
      const score = postureScore(a);
      Object.entries(a.task || {}).forEach(([taskType, count]) => {
        const domain = TASK_DOMAIN[taskType];
        if (!domain || !count) return;
        offload[domain] = (offload[domain] || 0) + score * count;
        weight[domain] = (weight[domain] || 0) + count;
      });
    });

    const domains = Object.keys(weight)
      .filter((d) => weight[d] >= minMessages)
      .map((d) => ({ domain: d, score: offload[d] / weight[d] }))
      .sort((a, b) => a.score - b.score);

    if (domains.length < 2) return null;
    const engaged = domains[0];
    const offloaded = domains[domains.length - 1];
    if (offloaded.score - engaged.score < spread) return null;
    return `You're most hands-on with ${engaged.domain}, and hand off most with ${offloaded.domain} — whichever tool you're in.`;
  }

  function buildProfile(history, opts = {}) {
    const windowDays = opts.windowDays || PROFILE_WINDOW_DAYS;
    const minMessages = opts.minMessages ?? MIN_PROFILE_MESSAGES;
    const minSessions = opts.minSessions ?? MIN_PROFILE_SESSIONS;
    const week = (history || []).slice(-windowDays);
    const acc = accumulateByPlatform(week);

    let tools = Object.entries(acc)
      .filter(([, a]) => a.messages > 0)
      .map(([host, a]) => ({ host, name: prettyPlatform(host), ...a }))
      .sort((x, y) => y.messages - x.messages);

    const currentHost = opts.currentHost ? canonicalPlatformHost(opts.currentHost) : null;
    if (currentHost && acc[currentHost]?.messages > 0 && !tools.some((t) => t.host === currentHost)) {
      tools.push({ host: currentHost, name: prettyPlatform(currentHost), ...acc[currentHost] });
      tools.sort((x, y) => y.messages - x.messages);
    }

    return tools.slice(0, MAX_PROFILE_TOOLS).map((t) => {
        if (t.messages < minMessages || t.sessions < minSessions) {
          return { name: t.name, ready: false, line: `Still learning how you use ${t.name}.` };
        }
        const score = postureScore(t);
        const label = postureLabel(score);
        const use = dominantUse(t.task);
        const usePart = use ? `mostly ${use}` : "a mix of tasks";
        return {
          name: t.name,
          ready: true,
          use,
          posture: label,
          postureScore: score,
          messages: t.messages,
          line: `${t.name} — ${usePart}. ${POSTURE_COPY[label]}`,
        };
      });
  }

  const SHAPE_EDITORIAL = {
    Thinker: {
      headline:
        "You brought your own questions <em>more often than not</em> — and it showed.",
      prompt: "When did you reach for the AI before you'd formed your own view?",
    },
    Maker: {
      headline: "You built <em>with</em> the AI, not <em>from</em> it — steering every step.",
      prompt: "Which of this week's outputs would you still stand behind next month?",
    },
    Delegator: {
      headline: "You handed off the heavy lifting — <em>fast</em>, but worth a glance.",
      prompt: "Was there one hand-off this week you wish you'd attempted first?",
    },
    Balanced: {
      headline: "Mostly steady engagement — a <em>mixed</em> week across your tools.",
      prompt: null,
    },
  };

  function weekStartMs(days = 7) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d.getTime();
  }

  function eventsSince(events = [], since) {
    return (events || []).filter((e) => (e.at || 0) >= since);
  }

  function classifyWeekShape(week, digestLog = {}) {
    if (!week.length) return "Balanced";
    const avgQuestion = week.reduce((s, e) => s + e.questionRatio, 0) / week.length;
    const avgPassive = week.reduce((s, e) => s + e.passiveRate, 0) / week.length;
    const totalMsg = week.reduce((s, e) => s + (e.messageCount || 0), 0);
    const depthMoments = (digestLog.depthMoments || []).length;
    const depthRate = totalMsg ? depthMoments / totalMsg : 0;

    if (avgQuestion >= 0.35 || depthRate >= 0.08) return "Thinker";
    if (avgPassive >= 0.45 && avgQuestion < 0.2) return "Delegator";
    if (avgPassive < 0.35 && avgQuestion < 0.3) return "Maker";
    return "Balanced";
  }

  function buildBiggestWin({ week, prior, digestLog, responses, costUsdWeek = 0 }) {
    const wins = [];
    if (week.length && prior.length) {
      const avgQ = week.reduce((s, e) => s + e.questionRatio, 0) / week.length;
      const priorQ = prior.reduce((s, e) => s + e.questionRatio, 0) / prior.length;
      const delta = Math.round((avgQ - priorQ) * 100);
      if (delta >= 5) {
        wins.push(`You asked ${delta}% more questions than last week.`);
      }
    }
    if (responses?.drafted > 0) {
      wins.push(
        `You drafted first ${responses.drafted} time${responses.drafted === 1 ? "" : "s"} before handing off.`
      );
    }
    if (responses?.reflected > 0) {
      wins.push(
        `You paused to reflect ${responses.reflected} time${responses.reflected === 1 ? "" : "s"} on high-stakes prompts.`
      );
    }
    if (costUsdWeek >= 0.01) {
      wins.push(`Cost coach saved you about $${costUsdWeek.toFixed(2)} this week.`);
    }
    const since = weekStartMs(7);
    const draftedOnGuard = eventsSince(digestLog.guardEvents, since).filter(
      (e) => e.action === "draft-submitted"
    ).length;
    if (draftedOnGuard > 0) {
      wins.push(
        `Guard mode helped you draft first ${draftedOnGuard} time${draftedOnGuard === 1 ? "" : "s"}.`
      );
    }
    if (!wins.length && week.length) {
      const avgPassive = week.reduce((s, e) => s + e.passiveRate, 0) / week.length;
      if (avgPassive < 0.35) {
        wins.push("You stayed engaged — fewer passive replies than a typical week.");
      } else {
        wins.push("You kept Nomon active across the week — the mirror is filling in.");
      }
    }
    return wins[0] || "Keep going — your weekly mirror fills in as Nomon sees more sessions.";
  }

  function buildStatPills({ week, avgQuestion, digestLog, responses }) {
    if (!week.length) return [];
    const avgLen = Math.round(
      week.reduce((s, e) => s + e.avgPromptLength, 0) / week.length
    );
    const avgPassive = Math.round(
      (week.reduce((s, e) => s + e.passiveRate, 0) / week.length) * 100
    );
    const since = weekStartMs(7);
    const mismatches = eventsSince(digestLog.mismatchEvents, since).length;
    const badges = responses?.engaged || 0;
    return [
      { label: "questions", value: `${Math.round(avgQuestion * 100)}%` },
      { label: "word avg", value: String(avgLen) },
      { label: "passive", value: `${avgPassive}%` },
      { label: "goal mismatches", value: String(mismatches) },
      { label: "badges", value: String(badges) },
    ];
  }

  function buildDigest({ history, session, digestLog, costUsdWeek = 0 }) {
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
      : ["Not enough data yet — keep chatting with Nomon active."];

    const responses = summariseResponses(digestLog);
    const shape = classifyWeekShape(week, digestLog);
    const editorial = SHAPE_EDITORIAL[shape] || SHAPE_EDITORIAL.Balanced;
    const since = weekStartMs(7);
    const weeklyMismatches = eventsSince(digestLog.mismatchEvents, since).length;

    return {
      headline,
      shape,
      shapeHeadline: editorial.headline,
      biggestWin: buildBiggestWin({ week, prior, digestLog, responses, costUsdWeek }),
      statPills: buildStatPills({ week, avgQuestion, digestLog, responses }),
      profileContrast: buildProfileContrast(history),
      loopTrend,
      driftLines,
      platforms: summarisePlatforms(week),
      profile: buildProfile(history),
      depthMoments: (digestLog.depthMoments || []).slice(-3),
      mismatchSummary: `${session.mismatchCount || 0} intention checks this session`,
      weeklyMismatchCount: weeklyMismatches,
      guardSummary: summariseGuardEvents(digestLog.guardEvents || []),
      responses,
      prompt: editorial.prompt || pickRandom(DIGEST_PROMPTS),
      hasWeekData: week.length > 0,
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
    getGuardHoldCopy,
    getDepthCardCopy,
    getDepthOverlayCopy,
    detectDepthTaskType,
    isHighStakesDepth,
    summariseResponses,
    buildProfile,
    buildProfileContrast,
    canonicalPlatformHost,
    prettyPlatform,
    buildDigest,
  };
})();

globalThis.LumenNudges = LumenNudges;
