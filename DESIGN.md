# Nomon — Design System ("Aurora Grayscale")

> Single source of truth for the extension's visual language. The interactive
> reference implementation lives in `mockups/` — this document distills it into
> tokens and rules for implementation in `widget.css` / `widget.js` (and the
> mirrored Safari copy under `safari/Nomon/Nomon Extension/Resources/`).

---

## 1. Philosophy

Premium, subtle, controlled. Near-black ("Ink") or warm-paper ("Paper") surfaces,
soft neutral light-gradients, matte grain, hairline borders, generous radii. The
product should feel like a quiet instrument — a mirror, not a nanny.

### The three hard rules (non-negotiable)

1. **No emojis.** Anywhere. Use type, the four-dot mark, or a thin-stroke SVG glyph instead.
2. **No purple — or any shade of purple — anywhere,** with the *single* exception of the
   four-dot logo mark and its animation. Purple must not appear in signals, cards, panels,
   badges, borders, or gradients.
3. **No "glow" highlights.** No blurred/spread box-shadows used to draw attention, no pulsing
   glow rings. Elevation drop-shadows (for depth) and hairline rings (for structure) are fine;
   a soft *ambient background light-gradient* is fine. A colored bloom around a UI element to
   highlight it is not.

### Colour policy

- The **four-dot mark** (green / amber / purple / blue) is the **only saturated colour** in the product.
- Exactly **two restrained, flat accents** are allowed *outside* the mark:
  - **Blue** — the **Cost** pillar only (money reads distinct from cognition).
  - **Green** — **positive / success** only ("on by default", completed goals, "biggest win").
- Everything else is **grayscale**. **Signals and modes differentiate by label and border
  weight, not hue** — they are monochrome.

---

## 2. Colour tokens

### The logo mark (the only saturated colour)

| Token | Hex |
|---|---|
| `--nm-dot-green` | `#5ba85c` |
| `--nm-dot-amber` | `#e5a33d` |
| `--nm-dot-purple` | `#8e6fd8` |
| `--nm-dot-blue` | `#5b9bd5` |

These appear **only** in the four-dot mark. Never reuse them for signal/card/border chrome.

### Ink theme (dark hosts: Gemini, Grok, dark ChatGPT/Claude)

| Role | Value |
|---|---|
| Page / deepest bg | `#08080b` |
| Canvas gradient | `linear-gradient(180deg,#101014,#0b0b0e)` |
| Card / panel | `linear-gradient(180deg, rgba(24,24,30,.98), rgba(15,15,19,.98))` |
| Glass fill (subtle) | `rgba(255,255,255,.03)` → `.06` |
| Border hairline | `rgba(255,255,255,.08)` |
| Border strong | `rgba(255,255,255,.12)` – `.28` |
| Text primary | `#f2f2f4` (headings `#ffffff`) |
| Text body | `#e7e7ea` |
| Text secondary | `#a2a2ad` |
| Text muted | `#9a9aa5` / `#8a8a95` |
| Text faint | `#7f7f8a` / `#6a6a75` |
| Neutral dot (signal/status) | `#9a9aa5` (lead dot `#a2a2ad`) |
| Headline gradient | `linear-gradient(180deg,#fff,#b7b7c2)` |

### Paper theme (light hosts: default ChatGPT, Claude)

| Role | Value |
|---|---|
| Page bg | `linear-gradient(180deg,#fbfbfd,#f3f3f6)` |
| Card / panel | `linear-gradient(180deg,#fff,#f6f6f9)` |
| Glass fill | `rgba(0,0,0,.02)` |
| Border hairline | `rgba(0,0,0,.06)` – `.08` |
| Border strong | `rgba(0,0,0,.12)` – `.25` |
| Text primary | `#1a1822` (headings `#17151f`) |
| Text body | `#33333b` |
| Text secondary | `#55555e` |
| Text muted | `#6f6f79` / `#77777f` |
| Text faint | `#83838d` / `#9a9aa5` |
| Neutral dot | `#83838d` |
| Inverted control (selected) | bg `#1a1822`, text `#fff` |

### The two allowed accents

