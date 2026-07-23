const LumenJudge = (() => {
  const cache = new Map();
  const DEFAULT_API = LumenConfig.judgeApiUrl();

  function cacheKey(text, messageIndex) {
    return `${messageIndex}:${text.slice(0, 500)}`;
  }

  async function classify(text, evaluation) {
    const goals = globalThis.LumenGoals?.get?.() || {};
    // Run when the user explicitly opted in, or when the backend reports a
    // configured LLM key (auto-enabled). content.js decides *which* messages
    // are worth a call via LumenRules.shouldConsultJudge.
    if (!goals.llmJudgeEnabled && !goals.judgeAvailable) return null;

    const key = cacheKey(text, evaluation.messageIndex);
    if (cache.has(key)) return cache.get(key);

    const base = (goals.webAppUrl || "").replace(/\/$/, "");
    const apiUrl = goals.judgeApiUrl || (base ? `${base}/api/judge` : DEFAULT_API);
    try {
      const res = await globalThis.LumenNet.fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          messageIndex: evaluation.messageIndex,
          taskType: evaluation.taskType,
          rulePrimary: evaluation.primary,
          ruleConfidence: evaluation.confidence,
          ruleReasons: evaluation.reasons || [],
          loopScore: evaluation.loopScore,
        }),
      });
      if (!res.ok) return null;
      const verdict = await res.json();
      cache.set(key, verdict);
      return verdict;
    } catch (_) {
      return null;
    }
  }

  function mergeVerdict(evaluation, verdict) {
    if (!verdict?.signal) return evaluation;

    const tier1Exact =
      evaluation.framing?.tier === 1 && evaluation.framing?.source === "tier1";
    if (
      verdict.signal === "handoff" &&
      !tier1Exact &&
      (LumenRules.isUtilityTaskType?.(evaluation.taskType) ||
        LumenRules.isProvidedSourceSummarisation?.(evaluation.text || ""))
    ) {
      return {
        ...evaluation,
        judge: { ...verdict, signal: "none", rationale: "Utility / source summarisation — not a hand-off" },
        reasons: [...(evaluation.reasons || []), "Judge: utility task — no flag"],
        explanation: LumenRules.explainEvaluation(evaluation),
      };
    }

    const merged = { ...evaluation, judge: verdict, reasons: [...(evaluation.reasons || [])] };
    merged.reasons.push(`Judge: ${verdict.rationale || verdict.signal}`);

    if (verdict.confidence === "high" || verdict.confidence === "medium") {
      if (verdict.signal === "handoff") {
        merged.primary = "handoff";
        merged.handoff = {
          active: true,
          label: globalThis.LumenNudges.getHandOffLabel(),
          stripOnly: true,
        };
        // Hand-off never gates the answer — surface as a strip, not the overlay.
        merged.overlayType = null;
        merged.confidence = verdict.confidence === "high" ? "high" : "medium";
      } else if (verdict.signal === "engaged" || verdict.signal === "none") {
        merged.handoff = { active: false };
        merged.overlayType = null;
        // Affirmative Mirror: keep or promote a hands-on strip when engagement
        // override / scaffold / attempt-first already fired.
        if (evaluation.engagementOverride || evaluation.engaged?.active) {
          merged.primary = "engaged";
          merged.stance = evaluation.stance || evaluation.engaged?.stance || "steering";
          merged.engaged = {
            active: true,
            stance: merged.stance,
            label:
              evaluation.engaged?.label ||
              globalThis.LumenNudges.getEngagedLabel?.({
                stance: merged.stance,
                reasons: evaluation.reasons || [],
              }) ||
              "hands-on · you put real thought in",
          };
          merged.confidence = "low";
          merged.reasons.push("LLM: confirmed hands-on use");
        } else {
          merged.primary = null;
          merged.engaged = { active: false };
          merged.confidence = "low";
          merged.reasons.push("LLM: engaged use — no flag");
        }
      } else if (verdict.signal === "loop" && evaluation.messageIndex > 2) {
        merged.primary = "loop";
        merged.loop = {
          active: true,
          label: globalThis.LumenNudges.getLoopLabel(
            evaluation.loopSignals || {},
            evaluation.loopScore,
            0
          ),
        };
        if (evaluation.loopScore >= 70) merged.overlayType = "loop";
        merged.confidence = verdict.confidence;
      }
    } else if (verdict.signal === "handoff" && verdict.confidence === "low") {
      merged.handoff = {
        active: true,
        label: globalThis.LumenNudges.getHandOffLabel(),
        stripOnly: true,
      };
      merged.primary = "handoff";
      merged.overlayType = null;
    }

    merged.explanation = globalThis.LumenRules.explainEvaluation(merged);
    return merged;
  }

  return { classify, mergeVerdict };
})();

globalThis.LumenJudge = LumenJudge;
