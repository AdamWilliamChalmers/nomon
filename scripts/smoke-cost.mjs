import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, location: { hostname: "claude.ai" } };
vm.createContext(ctx);
for (const f of ["cost/models.js", "cost/costRules.js", "cost/cost.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}

const sample = `<system>
You are a careful data extraction assistant for an e-commerce support desk.
Always reply with valid JSON matching the schema.
Never invent order IDs. Prefer short field values.
Follow company tone: warm, concise, no emojis.
Escalate refunds over 200 dollars to a human.
</system>

Example 1:
User: Where is order 18422?
Assistant: {"intent":"tracking","order_id":"18422"}

Example 2:
User: Can you track order 18422 please?
Assistant: {"intent":"tracking","order_id":"18422"}

Example 3:
User: What's the status of 18422?
Assistant: {"intent":"tracking","order_id":"18422"}

Example 4:
User: I want a refund for order 99101 totaling 45
Assistant: {"intent":"refund","order_id":"99101"}

Context:
{
  "catalog": {
    "version": 3,
    "regions": [
      { "code": "US", "name": "United States" },
      { "code": "CA", "name": "Canada" }
    ]
  }
}

User: I need a refund for order 55210`;

const off = ctx.LumenCost.analyze(sample, { costEnabled: false });
if (off.show) throw new Error("expected off");

const r = ctx.LumenCost.analyze(
  sample,
  { costEnabled: true, costLevel: "full", costMonthlyVolume: 10000 },
  { hostname: "claude.ai" }
);
if (!r.show) throw new Error("expected show");
if (r.model.id !== "claude-sonnet-5") throw new Error("bad model " + r.model.id);
const ids = new Set(r.matches.map((m) => m.ruleId));
for (const need of ["few-shot-bloat", "model-downgrade"]) {
  if (!ids.has(need)) throw new Error("missing rule " + need + " got " + [...ids]);
}
console.log("cost smoke ok", {
  tokens: r.inputTokens,
  strip: r.stripLine,
  rules: [...ids],
});
