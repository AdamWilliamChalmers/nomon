# Lumen — Metacognitive Reframe: Three Cursor Prompts

Run these in order. Each is a self-contained task.
Do NOT combine them into one session — scope creep risk is high.

---

---

# PROMPT 1 OF 3: Copy & Framing Rewrite
## nudges.js + popup copy + Chrome Web Store description

### Read this entire prompt before writing a single line of code.
### Output a numbered implementation plan and STOP. Wait for confirmation.

---

## Background

Lumen's signal model is correctly designed but currently uses the wrong
conceptual frame in its user-facing language. The product describes itself
as detecting "cognitive offloading" — but the research literature (Risko &
Gilbert 2016; Fan et al. 2025; Lodge & Loble 2026) is clear that offloading
itself is neutral. What Lumen actually detects is the harmful subset:
**metacognitive disengagement** — when the user stops evaluating, questioning,
or building on AI output and shifts into passive acceptance mode.

The fix is a copy rewrite. No engine logic changes. No signal weight changes.
Words only. Every user-facing string that currently implies "you are offloading"
should be rewritten to imply "you've stopped engaging critically."

This is not cosmetic. It affects credibility with academic users, university
procurement, and the product's ability to defend its claims if challenged.

---

## Files to change

### `extension/nudges.js`

Rewrite every strip message and card body using the principles below.
Do not change the JS structure, exports, or key names — only the string values.

**Rewrite principles:**

1. Never say "offloading", "delegating", or "handing over" in a negative frame.
   These are neutral acts. The problem is what happens after — or doesn't.

2. The question to surface is always: are you evaluating what the AI says?
   Not: are you asking too much of it.

3. Strip messages should be descriptive observations, never accusations.
   Current: "loop · still with it?"
   Better:  "loop · reading this, or moving on?"

4. Card body copy should reference the specific metacognitive risk,
   not the offloading behaviour.
   Current: "You've sent 4 outputs requests without editing or questioning."
   Better:  "Four responses accepted without a question or pushback.
             Worth checking — does this still sound like your thinking?"

**Rewrite the following string categories:**

STRIP MESSAGES — one line each, max 40 chars after the signal name:

  loop (low):      "loop · still reading?"
  loop (mid):      "loop · what would you change here?"
  loop (high):     "loop · reading this, or moving on?"
  hand-off:        "hand-off · what do you already know?"
  drift:           "drift · fewer questions this week"
  mismatch:        "mismatch · this conflicts with your goal"
  depth:           "depth · worth sitting with this?"

CARD HEADERS — short, signal-coloured, no judgment:

  loop:      "Still evaluating?"
  hand-off:  "Before you hand this over"
  mismatch:  "You said something different"
  depth:     "This one might be worth thinking through"

CARD BODY COPY — 1-2 sentences. Descriptive. Never "you're doing this wrong."

  loop_unaware:
    "Last [N] messages: short requests, long responses, no questions back.
     Not a problem — just worth noticing. Still tracking the reasoning?"

  loop_stuck:
    "What's one thing about this you already know, even roughly?
     Even a sentence changes how you use the answer."

  loop_overwhelmed:
    "You've been at this a while. Good place to pause if you need one."

  hand-off_default:
    "You're asking for [task type] in one go — which is fine.
     Even a rough paragraph first changes what you get back."

  mismatch_default:
    "When you set up Lumen, you said: \"[user goal]\".
     This prompt hands that over. Still the plan?"

  depth_default:
    "This is the kind of question where your instinct matters.
     Worth a thought before you read the answer?"

BUTTON LABELS — always give equal visual weight to skip path:

  think_first:     "Let me think first"
  continue:        "Continue — show answer"
  draft_first:     "I'll draft something"
  skip:            "Skip"
  got_it:          "Got it"
  tell_me_more:    "Tell me more"
  goal_changed:    "My goal changed — continue"
  keep_flagging:   "Keep flagging this"
  stop_flagging:   "Stop flagging [task type]"
  take_break:      "Take a break"
  keep_going:      "Keep going"

