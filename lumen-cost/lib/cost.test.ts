import { describe, expect, it } from "vitest";
import {
  approxTokenCount,
  costForTokens,
  estimateCallCost,
  estimateSavings,
  formatUsd,
} from "./cost";
import type { ModelPricing } from "./types";

const model: ModelPricing = {
  id: "test",
  name: "Test",
  provider: "Test",
  inputPerMillion: 1,
  outputPerMillion: 2,
  cachedInputPerMillion: 0.1,
  contextWindow: 128000,
  supportsCaching: true,
  tokenizer: "cl100k_base",
  exactTokenizer: true,
  tier: "flagship",
  downgradeTo: null,
};

describe("cost math", () => {
  it("computes per-million pricing", () => {
    expect(costForTokens(1_000_000, 2.5)).toBe(2.5);
    expect(costForTokens(500, 2)).toBeCloseTo(0.001);
  });

  it("estimates call cost", () => {
    const c = estimateCallCost(model, 1_000_000, 500_000);
    expect(c.inputUsd).toBe(1);
    expect(c.outputUsd).toBe(1);
    expect(c.totalUsd).toBe(2);
    expect(c.cachedInputUsd).toBeCloseTo(0.1);
  });

  it("scales monthly savings", () => {
    const s = estimateSavings(1000, model, 1000, "input");
    expect(s.tokens).toBe(1000);
    expect(s.usdPerCall).toBeCloseTo(0.001);
    expect(s.usdPerMonth).toBeCloseTo(1);
  });

  it("approx token count is positive", () => {
    expect(approxTokenCount("hello world from lumen")).toBeGreaterThan(2);
  });

  it("formats tiny usd", () => {
    expect(formatUsd(0.00001)).toBe("<$0.0001");
  });
});
