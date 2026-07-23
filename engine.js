const LumenEngine = (() => {
  const WEIGHTS = {
    promptLength: 0.2,
    velocity: 0.25,
    passiveAcceptance: 0.3,
    taskFraming: 0.25,
  };

  const HIGH_FRAMING = LumenRules.TIER1_PATTERNS.map((p) => p.re);
  const MEDIUM_FRAMING = LumenRules.TIER2_PATTERNS.map((p) => p.re);
  const LOW_FRAMING = LumenRules.TIER0_PATTERNS.map((p) => p.re);

  const PASSIVE_CONTINUATIONS = [
    /^(continue|go on|keep going|more|next|yes|yep|ok|okay|thanks|thank you|perfect|great|good|sure|do it|proceed|carry on|sounds good|looks good|that works)\.?$/i,
    /^(please )?(continue|expand|elaborate|go ahead)\b/i,
  ];

  const ENGAGEMENT_MARKERS = LumenRules.ENGAGEMENT_MARKERS;
  const USER_CONTEXT_MARKERS = LumenRules.USER_CONTEXT_MARKERS;

  // Depth = high-stakes questions worth thinking through first. Note: "write my"
  // / "create my" are deliberately NOT here — those are hand-offs, and depth
  // outranks hand-off in primary selection, so including them would mask a clear
  // delegation behind a "think about it" card.
  const DEPTH_TRIGGERS = [
    /should i\b/i, /what career/i, /how do i decide/i, /is it worth/i,
    /i want to understand/i, /help me learn/i,
    /what do i really want/i, /who am i\b/i,
  ];

  const DEPTH_EXEMPT = [
    /debug/i, /error/i, /summarize/i, /translate/i, /schedule/i, /capital of/i,
    /what time/i, /fix this bug/i, /stack trace/i, /regex/i, /api endpoint/i,
  ];

  const TASK_TYPE_MODIFIERS = {
    email_drafting: { scoreMultiplier: 0.15, autoExemptAfter: 2 },
    scheduling: { scoreMultiplier: 0.1, autoExemptAfter: 1 },
    formatting: { scoreMultiplier: 0.15, autoExemptAfter: 2 },
    conversion: { scoreMultiplier: 0.1, autoExemptAfter: 1 },
    translation: { scoreMultiplier: 0.2, autoExemptAfter: 3 },
    literature_search: { scoreMultiplier: 0.4, autoExemptAfter: null },
    fact_checking: { scoreMultiplier: 0.35, autoExemptAfter: null },
    summarisation: { scoreMultiplier: 0.3, autoExemptAfter: null },
    data_analysis: { scoreMultiplier: 0.55, autoExemptAfter: null },
    research: { scoreMultiplier: 0.45, autoExemptAfter: null },
    essay_writing: { scoreMultiplier: 1.0, autoExemptAfter: null },
    argument_building: { scoreMultiplier: 1.0, autoExemptAfter: null },
    decision_making: { scoreMultiplier: 1.1, autoExemptAfter: null },
    learning_concept: { scoreMultiplier: 1.2, autoExemptAfter: null },
    creative_writing: { scoreMultiplier: 0.9, autoExemptAfter: null },
    reflection: { scoreMultiplier: 1.2, autoExemptAfter: null },
    code_generation: { scoreMultiplier: 0.65, autoExemptAfter: null },
    debugging: { scoreMultiplier: 0.5, autoExemptAfter: null },
    code_explanation: { scoreMultiplier: 0.9, autoExemptAfter: null },
    general: { scoreMultiplier: 0.45, autoExemptAfter: null },
  };

  const SPECIFICITY_MARKERS = [
    /why (did|does|would|is)/i,
    /what (causes|happens|makes|determines)/i,
    /how (does|would|could) .{10,}/i,
    /\b(this|that|here|above|instead|rather than)\b/i,
  ];

  const ENGAGEMENT_PHRASES = [
    "but", "however", "actually", "i think", "what about", "why did you", "that's not",
  ];

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isPassiveContinuation(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (PASSIVE_CONTINUATIONS.some((pattern) => pattern.test(trimmed))) return true;
    if (wordCount(trimmed) <= 3 && !trimmed.includes("?")) return true;
    return false;
  }

  function hasEngagementMarkers(text) {
    return LumenRules.hasEngagementMarkers(text);
  }

  function hasUserProvidedContext(text) {
    return LumenRules.hasUserProvidedContext(text);
  }

  function getPreviousAssistant(messages, userIndex) {
    for (let i = userIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }

  function getPreviousUserMessage(messages, userIndex) {
    for (let i = userIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return messages[i];
    }
    return null;
  }

  function isSimilarToPreviousUserMessage(text, messages, userIndex) {
    const previous = getPreviousUserMessage(messages, userIndex);
    if (!previous) return false;
    const a = normalizeText(text);
    const b = normalizeText(previous.text);
    if (!a || !b || a === b) return a === b;
    const aWords = new Set(a.split(" "));
    const overlap = b.split(" ").filter((word) => aWords.has(word)).length;
    return overlap / Math.max(b.split(" ").length, 1) >= 0.75 && wordCount(text) < 20;
  }

  function containsQuoteFromAi(userText, aiText) {
    const aiWords = aiText.toLowerCase().split(/\s+/).filter(Boolean);
    if (aiWords.length < 4) return false;
    for (let i = 0; i <= aiWords.length - 4; i += 1) {
      const phrase = aiWords.slice(i, i + 4).join(" ");
      if (userText.toLowerCase().includes(phrase)) return true;
    }
    return false;
  }

  function scorePromptLength(text, context) {
    const words = wordCount(text);
    const isCodeContext =
      text.includes("```") || /\b(function|const|def|class|import|line \d+)\b/i.test(text);
    const priorLong = (context?.priorAIWordCount || 0) > 500;

    if (isCodeContext) {
      if (words < 5) return 40;
      if (words < 15) return 20;
      return 0;
    }

    if (priorLong) {
      if (words < 5) return 60;
      if (words < 15) return 35;
      if (words < 40) return 20;
      return 0;
    }

    if (words > 40) return 0;
    if (words >= 15) return 50;
    if (words >= 8) return 80;
    if (words <= 3) return 100;
    return 95;
  }

  function detectTaskType(message) {
    const m = message.toLowerCase();
    if (/write.*email|draft.*message|reply to/i.test(m)) return "email_drafting";
    if (/schedule|calendar|meeting time/i.test(m)) return "scheduling";
    // Summarisation before formatting — "bullet points" alone must not beat "summarise".
    if (/summaris|summariz|tldr|key points|bullet points from/i.test(m)) return "summarisation";
    if (/format|reformat/i.test(m)) return "formatting";
    if (/\bbullet points?\b/i.test(m)) return "formatting";
    if (/literature|papers|sources|citations/i.test(m)) return "literature_search";
    if (/fact check|is it true|verify/i.test(m)) return "fact_checking";
    if (/write.*essay|draft.*paper|argument/i.test(m)) return "essay_writing";
    if (/debug|bug|error|stack trace|fix line/i.test(m)) return "debugging";
    if (/explain.*code|how does this (function|code)/i.test(m)) return "code_explanation";
    if (/explain|how does|why does|help me understand/i.test(m)) return "learning_concept";
    if (/function|class|code|implement|script/i.test(m)) return "code_generation";
    return "general";
  }

  function computeDwellRatio(messages, userIndex) {
    const userMsg = messages[userIndex];
    // Prefer first-keystroke dwell (time until the user starts composing) when
    // the content script captured it — closer to "did they read?" than send gap.
    if (userMsg?.dynamics?.firstKeyDwellRatio != null) {
      return userMsg.dynamics.firstKeyDwellRatio;
    }
    const prevAssistant = getPreviousAssistant(messages, userIndex);
    if (!prevAssistant?.text || !userMsg?.timestamp || !prevAssistant.timestamp) return null;
    const dwell = userMsg.timestamp - prevAssistant.timestamp;
    const expected = wordCount(prevAssistant.text) * 250;
    if (expected <= 0 || dwell < 0) return null;
    return dwell / expected;
  }

  // Dwell vs expected reading time (~250ms/word). Positive = more passive;
  // negative = credit for sitting with the answer.
  function scoreDwellTime(dwellRatio, priorAIWordCount) {
    if (priorAIWordCount < 100) return 0;
    if (dwellRatio == null) return 0;
    if (dwellRatio < 0.15) return 25;
    if (dwellRatio < 0.3) return 15;
    if (dwellRatio < 0.5) return 5;
    if (dwellRatio >= 0.8) return -10;
    return 0;
  }

  function scoreResponseEngagement(userText, priorAiText) {
    if (!priorAiText) return 0;
    const aiText = priorAiText.toLowerCase();
    const userLower = userText.toLowerCase();
    const aiSentences = aiText.split(".").map((s) => s.trim()).filter((s) => s.length > 20);
    const referencesAI = aiSentences.some((sentence) => {
      const words = sentence.split(" ").slice(0, 5).join(" ");
      return userLower.includes(words);
    });
    const pushesBack = ENGAGEMENT_PHRASES.some((p) => userLower.includes(p));
    if (referencesAI || pushesBack) return -15;
    return 0;
  }

  function scoreQuestionSpecificity(message) {
    if (!message.includes("?")) return 0;
    const score = SPECIFICITY_MARKERS.reduce(
      (acc, pattern) => acc + (pattern.test(message) ? 1 : 0),
      0
    );
    if (score >= 2) return -12;
    if (score === 1) return -6;
    return 0;
  }

  function computeConversationArc(loopScores) {
    if (!loopScores || loopScores.length < 3) return "early";
    const firstThird = loopScores.slice(0, Math.floor(loopScores.length / 3));
    const avgEarly = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    if (avgEarly < 35) return "strong_opener";
    if (avgEarly > 70) return "passive_from_start";
    return "mixed";
  }

  function applyTaskTypeModifier(score, taskType, context) {
    const mod = TASK_TYPE_MODIFIERS[taskType] || TASK_TYPE_MODIFIERS.general;
    const crowdMod = context?.crowdCalibration?.taskTypeModifiers?.[taskType];
    const multiplier = crowdMod?.scoreMultiplier ?? mod.scoreMultiplier;
    let adjusted = Math.round(score * multiplier);
    const sens = context?.sessionSensitivity?.[taskType];
    if (typeof sens === "number") adjusted = Math.round(adjusted * sens);
    if (context?.taskTypeExempt?.includes(taskType)) return Math.min(adjusted, 20);
    return adjusted;
  }

  function scoreMessageVelocity(timestamps, messages) {
    const now = Date.now();
    const windowMs = 3 * 60 * 1000;
    const count = timestamps.filter((t) => now - t <= windowMs).length;
    let score = 0;
    if (count < 2) score = 0;
    else if (count <= 3) score = 40;
    else if (count <= 5) score = 70;
    else score = 100;

    const recentUserMessages = messages.filter(
      (msg) => msg.role === "user" && msg.timestamp && now - msg.timestamp <= windowMs
    );
    if (recentUserMessages.length) {
      const averageWords =
        recentUserMessages.reduce((sum, msg) => sum + wordCount(msg.text), 0) /
        recentUserMessages.length;
      if (averageWords < 8 && count >= 2) score = Math.min(100, score + 20);
      if (averageWords < 12 && count >= 4) score = Math.min(100, score + 10);
    }
    return score;
  }

  function scoreConversationDelegation(messages, userIndex) {
    const recentUsers = messages.slice(0, userIndex + 1).filter((m) => m.role === "user").slice(-4);
    const delegationCount = recentUsers.filter((m) =>
      HIGH_FRAMING.some((pattern) => pattern.test(m.text))
    ).length;
    if (delegationCount >= 3) return 75;
    if (delegationCount >= 2) return 45;
    return 0;
  }

  function scoreTaskFraming(text, messages, userIndex) {
    if (LumenRules.isScaffoldAsk?.(text) || LumenRules.isAttemptFirst?.(text)) return 10;
    let score = 30;
    if (LOW_FRAMING.some((pattern) => pattern.test(text))) score = 10;
    else if (HIGH_FRAMING.some((pattern) => pattern.test(text))) score = 90;
    else if (MEDIUM_FRAMING.some((pattern) => pattern.test(text))) score = 50;
    return Math.min(100, Math.max(score, scoreConversationDelegation(messages, userIndex)));
  }

  function scorePassiveAcceptance(messages, userIndex, dwellRatio) {
    const userMsg = messages[userIndex];
    if (!userMsg || userMsg.role !== "user") return 0;
    if (userMsg.text.includes("?")) return 0;
    if (hasEngagementMarkers(userMsg.text) || hasUserProvidedContext(userMsg.text)) return 0;

    const prevAssistant = getPreviousAssistant(messages, userIndex);
    if (!prevAssistant) return 0;

    const aiWords = wordCount(prevAssistant.text);
    if (aiWords < 100) return 0;

    const userWords = wordCount(userMsg.text);
    const gapMs =
      userMsg.timestamp && prevAssistant.timestamp
        ? userMsg.timestamp - prevAssistant.timestamp
        : null;
    let score = 0;

    if (isPassiveContinuation(userMsg.text)) score = userWords <= 3 ? 100 : 90;
    else if (isSimilarToPreviousUserMessage(userMsg.text, messages, userIndex) && userWords < 20) score = 80;
    else if (gapMs != null && gapMs <= 15000 && aiWords >= 150 && userWords < 20) score = 75;
    else if (aiWords > 300 && userWords < 8 && !containsQuoteFromAi(userMsg.text, prevAssistant.text)) score = 100;
    else if (aiWords > 200 && userWords < 15) score = 60;

    // Paste of a short follow-up (no own framing) after a long reply → more passive.
    if (
      userMsg.dynamics?.pasted &&
      userWords < 25 &&
      !hasEngagementMarkers(userMsg.text) &&
      !hasUserProvidedContext(userMsg.text)
    ) {
      score = Math.max(score, score > 0 ? Math.min(100, score + 15) : 55);
    }

    const dwellMod = scoreDwellTime(dwellRatio, aiWords);
    if (dwellMod > 0 && score > 0) {
      score = Math.min(100, score + dwellMod);
    }
    return score;
  }

  function computeLoopScore(signals) {
    return Math.round(
      signals.promptLength * WEIGHTS.promptLength +
        signals.velocity * WEIGHTS.velocity +
        signals.passiveAcceptance * WEIGHTS.passiveAcceptance +
        signals.taskFraming * WEIGHTS.taskFraming
    );
  }

  function isSubstantiveQuestion(text) {
    if (!text.includes("?")) return false;
    const withoutQuotes = text.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
    return withoutQuotes.includes("?");
  }

  function getTaskFramingTier(text) {
    return LumenRules.analyzeFraming(text).tier;
  }

  function hasStrongDelegation(text) {
    return LumenRules.isStrongDelegation(text, LumenRules.analyzeFraming(text));
  }

  function getUserMessageIndex(messages, index) {
    return messages.slice(0, index + 1).filter((m) => m.role === "user").length;
  }

  function isTaskTypeExempt(taskType, context) {
    return Boolean(context?.taskTypeExempt?.includes(taskType));
  }

  function shouldShowOverlay(messageIndex, framing, loopScore, exempt, mode, confidenceLevel) {
    // The reconsider overlay is the one heavier interrupt. Per spec it only
    // belongs in active/guard modes (ambient = strips only, ghost = nothing).
    // Hand-off and Depth never gate the AI response — they surface as a strip
    // or an additive card so the experience stays seamless.
    if (mode !== "active" && mode !== "guard") return null;
    if (exempt) return null;
    if (confidenceLevel === "gray" || confidenceLevel === "low") return null;
    if (messageIndex > 2 && loopScore >= 70) return "loop";
    return null;
  }

  function applyPostProcessing(rawScore, text, messages, userIndex, context) {
    let score = rawScore;
    if (isSubstantiveQuestion(text)) score = Math.max(0, score - 8);
    score += scoreQuestionSpecificity(text);
    if (hasEngagementMarkers(text)) score = Math.max(0, score - 12);
    if (hasUserProvidedContext(text)) score = Math.max(0, score - 10);
    const prevAssistant = getPreviousAssistant(messages, userIndex);
    const priorAIWordCount = prevAssistant ? wordCount(prevAssistant.text) : 0;
    if (prevAssistant) {
      score += scoreResponseEngagement(text, prevAssistant.text);
      if (containsQuoteFromAi(text, prevAssistant.text)) score = Math.max(0, score - 10);
    }
    if (/^\s*(\d+[\.)]|[-*•])\s+/m.test(text) && wordCount(text) >= 20) score = Math.max(0, score - 8);

    // Careful reading credit (first-keystroke or send-gap dwell).
    const dwellMod = scoreDwellTime(context?.dwellRatio, priorAIWordCount);
    if (dwellMod < 0) score = Math.max(0, score + dwellMod);

    // Short pasted commands without own framing nudge the loop score up.
    const userMsg = messages[userIndex];
    if (
      userMsg?.dynamics?.pasted &&
      wordCount(text) < 25 &&
      !hasEngagementMarkers(text) &&
      !hasUserProvidedContext(text) &&
      !text.includes("?")
    ) {
      score = Math.min(100, score + 12);
    }

    const arc = computeConversationArc(context?.priorLoopScores || []);
    if (arc === "strong_opener") score = Math.max(0, Math.round(score * 0.8));

    return Math.max(0, Math.min(100, score));
  }

  function computeLoopSignals(msg, messages, index, timestamps, goals, context) {
    const calibration = getUseCaseCalibration(goals.useCases);
    const priorAssistant = getPreviousAssistant(messages, index);
    const priorAIWordCount = priorAssistant ? wordCount(priorAssistant.text) : 0;
    const dwellRatio = computeDwellRatio(messages, index);
    const taskType = detectTaskType(msg.text);

    const signals = {
      promptLength: scorePromptLength(msg.text, { priorAIWordCount, platform: context?.platform }),
      velocity: Math.round(scoreMessageVelocity(timestamps, messages) * calibration.velocityScale),
      passiveAcceptance: scorePassiveAcceptance(messages, index, dwellRatio),
      taskFraming: Math.min(
        100,
        Math.round(scoreTaskFraming(msg.text, messages, index) * calibration.taskFramingScale)
      ),
    };
    const raw = computeLoopScore(signals);
    let score = applyPostProcessing(raw, msg.text, messages, index, {
      priorLoopScores: context?.priorLoopScores,
      dwellRatio,
    });
    score = applyTaskTypeModifier(score, taskType, {
      sessionSensitivity: context?.sessionSensitivity,
      taskTypeExempt: context?.taskTypeExempt,
      crowdCalibration: context?.crowdCalibration,
    });
    return { signals, score, calibration, taskType, dwellRatio };
  }

  function getUseCaseCalibration(useCases) {
    const calibration = { loopThreshold: 40, velocityScale: 1, taskFramingScale: 1 };
    if (!useCases?.length) return calibration;

    if (useCases.includes("Research")) {
      calibration.velocityScale = 0.7;
      calibration.loopThreshold = 48;
    }
    if (useCases.includes("Writing")) {
      calibration.taskFramingScale = 1.15;
    }
    if (useCases.includes("Admin")) {
      calibration.loopThreshold = 48;
    }
    if (useCases.includes("Coding")) {
      calibration.loopThreshold = 45;
    }
    if (useCases.includes("Learning")) {
      calibration.loopThreshold = 42;
    }
    return calibration;
  }

  function weekStart(dateStr) {
    const date = new Date(dateStr);
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    return date.toISOString().slice(0, 10);
  }

  function aggregateWeek(history, weekKeyValue) {
    const entries = history.filter((entry) => weekStart(entry.date) === weekKeyValue);
    if (!entries.length) return null;
    return {
      questionRatio: entries.reduce((s, e) => s + e.questionRatio, 0) / entries.length,
      avgPromptLength: entries.reduce((s, e) => s + e.avgPromptLength, 0) / entries.length,
      passiveRate: entries.reduce((s, e) => s + e.passiveRate, 0) / entries.length,
      sessions: entries.length,
    };
  }

  function evaluateDrift(history, currentMetrics) {
    if (!history || history.length < 5) return { active: false };

    const currentWeek = weekStart(new Date().toISOString().slice(0, 10));
    const priorWeekDate = new Date(currentWeek);
    priorWeekDate.setUTCDate(priorWeekDate.getUTCDate() - 7);
    const priorWeek = weekStart(priorWeekDate.toISOString().slice(0, 10));

    const thisWeek = aggregateWeek(history, currentWeek);
    const lastWeek = aggregateWeek(history, priorWeek);

    if (!thisWeek || !lastWeek || thisWeek.sessions + lastWeek.sessions < 5) {
      const prior = history.slice(-6, -1);
      if (prior.length < 5) return { active: false };
      const avgQuestionRatio = prior.reduce((sum, entry) => sum + entry.questionRatio, 0) / prior.length;
      const avgPromptLength = prior.reduce((sum, entry) => sum + entry.avgPromptLength, 0) / prior.length;
      const avgPassiveRate = prior.reduce((sum, entry) => sum + entry.passiveRate, 0) / prior.length;

      if (currentMetrics.questionRatio < avgQuestionRatio - 0.12) {
        return { active: true, label: "drift · fewer questions this week" };
      }
      if (currentMetrics.avgPromptLength < avgPromptLength * 0.7) {
        return { active: true, label: "drift · shorter prompts than usual" };
      }
      if (currentMetrics.passiveRate > avgPassiveRate + 0.15) {
        return { active: true, label: "drift · more passive replies lately" };
      }
      return { active: false };
    }

    if (thisWeek.questionRatio < lastWeek.questionRatio - 0.1) {
      return { active: true, label: "drift · fewer questions this week" };
    }
    if (thisWeek.avgPromptLength < lastWeek.avgPromptLength * 0.75) {
      return { active: true, label: "drift · shorter prompts than usual" };
    }
    if (thisWeek.passiveRate > lastWeek.passiveRate + 0.12) {
      return { active: true, label: "drift · more passive replies lately" };
    }
    return { active: false };
  }

  function evaluateDepth(text, messages, userIndex) {
    if (DEPTH_EXEMPT.some((pattern) => pattern.test(text))) return { active: false };
    if (!DEPTH_TRIGGERS.some((pattern) => pattern.test(text))) return { active: false };

    const priorUserMessages = messages.slice(0, userIndex).filter((m) => m.role === "user");
    const hasReflection = priorUserMessages.some(
      (m) => hasEngagementMarkers(m.text) || hasUserProvidedContext(m.text)
    );
    if (hasReflection) return { active: false };

    return { active: true, taskType: globalThis.LumenNudges.detectDepthTaskType(text) };
  }

  function passiveMessageCount(messages) {
    const now = Date.now();
    return messages.filter(
      (m) =>
        m.role === "user" &&
        m.timestamp &&
        now - m.timestamp <= 3 * 60 * 1000 &&
        (isPassiveContinuation(m.text) || wordCount(m.text) < 8)
    ).length;
  }

  function evaluateMessage(msg, messages, index, context) {
    const goals = globalThis.LumenGoals.get();
    const messageIndex = getUserMessageIndex(messages, index);
    const timestamps = messages
      .filter((m) => m.role === "user" && m.timestamp)
      .map((m) => m.timestamp);
    if (msg.timestamp && !context.scoredIds.includes(msg.id)) timestamps.push(msg.timestamp);

    const engineContext = {
      platform: window.location.hostname,
      priorLoopScores: context.priorLoopScores || [],
      sessionSensitivity: context.sessionSensitivity,
      taskTypeExempt: context.taskTypeExempt,
      crowdCalibration: context.crowdCalibration,
    };

    const { signals, score: loopScoreRaw, calibration, taskType, dwellRatio } = computeLoopSignals(
      msg,
      messages,
      index,
      timestamps,
      goals,
      engineContext
    );

    const tier = getTaskFramingTier(msg.text);
    const framing = LumenRules.analyzeFraming(msg.text);
    const engagementOverride = LumenRules.checkEngagementOverride(msg.text);
    const stanceInfo = LumenRules.checkStance?.(msg.text) || {
      stance: engagementOverride.stance || "neutral",
      reasons: engagementOverride.reasons || [],
      framing,
    };
    const stance = stanceInfo.stance || engagementOverride.stance || "neutral";
    const exempt = isTaskTypeExempt(taskType, engineContext);
    let loopScore = loopScoreRaw;

    // Scaffold / attempt-first are practice-preserving — pull loop score down.
    if (stance === "scaffold") loopScore = Math.max(0, loopScore - 18);
    if (stance === "attempt-first") loopScore = Math.max(0, loopScore - 14);

    if (!exempt && !engagementOverride.active && messageIndex <= 2 && framing.tier >= 1) {
      loopScore = Math.max(loopScoreRaw, framing.tier === 1 ? 52 : 42);
      if (framing.tier === 1) signals.taskFraming = Math.max(signals.taskFraming, 90);
    }

    const mismatchMatch = goals.protectedGoals.length
      ? LumenRules.checkMismatchGoals(msg.text, goals.protectedGoals)
      : null;
    const depth =
      goals.mode === "ghost" ? { active: false } : evaluateDepth(msg.text, messages, index);
    const drift = evaluateDrift(context.history, context.currentMetrics);

    const loopThreshold =
      context.crowdCalibration?.loopThreshold ?? calibration.loopThreshold;
    const passiveCount = passiveMessageCount(messages);

    const handoffTier1Exact = framing.tier === 1 && framing.source === "tier1";
    const handoffSemanticOrTier2 =
      framing.tier === 2 || (framing.tier === 1 && framing.source === "semantic");

    // Hand-off is the core "you stopped thinking for yourself" signal, so it
    // must fire wherever delegation happens — not only in the opening two
    // messages. Scaffold and attempt-first suppress it (practice stays with you).
    const handoffActive =
      !exempt && !engagementOverride.active && stance !== "scaffold" && handoffTier1Exact;
    const handoffStripOnly =
      !exempt &&
      !engagementOverride.active &&
      stance !== "scaffold" &&
      handoffSemanticOrTier2;
    const loopActive = messageIndex > 2 && loopScore >= loopThreshold;

    // Affirmative Mirror: attempt-first, scaffold, or other engagement override.
    const engagedActive =
      (engagementOverride.active || stance === "scaffold" || stance === "attempt-first") &&
      goals.mode !== "ghost" &&
      !exempt;

    const handoffLabel = globalThis.LumenNudges.getHandOffLabel();
    const loopLabel = globalThis.LumenNudges.getLoopLabel(signals, loopScore, passiveCount);
    const engagedLabel = globalThis.LumenNudges.getEngagedLabel?.({
      ...engagementOverride,
      stance,
      reasons: engagementOverride.reasons?.length ? engagementOverride.reasons : stanceInfo.reasons,
    });
    const depthWarm = depth.active && globalThis.LumenNudges.isHighStakesDepth(msg.text);
    const mismatchHighFrequency =
      mismatchMatch && context.sessionMismatchCount >= 2;

    const result = {
      messageIndex,
      text: msg.text,
      tier,
      framing,
      stance,
      engagementOverride: engagementOverride.active,
      dwellRatio,
      pasted: Boolean(msg.dynamics?.pasted),
      loopScore,
      loopSignals: signals,
      taskType,
      handoff: handoffActive || handoffStripOnly
        ? { active: true, label: handoffLabel, stripOnly: handoffStripOnly && !handoffActive }
        : { active: false },
      loop: loopActive ? { active: true, label: loopLabel } : { active: false },
      drift: drift.active ? drift : { active: false },
      mismatch: mismatchMatch
        ? {
            active: true,
            goal: mismatchMatch.goal,
            label: globalThis.LumenNudges.getMismatchLabel(mismatchMatch.goal),
            highFrequency: mismatchHighFrequency,
          }
        : { active: false },
      depth: depth.active
        ? {
            active: true,
            taskType: depth.taskType,
            label: "depth · worth sitting with this?",
            warm: depthWarm,
          }
        : { active: false },
      engaged: engagedActive
        ? {
            active: true,
            stance,
            label: engagedLabel || "hands-on · you put real thought in",
          }
        : { active: false },
      overlayType: null,
      primary: null,
      reasons: [],
      confidence: "low",
      explanation: "",
    };

    if (result.mismatch.active && globalThis.LumenGoals.isActive()) result.primary = "mismatch";
    else if (result.depth.active && globalThis.LumenGoals.isActive()) result.primary = "depth";
    else if (handoffActive || handoffStripOnly) result.primary = "handoff";
    else if (loopActive) result.primary = "loop";
    else if (result.drift.active && goals.mode !== "ghost") result.primary = "drift";
    else if (result.engaged.active) result.primary = "engaged";

    const confidence = LumenRules.computeConfidence({
      text: msg.text,
      framing,
      engagementOverride,
      exempt,
      messageIndex,
      loopScore,
      loopThreshold,
      primary: result.primary,
    });
    result.confidence = confidence.level;
    result.reasons = result.engaged.active
      ? [
          ...(engagementOverride.reasons || stanceInfo.reasons || []),
          ...confidence.reasons.filter(
            (r) => !(engagementOverride.reasons || []).includes(r)
          ),
        ]
      : confidence.reasons;
    result.overlayType = shouldShowOverlay(
      messageIndex,
      framing,
      loopScore,
      exempt,
      goals.mode,
      confidence.level
    );
    // Depth is an invitation, never a gate: it renders as an additive card and
    // must never block the AI response (lumen_v3_design.md, principle #4).
    result.explanation = LumenRules.explainEvaluation(result);

    return result;
  }

  function evaluatePreSend(text, goals, context = {}) {
    if (goals.mode !== "guard" || globalThis.LumenGoals?.isPaused?.()) {
      return { block: false };
    }
    if (!goals.protectedGoals?.length) {
      return { block: false, needsGoals: true };
    }

    const taskType = detectTaskType(text);
    const blockable = LumenRules.isGuardBlockable(text, goals.protectedGoals, {
      taskType,
      taskTypeExempt: context.taskTypeExempt || [],
    });
    if (!blockable) return { block: false };

    return {
      block: true,
      mismatch: blockable.mismatch,
      confidence: blockable.confidence,
      reasons: blockable.reasons,
      taskType,
    };
  }

  return {
    wordCount,
    isPassiveContinuation,
    evaluateMessage,
    evaluatePreSend,
    computeLoopSignals,
    detectTaskType,
    getUserMessageIndex,
    getTaskFramingTier,
    shouldShowOverlay,
    TASK_TYPE_MODIFIERS,
  };
})();

globalThis.LumenEngine = LumenEngine;
