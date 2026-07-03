const LumenRules = (() => {
  const TIER1_PATTERNS = [
    { id: "write_me", re: /write me\b/i, label: "write me" },
    { id: "write_my", re: /write my\b/i, label: "write my" },
    { id: "write_generic", re: /\bwrite (me |us )?(an?|the|some)\b/i, label: "write it for me" },
    { id: "write_entire", re: /write the entire|entire paper|paper for me|write the whole/i, label: "whole task" },
    {
      id: "write_artifact",
      re: /write (an |the |this |my )?(essay|paper|assignment|report|thesis)/i,
      label: "write essay/paper",
    },
    { id: "can_write", re: /can you write|could you write|please write/i, label: "can you write" },
    { id: "do_for_me", re: /\bdo (this|it|my|the|all|your)\b[^?]*\bfor me\b|complete this for me/i, label: "do for me" },
    { id: "generate", re: /generate a|create a|produce a|make me|build me|come up with/i, label: "generate/create" },
    {
      id: "make_build",
      re: /\b(make|build|design|develop|code)\b (me |us )?(a|an|the|my|some)\b/i,
      label: "make/build for me",
    },
    {
      id: "ideate",
      re: /\b(give me|suggest|think of|come up with)\b[^?]*\b(idea|ideas|name|names|topic|topics|concept|concepts)\b|\bany ideas\b/i,
      label: "ideate for me",
    },
    { id: "just_do", re: /just do|can you do/i, label: "just do it" },
    { id: "give_full", re: /give me a full|give me all citations|give me a/i, label: "give me full output" },
    { id: "complete", re: /complete this|finish this|turn this into|output a/i, label: "complete/finish" },
    { id: "draft_for", re: /\bdraft (a|an|the|my)\b/i, label: "draft for me" },
  ];

  const TIER2_PATTERNS = [
    { id: "help_write", re: /help me write/i, label: "help me write" },
    { id: "improve", re: /improve this|fix this|rewrite this|polish this|clean up this/i, label: "improve/rewrite" },
  ];

  const TIER0_PATTERNS = [
    { id: "learn", re: /how do i|why does|what is|help me understand|explain/i, label: "learning question" },
    { id: "review", re: /review my (thinking|reasoning|draft|approach)/i, label: "review my work" },
    { id: "critique", re: /what would you change|does this make sense|what am i missing|push back on|challenge this/i, label: "critique request" },
  ];

  const MISMATCH_DELEGATION = [
    /write me\b/i,
    /write my\b/i,
    /write the/i,
    /\bwrite (me |us )?an?\b/i,
    /can you write/i,
    /create a/i,
    /generate a/i,
    /\bdraft (a|an|the|my)\b/i,
    /\bdo (this|it|my|the|all|your)\b[^?]*\bfor me\b/i,
    /make me/i,
    /just do/i,
    /can you do/i,
  ];

  const ENGAGEMENT_MARKERS = [
    /\bi think\b/i,
    /\bmy (view|take|draft|attempt|understanding|hypothesis|instinct)\b/i,
    /\bi('ve| have) (been|tried|started|written|drafted|noticed|wondered)\b/i,
    /\bi('m| am) (not sure|wondering|trying to understand|struggling with)\b/i,
    /\bhere('s| is) (my|what i)\b/i,
    /\bbelow is (my|the)\b/i,
  ];

  const USER_CONTEXT_MARKERS = [
    /\bhere('s| is) (my|the) (draft|attempt|version|notes|outline|thinking)\b/i,
    /\bhere('s| is) what i (tried|did|have|wrote|attempted|came up with)\b/i,
    /\bi wrote\b/i,
    /\bmy current (draft|version|thinking)\b/i,
    /\bwhat i have so far\b/i,
  ];

  const ENGAGEMENT_WORD_THRESHOLD = 50;

  // Directive / imperative prompts are the classic subtle hand-off the regex
  // tiers miss ("write a nice email", "summarise this", "just go with yours").
  // Used only to decide whether to spend a cheap LLM judge call — never to
  // flag on its own.
  const INSTRUCTION_VERBS =
    /\b(write|draft|compose|create|generate|make|build|summari[sz]e|rewrite|rephrase|reword|fix|improve|polish|translate|finish|complete|plan|outline|design|implement|code|solve|answer|respond|reply|decide|choose|pick|optimi[sz]e|refactor|debug|format|edit|expand|shorten|continue|redo|handle|sort)\b/i;
  const IMPERATIVE_START =
    /^(please\s+|can you\s+|could you\s+|just\s+)?(write|draft|compose|create|generate|make|build|summari[sz]e|rewrite|fix|improve|polish|translate|finish|complete|plan|outline|design|implement|code|solve|answer|respond|reply|decide|choose|pick|continue|redo|give|tell|show|handle|do)\b/i;

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function matchPatterns(text, patterns) {
    return patterns.filter((p) => p.re.test(text)).map((p) => p.label);
  }

  function semanticDelegation(text) {
    const t = text.toLowerCase();
    const writeIntent = /\b(write|draft|produce|generate|compose|complete|finish)\b/.test(t);
    const wholeTask = /\b(essay|paper|assignment|thesis|report|analysis|argument)\b/.test(t);
    const forMe = /\b(for me|in one go|entire|whole|full|all citations)\b/.test(t);
    const compareTask = /\b(compar(e|ing|ison)|contrast|versus|vs\.?)\b/.test(t);
    return writeIntent && (wholeTask || forMe || (compareTask && writeIntent));
  }

  function analyzeFraming(text) {
    const tier0 = matchPatterns(text, TIER0_PATTERNS);
    if (tier0.length) return { tier: 0, matches: tier0, source: "tier0" };

    const tier1 = matchPatterns(text, TIER1_PATTERNS);
    if (tier1.length) return { tier: 1, matches: tier1, source: "tier1" };

    if (semanticDelegation(text)) {
      return { tier: 1, matches: ["semantic delegation"], source: "semantic" };
    }

    const tier2 = matchPatterns(text, TIER2_PATTERNS);
    if (tier2.length) return { tier: 2, matches: tier2, source: "tier2" };

    return { tier: 0, matches: [], source: "none" };
  }

  function hasEngagementMarkers(text) {
    return ENGAGEMENT_MARKERS.some((re) => re.test(text));
  }

  function hasUserProvidedContext(text) {
    return USER_CONTEXT_MARKERS.some((re) => re.test(text));
  }

  function checkEngagementOverride(text) {
    const words = wordCount(text);
    const reasons = [];
    if (hasUserProvidedContext(text)) reasons.push("You shared your own draft or notes");
    if (hasEngagementMarkers(text)) reasons.push("Engagement markers in your prompt");
    if (words >= ENGAGEMENT_WORD_THRESHOLD) reasons.push(`${words} words — substantial input`);

    const active =
      hasUserProvidedContext(text) ||
      (words >= ENGAGEMENT_WORD_THRESHOLD && hasEngagementMarkers(text)) ||
      words >= ENGAGEMENT_WORD_THRESHOLD + 30;

    return { active, reasons };
  }

  function looksLikeInstruction(text) {
    const t = (text || "").trim();
    if (!t) return false;
    const words = wordCount(t);
    // Subtle hand-offs are short, directive prompts. Long prompts are handled
    // by the engagement override (they usually carry the user's own thinking).
    return words <= 40 && (IMPERATIVE_START.test(t) || INSTRUCTION_VERBS.test(t));
  }

  // Decide whether a cheap LLM judge call is worth making. We consult the LLM
  // for borderline ("gray") cases AND for substantive, unflagged directives the
  // rule tiers missed — but never when the user clearly engaged, and never when
  // the rules are already confident. opts.passiveLater catches mid-conversation
  // passive continuations (the subtle "loop" pattern).
  function shouldConsultJudge(evaluation, text, opts = {}) {
    if (!text) return false;
    if (evaluation?.confidence === "gray") return true;
    if (evaluation?.confidence === "high") return false;
    if (checkEngagementOverride(text).active) return false;
    // The user showed their own work (draft / attempt / notes) — that's
    // engagement, not offloading. Don't spend an LLM call second-guessing it.
    if (hasUserProvidedContext(text)) return false;
    if (looksLikeInstruction(text)) return true;
    if (opts.passiveLater) return true;
    return false;
  }

  function isStrongDelegation(text, framing) {
    const f = framing || analyzeFraming(text);
    return f.tier === 1 && f.source !== "semantic";
  }

  function computeConfidence({
    text,
    framing,
    engagementOverride,
    exempt,
    messageIndex,
    loopScore,
    loopThreshold,
    primary,
  }) {
    const reasons = [];

    if (exempt) {
      return { level: "low", reasons: ["Task type is in your exemption list"], overlay: false };
    }
    if (engagementOverride?.active) {
      return {
        level: "low",
        reasons: engagementOverride.reasons,
        overlay: false,
      };
    }

    // Mismatch is grounded in an explicit goal the user set plus a delegation
    // match — high precision, so trust it without spending an LLM call.
    if (primary === "mismatch") {
      return { level: "high", reasons: ["This conflicts with a goal you set"], overlay: false };
    }

    if (primary === "handoff" || (messageIndex <= 2 && framing.tier === 1)) {
      reasons.push(...framing.matches.map((m) => `Matched: ${m}`));
      if (framing.source === "semantic") {
        return { level: "gray", reasons: [...reasons, "Semantic fallback — not exact phrase"], overlay: false };
      }
      return { level: "high", reasons, overlay: messageIndex <= 2 };
    }

    if (messageIndex <= 2 && framing.tier === 2) {
      return {
        level: "gray",
        reasons: [...framing.matches.map((m) => `Matched: ${m}`), "Partial delegation (Tier 2)"],
        overlay: false,
      };
    }

    if (messageIndex <= 2 && framing.tier === 0 && semanticDelegation(text)) {
      return {
        level: "gray",
        reasons: ["Semantic delegation without Tier 1 phrase"],
        overlay: false,
      };
    }

    if (primary === "loop" && loopScore >= loopThreshold && loopScore < loopThreshold + 10) {
      return {
        level: "gray",
        reasons: [`Borderline loop score (${loopScore})`],
        overlay: false,
      };
    }

    if (primary === "loop" && loopScore >= 70) {
      return { level: "high", reasons: [`Loop score ${loopScore}`], overlay: messageIndex > 2 };
    }

    return { level: "low", reasons: ["No strong signal"], overlay: false };
  }

  // Guard mode only: hold send when a tier-1 delegation prompt clearly conflicts
  // with a user-stated protected goal. Semantic / tier-2 cases stay post-send
  // nudges — not confident enough to block.
  function isGuardBlockable(text, protectedGoals, options = {}) {
    if (!protectedGoals?.length || !text?.trim()) return null;
    if (checkEngagementOverride(text).active) return null;
    if (options.taskTypeExempt?.includes(options.taskType)) return null;

    const mismatch = checkMismatchGoals(text, protectedGoals);
    if (!mismatch) return null;

    const framing = analyzeFraming(text);
    if (framing.tier !== 1 || framing.source !== "tier1") return null;

    return {
      mismatch,
      confidence: "high",
      reasons: ["This conflicts with a goal you set", ...framing.matches.map((m) => `Matched: ${m}`)],
    };
  }

  function checkMismatchGoals(text, protectedGoals) {
    if (!protectedGoals?.length) return null;
    for (const goal of protectedGoals) {
      const goalLower = goal.toLowerCase();
      if (
        (goalLower.includes("draft") || goalLower.includes("essay") || goalLower.includes("write")) &&
        MISMATCH_DELEGATION.some((re) => re.test(text))
      ) {
        return { goal, reason: "drafting" };
      }
      if (goalLower.includes("decision") && /decide for me|what should i choose|pick for me|tell me what to do/i.test(text)) {
        return { goal, reason: "decisions" };
      }
      if (goalLower.includes("code") && /write (the|this) code|implement this for me|code this for me/i.test(text)) {
        return { goal, reason: "code" };
      }
      if (goalLower.includes("analysis") && /analyze this for me|do the analysis|run the analysis for me/i.test(text)) {
        return { goal, reason: "analysis" };
      }
      if (MISMATCH_DELEGATION.some((re) => re.test(text)) && goalLower.length > 12) {
        return { goal, reason: "delegation" };
      }
    }
    return null;
  }

  function explainEvaluation(evaluation) {
    const parts = [];
    if (evaluation.reasons?.length) parts.push(...evaluation.reasons);
    if (evaluation.judge?.rationale) parts.push(`LLM: ${evaluation.judge.rationale}`);
    if (evaluation.framing?.matches?.length && !evaluation.reasons?.length) {
      parts.push(...evaluation.framing.matches.map((m) => `Matched: ${m}`));
    }
    if (evaluation.messageIndex != null) parts.unshift(`Message ${evaluation.messageIndex} in chat`);
    if (evaluation.taskType) parts.push(`Task: ${evaluation.taskType.replace(/_/g, " ")}`);
    if (evaluation.confidence) parts.push(`Confidence: ${evaluation.confidence}`);
    return parts.filter(Boolean).slice(0, 5).join(" · ");
  }

  return {
    TIER1_PATTERNS,
    TIER2_PATTERNS,
    TIER0_PATTERNS,
    MISMATCH_DELEGATION,
    ENGAGEMENT_MARKERS,
    USER_CONTEXT_MARKERS,
    wordCount,
    analyzeFraming,
    semanticDelegation,
    checkEngagementOverride,
    hasEngagementMarkers,
    hasUserProvidedContext,
    looksLikeInstruction,
    shouldConsultJudge,
    isStrongDelegation,
    computeConfidence,
    checkMismatchGoals,
    isGuardBlockable,
    explainEvaluation,
  };
})();

globalThis.LumenRules = LumenRules;
