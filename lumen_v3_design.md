# Lumen v3 — Blue Sky Design Document
## The Four Signals, Multi-Platform Expansion, and the Red Light Problem Solved

---

## The core insight that drives v3

The traffic light was doing too much work. One red light trying to mean four completely different things simultaneously will always feel wrong to users in at least some contexts. A surgeon rapidly looking up drug interactions — high-offloading by every signal, completely correct behaviour. A student asking AI to write their essay — also high-offloading, worth flagging. Same signal, entirely opposite meanings.

**The fix: don't replace the traffic light. Decompose it.**

Cognitive offloading is not one thing. It is a family of related-but-distinct behaviours, each with its own meaning, its own appropriate response, and its own appropriate tone. V3 gives each a name, a colour, and a voice.

---

## The four signals

### 1. Loop (green)

**What it is:** You're in a passive consumption cycle in this specific conversation, right now. Short inputs, long outputs, no critical engagement.

**What it means:** Descriptively true. No value judgment. Like a heart rate monitor reading high during a run — it's information, not an accusation.

**What fires it:** The existing scoring signals (prompt length, velocity, passive acceptance, task framing) — but now named and isolated rather than blended into a single composite.

**Visual:** Green dot. 11px strip under the message. Single-line message: "loop · still with it?"

**Response:** The lightest possible touch. A one-line nudge in the strip. No banner. No reflection box. Just a check-in.

**What it never says:** "You're doing this wrong." "You're being passive." Any language implying judgment.

---

### 2. Drift (amber)

**What it is:** Your pattern is shifting over time, across sessions. You used to ask a lot of questions and engage critically. Lately you've been mostly issuing commands and accepting outputs.

**What it means:** A longitudinal signal — meaningful only across multiple sessions and days, never per-message. Context matters enormously: someone who just started using AI heavily for a new job project might look like "drift" but is actually fine.

**What fires it:** Week-over-week comparison of question-asking ratio, average prompt length trend, and passive acceptance rate trend. Only fires if the direction has been consistent for 5+ sessions.

**Visual:** Amber dot in the strip. Message: "drift · fewer questions than last week."

**Response:** This signal should NOT generate a banner during a session. It belongs in the weekly digest. In-session, it's just the strip label — a heads-up. The full context, with sparkline and comparison, lives in the Pro weekly email.

**Critical design rule:** Drift is the one signal that requires time to interpret correctly. Show it as an observation, not a warning. "You've been asking fewer questions this week" is true and useful. "You're becoming more dependent" is an interpretation that may be wrong.

---

### 3. Mismatch (purple)

**What it is:** What you're asking AI to do conflicts with a goal you set for yourself. This is the only signal that is entirely user-defined.

**What fires it:** During onboarding, the user states intentions — "I want to write my own first drafts," "I want to understand the code I use," "I want to be the one who makes decisions about X." When a prompt matches a delegation pattern that touches one of those protected areas, Mismatch fires.

**What it never does:** Fire unless the user has explicitly defined a goal. No system-imposed values about what users "should" protect. If you haven't told Lumen you care about something, Lumen won't tell you that you should.

**Visual:** Purple dot. Strip message: "mismatch · you said you'd write this part."

**Response:** A small card below the strip (not a banner above the input). It quotes back the user's own stated intention, asks if they want to pause, and offers two buttons: "Pause and draft myself" and "My goal changed — continue." The second button is important: it lets users update their intention without friction, rather than just bypassing a nag.

**The psychological key:** Mismatch is the one signal where the user is in conversation with their past self, not with Lumen. Lumen is just the messenger. The language of the card should make this clear: "When you set up Lumen, you said..." — not "Lumen thinks you should..."

---

### 4. Depth (blue)

**What it is:** This task is one where the thinking is the point. Not because the user is doing anything wrong — but because sitting with it longer would serve them. An invitation, not a warning.

**What fires it:** A combination of task-type detection (existential questions, creative decisions, complex value judgements, learning tasks) and the absence of any prior user reflection in the conversation. Specifically: prompts containing decision language ("should I", "what career", "how do I decide", "is it worth"), learning language ("I want to understand", "help me learn"), or authorship language ("write my", "create my") on topics that are clearly personal or developmental.

**What it never fires for:** Factual lookups, research tasks, code debugging, summarisation, administrative tasks. These are legitimate AI uses where depth prompts would be annoying and wrong.

**Visual:** Blue dot. Strip message: "depth · worth thinking first?"

**Response:** A small card — not a banner — with a one-sentence framing and a small textarea. Placeholder is specific to the detected task type. Two buttons: "Let me think first" (hides the AI response area briefly, focuses the textarea) and "Skip — just ask" (proceeds normally).

**The psychological key:** Depth is an invitation to a conversation with yourself before you have a conversation with AI. The textarea is not a gate. Typing nothing and clicking skip is completely valid. The card exists to create a moment — a beat — not to enforce anything.

---

## Onboarding — the goal-setting moment

The Mismatch and Depth signals both depend on knowing something about the user's intentions. This requires a lightweight onboarding flow — 3 questions, completable in under 90 seconds, entirely optional (skipping puts Lumen in "Ghost" mode, no Mismatch or Depth signals, Loop and Drift only).

**Question 1: What do you mainly use AI for?**
Options: Research / Writing / Coding / Learning / Admin / Creative work / Work tasks
(Multi-select. Drives Loop sensitivity calibration — a researcher doing rapid literature review should score differently to someone asking AI to write their emails.)

**Question 2: Is there anything you want to protect?**
Free text, with examples: "I want to write my own first drafts." "I want to be the one who makes decisions." "I want to understand the code, not just copy it." "I want to keep doing my own analysis before asking AI."
(These become Mismatch triggers. Editable any time from the session badge popover. Can be deleted entirely to turn Mismatch off.)