INTERVENTION CARD TITLES (the Unaware state):
  Current: "Lumen — high cognitive offloading detected"
  New:     "Lumen — checking in"
  Reason:  "high cognitive offloading detected" is an accusation.
            "checking in" is an observation.

---

### `extension/popup/popup.html` and `popup.js`

Rewrite the session summary section labels:

  Current: "Session score"     → "Engagement this session"
  Current: "Amber alerts"      → "Check-ins"
  Current: "Red interventions" → "Pause moments"
  Current: "Messages"          → "Messages" (keep)

The popup header tooltip (if any) on the score number:
  Current: "Cognitive offloading score"
  New:     "Metacognitive engagement — lower means more passive acceptance"

---

### `web/app/page.tsx` — landing page hero and how-it-works section

Rewrite the hero tagline candidates. The current framing "Stay conscious of
how you think alongside AI" is good but can be sharper.

Recommended replacement:
  Hero H1:    "Keep your thinking sharp while using AI."
  Hero H2:    "Lumen watches how you engage with AI responses —
               not how much you use AI."
  How it works, step 2 label:
    Current:  "Signals appear inline"
    New:      "You see when you've stopped evaluating"
  How it works, step 3 label:
    Current:  "Weekly card shows your shape"
    New:      "Your weekly card shows your engagement pattern"

Rewrite the feature description bullets to use metacognitive language:
  Current: "Detects cognitive offloading patterns"
  New:     "Detects when you shift from thinking with AI to accepting from AI"

  Current: "Four signal types"
  New:     "Four signals — each targeting a different metacognitive risk"

---

### `web/supabase/schema.sql` — insight_line templates

In the weekly summary generation logic (lib/scoring.ts), update the
INSIGHT_TEMPLATES to use metacognitive framing:

  thinker_high:
    Current: "Mostly a thinker week — more depth moments than usual."
    New:     "High engagement week — more evaluation moments than usual."

  explorer_high:
    Current: "Explorer mode all week. More questions than any week this month."
    New:     "Questioning mode all week — more pushback and follow-up than usual."

  delegator:
    Current: (implied negative)
    New:     "Mostly acceptance mode this week. Worth checking a few of those
              responses still sound like your thinking."

  ordinary:
    Keep: "Consistent with your baseline. A steady week." — this is correct.

---

## What NOT to change

- Signal names (Loop, Drift, Mismatch, Depth, Hand-off) — these are correct
- Signal colours — unchanged
- JS logic, scoring weights, engine.js — not in scope for this prompt
- The four human state names (Overwhelmed, Stuck, Unaware, Intentional) — keep
- Any file not listed above

---

## Definition of done

- [ ] Every user-facing string in nudges.js uses metacognitive framing
- [ ] No string contains "offloading" in a negative frame
- [ ] Intervention card titles no longer say "detected"
- [ ] Popup session labels updated
- [ ] Landing page hero and feature bullets updated
- [ ] insight_line templates updated in scoring.ts
- [ ] Zero functional changes — only string values modified




---

---

# PROMPT 2 OF 3: Engine — Cognitive Load Classification
## engine.js task type calibration table rewrite

### Read this entire prompt before writing a single line of code.
### Output a numbered implementation plan and STOP. Wait for confirmation.

---

## Background

The current task type calibration table in engine.js uses intuitive categories
(admin, research, creative, code). These work but lack a principled foundation
that explains WHY different tasks should score differently.

The research framework that justifies this is Cognitive Load Theory (Sweller),
which distinguishes three types of cognitive load:

- **Extraneous load** — effort that doesn't contribute to learning or thinking.
  Formatting, scheduling, converting, summarising documents you'll then engage
  with critically. Fine to offload entirely. Scoring should be minimal.

- **Intrinsic load** — the inherent complexity of the task itself.
  Debugging, researching, translating. Medium scoring — depends on whether
  the user is learning from the process or just extracting output.

