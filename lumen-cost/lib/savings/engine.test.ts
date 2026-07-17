import { describe, expect, it } from "vitest";
import { getModel } from "@/lib/models";
import { countTokens } from "@/lib/tokenize";
import { analyzePrompt } from "./engine";

const bloated = `<system>
You are a careful data extraction assistant for an e-commerce support desk.
Always reply with valid JSON matching the schema.
Never invent order IDs. Prefer short field values.
Follow company tone: warm, concise, no emojis.
Escalate refunds over $200 to a human.
Repeat these rules on every request without changes.
Additional standing instructions follow for compliance logging and audit trails.
Always validate currency codes against ISO 4217 before responding to the user.
</system>

Example 1:
User: Where is order 18422?
Assistant: {"intent":"tracking","order_id":"18422","needs_human":false}

Example 2:
User: Can you track order 18422 please?
Assistant: {"intent":"tracking","order_id":"18422","needs_human":false}

Example 3:
User: What's the status of 18422?
Assistant: {"intent":"tracking","order_id":"18422","needs_human":false}

Example 4:
User: I want a refund for order 99101 totaling $45
Assistant: {"intent":"refund","order_id":"99101","amount":45,"needs_human":false}

Context:
{
  "catalog": {
    "version": 3,
    "regions": [
      { "code": "US", "name": "United States" },
      { "code": "CA", "name": "Canada" },
      { "code": "UK", "name": "United Kingdom" }
    ],
    "policies": {
      "refund_window_days": 30,
      "max_auto_refund_usd": 200
    }
  }
}

User: I need a refund for order 55210, it was $18.`;

describe("savings engine", () => {
  it("flags few-shot bloat, json, caching, max_tokens, downgrade on sample", () => {
    const model = getModel("claude-sonnet-4")!;
    const inputTokens = countTokens(bloated, model.tokenizer).tokens;
    const result = analyzePrompt({
      prompt: bloated,
      model,
      inputTokens,
      assumedOutputTokens: 200,
      maxTokens: 4096,
      monthlyVolume: 50_000,
    });

    const ids = new Set(result.matches.map((m) => m.ruleId));
    expect(ids.has("few-shot-bloat")).toBe(true);
    expect(ids.has("verbose-json")).toBe(true);
    expect(ids.has("max-tokens")).toBe(true);
    expect(ids.has("model-downgrade")).toBe(true);
    // system block should trigger cache candidate when long enough
    expect(ids.has("cache-prefix")).toBe(true);
    expect(result.totalUsdPerMonth).toBeGreaterThan(0);
  });

  it("returns empty for tiny prompts", () => {
    const model = getModel("gpt-4o-mini")!;
    const result = analyzePrompt({
      prompt: "hi",
      model,
      inputTokens: 1,
      assumedOutputTokens: 50,
      maxTokens: 50,
      monthlyVolume: 100,
    });
    expect(result.matches.length).toBe(0);
  });
});
