# Lumen — Design System for Cursor

## What this is

Lumen is a Chrome extension + web product (lumen.so) that detects cognitive offloading patterns during AI conversations. It holds up a mirror to the user's thinking habits — passivity, drift, goal conflicts — without nagging them.

**Core philosophy: mirror, not nanny.**
- No red. No blocking. No required actions.
- Ghost mode always available (full opacity → 30%)
- Signals inform, never alarm
- The reflection box is never required

---

## Design direction: Diffuse

The Diffuse direction was chosen for Lumen. Key qualities:
- Near-white lavender-tinted base — calm, browser-native
- The four signal colours do ALL chromatic work; the base palette is achromatic
- Plus Jakarta Sans throughout, weight contrast does the heavy lifting
- Signals appear as quiet data, never as alerts

---

## Colour tokens

Copy these into your CSS `:root` or Tailwind config.

```css
:root {
  /* Base surfaces */
  --lumen-cloud:    #fafafc;   /* page background */
  --lumen-surface:  #ffffff;   /* card / popup bg */
  --lumen-mist:     #e8e7f0;   /* border, divider */
  --lumen-mist-lt:  #f0eff5;   /* hero / section tint (iris) */

  /* Text */
  --lumen-dusk:     #1a1825;   /* primary text, logo mark */
  --lumen-slate:    #7b7a8a;   /* secondary text */
  --lumen-haze:     #9896a8;   /* muted / labels */
  --lumen-ghost:    #b8b6c4;   /* ghost mode, timestamps */

  /* Borders */
  --lumen-border:   #e2e1ea;   /* default hairline */
  --lumen-border-strong: #c8c7d5; /* hover / emphasis */

  /* Signal colours — the ONLY chromatic elements */
  --lumen-loop:          #2d9e4e;   /* green  — in-session passivity */
  --lumen-loop-tint:     #e8f7ee;
  --lumen-loop-text:     #1a6630;

  --lumen-drift:         #d4921a;   /* amber  — cross-session decline */
  --lumen-drift-tint:    #faf0e0;
  --lumen-drift-text:    #7a5010;

  --lumen-mismatch:      #7b5cbf;   /* purple — goal conflict */
  --lumen-mismatch-tint: #ede9f8;
  --lumen-mismatch-text: #4a3680;

  --lumen-depth:         #3478c5;   /* blue   — high-stakes prompt */
  --lumen-depth-tint:    #e8f0fa;
  --lumen-depth-text:    #1a4880;

  /* RULE: Never use red. Not for errors, not for warnings, not ever. */
}
```

### Tailwind config equivalent

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        lumen: {
          cloud:    '#fafafc',
          surface:  '#ffffff',
          mist:     '#e8e7f0',
          'mist-lt':'#f0eff5',
          dusk:     '#1a1825',
          slate:    '#7b7a8a',
          haze:     '#9896a8',
          ghost:    '#b8b6c4',
          border:   '#e2e1ea',
          loop:     '#2d9e4e',
          'loop-tint':    '#e8f7ee',
          'loop-text':    '#1a6630',
          drift:    '#d4921a',
          'drift-tint':   '#faf0e0',
          'drift-text':   '#7a5010',
          mismatch: '#7b5cbf',
          'mismatch-tint':'#ede9f8',
          'mismatch-text':'#4a3680',
          depth:    '#3478c5',
          'depth-tint':   '#e8f0fa',
          'depth-text':   '#1a4880',
        }
      }
    }
  }
}
```

---

## Typography

**Font family:** Plus Jakarta Sans (single family, weight contrast only)

```html
<!-- In <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

```css
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
}
```

### Type scale

| Role            | Size  | Weight | Tracking | Usage                        |
|-----------------|-------|--------|----------|------------------------------|
| Display         | 36–40px | 700  | –0.03em  | Hero headlines, lumen.so     |
| Heading 1       | 24px  | 600    | –0.02em  | Section headers              |
| Heading 2       | 17px  | 600    | –0.01em  | Card titles, popup sections  |
| Body            | 14px  | 400    | 0        | Descriptions, nudge text     |
| Signal value    | 22px  | 700    | –0.03em  | The 2.1× number              |
| Label / caption | 11px  | 500    | +0.04em  | Signal names, timestamps     |

---

## Logo mark

The Lumen mark is **three concentric rings at decreasing opacity**. A diffusion pattern, a pupil, a ripple. It conveys observation without surveillance.

```html
<!-- Standard mark (dark bg) — use in popup header, favicon -->
<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
  <circle cx="9" cy="9" r="3" fill="white" opacity="0.95"/>
  <circle cx="9" cy="9" r="6" stroke="white" stroke-width="1" opacity="0.3"/>
  <circle cx="9" cy="9" r="8.5" stroke="white" stroke-width="0.5" opacity="0.15"/>
</svg>
```

