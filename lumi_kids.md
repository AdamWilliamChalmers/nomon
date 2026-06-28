# Lumi — Kids Thinking Coach

> **Parked (2025).** Lumi is not wired into the extension or dashboard. Code lives in `extension/lumi*.js`, `web/components/LumiLearnedPanel.tsx`, and `web/app/api/lumi/` for when we pick it up again. Active product is Lumen only.

## What Lumi is

**Lumen** illuminates patterns for people who already want awareness. **Lumi** scaffolds thinking for young people (13–17) who are still building that habit.

Lumi is not a parental control tool. It does not block AI, set time limits, or show parents message content. It goes *farther in coaching*, not farther in control.

> Lumen helps you notice how you think with AI.  
> Lumi helps you learn *how* to think with AI — before you need to notice.

---

## Core features

### 1. Think with Lumi (pre-prompt ritual)

A button near the chat input opens a 30-second ritual before sending:

1. **What do you already know?** (textarea)
2. **What are you trying to figure out?** (pre-filled from draft prompt)
3. **Pick an approach:** Look it up / Figure it out / Get a hint

On complete, Lumi prepends structured context to the prompt and adds: *"Please help me learn — don't just give the final answer."*

### 2. @Lumi invocation

Typing `@lumi` at the start of a prompt opens the ritual instead of sending immediately.

### 3. Homework heuristic

When Lumi detects homework patterns (essay, assignment, solve this, etc.), it suggests the ritual — never blocks. User can always skip.

### 4. Kid voice pack

Same four signals as Lumen (Loop, Drift, Mismatch, Depth), warmer copy and Lumi branding when Lumi mode is on.

### 5. One thing I learned (weekly)

End of week on lumen.so dashboard: kid picks one thing they actually understood (not copied). Optional share with family. Appears on weekly card and parent digest email.

---

## Age boundary

- **13–17:** Primary audience. Lumi mode toggle in extension popup. Child-led family sharing unchanged.
- **Under 13:** Not supported. COPPA/regulatory surface. Refer parents to screen-time tools for hard controls.

---

## What Lumi does not do

- Block AI or enforce time limits
- Show parents session logs or message content
- Real-time parent alerts
- Peer comparison metrics
- Hidden parent modes

---

## Data

Lumi sessions track additional metrics locally and in session POSTs:

- `lumiRitualsCompleted` — pre-prompt rituals finished
- `lumiHomeworkSuggested` — homework heuristic fired
- `learnedMoment` — weekly highlight (web only, user-entered)

No conversation content is stored.

---

## Build map

| Component | Location |
|-----------|----------|
| Lumi mode + homework detection | `extension/lumi.js` |
| Kid voice copy | `extension/lumi-nudges.js` |
| Ritual UI + input hooks | `extension/content.js` |
| Session metrics | `extension/session.js` |
| Mode toggle | `extension/popup/` |
| Learned moment API | `web/app/api/lumi/learned/` |
| Dashboard panel | `web/components/LumiLearnedPanel.tsx` |
| Family email | `web/lib/familyEmail.ts` |

---

## Positioning

**To teens:** "Your thinking buddy for homework and big questions."

**To parents:** "Lumi helps your kid use AI like a tutor, not an answer machine."

**To schools:** "Show students how they're using AI — and help them make better choices themselves."
