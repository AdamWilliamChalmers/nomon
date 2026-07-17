#!/usr/bin/env node
/**
 * Reminder / checker for Cost coach pricing freshness.
 *
 * OpenAI does not expose a stable public JSON price feed for extensions.
 * Keep `cost/models.js` as the source of truth and refresh it when models
 * change (ChatGPT picker labels + API list rates).
 *
 * Usage:
 *   node scripts/refresh-cost-models.mjs
 *   node scripts/refresh-cost-models.mjs --check-days 14
 *
 * Manual refresh steps:
 *   1. Open https://openai.com/api/pricing/
 *   2. Cross-check ChatGPT picker labels (Instant / Medium / High + GPT-5.x)
 *   3. Update MODELS + UPDATED_AT + SOURCE in cost/models.js
 *   4. Run node scripts/smoke-cost-models.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelsPath = path.join(root, "cost/models.js");
const src = fs.readFileSync(modelsPath, "utf8");

const dateMatch = src.match(/UPDATED_AT\s*=\s*"([^"]+)"/);
const sourceMatch = src.match(/SOURCE\s*=\s*"([^"]+)"/);
const updatedAt = dateMatch?.[1];
const source = sourceMatch?.[1];

if (!updatedAt) {
  console.error("Could not find UPDATED_AT in cost/models.js");
  process.exit(1);
}

const maxAgeDays = Number(
  process.argv.includes("--check-days")
    ? process.argv[process.argv.indexOf("--check-days") + 1]
    : 21
);

const ageMs = Date.now() - Date.parse(`${updatedAt}T00:00:00Z`);
const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

console.log("Cost models catalog");
console.log(`  UPDATED_AT: ${updatedAt} (${ageDays} day(s) ago)`);
console.log(`  SOURCE:     ${source || "(missing)"}`);
console.log(`  File:       ${modelsPath}`);
console.log("");
console.log("Refresh checklist:");
console.log("  [ ] openai.com/api/pricing — confirm $/1M input+output");
console.log("  [ ] platform.claude.com pricing — Fable / Opus / Sonnet / Haiku");
console.log("  [ ] ChatGPT picker — Instant / Medium / High + GPT-5.x / o3");
console.log("  [ ] Claude.ai picker — model pill + Effort Low…Max");
console.log("  [ ] aliases in cost/models.js match visible UI strings");
console.log("  [ ] bump UPDATED_AT + SOURCE, run smoke-cost-models.mjs");

if (Number.isFinite(ageDays) && ageDays > maxAgeDays) {
  console.error(`\nSTALE: prices older than ${maxAgeDays} days — update cost/models.js`);
  process.exit(2);
}

console.log(`\nOK (within ${maxAgeDays}-day freshness window)`);
