import { estimateSavings } from "@/lib/cost";
import { estimateSubstringTokens } from "@/lib/tokenize";
import type { AnalyzeContext, RuleMatch, SavingsRule } from "@/lib/types";

const EXAMPLE_HEADERS =
  /(?:^|\n)\s*(?:example|ex|shot|sample)\s*[#:]?\s*\d+\s*[:.)-]?\s*$/gim;
const FEW_SHOT_LABEL = /(?:^|\n)\s*(?:user|assistant|human|ai)\s*:\s+/gi;

function jaccard(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Don't let the last example absorb the real user query / trailing context. */
function chunkEnd(prompt: string, start: number, rawEnd: number): number {
  const body = prompt.slice(start, rawEnd);
  // Prefer ending before a trailing "User:" that looks like the live query
  // (after assistant content), or before a Context:/JSON blob.
  const cut = body.search(
    /\n(?:Context|INPUT|Live user|Actual user)\s*:|\n\{[\s\S]{80,}$/i
  );
  if (cut > 40) return start + cut;

  // If this is the final chunk and ends with a lone User: line (live query),
  // peel it off when there was already a User: inside the example.
  const userHits = [...body.matchAll(/(?:^|\n)\s*User\s*:/gi)];
  if (userHits.length >= 2) {
    const last = userHits[userHits.length - 1].index ?? -1;
    if (last > 40) return start + last;
  }
  return rawEnd;
}

/**
 * Detect repeated few-shot examples; suggest keeping 1–2 diverse ones.
 */
export const fewShotBloatRule: SavingsRule = {
  id: "few-shot-bloat",
  title: "Redundant few-shot examples",
  detect(ctx: AnalyzeContext): RuleMatch[] {
    const { prompt, model, monthlyVolume } = ctx;
    if (prompt.length < 400) return [];

    const headers = [...prompt.matchAll(EXAMPLE_HEADERS)];
    const turnLabels = [...prompt.matchAll(FEW_SHOT_LABEL)];

    let chunks: { start: number; end: number; text: string }[] = [];

    if (headers.length >= 2) {
      for (let i = 0; i < headers.length; i++) {
        const start = headers[i].index ?? 0;
        const rawEnd =
          i + 1 < headers.length
            ? (headers[i + 1].index ?? prompt.length)
            : prompt.length;
        const end = chunkEnd(prompt, start, rawEnd);
        chunks.push({ start, end, text: prompt.slice(start, end) });
      }
    } else if (turnLabels.length >= 4) {
      const indices = turnLabels.map((m) => m.index ?? 0);
      for (let i = 0; i + 1 < indices.length; i += 2) {
        const start = indices[i];
        const rawEnd = i + 2 < indices.length ? indices[i + 2] : prompt.length;
        const end = chunkEnd(prompt, start, rawEnd);
        chunks.push({ start, end, text: prompt.slice(start, end) });
      }
    }

    if (chunks.length < 3) return [];

    const redundant = new Set<number>();
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        if (jaccard(chunks[i].text, chunks[j].text) >= 0.5) {
          const drop =
            chunks[i].text.length >= chunks[j].text.length ? i : j;
          if (drop > 0) redundant.add(drop);
        }
      }
    }

    // Always prefer ≤2 examples when there are 3+
    if (chunks.length >= 3) {
      for (let i = 2; i < chunks.length; i++) redundant.add(i);
    }

    if (redundant.size === 0) return [];

    let tokensSaved = 0;
    const excerpts: string[] = [];
    for (const idx of [...redundant].sort((a, b) => a - b)) {
      const c = chunks[idx];
      tokensSaved += estimateSubstringTokens(
        prompt,
        c.start,
        c.end,
        model.tokenizer
      );
      if (excerpts.length < 2) {
        excerpts.push(c.text.trim().slice(0, 160));
      }
    }

    if (tokensSaved < 40) return [];

    const keep = Math.max(1, chunks.length - redundant.size);
    return [
      {
        ruleId: "few-shot-bloat",
        title: `Drop ${redundant.size} redundant example${redundant.size > 1 ? "s" : ""}`,
        severity: tokensSaved > 400 ? "high" : "medium",
        summary: `Found ${chunks.length} few-shot blocks; ~${redundant.size} look similar or excess. Keeping ${keep} diverse example${keep === 1 ? "" : "s"} usually preserves quality.`,
        suggestion:
          "Keep the 1–2 most distinct examples. Remove near-duplicates and prefer short input→output pairs over full transcripts.",
        excerpt: excerpts.join("\n---\n"),
        estimate: estimateSavings(tokensSaved, model, monthlyVolume, "input"),
      },
    ];
  },
};