**Question 3: How visible do you want Lumen to be?**

| Mode | What it does |
|------|-------------|
| Ghost | No in-session signals at all. Weekly digest only. |
| Ambient (default) | Quiet strips. No banners. Loop and Drift only. |
| Active | All four signals. Cards for Mismatch and Depth. |

---

## What "red" means now

Red is retired as a monolithic state. It is replaced by:

- Loop at high intensity — same green dot, but message changes: "loop · 8 messages, mostly passive"
- Mismatch at high frequency — purple dot, more direct card language
- Depth on a high-stakes personal question — blue dot, warmer card tone

The colour-coding is now:
- **Green** = Loop (descriptive, in-session)
- **Amber** = Drift (longitudinal, mostly in digest)
- **Purple** = Mismatch (user-defined, intention-based)
- **Blue** = Depth (task-type invitation)

No red. Red implied "danger" or "wrong." None of these states are dangerous or wrong. They are different types of signal that deserve different responses.

---

## Multi-platform architecture

The core architectural change from v2 to v3 is the introduction of **platform adapters** — thin modules that know how to find messages on a specific LLM site and feed them to Lumen's shared scoring engine.

### Shared core (platform-agnostic)
- `engine.js` — signal computation, composite scoring, state management
- `nudges.js` — signal-to-message library, contextual selection
- `goals.js` — user intention store, Mismatch detection
- `widget.js` — strip injection, card rendering, badge + popover
- `session.js` — chrome.storage.session + chrome.storage.sync management

### Platform adapters (one per site)
Each adapter exports a standard interface:
```js
{
  hostname: 'chat.openai.com',
  getUserMessages: () => NodeList,
  getAssistantMessages: () => NodeList,
  getMessageText: (el) => string,
  getMessageContainer: () => Element,
  onNewMessage: (callback) => MutationObserver
}
```

The shared engine calls only this interface. Adding a new platform = writing one adapter file. No changes to engine, nudges, goals, or widget.

### Platform rollout order

**Phase 1 (live):** ChatGPT — chat.openai.com + chatgpt.com
`[data-message-author-role="user"]` / `[data-message-author-role="assistant"]`

**Phase 2 (next):**
- Claude.ai — relatively stable DOM, human/assistant turn structure, high-value user overlap
- Gemini — google.com/gemini, Angular-heavy, more fragile DOM, large user base worth the maintenance cost
- Grok — x.com/i/grok, React DOM, power-user audience with high Lumen-fit

**Phase 3 (later):**
- Copilot — copilot.microsoft.com, embedded in Office suite, requires different injection model
- Perplexity — perplexity.ai, research-mode users, Depth signal most relevant

### Cross-platform session score

With multiple adapters active simultaneously, the session score must aggregate across platforms. A user who is passive on ChatGPT and then passive on Claude in the same hour should see that reflected.

Implementation: `chrome.storage.session` keyed by `lumen_session_{date}`, appended to from any active adapter. The session badge reads the aggregate regardless of which tab is active.

---

## The inline strip — v3 spec

### Visual

Same as v2 but with four colour states instead of three, and the signal name displayed:

```
Lumen  ●  loop · still with it?
Lumen  ●  drift · fewer questions this week
Lumen  ●  mismatch · you said you'd write this
Lumen  ●  depth · worth thinking first?
```

Strip height: 20px. Padding: 3px 0 12px. Right-aligned, matching bubble alignment.

Dot size: 7px. Colours: #4caf50 (loop), #ffc107 (drift), #b06aed (mismatch), #4a9fd4 (depth).

Message: 11px, same colour as dot but at 70% opacity. Max 40 characters.

### When each signal fires in-session

| Signal | In-session strip | In-session card | In digest |
|--------|-----------------|-----------------|-----------|
| Loop | Always | Never | Weekly aggregate |
| Drift | Strip label only | Never | Full analysis |
| Mismatch | Always when matched | Yes — user's intention | Frequency data |
| Depth | When task qualifies | Yes — thinking prompt | Examples of good depth moments |

---

## The weekly digest (Pro tier)

The digest is where Drift lives fully, and where Loop and Depth data become genuinely useful longitudinally.

**Structure:**
1. Your week in one line — "Mostly research and learning mode. Slightly more passive than last week."
2. Loop trend — sparkline of session scores across 7 days
3. Drift analysis — question-asking ratio, prompt length trend, passive acceptance trend
4. Depth moments — 2-3 examples of conversations where the Depth signal fired and what happened next
5. Mismatch summary — how often your intentions were tested, and what you chose
6. One prompt — a single question for the user to sit with. Not generated. Curated from a library. Examples: "What did you figure out yourself this week, without AI?" / "Was there a moment where you surprised yourself?"

The digest is the most important product moment for retention and genuine value delivery. It is the only place where the user gets to see themselves over time rather than just in the moment.

---

## Design principles for v3 (non-negotiable)

1. **No red.** Every signal has a non-judgmental name and a descriptive message. None of them say the user is doing something wrong.

2. **Ghost mode always available.** The user can turn everything off with one click at any time. A product that users feel trapped in will be uninstalled.

3. **Mismatch only fires from user-stated goals.** Lumen never decides what the user should protect. Only the user decides that.

4. **Depth never delays AI response.** The card is additive — the AI response loads normally beneath it. Depth is an invitation to reflect before reading, not a gate before asking.

5. **Drift never appears as a banner or card.** It is a strip label only in-session. The full analysis belongs in the digest. Longitudinal signals presented in real-time create anxiety without providing useful context.

6. **The reflection textarea is never required.** Every card has a "Skip" or "Continue" path that is as prominent as the reflective path. The choice is always the user's.
