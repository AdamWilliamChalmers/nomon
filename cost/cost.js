/**
 * Nomon Cost coach — local draft analysis (never networked).
 * Approx tokenization only (keeps the content-script bundle small).
 */
const LumenCost = (() => {
  // Show a spend strip once the draft is a short sentence; tips still need more signal.
  const MIN_CHARS = 40;

  function approxTokenCount(text) {
    if (!text) return 0;
    const byChars = Math.ceil(text.length / 4);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const byWords = Math.ceil(words * 1.3);
    return Math.max(byChars, byWords);
  }

  function costForTokens(tokens, usdPerMillion) {
    return (tokens / 1_000_000) * usdPerMillion;
  }

  function estimateCallCost(model, inputTokens, outputTokens) {
    const inputUsd = costForTokens(inputTokens, model.inputPerMillion);
    const outputUsd = costForTokens(outputTokens, model.outputPerMillion);
    return {
      inputUsd,
      outputUsd,
      totalUsd: inputUsd + outputUsd,
    };
  }

  function formatUsd(n) {
    if (!Number.isFinite(n)) return "—";
    if (n === 0) return "$0";
    if (n < 0.0001) return "<$0.0001";
    if (n < 0.01) return `$${n.toFixed(4)}`;
    if (n < 1) return `$${n.toFixed(3)}`;
    if (n < 100) return `$${n.toFixed(2)}`;
    return `$${Math.round(n)}`;
  }

  function formatTokens(n) {
    if (n < 1000) return String(n);
    if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
    return `${Math.round(n / 1000)}k`;
  }

  /**
   * Analyze a composer draft.
   * @param {string} text
   * @param {object} goals - LumenGoals.get()
   * @param {{ hostname?: string, selectedModel?: object }} [opts]
   */
  function analyze(text, goals = {}, opts = {}) {
    const enabled = Boolean(goals.costEnabled);
    const level = goals.costLevel === "full" ? "full" : "subtle";
    if (!enabled) {
      return { show: false, reason: "off" };
    }

    const trimmed = String(text || "").trim();
    if (trimmed.length < MIN_CHARS) {
      return { show: false, reason: "short" };
    }

    const models = globalThis.LumenCostModels;
    const rules = globalThis.LumenCostRules;
    if (!models || !rules) {
      return { show: false, reason: "missing-module" };
    }

    const resolved = models.resolveForAnalysis(
      {
        hostname: opts.hostname || location.hostname,
        selectedModel: opts.selectedModel || null,
      },
      goals
    );
    const model = resolved.model;
    const modelLabel = resolved.label || model.name;
    const effort = resolved.effort || null;
    const outputMult = Number(resolved.outputMult) > 0 ? Number(resolved.outputMult) : 1;
    const monthlyVolume = Math.max(1, Number(goals.costMonthlyVolume) || 1000);
    const learnedOutput = globalThis.LumenCostLedger?.summarize?.()?.suggestedAssumedOutput;
    const baseAssumedOutput = Math.max(
      1,
      Number(learnedOutput) || Number(goals.costAssumedOutput) || 400
    );
    const assumedOutputTokens = Math.max(1, Math.round(baseAssumedOutput * outputMult));

    const inputTokens = approxTokenCount(trimmed);
    const callCost = estimateCallCost(model, inputTokens, assumedOutputTokens);

    const estimateSavings = (tokensSaved, side = "input") => {
      const rate =
        side === "input" ? model.inputPerMillion : model.outputPerMillion;
      const usdPerCall = costForTokens(Math.max(0, tokensSaved), rate);
      return {
        tokens: Math.max(0, Math.round(tokensSaved)),
        usdPerCall,
        usdPerMonth: usdPerCall * monthlyVolume,
      };
    };

    const matches = rules.runAll({
      prompt: trimmed,
      model,
      inputTokens,
      assumedOutputTokens,
      monthlyVolume,
      estimateSavings,
      estimateCallCost,
      countTokens: approxTokenCount,
      getModel: (id) => models.get(id),
      effort,
      outputMult,
    });

    const hostname = opts.hostname || (typeof location !== "undefined" ? location.hostname : "");
    const h = String(hostname || "").toLowerCase();
    const hClaude = h.includes("claude");
    const hGemini = h.includes("gemini") || h.includes("google");
    for (const m of matches) {
      if (m.ruleId === "model-downgrade" && m.targetModelId && !m.switchAction) {
        m.switchAction = models.switchActionFor?.(m.targetModelId, hostname) || null;
      }
      // Host-facing tip copy only — never invent picker labels.
      if (m.ruleId === "model-downgrade" && m.switchAction?.kind === "intelligence") {
        const to = m.switchAction.uiLabel || "Instant";
        const fromIntel = String(modelLabel || "")
          .replace(/\s*·.*$/, "")
          .trim();
        const from =
          /^(instant|medium|high)\b/i.test(fromIntel) ? fromIntel : null;
        m.title = `Try ${to}`;
        m.suggestion = from
          ? `Switch Intelligence to ${to} in the ChatGPT menu. Keep ${from} (or High) when you need harder reasoning.`
          : `Switch Intelligence to ${to} in the ChatGPT menu. Use Medium/High only when you need harder reasoning.`;
        m.summary = `Often enough for extraction / short Q&A. Save ~${Math.round(
          (m.estimate.usdPerCall / Math.max(callCost.totalUsd, 1e-12)) * 100
        )}% per call — verify quality first.`;
      } else if (
        m.ruleId === "model-downgrade" &&
        m.switchAction &&
        (hClaude || hGemini)
      ) {
        // Claude/Gemini tips use exact picker labels (Haiku 4.5, 3.1 Flash-Lite).
        const to = m.switchAction.uiLabel || m.switchAction.value;
        const fromShort = String(modelLabel || "")
          .replace(/^Claude\s+/i, "")
          .replace(/^Gemini\s+/i, "")
          .replace(/\s*·.*$/, "")
          .trim();
        if (to) {
          m.title = `Try ${to}`;
          m.suggestion = fromShort
            ? `Switch to ${to} in the model menu. Keep ${fromShort} for harder work.`
            : `Switch to ${to} in the model menu.`;
          m.summary = `Often enough for extraction / short Q&A. Save ~${Math.round(
            (m.estimate.usdPerCall / Math.max(callCost.totalUsd, 1e-12)) * 100
          )}% per call — verify quality first.`;
        }
      }
    }

    const totalUsdPerMonth = matches.reduce((n, m) => n + m.estimate.usdPerMonth, 0);
    const top = matches[0] || null;

    // Lead with detected picker label so Spend matches what ChatGPT shows
    const stripLine = top
      ? `~${formatTokens(inputTokens)} · ${formatUsd(callCost.totalUsd)}/call · ${top.title}`
      : `~${formatTokens(inputTokens)} · ~${formatUsd(callCost.totalUsd)} on ${modelLabel}`;

    return {
      show: true,
      level,
      model,
      modelLabel,
      modelConfidence: resolved.confidence,
      modelSource: resolved.source,
      effort,
      inputTokens,
      callCost,
      matches,
      top,
      totalUsdPerMonth,
      stripLine,
      pricesUpdatedAt: models.UPDATED_AT,
      pricesSource: models.SOURCE,
      approx: true,
      apiRatesNote: true,
    };
  }

  /**
   * Post-reply estimate using actual answer text (still approx tokens, not a receipt).
   */
  function estimateCompletedCall(inputText, outputText, goals = {}, opts = {}) {
    const models = globalThis.LumenCostModels;
    if (!models) return null;

    const resolved = models.resolveForAnalysis(
      {
        hostname: opts.hostname || (typeof location !== "undefined" ? location.hostname : ""),
        selectedModel: opts.selectedModel || null,
      },
      goals
    );
    const model = resolved.model;
    if (!model) return null;

    const inputTokens = approxTokenCount(String(inputText || "").trim());
    const outputTokens = approxTokenCount(String(outputText || "").trim());
    if (inputTokens + outputTokens < 8) return null;

    const callCost = estimateCallCost(model, inputTokens, outputTokens);
    return {
      model,
      modelLabel: resolved.label || model.name,
      modelConfidence: resolved.confidence,
      inputTokens,
      outputTokens,
      tokens: inputTokens + outputTokens,
      callCost,
      usd: callCost.totalUsd,
      approx: true,
    };
  }

  return {
    analyze,
    estimateCompletedCall,
    approxTokenCount,
    estimateCallCost,
    formatUsd,
    formatTokens,
  };
})();

globalThis.LumenCost = LumenCost;