```html
<!-- Mark container — the square rounded pill -->
<div style="
  width: 36px; height: 36px;
  background: #1a1825;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
">
  <!-- mark SVG above -->
</div>
```

### Logo lockup (wordmark + mark)

```html
<div style="display:flex; align-items:center; gap:9px;">
  <!-- mark container -->
  <span style="
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #1a1825;
    letter-spacing: -0.02em;
  ">lumen</span>
</div>
```

### Ghost mode state

When Ghost mode is active, set opacity 0.3 on the entire logo lockup. Do not change the mark itself.

```css
.lumen-logo.ghost-mode { opacity: 0.3; }
```

---

## The four signals

Each signal has: a name, colour, icon, tint background, and text colour for on-tint use.

| Signal   | Meaning                    | Colour     | Icon (Tabler)        | Tint       |
|----------|----------------------------|------------|----------------------|------------|
| Loop     | In-session passivity       | `#2d9e4e`  | `ti-refresh`         | `#e8f7ee`  |
| Drift    | Cross-session decline      | `#d4921a`  | `ti-trending-down`   | `#faf0e0`  |
| Mismatch | Goal conflict              | `#7b5cbf`  | `ti-arrows-diff`     | `#ede9f8`  |
| Depth    | High-stakes prompt         | `#3478c5`  | `ti-brain`           | `#e8f0fa`  |

### Signal stat card component

```html
<div class="signal-card" data-signal="loop">
  <div class="signal-card__header">
    <div class="signal-card__dot"></div>
    <span class="signal-card__name">Loop</span>
  </div>
  <div class="signal-card__value">2.1<span class="signal-card__unit">×</span></div>
  <div class="signal-card__desc">4 consecutive accepts</div>
</div>
```

```css
.signal-card {
  border-radius: 10px;
  padding: 12px 14px;
  border: 0.5px solid #e2e1ea;
  background: white;
}

.signal-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.signal-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.signal-card__name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.signal-card__value {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 4px;
}

.signal-card__unit {
  font-size: 14px;
  font-weight: 500;
}

.signal-card__desc {
  font-size: 11px;
  color: #9896a8;
  line-height: 1.4;
}

/* Null/inactive state */
.signal-card--null { opacity: 0.4; }

/* Signal variants */
[data-signal="loop"]     .signal-card__dot  { background: #2d9e4e; }
[data-signal="loop"]     .signal-card__name { color: #1a6630; }
[data-signal="loop"]     .signal-card__value { color: #2d9e4e; }

[data-signal="drift"]    .signal-card__dot  { background: #d4921a; }
[data-signal="drift"]    .signal-card__name { color: #7a5010; }
[data-signal="drift"]    .signal-card__value { color: #d4921a; }

[data-signal="mismatch"] .signal-card__dot  { background: #7b5cbf; }
[data-signal="mismatch"] .signal-card__name { color: #4a3680; }
[data-signal="mismatch"] .signal-card__value { color: #7b5cbf; }
[data-signal="mismatch"] { border-color: #d4d0ed; }

[data-signal="depth"]    .signal-card__dot  { background: #3478c5; }
[data-signal="depth"]    .signal-card__name { color: #1a4880; }
[data-signal="depth"]    .signal-card__value { color: #3478c5; }
```

### Signal pill / badge

```html
<div class="signal-pill" data-signal="mismatch">
  <div class="signal-pill__dot"></div>
  Mismatch
</div>
```

```css
.signal-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.signal-pill__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

[data-signal="loop"]     .signal-pill { background: #e8f7ee; color: #1a6630; }
[data-signal="loop"]     .signal-pill__dot { background: #2d9e4e; }
[data-signal="drift"]    .signal-pill { background: #faf0e0; color: #7a5010; }
[data-signal="drift"]    .signal-pill__dot { background: #d4921a; }
[data-signal="mismatch"] .signal-pill { background: #ede9f8; color: #4a3680; }
[data-signal="mismatch"] .signal-pill__dot { background: #7b5cbf; }
[data-signal="depth"]    .signal-pill { background: #e8f0fa; color: #1a4880; }
[data-signal="depth"]    .signal-pill__dot { background: #3478c5; }
```

---

## Nudge component (the mirror)

The nudge is the primary interaction surface. Rules:
- Left accent bar = signal colour (2.5px, no border-radius)
- Title is brief and factual, never imperative
- Body copy uses "still your call", "noticing, not judging" — non-prescriptive language
- CTA is always optional, never a required action
- Never use modal overlays. Never block content.

```html
<div class="nudge" data-signal="mismatch">
  <div class="nudge__bar"></div>
  <div class="nudge__body">
    <div class="nudge__title">Goal mismatch</div>
    <div class="nudge__text">
      This session conflicts with "think independently on strategy." Still your call.
    </div>
    <button class="nudge__action">Reflect ↗</button>
  </div>
</div>
```

