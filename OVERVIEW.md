# Lumen — Product Overview

> **One line:** Lumen is a cognitive-fitness layer for the AI era — a privacy-first browser extension (plus companion web app) that notices *when you stop critically evaluating* AI output and reflects it back to you. A mirror, not a nanny.

_Last updated to reflect the shipped state: extension `v3.5.1`, web app `lumen-web 0.1.0` (Next.js 14)._

---

## 1. What Lumen is

Lumen sits quietly beneath your AI chats (ChatGPT, Claude, Gemini, Grok, Copilot, Perplexity) and reads the **structure of the conversation** — never its content, and nothing leaves your device by default. When it detects that you've stopped evaluating what the AI gives you, it surfaces a quiet inline "signal" under your message. Over a week, those signals roll up into a single, shareable card.

It ships as two things:

- **A Chrome extension (MV3)** — the core product. All scoring happens locally, in the browser.
- **A companion web app (`lumen.so`)** — the marketing site, plus an optional account/dashboard/Pro layer and an anonymous data backend.

The distinguishing idea: Lumen measures **how** you use AI, not **how much**. It is deliberately *not* a usage blocker, screen-time limiter, or plagiarism detector.

---

## 2. The problem & the ethos

**The problem worth owning:** cognitive offloading and skill atrophy from heavy AI use. Everyone else is racing to make AI more capable; almost nobody is working to keep *humans* capable alongside it.

**The positioning — a "third way":** existing responses to AI-and-thinking anxiety are either prohibitionist (ban it) or passive (just use it carefully). Neither has traction. Lumen's stance is: **use AI freely, but stay conscious of how you're using it.**

**The mantra, enforced ruthlessly across every product decision:**

> **A mirror, not a nanny.** No red. No nagging. Never blocks or delays the AI response (the one exception is an opt-in *Guard* mode).

The single biggest churn risk is explicitly named in the strategy docs: **the product must not nag.** If users find it annoying and uninstall, the whole flywheel collapses.

**Non-negotiable design principles:**

- No red anywhere in the UI.
- Ghost mode (fully invisible) is always available and prominent.
- Mismatch signals only ever come from goals *the user* set — Lumen never decides what you should protect.
- Depth never delays the AI response.
- Drift is never a banner or an alarm — it lives in the weekly digest.
- The reflection box is never required.
- Privacy is radical: local by default, opt-in egress, revocable.

**Brand voice:** calm, curious, non-judgmental, clinical but warm — "a thoughtful researcher, not a productivity app." Never preachy, never alarmist. The name *Lumen* is Latin for light: it illuminates patterns you can't see yourself, and "shines without blinding."

Landing-page headline: **"AI should sharpen your thinking. Not replace it."**

---

## 3. How it works (product mechanics)

1. **It watches the conversation.** A lightweight content script reads how you and the AI are talking — never the content, never transmitted anywhere by default.
2. **It reflects, inline.** When you stop evaluating, a quiet one-line strip appears under your message — one of the signals below. Never a banner, never a block.
3. **It adds up over the week.** Patterns roll into a single shareable card: your "shape" and trends, with no raw scores exposed and no leaderboard.

### The five signals

The product's core vocabulary. One red light can't mean five different things — so each signal has its own name, colour, and voice.

| Signal | Colour | What it means | In-session behaviour |
|---|---|---|---|
| **Hand-off** | Light blue | Early full-task delegation on your first message(s) — "what do you already know?" | Strip only; an invitation, never a gate |
| **Loop** | Green | In-session passivity — accepting several answers in a row without editing or pushing back | Strip + contextual nudge; a heavier "reconsider" overlay only in Active/Guard at sustained high intensity |
| **Drift** | Amber | Cross-session decline — fewer questions than last week, accepting more | Strip label only; full analysis lives in the weekly digest, never an alarm |
| **Mismatch** | Purple | A prompt that conflicts with a goal *you* set — Lumen quotes your past self back | Strip + card |
| **Depth** | Blue | A high-stakes question where the thinking is the point — an invitation to a beat before the answer loads | Strip + additive card; **never blocks the AI response** |

### The four visibility modes (one dial, switchable any time)

| Mode | Behaviour |
|---|---|
| **Ghost** | No in-session signals — you only get the weekly digest |
| **Ambient** | *(default)* Loop + Drift strips only |
| **Active** | All signals + Mismatch/Depth reflection cards |
| **Guard** | *(opt-in)* Active + a brief hold before send when a prompt clearly conflicts with a protected goal you wrote — **always bypassable** |

