# Lumen AI Profile — characterising how you work across tools

> Status: **Phase 0 + Phase 1 + Phase 2 built.** Phase 3 (shareable card) pending.
> Decisions locked in: **per-tool framing**, **neutral/descriptive tone**.

## 0. What's built so far

- **Phase 0 (data)** — `session.js` now persists, per platform per day:
  `byPlatform[host].signalCounts {handoff, loop, mismatch, depth}` and
  `byPlatform[host].taskTypeCounts {essay_writing: n, code_generation: n, …}`.
  `recordMessage()` takes a `taskType` arg (threaded from `content.js`),
  `aggregatePlatforms()` sums both maps into the daily aggregate.
- **Phase 1 (MVP)** — `LumenNudges.buildProfile(history)` produces per-tool
  lines; `buildDigest()` returns them as `digest.profile`; the FAB popover digest
  renders a **"How you work"** section.
- **Phase 2 (on-demand view)** — a dedicated **"Your AI profile"** section in the
  FAB popover: per-tool cards with a hands-on↔hand-off posture meter, plus the
  cross-tool **contrast** headline from `LumenNudges.buildProfileContrast()`
  ("You're most hands-on with code, and hand off most with writing — whichever
  tool you're in"). Contrast is withheld unless ≥2 domains clear the sample gate
  and differ by ≥18 points.
- **Tests** — `scripts/test-profile.mjs` (round-trip + characterisation +
  contrast, 14 assertions). e2e (12/12) and the classifier corpus are unaffected.

Live example from the tests:

```
ChatGPT — mostly writing. You tend to hand whole tasks off here.
Claude — mostly code. You stay hands-on here — lots of questions and your own attempts.
Still learning how you use Gemini.
```

Current thresholds (tune with real data): window **14 days**, gate at **≥10
messages and ≥2 sessions** per tool; posture bands 0–31 hands-on / 32–51
collaborative / 52–69 mixed / 70+ hand-off heavy; dominant use named only at
**≥40% share and ≥1.5× the runner-up**.

## 1. One-line pitch

Lumen already watches *how* you work with AI in the moment. The **AI Profile**
reflects that back over time as a short, per-tool characterisation:

> **ChatGPT** — mostly **writing**. You tend to hand off whole drafts here.
> **Claude** — mostly **code**. You stay hands-on: lots of back-and-forth and your own attempts.

It is the retrospective, "mirror" counterpart to the in-session nudges: never
interrupts, never scolds, just shows you the pattern.

## 2. Why it's worth building

- **It turns data we already collect into identity-level insight.** Per-session
  signal counts and cross-LLM aggregation already exist; today they only surface
  as a flat weekly digest ("25% questions, 97-word prompts"). A characterisation
  is more memorable and is the kind of thing people screenshot and share.
- **It's the purest expression of "mirror, not nanny."** Descriptive,
  retrospective, per-tool. Lower trust-risk than any in-session signal, and it
  gives users a weekly reason to return.
- **It's differentiated.** Usage trackers count tokens and time. Nobody
  characterises *cognitive posture per tool*. "How you work with AI" is an
  unclaimed category.

The open risk is not value — it's **accuracy**. A confident-but-wrong profile
erodes trust faster than no profile. The design effort goes into guardrails.

## 3. What it is, concretely

A behavioural fingerprint built on three things Lumen already detects:

| Axis | Source today |
| --- | --- |
| **Platform** (ChatGPT, Claude, Gemini…) | `window.location.hostname` |
| **Task type** (writing, code, research, decisions, learning…) | `LumenEngine.detectTaskType()` |
| **Engagement posture** | blend of hand-off rate, passive rate, question ratio, prompt length, depth |

**Primary framing is per-tool** (chosen): each tool gets one line — what you
mostly use it for, and how engaged vs. offloaded you are there. A single
cross-cutting "contrast" line is an optional addition (see §7).

## 4. Data gap — the one real prerequisite

| Data needed | Stored today? | Where |
| --- | --- | --- |
| Per-platform message counts | Yes | `history[].byPlatform[host].messageCount` |
| Per-platform question ratio / prompt length / passive rate | Yes | `history[].byPlatform[host]` |
| Per-platform **signal counts** (hand-off / loop / mismatch / depth) | **No** | `session` tracks them but they collapse into the daily aggregate |
| Per-platform **task-type distribution** | **No** | `detectTaskType()` runs per message but is never persisted |

The profile's two headline claims — *what* you use each tool for, and *how
offloaded* you are there — both depend on data we currently discard.

**Fix (small, additive):** extend the daily `byPlatform` snapshot written in
`LumenSession.saveSessionSnapshot()` to also carry:

```
byPlatform[host] = {
  // existing
  questionRatio, avgPromptLength, passiveRate, messageCount,
  // new
  signalCounts: { handoff, loop, mismatch, depth },
  taskTypeCounts: { writing: n, code: n, research: n, ... }
}
```

These aggregate across the week with the same message-weighted method
`aggregatePlatforms()` already uses. No new storage, no new permissions — stays
100% local in `chrome.storage.sync`.

> Ship this data change **first** (Phase 0). It is harmless on its own and starts
> accumulating history immediately, so the profile has real data the day it
> launches instead of starting cold.

## 5. Characterisation logic

For each `platform` bucket over a trailing window (suggest 14–28 days):

1. **Dominant use** — top entry in `taskTypeCounts`, but only *named* when it's a
   clear plurality (≥ 40% of messages **and** ≥ 1.5× the runner-up). Otherwise
   say "a mix."
2. **Posture score** — normalised blend:
   - offload-leaning: high `handoff/message`, high `passiveRate`, short
     `avgPromptLength`, low `questionRatio`
   - engaged-leaning: high `questionRatio`, longer prompts, own-draft / pushback
     markers, `depthCount > 0`
3. **Posture label** on a neutral spectrum:
   `hands-on → collaborative → mixed → hand-off heavy`

### Copy (neutral tone — locked in)

Value-neutral, descriptive, never evaluative. Examples:

- "You tend to hand off whole drafts here." (not "you offload too much")
- "You stay hands-on — lots of back-and-forth." (not "good engagement")
- "Mostly quick, passive replies in this tool."
- "Still learning how you use Claude." (below sample gate)

## 6. Trust & accuracy guardrails (make-or-break)

- **Minimum sample gate.** Don't characterise a tool below N sessions / M
  messages. Below threshold → "Still learning…". (Tune N, M during testing.)
- **Neutral tone.** Posture words are value-neutral. Describe, don't score.
- **Task-type honesty.** Inherits `detectTaskType()` heuristic error; only name a
  dominant use on a clear plurality, else "a mix."
- **Privacy.** Fully computable locally; **no raw prompts ever leave the device.**
  The profile feels more like "profiling" than counts, so it stays local-only and
  must not ride the opt-in `shareAnonymisedData` channel without separate,
  explicit consent.
- **No false positives over coverage.** Same north star as the classifier: a
  missing line is fine; a wrong line is not.

## 7. UX surfaces & phasing

- **Phase 0 — data.** ✅ Done. Persist `signalCounts` + `taskTypeCounts` per
  platform/day.
- **Phase 1 — MVP.** ✅ Done. A "How you work" section in the weekly digest:
  per-tool lines, with sample gating and neutral copy. Reuses the existing digest
  surface; no new UI shell.
- **Phase 2 — on-demand.** ✅ Done. A dedicated "Your AI profile" section in the
  FAB popover (per-tool cards + posture meter + cross-tool contrast line),
  available any time rather than only inside the weekly digest.
- **Phase 3 — shareable card.** The screenshot artifact / growth loop.

Optional cross-cutting line (can land in Phase 1 or later):

> "You think hardest about **code**, and offload most when **writing** — whichever
> tool you're in."

Derived by comparing posture **per task type across all platforms** and surfacing
the largest engaged-vs-offloaded contrast.

## 8. Open questions to revisit before building

- Trailing window length (14 vs 28 days) and the exact sample-gate thresholds.
- Whether to include the cross-cutting contrast line in the MVP or hold for V2.
- Exact posture-score weights (calibrate against a labelled corpus, like the
  classifier harness in `scripts/test-classifier-corpus.mjs`).
