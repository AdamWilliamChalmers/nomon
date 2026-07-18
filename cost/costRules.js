/**
 * Deterministic savings rules for the Cost coach.
 * Ported from lumen-cost/ — keep in sync when rules change.
 */
const LumenCostRules = (() => {
  const SYSTEMISH =
    /^(system|instructions?|role|persona|you are|always|never|guidelines?|policy)\b/im;
  const MARKER_BLOCKS =
    /<(system|instructions?|context|rules?)[^>]*>[\s\S]*?<\/\1>/gi;
  const EXAMPLE_HEADERS =
    /(?:^|\n)\s*(?:example|ex|shot|sample)\s*[#:]?\s*\d+\s*[:.)-]?\s*$/gim;
  const FEW_SHOT_LABEL = /(?:^|\n)\s*(?:user|assistant|human|ai)\s*:\s+/gi;

  function jaccard(a, b) {
    const ta = new Set(
      a
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2)
    );
    const tb = new Set(
      b
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2)
    );
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return inter / (ta.size + tb.size - inter);
  }

  function findJsonBlocks(text) {
    const blocks = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "{" && text[i] !== "[") continue;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{" || ch === "[") depth++;
        else if (ch === "}" || ch === "]") {
          depth--;
          if (depth === 0) {
            const raw = text.slice(i, j + 1);
            if (raw.length >= 80) blocks.push({ start: i, end: j + 1, raw });
            i = j;
            break;
          }
        }
      }
    }
    return blocks;
  }

  function chunkEnd(prompt, start, rawEnd) {
    const body = prompt.slice(start, rawEnd);
    const cut = body.search(
      /\n(?:Context|INPUT|Live user|Actual user)\s*:|\n\{[\s\S]{80,}$/i
    );
    if (cut > 40) return start + cut;
    const userHits = [...body.matchAll(/(?:^|\n)\s*User\s*:/gi)];
    if (userHits.length >= 2) {
      const last = userHits[userHits.length - 1].index ?? -1;
      if (last > 40) return start + last;
    }
    return rawEnd;
  }

  function cachePrefix(ctx) {
    const { prompt, model, inputTokens, monthlyVolume, estimateSavings } = ctx;
    if (!prompt.trim() || inputTokens < 120) return [];

    let cacheableChars = 0;
    let excerpt = "";
    const marked = [...prompt.matchAll(MARKER_BLOCKS)];
    if (marked.length > 0) {
      cacheableChars = marked.reduce((n, m) => n + m[0].length, 0);
      excerpt = marked[0][0].slice(0, 180);
    } else {
      const cut = Math.min(Math.floor(prompt.length * 0.4), 2400, prompt.length);
      const head = prompt.slice(0, cut);
      const looksSystem =
        SYSTEMISH.test(head) ||
        head.split("\n").filter((l) => l.trim().length > 40).length >= 6;
      if (looksSystem && head.trim().length >= 400) {
        cacheableChars = head.length;
        excerpt = head.slice(0, 180);
      }
    }

    const minChars = marked.length > 0 ? 280 : 400;
    if (cacheableChars < minChars) return [];

    const cacheableTokens = Math.round(
      inputTokens * (cacheableChars / Math.max(prompt.length, 1))
    );
    if (cacheableTokens < 80) return [];

    if (!model.supportsCaching || model.cachedInputPerMillion == null) {
      return [
        {
          ruleId: "cache-prefix",
          title: "Stable prefix — caching candidate",
          severity: "medium",
          summary: `~${cacheableTokens} tokens look static across calls.`,
          suggestion:
            "Isolate them as a system block and use a cache-capable model.",
          excerpt,
          estimate: estimateSavings(Math.round(cacheableTokens * 0.5), "input"),
        },
      ];
    }

    const full = (cacheableTokens / 1e6) * model.inputPerMillion;
    const cached = (cacheableTokens / 1e6) * model.cachedInputPerMillion;
    const usdPerCall = Math.max(0, full - cached);

    return [
      {
        ruleId: "cache-prefix",
        title: "Enable prompt caching",
        severity: "high",
        summary: `~${cacheableTokens} reusable tokens — cached input on ${model.name} is cheaper.`,
        suggestion:
          "Keep the static system block identical; put volatile user text after it.",
        excerpt,
        estimate: {
          tokens: cacheableTokens,
          usdPerCall,
          usdPerMonth: usdPerCall * monthlyVolume,
        },
      },
    ];
  }

  function fewShotBloat(ctx) {
    const { prompt, monthlyVolume, estimateSavings, countTokens } = ctx;
    if (prompt.length < 400) return [];

    const headers = [...prompt.matchAll(EXAMPLE_HEADERS)];
    const turnLabels = [...prompt.matchAll(FEW_SHOT_LABEL)];
    let chunks = [];

    if (headers.length >= 2) {
      for (let i = 0; i < headers.length; i++) {
        const start = headers[i].index ?? 0;
        const rawEnd =
          i + 1 < headers.length
            ? headers[i + 1].index ?? prompt.length
            : prompt.length;
        const end = chunkEnd(prompt, start, rawEnd);
        chunks.push({ start, end, text: prompt.slice(start, end) });
      }
    } else if (turnLabels.length >= 4) {
      const indices = turnLabels.map((m) => m.index ?? 0);
      for (let i = 0; i + 1 < indices.length; i += 2) {
        const start = indices[i];
        const rawEnd = i + 2 < indices.length ? indices[i + 2] : prompt.length;
        const end = chunkEnd(prompt, start, rawEnd);
        chunks.push({ start, end, text: prompt.slice(start, end) });
      }
    }

    if (chunks.length < 3) return [];

    const redundant = new Set();
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        if (jaccard(chunks[i].text, chunks[j].text) >= 0.5) {
          const drop =
            chunks[i].text.length >= chunks[j].text.length ? i : j;
          if (drop > 0) redundant.add(drop);
        }
      }
    }
    if (chunks.length >= 3) {
      for (let i = 2; i < chunks.length; i++) redundant.add(i);
    }
    if (!redundant.size) return [];

    let tokensSaved = 0;
    const excerpts = [];
    for (const idx of [...redundant].sort((a, b) => a - b)) {
      const c = chunks[idx];
      tokensSaved += countTokens(c.text);
      if (excerpts.length < 2) excerpts.push(c.text.trim().slice(0, 140));
    }
    if (tokensSaved < 40) return [];

    return [
      {
        ruleId: "few-shot-bloat",
        title: `Drop ${redundant.size} example${redundant.size > 1 ? "s" : ""}`,
        severity: tokensSaved > 400 ? "high" : "medium",
        summary: `${chunks.length} few-shot blocks; keep 1–2 diverse ones.`,
        suggestion: "Remove near-duplicates; prefer short input→output pairs.",
        excerpt: excerpts.join("\n---\n"),
        estimate: estimateSavings(tokensSaved, "input"),
      },
    ];
  }

  function verboseJson(ctx) {
    const { prompt, monthlyVolume, estimateSavings, countTokens } = ctx;
    const blocks = findJsonBlocks(prompt);
    if (!blocks.length) return [];

    let tokensSaved = 0;
    let rewritten = prompt;
    const excerpts = [];
    const sorted = [...blocks].sort((a, b) => b.start - a.start);

    for (const block of sorted) {
      try {
        const minified = JSON.stringify(JSON.parse(block.raw));
        if (minified.length >= block.raw.length * 0.95) continue;
        const delta = countTokens(block.raw) - countTokens(minified);
        if (delta < 8) continue;
        tokensSaved += delta;
        rewritten =
          rewritten.slice(0, block.start) + minified + rewritten.slice(block.end);
        if (excerpts.length < 2) excerpts.push(block.raw.slice(0, 120) + "…");
      } catch (_) {
        /* not JSON */
      }
    }

    if (tokensSaved < 12) return [];

    return [
      {
        ruleId: "verbose-json",
        title: "Minify JSON in your prompt",
        severity: tokensSaved > 200 ? "high" : "medium",
        summary: `Pretty-printed JSON costs ~${tokensSaved} extra tokens.`,
        suggestion: "Send compact JSON — models don't need indentation.",
        excerpt: excerpts.join("\n"),
        rewrittenPrompt: rewritten !== prompt ? rewritten : undefined,
        estimate: estimateSavings(tokensSaved, "input"),
      },
    ];
  }

  /**
   * Mirror-aware model fit: save (cheaper), hold (no tip), or upgrade (step up).
   * Biased toward HOLD — only tip when the draft clearly fits cheaper or heavier.
   */
  function assessCostFit(ctx) {
    const prompt = String(ctx.prompt || "");
    const goals = ctx.goals || {};
    const words = prompt.trim().split(/\s+/).filter(Boolean).length;
    const lower = prompt.toLowerCase();

    const taskType =
      globalThis.LumenEngine?.detectTaskType?.(prompt) || "general";
    const framing = globalThis.LumenRules?.analyzeFraming?.(prompt) || {
      tier: 0,
    };
    const utility = Boolean(globalThis.LumenRules?.isUtilityTaskType?.(taskType));
    const depthWarm = Boolean(globalThis.LumenNudges?.isHighStakesDepth?.(prompt));
    const engagement = globalThis.LumenRules?.checkEngagementOverride?.(prompt);
    const mismatch =
      Array.isArray(goals.protectedGoals) && goals.protectedGoals.length
        ? globalThis.LumenRules?.checkMismatchGoals?.(prompt, goals.protectedGoals)
        : null;

    // True heavies — not routine explain/teach (those are often Instant/Medium).
    const HEAVY_TASKS = new Set(["essay_writing", "code_generation"]);
    const SIMPLE_TASKS = new Set([
      "summarisation",
      "formatting",
      "translation",
      "conversion",
      "scheduling",
      "email_drafting",
      "fact_checking",
      "code_explanation",
    ]);

    const reasons = [];
    let score = 0; // negative → save, positive → upgrade

    // —— Upgrade signals (need a clear case; threshold is high) ——
    if (depthWarm) {
      score += 3;
      reasons.push("high-stakes decision");
    }
    if (mismatch) {
      score += 2;
      reasons.push("touches a protected goal");
    }
    if (
      /\b(invest|crypto|mortgage|lawsuit|diagnos|medical advice|architect(?:ure|ing)?|system design|migrate (the )?prod)\b/i.test(
        prompt
      )
    ) {
      score += 2;
      reasons.push("high-impact domain");
    }
    if (taskType === "code_generation" && words >= 60) {
      score += 2;
      reasons.push("substantial coding");
    } else if (HEAVY_TASKS.has(taskType)) {
      score += 1;
      reasons.push(taskType.replace(/_/g, " "));
    }
    if (engagement?.active && words >= 120) {
      score += 1;
      reasons.push("substantial own work");
    }
    if (
      framing.tier === 1 &&
      /\b(decide|choose|strateg|trade-?off|should i)\b/i.test(prompt)
    ) {
      score += 2;
      reasons.push("needs judgment");
    }

    // —— Save signals (routine production / extractive / light teaching) ——
    if (utility || SIMPLE_TASKS.has(taskType)) {
      score -= 2;
      reasons.push(taskType.replace(/_/g, " "));
    }
    if (taskType === "learning_concept" || taskType === "email_drafting") {
      score -= 1;
      reasons.push(taskType.replace(/_/g, " "));
    }
    if (
      /\b(\d+)\s*words?\b/i.test(prompt) ||
      /\b(short|brief|simple|eli5|plain language)\b/i.test(prompt)
    ) {
      score -= 2;
      reasons.push("bounded / simple ask");
    }
    if (
      /\b(\d+(st|nd|rd|th)\s*grade|for (kids|children|students|class|beginners)|explain .{0,40}(simply|to a))\b/i.test(
        lower
      )
    ) {
      score -= 3;
      reasons.push("teaching / beginner");
    }
    if (
      /\b(summari[sz]e|tldr|bullet|translate|reformat|rewrite|rephrase|extract|list|outline)\b/i.test(
        prompt
      )
    ) {
      score -= 2;
      reasons.push("extractive / rewrite");
    }
    if (
      /\b(write|draft|compose)\b/i.test(prompt) &&
      words < 55 &&
      !depthWarm &&
      !mismatch
    ) {
      score -= 2;
      reasons.push("short writing ask");
    }
    if (words > 0 && words < 40 && !depthWarm && !mismatch) {
      score -= 1;
      reasons.push("short draft");
    }
    if (/\b(debug|stack trace|typo|format this)\b/i.test(prompt)) {
      score -= 1;
      reasons.push("narrow fix");
    }

    // Structural cues (still local — no API): code fences / JSON lean save;
    // long multi-question deliberation leans upgrade.
    if (/```[\s\S]{40,}```/.test(prompt) || /\{[\s\S]{80,}\}/.test(prompt)) {
      score -= 1;
      reasons.push("structured paste");
    }
    const qMarks = (prompt.match(/\?/g) || []).length;
    if (qMarks >= 2 && words >= 50) {
      score += 1;
      reasons.push("multi-question");
    }

    // Personal on-device memory from tip accepts / dismisses — $0 to us.
    const memAdj = Number(globalThis.LumenCostLedger?.fitScoreAdjust?.(taskType)) || 0;
    if (memAdj) {
      score += memAdj;
      if (memAdj <= -0.5) reasons.push("your past tip choices");
      else if (memAdj >= 0.5) reasons.push("your past tip choices");
    }

    // Prefer HOLD unless the case is clear either way.
    let fit = "hold";
    if (score <= -2) fit = "save";
    else if (score >= 3) fit = "upgrade";

    return {
      fit,
      score,
      taskType,
      reasons: reasons.slice(0, 3),
      depthWarm: Boolean(depthWarm),
      mismatch: Boolean(mismatch),
      utility,
    };
  }

  function modelFit(ctx) {
    const {
      model,
      inputTokens,
      assumedOutputTokens,
      monthlyVolume,
      estimateCallCost,
      getModel,
      hostname,
    } = ctx;
    if (!model) return [];

    const fitInfo = assessCostFit(ctx);
    const modelsApi = globalThis.LumenCostModels;
    const current = estimateCallCost(model, inputTokens, assumedOutputTokens);

    if (fitInfo.fit === "hold") return [];

    if (fitInfo.fit === "upgrade") {
      const heavier =
        modelsApi?.stepUpFrom?.(model.id, hostname) ||
        null;
      if (!heavier || heavier.id === model.id) return [];
      const alt = estimateCallCost(heavier, inputTokens, assumedOutputTokens);
      const usdPerCall = Math.max(0, alt.totalUsd - current.totalUsd);
      const reason =
        fitInfo.reasons[0] || fitInfo.taskType.replace(/_/g, " ") || "this kind of prompt";
      return [
        {
          ruleId: "model-upgrade",
          fit: "upgrade",
          taskType: fitInfo.taskType,
          title: `Try ${heavier.name}`,
          severity: "high",
          summary: `This looks like it needs more horsepower (${reason}).`,
          suggestion: `Step up to ${heavier.name} for this draft. Drop back down for simpler asks.`,
          targetModelId: heavier.id,
          fromModelId: model.id,
          estimate: {
            tokens: 0,
            usdPerCall,
            usdPerMonth: usdPerCall * monthlyVolume,
          },
        },
      ];
    }

    // fit === save
    if (!model.downgradeTo) return [];
    const cheaper = getModel(model.downgradeTo);
    if (!cheaper || cheaper.id === model.id) return [];

    const alt = estimateCallCost(cheaper, inputTokens, assumedOutputTokens);
    const usdPerCall = current.totalUsd - alt.totalUsd;
    if (usdPerCall <= 0) return [];
    if (usdPerCall * monthlyVolume < 0.5 && usdPerCall < 0.001) return [];

    // Avoid Instant → Instant no-ops (economy → nano still maps to Instant).
    const fromIntel = modelsApi?.intelligenceOf?.(model.id);
    const toIntel = modelsApi?.intelligenceOf?.(cheaper.id);
    if (fromIntel && toIntel && fromIntel === toIntel) {
      return [];
    }

    const reason = fitInfo.reasons[0] || "simpler draft";
    return [
      {
        ruleId: "model-downgrade",
        fit: "save",
        taskType: fitInfo.taskType,
        title: `Try ${cheaper.name}`,
        severity: usdPerCall * monthlyVolume > 20 ? "high" : "medium",
        summary: `Fits a lighter model (${reason}). Save ~${Math.round(
          (usdPerCall / Math.max(current.totalUsd, 1e-12)) * 100
        )}% per call — verify quality first.`,
        suggestion: `Route this to ${cheaper.name}. Keep ${model.name} when the work needs harder reasoning.`,
        targetModelId: cheaper.id,
        fromModelId: model.id,
        estimate: {
          tokens: 0,
          usdPerCall,
          usdPerMonth: usdPerCall * monthlyVolume,
        },
      },
    ];
  }

  /**
   * Claude Effort Extra/Max burns limits faster (longer/more thorough replies).
   * Suggest High (default) when over-provisioned.
   */
  function effortRightsize(ctx) {
    const { effort, model, assumedOutputTokens, monthlyVolume, estimateCallCost } =
      ctx;
    if (!effort || (effort !== "extra" && effort !== "max")) return [];

    // Don't down-sell effort on drafts that need judgment.
    const fitInfo = assessCostFit(ctx);
    if (fitInfo.fit === "upgrade") return [];

    const highOut = Math.max(1, Math.round(assumedOutputTokens / (effort === "max" ? 2 : 1.45)));
    const current = estimateCallCost(model, ctx.inputTokens, assumedOutputTokens);
    const alt = estimateCallCost(model, ctx.inputTokens, highOut);
    const usdPerCall = Math.max(0, current.totalUsd - alt.totalUsd);
    if (usdPerCall <= 0) return [];

    return [
      {
        ruleId: "effort-rightsize",
        title: "Lower Effort to High",
        severity: effort === "max" ? "high" : "medium",
        summary: `Effort ${effort[0].toUpperCase()}${effort.slice(
          1
        )} uses limits faster with longer replies. High is Claude's default for most tasks.`,
        suggestion:
          "Drop Effort to High (or Medium) unless this prompt truly needs Max thoroughness.",
        switchAction: {
          kind: "effort",
          value: "high",
          uiLabel: "High",
          buttonLabel: "Switch Effort to High",
        },
        estimate: {
          tokens: Math.max(0, assumedOutputTokens - highOut),
          usdPerCall,
          usdPerMonth: usdPerCall * monthlyVolume,
        },
      },
    ];
  }

  const RULES = [
    cachePrefix,
    fewShotBloat,
    verboseJson,
    modelFit,
    effortRightsize,
  ];

  function isExtractiveAsk(prompt) {
    return /\b(summari[sz]e|tldr|bullet|in\s+\d+\s+bullets?|\d+\s+bullets?|extract|key points|tl;?dr)\b/i.test(
      String(prompt || "")
    );
  }

  function runAll(ctx) {
    const matches = [];
    for (const rule of RULES) {
      try {
        matches.push(...rule(ctx));
      } catch (_) {
        /* never break coaching */
      }
    }
    const severityRank = { high: 3, medium: 2, low: 1 };
    const extractive = isExtractiveAsk(ctx.prompt);
    const isModelTip = (m) =>
      m?.ruleId === "model-downgrade" || m?.ruleId === "model-upgrade";

    matches.sort((a, b) => {
      // Clear extractive asks (summarise / N bullets): prefer model fit over
      // cache/JSON tips so users see Instant/Medium coaching first.
      if (extractive) {
        const aM = isModelTip(a);
        const bM = isModelTip(b);
        if (aM && !bM) return -1;
        if (bM && !aM) return 1;
      }
      if (a.fit === "upgrade" && b.fit !== "upgrade") return -1;
      if (b.fit === "upgrade" && a.fit !== "upgrade") return 1;
      const sr =
        (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (sr) return sr;
      return (b.estimate?.usdPerMonth || 0) - (a.estimate?.usdPerMonth || 0);
    });
    return matches;
  }

  return { runAll, assessCostFit, isExtractiveAsk };
})();

globalThis.LumenCostRules = LumenCostRules;