The first three modes never block you. Guard is the only mode that can ever intervene before send, and only on goals you explicitly wrote.

---

## 4. Architecture

The frontend/backend split is unusual: **the "frontend" (the extension) does all the scoring locally.** The web app is an optional backend + marketing site + Pro dashboard.

### A) Chrome extension (repo root, vanilla JS, Manifest V3)

```
manifest.json          — MV3 config; content scripts injected on 8 LLM hosts
content.js             — bootstrap/orchestrator: adapter selection, send-capture, render loop
engine.js              — the scoring engine (Loop score + five-signal evaluation)
rules.js               — regex pattern tiers, task-type classification, engagement markers
nudges.js              — signal copy, weekly digest builder, AI-profile builder
goals.js               — onboarding, protected goals, visibility modes
session.js             — per-day local session storage, drift history, digest log
judge.js / net.js      — optional LLM classification + background fetch
config.js              — single source of truth for the backend URL
background.js          — service worker (proxies fetches to avoid loopback/PNA blocks)
widget.js / widget.css — all UI (strips, cards, badge/pill, onboarding, popover)
sparkline.js           — badge-popover chart
adapters/              — per-site DOM adapters (see below)
scripts/               — Node/jsdom test suites + icon generation (NOT shipped)
```

**Adapter pattern:** `adapters/chatgpt.js` is a bespoke role-attribute adapter; `adapters/base.js` is a shared factory for no-role-attribute sites (DOM-order message building), with thin configs for `claude.js`, `gemini.js`, `grok.js`, `copilot.js`, `perplexity.js`. A fail-soft `try/catch` around DOM parsing means a broken selector shows **nothing** rather than breaking the host page. (Gemini/Grok/Copilot/Perplexity selectors are "best-effort" and may need live tuning.)

**Pipeline:** `content.js` picks a site adapter → adapter builds a normalized message list from the DOM → `engine.js` scores each user message using `rules.js` patterns → optionally `judge.js` calls the backend for LLM confirmation on ambiguous messages → `widget.js` renders strips/cards/badge → `session.js` stores results locally → optionally POSTs an anonymised summary to `/api/session` (**only** if the user opted into `shareAnonymisedData`, default **off**).

**Scoring engine:** a weighted composite of prompt length, velocity, passive acceptance, and task framing, modulated by ~20 task-type multipliers (e.g. `essay_writing: 1.0`, `debugging: 0.5`, `scheduling: 0.1` — admin tasks barely count) and auto-exempt thresholds. The badge shows an **Engagement score (100 − passive)** so higher = better. Depth triggers/exemptions, passive-continuation detection, and AI-quote detection all work to keep false positives low.

### B) Companion web app (`web/`, Next.js 14 App Router)

- **Pages:** `/` (landing), `/dashboard` (weekly card + self-comparison, Pro-gated), `/card/[userId]` (public shareable card), `/community` (opt-in "shapes" feed), `/calibration`, `/signup` (age-gated 13+), `/survey`, `/upgrade` (Pro checkout), `/family/consent`, `/family/parent`.
- **API routes:** `session` (extension ingest), `judge` (LLM cascade), `card`, `digest` (Monday cron), `feedback`, `survey`, `calibration/weights`, `me` + `v1/me` (user/Pro status), `user`, `upgrade` (Polar webhook), `lumi/learned`, and the `family/*` set.
- **LLM judge cascade** (`web/lib/judge.ts`): tries OpenAI (`gpt-4o-mini`) → Gemini (`gemini-3.1-flash-lite`) → xAI (`grok-3-mini`, all keys optional), falling back to a local regex `heuristicJudge`. A capability probe lets the extension auto-enable the judge only when a key is configured. The endpoint is rate-limited per-IP with a global daily budget cap (`web/lib/rateLimit.ts`) to prevent denial-of-wallet abuse.
- **"Shapes"** (`web/lib/shapes.ts`): weekly personas — Explorer, Thinker, Maker, Delegator, Balanced — derived from question/depth/delegate rates.

### Database (Supabase / Postgres, `web/supabase/schema.sql`)

Aggregate-only, privacy-first tables: `users` (incl. `pro`, `polar_order_id`, `api_token`, `birth_year`, `parent_consent_at`), `sessions` (one row per posted session, **counts only — no message content**), `weekly_summaries`, `family_shares` (child-led, weekly-card-only), `signal_feedback` (flywheel training data), `survey_responses` (calibration study). Migration-safe `add column if not exists` blocks for Pro and Lumi fields.

