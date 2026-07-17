import type { CostBreakdown, ModelPricing, SavingsEstimate } from "./types";

export function costForTokens(
  tokens: number,
  usdPerMillion: number
): number {
  return (tokens / 1_000_000) * usdPerMillion;
}

export function estimateCallCost(
  model: ModelPricing,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const inputUsd = costForTokens(inputTokens, model.inputPerMillion);
  const outputUsd = costForTokens(outputTokens, model.outputPerMillion);
  const cachedInputUsd =
    model.cachedInputPerMillion != null
      ? costForTokens(inputTokens, model.cachedInputPerMillion)
      : null;

  return {
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + outputUsd,
    cachedInputUsd,
  };
}

export function estimateSavings(
  tokensSaved: number,
  model: ModelPricing,
  monthlyVolume: number,
  /** Defaults to input-side savings (most prompt optimizations). */
  side: "input" | "output" = "input"
): SavingsEstimate {
  const rate =
    side === "input" ? model.inputPerMillion : model.outputPerMillion;
  const usdPerCall = costForTokens(tokensSaved, rate);
  return {
    tokens: Math.max(0, Math.round(tokensSaved)),
    usdPerCall,
    usdPerMonth: usdPerCall * Math.max(0, monthlyVolume),
  };
}

/** Rough chars→tokens for non-OpenAI models. ~4 chars/token English. */
export function approxTokenCount(text: string): number {
  if (!text) return 0;
  // Slightly conservative: count whitespace-separated + punctuation weight
  const byChars = Math.ceil(text.length / 4);
  const byWords = Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
  return Math.max(byChars, byWords);
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.0001) return "<$0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}