- **Germane load** — the effort that actually builds understanding and skill.
  Writing your argument, forming a decision, learning a concept, making
  something that represents your thinking. This is what matters. High scoring.

Reclassify the existing TASK_TYPE_MODIFIERS table using this framework.
This makes Lumen's scoring defensible against academic scrutiny and reduces
false positives on legitimate extraneous-load tasks.

---

## File to change: `extension/engine.js`

### Replace the existing TASK_TYPE_MODIFIERS object

Current structure (approximate):
```js
const TASK_TYPE_MODIFIERS = {
  email_drafting:    { scoreMultiplier: 0.2, autoExemptAfter: 2 },
  scheduling:        { scoreMultiplier: 0.1, autoExemptAfter: 1 },
  // ... etc
};
```

Replace with this three-tier structure:

```js
const COGNITIVE_LOAD_TIERS = {

  // TIER 1: EXTRANEOUS LOAD
  // Effort that doesn't contribute to thinking or learning.
  // Legitimate to fully delegate. Score at 10-20% of normal.
  // autoExemptAfter: low — users should be able to exempt these quickly.
  extraneous: {
    email_drafting:    { scoreMultiplier: 0.15, autoExemptAfter: 2,
                         label: 'email drafting' },
    scheduling:        { scoreMultiplier: 0.10, autoExemptAfter: 1,
                         label: 'scheduling' },
    formatting:        { scoreMultiplier: 0.15, autoExemptAfter: 2,
                         label: 'formatting' },
    conversion:        { scoreMultiplier: 0.10, autoExemptAfter: 1,
                         label: 'file conversion' },
    translation:       { scoreMultiplier: 0.20, autoExemptAfter: 3,
                         label: 'translation' },
    summarisation:     { scoreMultiplier: 0.30, autoExemptAfter: null,
                         label: 'summarisation' },
                         // Note: summarisation scores slightly higher because
                         // the user should still engage with the summary.
  },

  // TIER 2: INTRINSIC LOAD
  // The inherent complexity of the task domain.
  // Delegation is common and often fine — but engagement matters.
  // Score at 40-70% of normal. No autoExempt.
  intrinsic: {
    fact_checking:     { scoreMultiplier: 0.35, autoExemptAfter: null,
                         label: 'fact checking' },
    literature_search: { scoreMultiplier: 0.40, autoExemptAfter: null,
                         label: 'literature search' },
    debugging:         { scoreMultiplier: 0.50, autoExemptAfter: null,
                         label: 'debugging' },
    code_generation:   { scoreMultiplier: 0.65, autoExemptAfter: null,
                         label: 'code generation' },
    data_analysis:     { scoreMultiplier: 0.55, autoExemptAfter: null,
                         label: 'data analysis' },
    research:          { scoreMultiplier: 0.45, autoExemptAfter: null,
                         label: 'research' },
  },

  // TIER 3: GERMANE LOAD
  // The effort that builds understanding, skill, and genuine thinking.
  // This is what Lumen is designed to protect.
  // Score at 90-120% of normal. Never autoExempt.
  germane: {
    essay_writing:     { scoreMultiplier: 1.0,  autoExemptAfter: null,
                         label: 'essay writing' },
    argument_building: { scoreMultiplier: 1.0,  autoExemptAfter: null,
                         label: 'argument building' },
    decision_making:   { scoreMultiplier: 1.1,  autoExemptAfter: null,
                         label: 'decision making' },
    learning_concept:  { scoreMultiplier: 1.2,  autoExemptAfter: null,
                         label: 'learning a concept' },
    creative_writing:  { scoreMultiplier: 0.9,  autoExemptAfter: null,
                         label: 'creative writing' },
    reflection:        { scoreMultiplier: 1.2,  autoExemptAfter: null,
                         label: 'personal reflection' },
    code_explanation:  { scoreMultiplier: 0.9,  autoExemptAfter: null,
                         label: 'understanding code' },
                         // Different from code_generation — user is learning.
  },
};

// Flatten for backward compatibility — existing code uses TASK_TYPE_MODIFIERS
const TASK_TYPE_MODIFIERS = Object.assign(
  {},
  COGNITIVE_LOAD_TIERS.extraneous,
  COGNITIVE_LOAD_TIERS.intrinsic,
  COGNITIVE_LOAD_TIERS.germane
);
```

