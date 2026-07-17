import { estimateSavings } from "@/lib/cost";
import { countTokens } from "@/lib/tokenize";
import type { AnalyzeContext, RuleMatch, SavingsRule } from "@/lib/types";

function findJsonBlocks(text: string): { start: number; end: number; raw: string }[] {
  const blocks: { start: number; end: number; raw: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{" && text[i] !== "[") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          const raw = text.slice(i, j + 1);
          if (raw.length >= 80) blocks.push({ start: i, end: j + 1, raw });
          i = j;
          break;
        }
      }
    }
  }
  return blocks;
}

/**
 * Pretty-printed / padded JSON in prompts wastes tokens. Suggest minify.
 */
export const verboseJsonRule: SavingsRule = {
  id: "verbose-json",
  title: "Compress verbose JSON",
  detect(ctx: AnalyzeContext): RuleMatch[] {
    const { prompt, model, monthlyVolume } = ctx;
    const blocks = findJsonBlocks(prompt);
    if (blocks.length === 0) return [];

    let tokensSaved = 0;
    let rewritten = prompt;
    const excerpts: string[] = [];

    // Process from end so indices stay valid for rewrite
    const sorted = [...blocks].sort((a, b) => b.start - a.start);
    for (const block of sorted) {
      try {
        const parsed = JSON.parse(block.raw);
        const minified = JSON.stringify(parsed);
        if (minified.length >= block.raw.length * 0.95) continue;

        const before = countTokens(block.raw, model.tokenizer).tokens;
        const after = countTokens(minified, model.tokenizer).tokens;
        const delta = before - after;
        if (delta < 8) continue;

        tokensSaved += delta;
        rewritten =
          rewritten.slice(0, block.start) +
          minified +
          rewritten.slice(block.end);
        if (excerpts.length < 2) {
          excerpts.push(block.raw.slice(0, 140) + "…");
        }
      } catch {
        // not valid JSON
      }
    }

    if (tokensSaved < 12) return [];

    return [
      {
        ruleId: "verbose-json",
        title: "Minify JSON in your prompt",
        severity: tokensSaved > 200 ? "high" : "medium",
        summary: `Pretty-printed JSON is costing ~${tokensSaved} extra tokens. Models don't need indentation or extra whitespace.`,
        suggestion:
          "Send compact JSON (JSON.stringify without spacing). Keep keys short when you control the schema.",
        excerpt: excerpts.join("\n"),
        rewrittenPrompt: rewritten !== prompt ? rewritten : undefined,
        estimate: estimateSavings(tokensSaved, model, monthlyVolume, "input"),
      },
    ];
  },
};