| Accent | Use | Ink | Paper |
|---|---|---|---|
| **Cost blue** | Cost strip, savings ledger, Cost tag | fill `rgba(91,155,213,.10)`, border `rgba(91,155,213,.28)`, dot/stroke `#5b9bd5`, tag text `#8fbfe8` | fill `rgba(91,155,213,.08–.10)`, border `rgba(91,155,213,.35)` |
| **Positive green** | "on by default", completed goal tick, biggest-win card | fill `rgba(91,168,92,.14)`, border `rgba(91,168,92,.30)`, text `#7fbf80` | fill `rgba(91,168,92,.12)`, border `.35` |

> Reassignment note: the old signal palette (`--lm-loop` green, `--lm-drift` amber,
> `--lm-mismatch` purple, `--lm-handoff` blue, `--lm-depth` blue) is **retired for chrome**.
> Signals are now monochrome. Keep the hues only inside the logo mark.

---

## 3. Typography

- **UI:** `"Plus Jakarta Sans"` (weights 300–800), system-sans fallback.
- **Editorial serif:** `"Newsreader"` — used **only** for the weekly-digest headline, the
  "Sit with" prompt, the share card, and the onboarding step titles. One considered flourish;
  do not spread it into general UI.
- Headings: weight 700, letter-spacing `-0.02em` to `-0.03em`.
- Body: 13–15px, line-height ~1.6, `#a2a2ad`/`#55555e`.
- Labels/kickers: 10–12px, weight 600–700, `letter-spacing:.12em–.22em`, uppercase, faint.

---

## 4. Shape, spacing, elevation

| Token | Value |
|---|---|
| Radius pill | `999px` |
| Radius card / modal | `18–24px` |
| Radius control (input/select/button) | `10–14px` |
| Radius small (chip inner, glyph box) | `7–11px` |
| Hairline border | `1px` (`0.5px` acceptable on retina) |

**Elevation (drop-shadows only — never a glow):**
- Resting pill: `0 8px 30px rgba(0,0,0,.45)` + inner highlight `inset 0 1px 0 rgba(255,255,255,.06)`
- Panel / modal: `0 24px 70px rgba(0,0,0,.6)` (Ink) · `0 24px 60px rgba(20,20,40,.18)` (Paper)
- Tooltip: `0 14px 40px rgba(0,0,0,.6)`

**Grain** (keeps gradients from reading flat/plasticky):
SVG `feTurbulence` fractal noise overlay on large surfaces —
`opacity:.035; mix-blend-mode:overlay` (Ink) · `opacity:.5; mix-blend-mode:multiply` (Paper).

**Ambient light-gradients** (encouraged — this is the "gradients of light" look): soft radial
`rgba(255,255,255,.05–.12)` and faint cool-blue `rgba(91,155,213,.06–.10)`, low and diffuse,
behind large surfaces. These are *background texture*, distinct from banned element glows.

---

## 5. Motion

