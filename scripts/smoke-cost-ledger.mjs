import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = {};
const ctx = {
  console,
  location: { hostname: "claude.ai" },
  localStorage: {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = String(v);
    },
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "cost/ledger.js"), "utf8"), ctx);

await ctx.LumenCostLedger.load();
const a = ctx.LumenCostLedger.recordApplied({
  ruleId: "few-shot-bloat",
  title: "Drop 2 examples",
  usd: 0.012,
  tokens: 120,
  host: "claude.ai",
  source: "logged",
});
if (!a) throw new Error("expected first record");
const dup = ctx.LumenCostLedger.recordApplied({
  ruleId: "few-shot-bloat",
  title: "Drop 2 examples",
  usd: 0.012,
  tokens: 120,
  host: "claude.ai",
  source: "logged",
});
if (dup) throw new Error("expected dedupe");

const s = ctx.LumenCostLedger.summarize();
if (s.eventCount !== 1) throw new Error("bad count");
if (s.usdAllTime < 0.01) throw new Error("bad total");
console.log("ledger smoke ok", s);