### Update detectTaskType() to use the new categories

Add a `loadTier` property to each detected task:

```js
function detectTaskType(message, context) {
  const text = message.toLowerCase();

  // Extraneous — always detect first (lowest friction to exempt)
  if (/write.*email|draft.*message|reply to|respond to/i.test(text))
    return { type: 'email_drafting', tier: 'extraneous' };
  if (/schedule|calendar|meeting|appointment/i.test(text))
    return { type: 'scheduling', tier: 'extraneous' };
  if (/format|tidy|clean up|convert|export as/i.test(text))
    return { type: 'formatting', tier: 'extraneous' };
  if (/translate|in (french|spanish|german|chinese|japanese)/i.test(text))
    return { type: 'translation', tier: 'extraneous' };
  if (/summar|tldr|key points|bullet.*points|main points/i.test(text))
    return { type: 'summarisation', tier: 'extraneous' };

  // Intrinsic — domain complexity tasks
  if (/fact.check|is it true|verify|source for/i.test(text))
    return { type: 'fact_checking', tier: 'intrinsic' };
  if (/find.*paper|literature|research.*on|papers.*about/i.test(text))
    return { type: 'literature_search', tier: 'intrinsic' };
  if (/bug|error|fix.*line|why.*not.*work|debug/i.test(text))
    return { type: 'debugging', tier: 'intrinsic' };
  if (/write.*function|generate.*code|create.*class|build.*component/i.test(text))
    return { type: 'code_generation', tier: 'intrinsic' };
  if (/analyse|analyze|data.*show|what.*pattern/i.test(text))
    return { type: 'data_analysis', tier: 'intrinsic' };

  // Germane — the load that builds thinking
  if (/write.*essay|draft.*paper|argument.*for|thesis/i.test(text))
    return { type: 'essay_writing', tier: 'germane' };
  if (/should i|decide|worth it|pros.*cons|help me choose/i.test(text))
    return { type: 'decision_making', tier: 'germane' };
  if (/explain.*to me|help me understand|how does.*work|why does/i.test(text))
    return { type: 'learning_concept', tier: 'germane' };
  if (/explain.*this code|what does.*do|how.*written/i.test(text))
    return { type: 'code_explanation', tier: 'germane' };
  if (/i feel|thinking about|reflecting|not sure what|career|life/i.test(text))
    return { type: 'reflection', tier: 'germane' };

  return { type: 'general', tier: 'intrinsic' }; // default: medium sensitivity
}
```

### Add loadTier to session POST payload

In session.js, include the most common detected load tier in the session summary:

```js
// Add to session payload
dominantLoadTier: session.taskTypeHistory
  .reduce((acc, t) => {
    acc[t.tier] = (acc[t.tier] || 0) + 1;
    return acc;
  }, {}),
```

This gives lumen.so data to show the user what kind of work they were doing,
not just how passively they engaged.

---

## What NOT to change

