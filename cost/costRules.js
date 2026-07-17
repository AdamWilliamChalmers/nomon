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

  function modelDowngrade(ctx) {
    const {
      model,
      inputTokens,
      assumedOutputTokens,
      monthlyVolume,
      estimateCallCost,
      getModel,
    } = ctx;
    if (!model.downgradeTo || model.tier === "economy") return [];
    const cheaper = getModel(model.downgradeTo);
    if (!cheaper) return [];

    const current = estimateCallCost(model, inputTokens, assumedOutputTokens);
    const alt = estimateCallCost(cheaper, inputTokens, assumedOutputTokens);
    const usdPerCall = current.totalUsd - alt.totalUsd;
    if (usdPerCall <= 0) return [];
    if (usdPerCall * monthlyVolume < 0.5 && usdPerCall < 0.001) return [];

    return [
      {
        ruleId: "model-downgrade",
        title: `Try ${cheaper.name}`,
        severity: usdPerCall * monthlyVolume > 20 ? "high" : "medium",
        summary: `Often enough for extraction / short Q&A. Save ~${Math.round(
          (usdPerCall / current.totalUsd) * 100
        )}% per call — verify quality first.`,
        suggestion: `Route this job to ${cheaper.name}. Keep ${model.name} for hard reasoning.`,
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
    modelDowngrade,
    effortRightsize,
  ];

  function runAll(ctx) {
    const matches = [];
    for (const rule of RULES) {
      try {
        matches.push(...rule(ctx));
      } catch (_) {
        /* never break coaching */
      }
    }
    matches.sort((a, b) => b.estimate.usdPerMonth - a.estimate.usdPerMonth);
    return matches;
  }

  return { runAll };
})();

globalThis.LumenCostRules = LumenCostRules;
