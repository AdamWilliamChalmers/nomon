export type TokenizerFamily =
  | "cl100k_base"
  | "o200k_base"
  | "approx_claude"
  | "approx_gemini";

export type ModelTier = "flagship" | "economy" | "reasoning";

export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion: number | null;
  contextWindow: number;
  supportsCaching: boolean;
  tokenizer: TokenizerFamily;
  exactTokenizer: boolean;
  tier: ModelTier;
  downgradeTo: string | null;
}

export interface ModelsCatalog {
  updatedAt: string;
  models: ModelPricing[];
}

export interface TokenCount {
  tokens: number;
  exact: boolean;
  tokenizer: TokenizerFamily;
}

export interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
  cachedInputUsd: number | null;
}

export interface SavingsEstimate {
  tokens: number;
  usdPerCall: number;
  usdPerMonth: number;
}

export interface RuleMatch {
  ruleId: string;
  title: string;
  severity: "high" | "medium" | "low";
  summary: string;
  suggestion: string;
  /** Span into the prompt when applicable */
  excerpt?: string;
  start?: number;
  end?: number;
  estimate: SavingsEstimate;
  /** Optional rewritten prompt snippet or full rewrite */
  rewrittenPrompt?: string;
}

export interface AnalyzeContext {
  prompt: string;
  model: ModelPricing;
  inputTokens: number;
  /** Assumed output tokens per call for cost projection */
  assumedOutputTokens: number;
  /** Max tokens budget the user set (optional) */
  maxTokens: number | null;
  /** Monthly call volume for $ projection */
  monthlyVolume: number;
}

export interface SavingsRule {
  id: string;
  title: string;
  detect(ctx: AnalyzeContext): RuleMatch[];
}