**Graceful degradation everywhere:** no Supabase → in-memory session store; no LLM keys → rule-based judging; no Chrome Store URL → CTA falls back to the store homepage.

---

## 5. Tech stack

**Extension:** Vanilla JavaScript (no framework/bundler), Chrome Manifest V3, `chrome.storage.sync`, IIFE modules on `globalThis`, CSS custom properties for theming. Permissions are just `storage` + `host_permissions` for the backend.

**Web app:** Next.js 14.2 (App Router), React 18.3, TypeScript 5, Tailwind CSS 3.4, `@supabase/supabase-js` 2.49 (DB + auth), `resend` 4.1 (digest email). Node pinned `>=20 <21`. Font: Plus Jakarta Sans.

**Infra:** Render (primary host, `lumen-web-vscp.onrender.com`, `rootDir: web`) with a Vercel config also present. GitHub Actions for CI tests + a weekly cron for digests. `.githooks/pre-commit` runs the suites locally.

**Third-party integrations (all optional):** Supabase (DB), Resend (email), Polar.sh (one-time Pro payments, HMAC-verified webhooks), and three LLM providers (OpenAI / xAI / Gemini) for the optional judge.

**Testing:** Node + jsdom smoke/e2e suites in `scripts/` (~135 assertion checks): shipped-engine smoke test, adapter host-matching/conformance, real-DOM adapter parsing, and a full end-to-end pipeline rendered into a mock ChatGPT DOM.

---

## 6. Privacy model (the foundation of the business)

Privacy isn't a compliance checkbox here — it's the load-bearing wall. "The moment users feel surveilled, the brand collapses."

- **Local by default.** All scoring happens in the browser. Nothing is transmitted unless the user opts in (`shareAnonymisedData`, default **off**).
- **Reads structure, not content.** The engine works on conversation shape (length, velocity, question/command patterns), and the backend stores only aggregate counts — never message text.
- **Opt-in, revocable data contribution**, with a transparency view of exactly what's shared and full deletion on request.
- **Family sharing is child-led and consent-based** — parents see the weekly card only, never logs, message content, or time limits. Hard rule: **no under-13 support.**

---

## 7. Strategy — the flywheel

Lumen is as much a strategy artifact as a codebase. The thesis is a 4-layer flywheel:

```
Free extension → mass adoption
   → anonymised, consensual behavioural data
      → research insights + brand authority as the AI-literacy voice
         → B2B demand (education, enterprise, government)
            → revenue → product investment → better free extension → (loop)
```

**Four layers of the asset:**

1. **The tool** — real-time, local cognitive-offloading monitor.
2. **The personal insight layer** — longitudinal per-user picture (the Pro tier).
3. **The collective intelligence layer** — anonymised, aggregated behavioural patterns that "don't exist anywhere in the world."
4. **The research & policy layer** — the dataset becomes publishable, fundable, and a reference point for AI-literacy policy.

**Competitive moats:** (1) first-mover longitudinal data that a late, well-funded entrant can't replicate; (2) a values-led "cognitive autonomy" brand ("Headspace, but for thinking"); (3) academic/research credibility as a barrier; (4) platform agnosticism (no single AI company can copy this without cannibalising its own engagement metrics); (5) the founder's academic position (Edinburgh, AI governance / computational social science).

**Big-sky bets (3–5 yr):** AI literacy becomes a *regulated requirement* and Lumen is the measurement/compliance layer ("the FICO of AI literacy"); the dataset becomes the product; a portable "Lumen score" becomes a professional signal; expansion to the whole knowledge-work stack (Docs, Notion, Copilot-in-Word).

---

## 8. Monetisation

> ⚠️ **There are two competing monetisation documents in the repo. This is the biggest internal inconsistency to reconcile.**

- **`lumen-monetisation-strategy.md` (v1.0, marked "Active anchor"):** free forever core; **"Lumen Deep" £39 one-time** unlock (12-month history, full charts, unlimited goals, data export, reflection journal); **£500–2,000 cohort licensing** for institutions. Explicitly **no subscriptions, no data sales.**
- **`lumen_cursor_gtm_prompt.md` (and the shipped code):** free tier + **"Lumen Pro" £49 one-time** via Polar.sh, unlocking the dashboard, shareable card URL, weekly digest email, community feed, and cross-session Drift. This is what the database (`pro`, `polar_order_id`) and web app actually implement today.
- **`lumen_strategic_memo.md`** sketches a longer B2C → university → enterprise → research-API ladder reaching ~£5M ARR at 36 months (this includes subscription pricing that the monetisation doc explicitly rejects).