| Token | Value |
|---|---|
| `--nm-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Mark ease | `cubic-bezier(0.45, 0, 0.55, 1)` |
| Fast (hover/toggle) | `.12–.15s` |
| Base (expand/fade) | `.2–.28s` |
| Mark cycle duration | `~4.6s`, plays **once per scored message** (idle = static) |

Respect `prefers-reduced-motion`: disable the mark cycle and any breathe animations.

### The four-dot mark

- Four dots in a T/diamond formation; each carries rest (`--rx/--ry`) and diamond
  (`--ex/--ey`) offsets. Green/amber/purple across the top, blue below-centre.
- **Crisp dots — no `box-shadow` glow** (rule 3). This is the one change from the old mark.
- Animation preserved from current behaviour: one processing loop per scored event
  (rest → converge → pulse → diamond → orbit → return). Idle is static.
- The mark is the brand everywhere: FAB, panel header, badge card, digest, wizard, empty states.

---

## 6. Components (see `mockups/` for the built reference)

| Surface | Mockup | Notes |
|---|---|---|
| **FAB / pill** | `fab.html` | Rest = mark only. Hover/tap → **horizontal three-pillar rail** (Mirror / Badge / Cost) with glyph + purpose line + neutral status dot. Signals = grayscale label + one neutral lead dot + stronger neutral border (no colour, no glow). Modes differ by border weight (Ambient plain · Active subtle border · Guard firmer border · Ghost dashed/faded · Paused greyscale). Digest-ready = small neutral dot with a **subtle opacity breathe**, not a glow pulse. |
| **Signal strips** | `interventions.html` §A | Monochrome pill, single neutral dot, name carries the signal. Hover tooltip states the principle in plain language, cited against behaviour. Optional one-line "why" beneath. |
| **Transparency badge** | `interventions.html` §B | "Disclose how you used AI" affordance under substantial replies → inline card with **behaviour-inferred level + evidence** → copied state with live badge preview. |
| **Reflection prompt** | `interventions.html` §C | Active-mode invitation before a big hand-off/loop/depth. "Draft first" vs "Continue". Serif title. |
| **Guard hold** | `interventions.html` §D | Opt-in send-pause; firmer frame (a goal is at stake); always three ways out (draft / send anyway / remove goal). |
| **Control panel** | `panel.html` §A | Three pillar blocks (Mirror = mode + protected goals · Badge = disclosures · Cost = coach), stats row on top, Privacy & data collapsed at bottom. |
| **Cost coach** | `panel.html` §B–C | **Off / Quiet / Loud** segmented control (not a dropdown). Strip is the signal family + heavier + blue accent + meter. Savings ledger modal framed as estimates, never a receipt. |
| **Weekly digest** | `weekly-digest.html` | Shape-first hero (serif, no emoji), one "biggest win", stat **pills**, one "Sit with" prompt, This week / AI profile / Goals **tabs**. |
| **Onboarding** | `onboarding.html` §A | Three-step wizard (use-cases → protected goals → visibility); everything **on by default, opt out**; skippable at every step. |
| **Tour** | `onboarding.html` §B | Coach-mark (dim page, lit pill, tip card), not a fake modal. 4 beats: intro · Mirror · Badge · Cost. |

### Escalation ladder by mode

The design gets *firmer* only as the user opts in — never louder by default:

- **Ghost** — nothing in-session; weekly digest only.
- **Ambient** — signal strips only.
- **Active** — strips + reflection prompts + disclosure badges.
- **Guard** — adds the opt-in send-hold on clear goal conflicts.

---

## 7. `#lumen-root` token mapping (for implementation)

The extension already scopes everything under `#lumen-root` with `--lm-*` variables. Repoint
them to the values above. Suggested mapping (keep the `--lm-*` names to minimise churn):

```
/* Logo mark — the ONLY saturated colour */
--lm-dot-green:#5ba85c; --lm-dot-amber:#e5a33d; --lm-dot-purple:#8e6fd8; --lm-dot-blue:#5b9bd5;

/* Surfaces / text / borders — set per Ink/Paper via host-theme detection (isHostDark) */
--lm-surface, --lm-cloud, --lm-mist … → the Ink/Paper values in §2

/* Accents — the only non-logo colour */
--lm-cost:#5b9bd5;  --lm-cost-tint:rgba(91,155,213,.10);  --lm-cost-border:rgba(91,155,213,.28);
--lm-positive:#7fbf80; --lm-positive-tint:rgba(91,168,92,.14);

/* RETIRE for chrome (do not use for signals/cards/borders): */
--lm-loop / --lm-drift / --lm-mismatch / --lm-handoff / --lm-depth  → collapse to neutral
    (signals become monochrome: dot #9a9aa5 / #83838d, name carries meaning)
```

Dark/light: the extension already detects host theme (`isHostDark()` in `widget.js`) and swaps
signal colours. Reuse that hook to swap the Ink/Paper token sets instead.

---

## 8. Implementation checklist

- [ ] Introduce the token layer first; repoint trivial rules; verify nothing purple remains in chrome.
- [ ] Migrate component-by-component (FAB → strips → panel → digest → badge → cost → onboarding → overlays).
- [ ] **Re-skin only** — preserve all behaviour, state, handlers, a11y, and host-theme detection in `widget.js`/`goals.js`/`session.js`/`content.js`/`cost/*`.
- [ ] Remove every `box-shadow` glow on the mark and elsewhere; keep elevation shadows.
- [ ] **Mirror every change** into `safari/Nomon/Nomon Extension/Resources/` (see `scripts/package-extension.sh` for any copy step).
- [ ] QA on ChatGPT (Paper) and Gemini (Ink); confirm no regressions.
- [ ] Final grep: zero emojis, zero purple outside `.lumen-dot`/logo, zero highlight glows.
```
