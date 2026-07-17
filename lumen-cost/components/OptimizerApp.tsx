"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { estimateCallCost, formatTokens, formatUsd } from "@/lib/cost";
import {
  defaultModelId,
  getModel,
  listModels,
  pricesUpdatedAt,
} from "@/lib/models";
import { analyzePrompt } from "@/lib/savings/engine";
import { decodeShareState, encodeShareState } from "@/lib/share";
import { useTokenCount } from "@/lib/useTokenCount";
import { CostTable } from "./CostTable";
import { SavingsPanel } from "./SavingsPanel";

const SAMPLE = `<system>
You are a careful data extraction assistant for an e-commerce support desk.
Always reply with valid JSON matching the schema.
Never invent order IDs. Prefer short field values.
Follow company tone: warm, concise, no emojis.
Escalate refunds over $200 to a human.
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

Context payload:
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

export function OptimizerApp() {
  const models = useMemo(() => listModels(), []);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(defaultModelId());
  const [monthlyVolume, setMonthlyVolume] = useState(10_000);
  const [assumedOutput, setAssumedOutput] = useState(400);
  const [maxTokens, setMaxTokens] = useState<number | "">(2048);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const model = getModel(modelId) ?? models[0];
  const tokenCount = useTokenCount(prompt, model.tokenizer);
  const inputTokens = tokenCount.tokens;

  useEffect(() => {
    if (hydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s) {
      const decoded = decodeShareState(s);
      if (decoded) {
        setPrompt(decoded.p);
        setModelId(decoded.m);
        setMonthlyVolume(decoded.v);
        setAssumedOutput(decoded.o);
        setMaxTokens(decoded.x ?? "");
      }
    } else {
      const saved = localStorage.getItem("lumen-cost:draft");
      if (saved) {
        try {
          const d = JSON.parse(saved) as {
            prompt?: string;
            modelId?: string;
            monthlyVolume?: number;
            assumedOutput?: number;
            maxTokens?: number | "";
          };
          if (d.prompt) setPrompt(d.prompt);
          if (d.modelId) setModelId(d.modelId);
          if (d.monthlyVolume) setMonthlyVolume(d.monthlyVolume);
          if (d.assumedOutput) setAssumedOutput(d.assumedOutput);
          if (d.maxTokens !== undefined) setMaxTokens(d.maxTokens);
        } catch {
          /* ignore */
        }
      }
    }
    setHydrated(true);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      "lumen-cost:draft",
      JSON.stringify({
        prompt,
        modelId,
        monthlyVolume,
        assumedOutput,
        maxTokens,
      })
    );
  }, [prompt, modelId, monthlyVolume, assumedOutput, maxTokens, hydrated]);

  const analysis = useMemo(() => {
    if (!prompt.trim()) {
      return {
        matches: [],
        totalUsdPerCall: 0,
        totalUsdPerMonth: 0,
        totalTokens: 0,
      };
    }
    return analyzePrompt({
      prompt,
      model,
      inputTokens,
      assumedOutputTokens: assumedOutput,
      maxTokens: maxTokens === "" ? null : Number(maxTokens),
      monthlyVolume,
    });
  }, [prompt, model, inputTokens, assumedOutput, maxTokens, monthlyVolume]);

  const callCost = estimateCallCost(model, inputTokens, assumedOutput);

  const copyShare = useCallback(async () => {
    const encoded = encodeShareState({
      p: prompt,
      m: modelId,
      v: monthlyVolume,
      o: assumedOutput,
      x: maxTokens === "" ? null : Number(maxTokens),
    });
    if (!encoded) {
      setShareMsg("Prompt too long to share in a URL — shorten it first.");
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Share link copied.");
      window.history.replaceState(null, "", `?s=${encoded}`);
    } catch {
      setShareMsg("Could not copy — URL updated in the address bar.");
      window.history.replaceState(null, "", `?s=${encoded}`);
    }
    window.setTimeout(() => setShareMsg(null), 2500);
  }, [prompt, modelId, monthlyVolume, assumedOutput, maxTokens]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:pt-14">
      <header className="animate-rise mb-10">
        <p className="font-display text-4xl md:text-6xl tracking-tight text-ink-50">
          Lumen
        </p>
        <p className="mt-2 max-w-xl text-lg text-ink-300">
          Same answer. Fewer tokens.
        </p>
        <p className="mt-3 max-w-lg text-sm text-ink-500">
          Paste your prompt. See what it costs, what it&apos;s wasting, and how
          to cut the bill — privately in your browser.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 md:p-5 animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <label className="text-xs uppercase tracking-[0.16em] text-ink-400">
                Your prompt
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt(SAMPLE)}
                  className="rounded-lg border border-ink-600/60 px-2.5 py-1 text-xs text-ink-300 hover:border-citrus-500/40 hover:text-citrus-400"
                >
                  Load sample
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt("")}
                  className="rounded-lg border border-ink-600/60 px-2.5 py-1 text-xs text-ink-300 hover:border-ember-400/40"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste a system + user prompt…"
              rows={16}
              className="w-full resize-y rounded-xl border border-ink-700/50 bg-ink-950/40 px-3 py-3 font-mono text-sm leading-relaxed text-ink-100 placeholder:text-ink-600 focus:border-citrus-500/40 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="font-mono text-ink-200">
                <span className="text-citrus-400">
                  {formatTokens(inputTokens)}
                </span>{" "}
                tokens
                {!tokenCount.exact ? (
                  <span className="ml-2 text-xs text-ember-400">approx</span>
                ) : null}
                <span className="mx-2 text-ink-600">·</span>
                {formatUsd(callCost.totalUsd)}
                <span className="text-ink-500"> / call on {model.name}</span>
              </p>
              <button
                type="button"
                onClick={copyShare}
                className="rounded-lg bg-citrus-500/90 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-citrus-400"
              >
                Copy share link
              </button>
            </div>
            {shareMsg ? (
              <p className="mt-2 text-xs text-ink-400">{shareMsg}</p>
            ) : null}
          </div>

          <div className="glass rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-rise-delay">
            <Field label="Model">
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 text-sm text-ink-100"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calls / month">
              <input
                type="number"
                min={1}
                value={monthlyVolume}
                onChange={(e) =>
                  setMonthlyVolume(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 font-mono text-sm text-ink-100"
              />
            </Field>
            <Field label="Expected output tok">
              <input
                type="number"
                min={1}
                value={assumedOutput}
                onChange={(e) =>
                  setAssumedOutput(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 font-mono text-sm text-ink-100"
              />
            </Field>
            <Field label="max_tokens (optional)">
              <input
                type="number"
                min={0}
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                className="w-full rounded-lg border border-ink-600/50 bg-ink-900/60 px-2 py-1.5 font-mono text-sm text-ink-100"
              />
            </Field>
          </div>
        </div>

        <SavingsPanel
          matches={analysis.matches}
          totalUsdPerMonth={analysis.totalUsdPerMonth}
          totalTokens={analysis.totalTokens}
          hasPrompt={prompt.trim().length > 0}
          onApplyRewrite={setPrompt}
        />
      </div>

      <div className="mt-6">
        <CostTable
          models={models}
          inputTokens={inputTokens}
          outputTokens={assumedOutput}
          monthlyVolume={monthlyVolume}
          selectedId={modelId}
          onSelect={setModelId}
          pricesUpdatedAt={pricesUpdatedAt()}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-ink-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