```css
.nudge {
  border-radius: 10px;
  padding: 11px 14px;
  border: 0.5px solid #e2e1ea;
  background: white;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.nudge__bar {
  width: 2.5px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: stretch;
  /* colour set by data-signal below */
}

.nudge__body { flex: 1; }

.nudge__title {
  font-size: 12px;
  font-weight: 600;
  color: #1a1825;
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}

.nudge__text {
  font-size: 11px;
  color: #7b7a8a;
  line-height: 1.45;
}

.nudge__action {
  font-size: 11px;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-top: 5px;
  /* colour set by data-signal below */
}

[data-signal="loop"]     .nudge__bar    { background: #2d9e4e; }
[data-signal="loop"]     .nudge__action { color: #2d9e4e; }
[data-signal="drift"]    .nudge__bar    { background: #d4921a; }
[data-signal="drift"]    .nudge__action { color: #d4921a; }
[data-signal="mismatch"] .nudge__bar    { background: #7b5cbf; }
[data-signal="mismatch"] .nudge__action { color: #7b5cbf; }
[data-signal="depth"]    .nudge__bar    { background: #3478c5; }
[data-signal="depth"]    .nudge__action { color: #3478c5; }
```

---

## Extension popup layout (320px wide)

```
┌─────────────────────────────────┐
│ [mark] lumen          [Ghost]   │  ← header, border-bottom
├────────┬────────┬────────┬──────┤
│ Loop   │ Drift  │Mismatch│Depth │  ← stats row, border-bottom
│ 2.1×   │   —    │   1    │  —   │
│ low    │        │flagged │      │
├─────────────────────────────────┤
│ ▌ Goal mismatch detected        │  ← nudge, border-bottom
│   "...conflicts with your goal" │
│   Reflect ↗                     │
├─────────────────────────────────┤
│ Session 04 · 28 min    Digest ↗ │  ← footer
└─────────────────────────────────┘
```

See `screens/extension-popup.html` for the full implementation.

---

## Icons

Use **Tabler Icons** (outline variant only — never filled).

```html
<!-- Load in <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">

<!-- Usage -->
<i class="ti ti-refresh" aria-hidden="true"></i>
```

### Signal icons (tinted to signal colour)

| Signal   | Icon class          | Reason                        |
|----------|---------------------|-------------------------------|
| Loop     | `ti-refresh`        | Repetition, cycling           |
| Drift    | `ti-trending-down`  | Decline over time             |
| Mismatch | `ti-arrows-diff`    | Conflict / divergence         |
| Depth    | `ti-brain`          | Thinking, cognition           |

### UI chrome icons (--lumen-haze colour)

| Action        | Icon class           |
|---------------|----------------------|
| Ghost mode    | `ti-eye-off`         |
| Weekly digest | `ti-chart-line`      |
| Set goal      | `ti-target`          |
| Settings      | `ti-settings-2`      |
| Session time  | `ti-clock-hour-4`    |
| Reflect       | `ti-sparkles`        |
| Dismiss       | `ti-x`               |
| Mute          | `ti-bell-off`        |
| Active/live   | `ti-circle-dot`      |

---

## Copy voice

- **Factual, not prescriptive.** "4 consecutive accepts" not "You're offloading too much."
- **Non-imperative CTAs.** "Reflect ↗" not "Fix this now."
- **Acknowledge autonomy.** Add "still your call" or "noticing, not judging" to nudge copy.
- **No red, no alarm language.** "Flagged" not "Warning." "Detected" not "Alert."
- **Sentence case everywhere.** "Goal mismatch" not "Goal Mismatch."
- **Ghost mode copy.** "Ghost mode" not "Pause" or "Disable."

---

## Spacing system

| Token   | Value | Usage                              |
|---------|-------|------------------------------------|
| `--sp-1`  | 4px   | Icon-to-label gap                  |
| `--sp-2`  | 8px   | Internal component padding         |
| `--sp-3`  | 12px  | Card padding (tight)               |
| `--sp-4`  | 16px  | Card padding (standard)            |
| `--sp-5`  | 24px  | Section gap                        |
| `--sp-6`  | 32px  | Large section gap                  |
| `--sp-8`  | 48px  | Hero padding                       |

Border radius: `8px` controls/inputs, `10px` cards/nudges, `12px` popup shell/modals.

---

## What NOT to do

1. **No red** — ever, anywhere in the product
2. **No modal overlays** that block AI responses
3. **No required actions** — every nudge is dismissible
4. **No alarm language** — "warning", "danger", "you must"
5. **No gradients** — flat surfaces only
6. **No filled Tabler icons** — outline only
7. **No other font families** — Plus Jakarta Sans only
8. **No chromatic base surfaces** — only the four signal colours carry hue
