"use client";

import type { RuleMatch } from "@/lib/types";
import { formatTokens, formatUsd } from "@/lib/cost";

interface Props {
  matches: RuleMatch[];
  totalUsdPerMonth: number;
  totalTokens: number;
  hasPrompt: boolean;
  onApplyRewrite?: (prompt: string) => void;
}

const severityStyles = {
  high: "text-ember-400 border-ember-400/30 bg-ember-500/10",
  medium: "text-citrus-400 border-citrus-400/25 bg-citrus-500/10",
  low: "text-ink-300 border-ink-400/20 bg-ink-800/40",
};

export function SavingsPanel({
  matches,
  totalUsdPerMonth,
  totalTokens,
  hasPrompt,
  onApplyRewrite,
}: Props) {
  if (!hasPrompt) {
    return (
      <section className="glass rounded-2xl p-6 animate-rise">
        <p className="font-display text-2xl text-ink-100">Savings coach</p>
        <p className="mt-2 text-sm text-ink-400 max-w-md">
          Paste a prompt. Lumen ranks concrete cuts — caching, few-shot bloat,
          JSON padding, max_tokens, and cheaper models — with estimated $ impact.
        </p>
      </section>
    );
  }

  const hero =
    totalUsdPerMonth > 0.01
      ? formatUsd(totalUsdPerMonth)
      : matches.length === 0
        ? "Looking clean"
        : formatUsd(totalUsdPerMonth);

  return (
    <section className="glass rounded-2xl p-6 md:p-8 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">
            Estimated monthly waste
          </p>
          <p className="mt-1 font-display text-4xl md:text-5xl text-citrus-400 tabular-nums">
            {hero}
          </p>
          <p className="mt-2 text-sm text-ink-400">
            {matches.length === 0
              ? "No high-signal cuts found for this prompt + settings."
              : `${matches.length} recommendation${matches.length === 1 ? "" : "s"} · ~${formatTokens(totalTokens)} input tokens addressable`}
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {matches.map((m) => (
          <li
            key={`${m.ruleId}-${m.title}`}
            className={`rounded-xl border px-4 py-3 ${severityStyles[m.severity]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink-50">{m.title}</p>
                <p className="mt-1 text-sm text-ink-200/80">{m.summary}</p>
                <p className="mt-2 text-sm text-ink-300">{m.suggestion}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm text-ink-50">
                  {formatUsd(m.estimate.usdPerMonth)}
                  <span className="text-ink-400">/mo</span>
                </p>
                <p className="font-mono text-xs text-ink-400">
                  {m.estimate.tokens > 0
                    ? `${formatTokens(m.estimate.tokens)} tok · `
                    : ""}
                  {formatUsd(m.estimate.usdPerCall)}/call
                </p>
              </div>
            </div>
            {m.excerpt ? (
              <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-ink-950/50 p-2 font-mono text-[11px] text-ink-300 whitespace-pre-wrap">
                {m.excerpt}
              </pre>
            ) : null}
            {m.rewrittenPrompt && onApplyRewrite ? (
              <button
                type="button"
                onClick={() => onApplyRewrite(m.rewrittenPrompt!)}
                className="mt-3 text-xs font-medium text-citrus-400 hover:text-citrus-500 underline underline-offset-2"
              >
                Apply compact rewrite
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[11px] leading-relaxed text-ink-500">
        Estimates assume your monthly volume and typical output length. Caching
        savings require identical prefixes across requests. Model downgrades are
        guidance — verify quality. Not a guarantee of identical answers.
      </p>
    </section>
  );
}