- Signal weights (Loop 20%, Drift 25%, Passive 30%, Task framing 25%)
- The composite score calculation
- The four human states
- content.js, widget.css, adapters — not in scope
- The session POST endpoint schema (add dominantLoadTier but don't remove fields)

---

## Definition of done

- [ ] COGNITIVE_LOAD_TIERS object exists with three tiers, all task types
- [ ] TASK_TYPE_MODIFIERS flattened from tiers for backward compatibility
- [ ] detectTaskType() returns { type, tier } not just a string
- [ ] scoreMultiplier values follow extraneous < intrinsic < germane progression
- [ ] autoExemptAfter is null for all germane tasks (never auto-exempt)
- [ ] dominantLoadTier added to session POST payload
- [ ] No changes to signal weights, composite score, or human states
- [ ] No console errors




---

---

# PROMPT 3 OF 3: New Signal — Dwell Time (Signal 5)
## engine.js + content.js — metacognitive evaluation signal

### Read this entire prompt before writing a single line of code.
### Output a numbered implementation plan and STOP. Wait for confirmation.

---

## Background

The four existing signals (Loop, Drift, Passive Acceptance, Task Framing) all
measure what the user TYPES. None of them measure what the user DOES with the
AI's response — which is the more direct proxy for metacognitive engagement.

Signal 5 measures **dwell time**: how long the user spends with the AI response
before composing their next message. Very short dwell time on a long response
is strong evidence of passive acceptance — the user almost certainly did not
read it, let alone evaluate it. Long dwell time suggests genuine engagement.

This is grounded in the research literature. The 2026 International AI Safety
Report flags passive acceptance of AI output as a primary mechanism of
metacognitive erosion. Dwell time is the most direct behavioural measure of
whether evaluation occurred.

---

## Implementation

### In `extension/content.js`

Add a dwell time tracker that fires when a new AI response appears:

```js
// Dwell time tracker — measures time between AI response appearing
// and user beginning to type their next message.

let dwellState = {
  responseAppearedAt: null,
  responseWordCount: 0,
  dwellRatio: null,
};

function startDwellTimer(aiMessageEl) {
  dwellState.responseAppearedAt = Date.now();
  dwellState.responseWordCount = countWords(aiMessageEl.innerText || '');
  dwellState.dwellRatio = null;

  // Watch for user starting to type
  const inputEl = getInputElement(); // use adapter to find textarea
  if (!inputEl) return;

  const onInput = () => {
    if (dwellState.responseAppearedAt && !dwellState.dwellRatio) {
      const elapsed = Date.now() - dwellState.responseAppearedAt;
      // Expected read time: 238ms per word (comfortable reading speed)
      const expectedReadTime = dwellState.responseWordCount * 238;
      dwellState.dwellRatio = expectedReadTime > 0
        ? elapsed / expectedReadTime
        : 1.0;

      // Store for engine to pick up on next score computation
      window.__lumenDwellRatio = dwellState.dwellRatio;
    }
    inputEl.removeEventListener('input', onInput);
  };

  inputEl.addEventListener('input', onInput);
}

// Call startDwellTimer whenever a new AI message appears
// Hook into the existing MutationObserver that watches for new messages
// Add after the existing new-message detection logic:
// if (isNewAIMessage(mutation)) { startDwellTimer(newAIMessageEl); }
```

### In `extension/engine.js`

Add Signal 5 scoring function:

```js
// Signal 5: Dwell time — did the user read the AI response?
// Weight: contributes to passive acceptance score, not a standalone signal.
// Does not appear as its own strip label — it modifies the passive
// acceptance score only.

function scoreDwellTime(dwellRatio, priorAIWordCount) {
  // Only meaningful if AI response was substantial
  if (priorAIWordCount < 100) return 0;
  if (dwellRatio === null || dwellRatio === undefined) return 0;

  // dwellRatio < 0.15: almost certainly didn't read (300 words in under 11s)
  // dwellRatio 0.15-0.4: skimmed
  // dwellRatio 0.4-0.8: probably read
  // dwellRatio > 0.8: read carefully

  if (dwellRatio < 0.15) return 25;   // Strong passive acceptance signal
  if (dwellRatio < 0.30) return 15;   // Probable skim
  if (dwellRatio < 0.50) return 5;    // Borderline
  return -10;                          // Credit for reading carefully
}
```

Integrate into the passive acceptance score calculation:

```js
// In computePassiveAcceptance(), add dwell time contribution:
function computePassiveAcceptance(userMessage, priorAIMessage, context) {
  let score = 0;

  // Existing passive acceptance logic (keep unchanged):
  const aiWordCount = countWords(priorAIMessage);
  const userWordCount = countWords(userMessage);
  const hasQuestion = userMessage.includes('?');
  const quotesAI = checkQuotesAI(userMessage, priorAIMessage);

  if (aiWordCount > 300 && userWordCount < 8 && !hasQuestion && !quotesAI) {
    score = 100;
  } else if (aiWordCount > 200 && userWordCount < 15 && !hasQuestion) {
    score = 60;
  }
  // ... existing scaling logic ...

  // Add Signal 5: dwell time modifier
  const dwellRatio = window.__lumenDwellRatio || null;
  const dwellScore = scoreDwellTime(dwellRatio, aiWordCount);
  score = Math.min(100, Math.max(0, score + dwellScore));

  // Clear dwell ratio — consumed
  window.__lumenDwellRatio = null;

  return score;
}
```

### Dwell ratio in session data

Add to chrome.storage.session and the session POST payload:

```js
// Track dwell ratios across the session for the POST
session.dwellRatios = session.dwellRatios || [];
session.dwellRatios.push({
  messageIndex: session.messageCount,
  ratio: dwellRatio,
  aiWordCount: dwellState.responseWordCount,
});

// In session POST payload, add:
avgDwellRatio: session.dwellRatios.length > 0
  ? session.dwellRatios.reduce((a, b) => a + b.ratio, 0) /
    session.dwellRatios.length
  : null,
lowDwellCount: session.dwellRatios.filter(d => d.ratio < 0.3).length,
```

### Dwell time in the weekly card

In `web/lib/scoring.ts`, add a dwell metric to the weekly summary:

```ts
// Add to WeeklySummary type and aggregation:
avgDwellRatio: number | null;  // null if not enough data
lowDwellSessions: number;      // sessions where avg dwell was under 0.3

// Add to weekly card display (lib/shapes.ts shape classification):
// A user with consistently low dwell ratios across germane-load tasks
// should be classified as 'Delegator' regardless of other signals.
if (avgDwellRatio !== null && avgDwellRatio < 0.25 &&
    dominantTier === 'germane') {
  return 'Delegator';
}
```

---

## Edge cases to handle

1. **User switches tabs mid-read.** If the tab loses focus between AI response
   appearing and user typing, pause the dwell timer. Resume on focus return.
   Use `document.addEventListener('visibilitychange')`.

2. **AI response streams slowly.** Don't start the dwell timer until the AI
   response has stopped streaming (word count stabilises). Poll every 500ms
   for 3 seconds after the message element appears; start timer when stable.

3. **Very short AI responses** (under 100 words). Don't score dwell time —
   short responses don't require meaningful read time. Score = 0.

4. **User copies text from AI response.** This is strong engagement evidence.
   If a `copy` event fires on the AI message element during the dwell window,
   apply a -15 credit to the dwell score (they were reading carefully enough
   to copy).

5. **Mobile / touch.** Touch events instead of `input` event on textarea.
   Use `touchstart` on the input area as the dwell-end trigger on mobile.

---

## What NOT to change

- Signal weights for Loop, Drift, Task Framing — unchanged
- Dwell time does NOT appear as its own strip label — it feeds into
  passive acceptance score only. No new signal colour. No new strip message.
- The four human states — unchanged
- Platform adapters — unchanged
- The session POST endpoint shape (only adding fields, not changing existing)

---

## Definition of done

- [ ] startDwellTimer() fires on every new AI message
- [ ] Timer pauses on tab visibility change, resumes on return
- [ ] Timer starts only after AI response has stabilised (stopped streaming)
- [ ] scoreDwellTime() modifies passive acceptance score correctly
- [ ] Copy-during-dwell applies -15 credit
- [ ] dwellRatio consumed after each message (no cross-message bleed)
- [ ] avgDwellRatio and lowDwellCount in session POST payload
- [ ] No new strip label or signal colour introduced
- [ ] No console errors on ChatGPT, Claude, Gemini, Grok
