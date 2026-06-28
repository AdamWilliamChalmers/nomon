const LumenJudge = (() => {
  const cache = new Map();
  const DEFAULT_API = "http://localhost:3000/api/judge";

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
        merged.primary = null;
        merged.handoff = { active: false };
        merged.overlayType = null;
        merged.confidence = "low";
        merged.reasons.push("LLM: engaged use — no flag");
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
