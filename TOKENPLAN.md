# Nomon Cost — Product & Technical Plan

> **Status (2026-07-15):** Cost coach ships **inside Nomon** as an **opt-in** FAB setting
> (`Cost coach`: Off / quiet tip / tips + details). Analysis is local compose-time
> (`cost/*.js` + `content.js` `bindCostCoach`). The standalone `lumen-cost/` Next app
> remains a rules sandbox / deep-dive prototype — product home is the extension.
>
> Nomon’s three pillars: (1) cognitive-offloading mirror · (2) AI transparency badges ·
> (3) token cost manager across AIs.

> **Original one-liner:** a prompt cost-optimizer / savings coach for LLM users —
> _what it costs, what it's wasting, how to cut the bill — without changing the answer._

---

## Table of contents

1. [The idea (origin & decision)](#1-the-idea-origin--decision)
2. [Positioning](#2-positioning)
3. [Target users](#3-target-users)
4. [Market landscape & why we're different](#4-market-landscape--why-were-different)
5. [Scope by phase](#5-scope-by-phase)
6. [The savings engine (technical core)](#6-the-savings-engine-technical-core)
7. [Tech stack](#7-tech-stack)
8. [Key risks & mitigations](#8-key-risks--mitigations)
9. [Success metrics](#9-success-metrics)
10. [Suggested build order](#10-suggested-build-order)
11. [Open decisions](#11-open-decisions)

---

## 1. The idea (origin & decision)

The original brief was to build an app that could:

- **Count tokens**
- **Help people save tokens**
- **Track tokens** (usage over time)
- **"Max" tokens** (get the most output per dollar)
- **Know which LLM to use to save tokens**

Decomposing this revealed **two very different products**:

| Job | What it really is | Difficulty |
|---|---|---|
| Count tokens | Paste text → token count | Trivial (solved) |
| Know which LLM saves tokens | Compare price/model | Easy (solved) |
| Save tokens | Prompt optimization advice | Medium (**interesting**) |
| Track tokens | Log real usage/spend over time | Hard (valuable) |
| "Max" tokens | Get the most output per dollar | Medium (fuzzy) |

- The first two are a **calculator** (stateless, anonymous, one-shot) — **already commoditized** (see §4).
- The last three are a **tracker/optimizer** (stateful, needs real usage or API access) — mostly owned by well-funded incumbents.

**Decision:** Build the differentiated wedge — **the prompt cost-optimizer / savings coach**. Everyone else _measures_ tokens; Lumen _reduces_ them. The counter and price table are the free front door; the **savings engine** is the reason people return and eventually pay.

---

## 2. Positioning

**One-liner:** _Paste your prompt. Lumen tells you what it costs, what it's wasting, and how to cut the bill — without changing the answer._

**Tagline candidates:**
- "Shine a light on your token spend."
- "Same answer. Fewer tokens."

**Core wedge:** _prescriptive, pre-send, zero-setup, private._ No competitor owns "tell me how to make **this specific prompt** cheaper."

---

## 3. Target users

In priority order:

1. **Solo devs / indie hackers** shipping LLM features on a budget — feel every dollar, no procurement.
2. **Small AI teams** without a dedicated FinOps/observability setup.
3. **Prompt engineers / consultants** who want a shareable "here's why your prompt is expensive" artifact.

**Deliberately _not_ targeting (yet):** large enterprises with existing Helicone/Langfuse stacks. Win at the small end, grow up.

---

## 4. Market landscape & why we're different

### The space is crowded

- **Token counting + cost comparison is fully commoditized.** Tools like `tokencost.app`, `tokencalculator.app`, and `token-calculator.net` already do 60+ models, run tiktoken in-browser (WASM, private), show sortable price tables, and support shareable URLs. Libraries like `toksum` (300+ models) and `tokonomix` do it programmatically. **A plain token counter has zero moat.**
- **Tracking real spend + routing to the cheapest model** is owned by mature, well-funded players: **Helicone** (proxy, 0% markup, caching, auto-routes to cheapest provider), **Langfuse**, **OpenRouter**, **Portkey**, **LiteLLM**.

> A "token counter that also tells you which LLM is cheapest" would launch dead — 5+ sites already do it better.

### The gap

Everyone **measures**; almost nobody **actively reduces**. A tool that takes a prompt and says _"this costs 2.3× more than it needs to — here's the rewrite"_ is a real, underserved wedge.

### Differentiation table

| Competitor | What they do | Lumen's edge |
|---|---|---|
| tokencost / tokencalculator | Count + price table | We add **actionable savings**, not just numbers |
| Helicone / Portkey | Proxy, routing, tracking | We're **zero-integration**, privacy-first, optimize _before_ you send |
| Langfuse | Deep observability | We're **prescriptive** (fix this), not just descriptive |
| toksum / tokonomix | Libraries for devs | We're a **product + UI**, plus a CLI later |

---

## 5. Scope by phase

### Phase 1 — The Optimizer (MVP)

Everything **client-side**, no login, no backend. Privacy is a selling point ("your prompt never leaves your browser").

- **Live token counter** — tiktoken (WASM) for exact OpenAI counts; documented heuristics for Claude/Gemini/others.
- **Multi-model cost table** — input/output/total cost across ~15–20 popular models, sortable by price, filterable by provider.
- **Savings panel (the differentiator)** — analyzes the pasted prompt and returns concrete, ranked recommendations, each with an estimated **token + $ delta**:
  - Bloated/boilerplate system prompt detection
  - Redundant few-shot examples
  - Verbose formatting (uncompressed JSON, repeated scaffolding, filler phrases)
  - Repeated prefix → **prompt-caching** candidate (often the biggest real-world win)
  - **Right-sizing `max_tokens`** — flag over-allocated output budgets
  - **"Cheaper model, same job"** — suggest a downgrade (e.g. Opus → Haiku/Flash) with the $ saved at a user-entered monthly volume
- **Shareable URL** — encode prompt + settings so a result can be bookmarked/sent (table stakes vs. incumbents).

### Phase 2 — The Tracker (the moat)

Turns a one-shot tool into a habit. Requires accounts + storage.

- Usage over time via **import** (paste/upload provider usage exports/CSVs) — low-friction, avoids proxy commitment.
- Per-workload model recommendations based on _your actual traffic_, not generic tables.
- Budget alerts, spend trends, savings-realized tracking ("Lumen saved you $X this month").
- **Deferred decision:** BYOK/proxy mode. Powerful but puts us head-to-head with Helicone and adds real infra/security burden. Revisit only if Phase 1 gets traction.

### Phase 3 — Distribution / stickiness (optional)

- **CLI + npm package** (`lumen check ./prompt.txt`) for CI ("fail build if prompt cost regresses").
- **VS Code / Cursor extension** that lints prompts inline.

---

## 6. The savings engine (technical core)

This is where the product lives or dies — design it explicitly.

- **Rule-based first.** Deterministic, instant, free, explainable. Each rule = detector + estimated saving + suggested rewrite. Ship ~8–10 solid rules.
- **Estimation model:** every recommendation must show `tokens saved → $ saved` at both per-call and (user-supplied) monthly volume. **The numbers are the whole pitch.**
- **LLM-assisted pass (later, opt-in):** a "deep rewrite" that actually rewrites the prompt. Optional because it costs tokens (ironic) and needs a backend/key.
- **Pricing data** lives in one versioned `models.json` (price in/out, context window, caching support, tokenizer family). This is the ongoing maintenance tax (see §8).

### Rule design shape

Each rule should expose:

```
{
  id: string,
  title: string,
  detect(prompt): Match[],
  estimateSavings(match, model, volume): { tokens: number, usd: number },
  suggestion: string   // human-readable rewrite / action
}
```

---

## 7. Tech stack

- **Next.js (App Router) + TypeScript + Tailwind** — matches the existing `web/` scaffold; static/edge-friendly so Phase 1 needs no server.
- **Tokenization:** `tiktoken` via WASM (`js-tiktoken` / `@dqbd/tiktoken`) in a **Web Worker** so the UI stays smooth on large pastes.
- **State/URL:** encode shareable state in the query string; local persistence via `localStorage`.
- **Phase 2 backend:** Postgres (Supabase or Neon) + auth (Clerk / Supabase Auth). Deploy on Vercel.
- **Testing:** unit tests on the savings rules + token/cost math (correctness is the credibility bar).

> **Repo note:** current workspace is effectively empty — only a stale `web/.next` build cache, no source, no `package.json`, no git. Clean out `.next` and scaffold fresh.

---

## 8. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| **Pricing drift** (models/prices change constantly) | Single versioned `models.json`; "prices updated on {date}" badge; ideally a scripted refresh. **#1 ongoing cost.** |
| **Non-OpenAI tokenizer accuracy** (Claude/Gemini are approximations) | Label estimates clearly, show confidence; use official count endpoints in Phase 2. |
| **"Just another counter" perception** | Lead UI + marketing with the **savings number**, not the count. Counter is secondary. |
| **Savings rules feel gimmicky if weak** | Ship fewer, genuinely-useful rules with honest $ estimates; caching detection + model right-sizing are the credible headliners. |
| **Monetization** | Free calculator + savings panel; paid = tracking/history/alerts/team (Phase 2). **Don't gate the wedge.** |

---

## 9. Success metrics

- **Phase 1:** % of sessions that view the savings panel; median estimated $ saved shown; share-link creations; return visits.
- **Phase 2:** accounts created; tracked spend under management; "savings realized" $.

---

## 10. Suggested build order

1. Scaffold Next.js in `web/` (clean out stale `.next`), Tailwind, Web Worker tokenizer.
2. Live counter + `models.json` cost table (proves the base).
3. **Savings engine v1** (rules + $ estimation) + savings panel UI.
4. Shareable URLs, polish, deploy.
5. _(Phase 2)_ auth + usage import + history/alerts.

---

## 11. Open decisions

- [ ] **Phase 2 BYOK/proxy mode** — build it (compete with Helicone directly) or stay import-only? Defer until Phase 1 traction.
- [ ] **Initial model coverage** — which ~15–20 models ship in v1 `models.json`?
- [ ] **Deep-rewrite LLM pass** — in scope for v1, or strictly Phase 2?
- [ ] **Monetization timing** — when to introduce paid tier.
- [ ] **Naming/branding** — confirm "Lumen" + tagline.
