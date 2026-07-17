"use client";

import { useMemo, useState } from "react";
import { estimateCallCost, formatUsd } from "@/lib/cost";
import type { ModelPricing } from "@/lib/types";

interface Props {
  models: ModelPricing[];
  inputTokens: number;
  outputTokens: number;
  monthlyVolume: number;
  selectedId: string;
  onSelect: (id: string) => void;
  pricesUpdatedAt: string;
}

type SortKey = "total" | "input" | "output" | "name";

export function CostTable({
  models,
  inputTokens,
  outputTokens,
  monthlyVolume,
  selectedId,
  onSelect,
  pricesUpdatedAt,
}: Props) {
  const [provider, setProvider] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("total");

  const providers = useMemo(
    () => ["all", ...Array.from(new Set(models.map((m) => m.provider)))],
    [models]
  );

  const rows = useMemo(() => {
    let list = models.filter(
      (m) => provider === "all" || m.provider === provider
    );
    const scored = list.map((m) => {
      const cost = estimateCallCost(m, inputTokens, outputTokens);
      return { model: m, cost, monthly: cost.totalUsd * monthlyVolume };
    });
    scored.sort((a, b) => {
      if (sort === "name") return a.model.name.localeCompare(b.model.name);
      if (sort === "input") return a.cost.inputUsd - b.cost.inputUsd;
      if (sort === "output") return a.cost.outputUsd - b.cost.outputUsd;
      return a.cost.totalUsd - b.cost.totalUsd;
    });
    return scored;
  }, [models, provider, sort, inputTokens, outputTokens, monthlyVolume]);

  return (
    <section className="glass rounded-2xl p-5 md:p-6 animate-rise-delay">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink-50">Model cost table</h2>
          <p className="text-xs text-ink-450 text-ink-400 mt-1">
            Prices updated {pricesUpdatedAt} · per-call & monthly at your volume
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 text-xs text-ink-100"
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? "All providers" : p}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 text-xs text-ink-100"
          >
            <option value="total">Sort: total $</option>
            <option value="input">Sort: input $</option>
            <option value="output">Sort: output $</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium">Input</th>
              <th className="pb-2 font-medium">Output</th>
              <th className="pb-2 font-medium">/call</th>
              <th className="pb-2 font-medium">/month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/40">
            {rows.map(({ model, cost, monthly }) => {
              const selected = model.id === selectedId;
              return (
                <tr
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  className={`cursor-pointer transition-colors ${
                    selected
                      ? "bg-citrus-500/10"
                      : "hover:bg-ink-800/50"
                  }`}
                >
                  <td className="py-2.5 pr-2">
                    <div className="font-medium text-ink-50">{model.name}</div>
                    <div className="text-[11px] text-ink-500">
                      {model.provider}
                      {!model.exactTokenizer ? " · approx tokens" : ""}
                      {model.supportsCaching ? " · cache" : ""}
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-ink-300">
                    {formatUsd(cost.inputUsd)}
                  </td>
                  <td className="py-2.5 font-mono text-ink-300">
                    {formatUsd(cost.outputUsd)}
                  </td>
                  <td className="py-2.5 font-mono text-ink-100">
                    {formatUsd(cost.totalUsd)}
                  </td>
                  <td className="py-2.5 font-mono text-citrus-400">
                    {formatUsd(monthly)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