**Shared, consistent principles across all three:** free is the strategy (not a loss leader); a one-time purchase fits "mirror not nanny" better than a subscription that nags you to pay; the free tier must be genuinely complete, not a crippled demo; and the aggregate dataset is a *moat and research asset*, **not a data-sales revenue line.**

_Practical note: what's live is the **£49 one-time Pro** model. The £39 "Deep" naming and the ARR ladder are aspirational/older framings that should be reconciled with the shipped product._

---

## 9. Sub-products (parked / secondary)

- **Lumi** (`lumi_kids.md`) — a teen (13–17) "thinking coach" with pre-prompt rituals; explicitly *not* a parental-control tool. **Parked (2025)**; schema hooks exist (`lumi_mode`, ritual/homework counts) but it isn't wired into the shipped product.
- **Family sharing** (`lumen_family.md`) — child-led, consent-based; parents see the weekly card only. Implemented in schema + `family/*` routes.
- **AI Profile** (`lumen-ai-profile.md`) — a per-tool "how you work" characterisation + a client-side shareable PNG card; no data leaves the device.

---

## 10. Brand & design

- **Name:** *Lumen* (Latin, "light"). Mark evolved toward three dots.
- **Design system** (`lumen-design-system/tokens/tokens.css`): the current shipped look is **light, minimal, precise** — Plus Jakarta Sans; neutral palette (cloud / mist / dusk / slate / haze); and the four signal colours: Loop green `#2d9e4e`, Drift amber `#d4921a`, Mismatch purple `#7b5cbf`, Depth blue `#3478c5`.
- **Design evolution to note:** older docs (`lumen_cursor_gtm_prompt.md`, the strategic memo) describe a *dark* theme (`--lm-void #080808`, Inter) and a red/green/amber "traffic-light" metaphor. The shipped product has moved to the **light theme with no red** and named per-signal colours. Treat the light design system as current.

---

## 11. Current status & known reconciliation items

**Shipped and working:** five signals; five visibility modes; seven-site adapter coverage (ChatGPT bespoke + 6 factory adapters); local-first scoring with opt-in egress; configurable backend URL; optional LLM judge cascade with heuristic fallback; Pro tier gating via Polar; weekly card/digest; family sharing; CI + pre-commit test suites (~135 checks).

**Open items to reconcile (mostly documentation vs. code drift):**

1. **Monetisation:** £39 "Deep" (monetisation doc) vs. £49 "Pro" (shipped) vs. subscription ladder (memo). Pick one story.
2. **`README.md` still says "v3.1" and "four signals"** in places, while the manifest (`v3.5.1`) and landing page treat **Hand-off** as a first-class fifth signal. `PLANNING.md` (P0.4) already flags this.
3. **Design docs describe a dark/traffic-light theme** that no longer matches the shipped light theme.
4. **Best-effort selectors** (Gemini/Grok/Copilot/Perplexity) still need live tuning against real logged-in sessions.

---

## 12. Repo map — where to look

| Topic | Key files |
|---|---|
| Product & signals | `README.md`, `web/app/page.tsx` |
| Mission & strategy | `lumen_strategic_memo.md`, `lumen-monetisation-strategy.md`, `lumen_cursor_gtm_prompt.md` |
| Engineering status / decisions | `PLANNING.md` |
| Scoring logic | `engine.js`, `rules.js`, `web/lib/scoring.ts`, `web/lib/shapes.ts` |
| Backend | `web/supabase/schema.sql`, `web/lib/judge.ts`, `web/app/api/judge/route.ts`, `web/app/api/session/route.ts` |
| Infra & config | `render.yaml`, `web/README.md`, `manifest.json`, `config.js` |
| Design | `lumen-design-system/tokens/tokens.css`, `lumen_style_guide.md`, `lumen_v3_design.md` |
| Sub-products | `lumi_kids.md`, `lumen_family.md`, `lumen-ai-profile.md` |
| Signal validation / taxonomy | `lumen_signal_validation.md`, `lumen_signal_taxonomy_fix (1).md` |
```
