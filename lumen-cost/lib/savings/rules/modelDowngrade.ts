import { estimateCallCost } from "@/lib/cost";
import type {
  AnalyzeContext,
  ModelPricing,
  RuleMatch,
  SavingsRule,
} from "@/lib/types";
import catalog from "@/data/models.json";

function byId(id: string): ModelPricing | undefined {
  return (catalog.models as ModelPricing[]).find((m) => m.id === id);
}

/**
 * Suggest a cheaper model in the same family when on a flagship tier.
 */
export const modelDowngradeRule: SavingsRule = {
  id: "model-downgrade",
  title: "Cheaper model, same job",
  detect(ctx: AnalyzeContext): RuleMatch[] {
    const { model, inputTokens, assumedOutputTokens, monthlyVolume } = ctx;
    if (!model.downgradeTo) return [];

    const cheaper = byId(model.downgradeTo);
    if (!cheaper) return [];

    // Don't nag economy tiers
    if (model.tier === "economy") return [];

    const current = estimateCallCost(
      model,
      inputTokens,
      assumedOutputTokens
    );
    const alt = estimateCallCost(
      cheaper,
      inputTokens,
      assumedOutputTokens
    );
    const usdPerCall = current.totalUsd - alt.totalUsd;
    if (usdPerCall <= 0) return [];

    // Only surface if monthly impact is meaningful at user's volume
    if (usdPerCall * monthlyVolume < 0.5 && usdPerCall < 0.001) return [];

    return [
      {
        ruleId: "model-downgrade",
        title: `Try ${cheaper.name} instead of ${model.name}`,
        severity: usdPerCall * monthlyVolume > 20 ? "high" : "medium",
        summary: `For many classification, rewrite, extraction, and short Q&A jobs, ${cheaper.name} is enough. Est. save ${Math.round(
          (usdPerCall / current.totalUsd) * 100
        )}% per call — verify quality on a sample first.`,
        suggestion: `Route this workload to ${cheaper.name} (${cheaper.provider}). Keep ${model.name} for hard reasoning / high-stakes tasks. This is guidance, not a quality guarantee.`,
        estimate: {
          tokens: 0,
          usdPerCall,
          usdPerMonth: usdPerCall * monthlyVolume,
        },
      },
    ];
  },
};
