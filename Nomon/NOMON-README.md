# NOMON — Brand Package

Complete brand package for **Nomon** (formerly Lumen). Drop this folder into the repo as `brand/` and hand to Cursor. Includes rename guidance, the static mark, the processing animation, FAB replacement, and a React component.

---

## Files

| File | Purpose |
|---|---|
| `nomon-logo-static.html` | Master lockup (vertical + horizontal), FAB sizes, light/dark, scale strip, wordmark alone |
| `nomon-logo-animated.html` | Processing animation at every size — hero, lockup, FAB, thinking state |
| `NOMON-README.md` | This file |

---

## The name

**Nomon** — from *gnomon*, the pointer on a sundial, with the silent g dropped. The gnomon is the instrument that does nothing but cast a shadow; the reader takes the reading themselves. That is the product philosophy — mirror, not nanny — in a single object.

The name is also a **palindrome**: N-O-M-O-N reads identically in both directions. The word is literally its own mirror image, symmetric around the central M. Use this in brand storytelling; do not over-explain it in product UI.

Pronunciation: **NO-mon**. Nobody can get it wrong — that's why the g was dropped.

### Naming conventions in code

| Context | Use |
|---|---|
| Product name (UI, marketing) | Nomon |
| Wordmark rendering | NOMON (uppercase via CSS `text-transform`, source text "Nomon") |
| Code prefixes / CSS classes | `nomon-` (`.nomon-mark`, `--nomon-green`, `nomon-cycle`) |
| Extension internal namespace | `globalThis.Nomon` (rename from `Lumen` incrementally; keep an alias during migration: `globalThis.Lumen = globalThis.Nomon`) |
| Domains to secure | nomon.ai · getnomon.com · nomon.so (nomon.com belongs to the Barcelona clock brand) |

**Rename checklist for the existing repo:** `manifest.json` name/description → Nomon; extension display strings; `web/` site copy and metadata; keep storage keys stable for existing users (do NOT rename `chrome.storage` keys without a migration).

---

## The mark

Four dots in a T formation. Three across the top (green, amber, purple), one below centre (blue). The blue dot sits on the palindrome axis — the same vertical line that runs through the wordmark's central M.

```
   ●   ●   ●        green · amber · purple
       ●            blue — on the axis

   N O M O N        Georgia / Times, 400, letter-spacing 0.32em
       ↑
   symmetry axis through the M
```

Optional narrative mapping (marketing only, never in product UI): the top three dots as signals observed, the blue dot set apart as the user's own reflection.

### Tokens

```css
--nomon-bg:     #0A0A09   /* near-black background */
--nomon-green:  #5BA85C
--nomon-amber:  #E5A33D
--nomon-purple: #8E44AD
--nomon-blue:   #5B9BD5
--nomon-white:  #F5F2EC   /* wordmark on dark */
--nomon-ink:    #191917   /* wordmark on light */
```

> Palette note: alternative directions (monochrome ramp, three-neutrals-plus-one-accent) were explored and remain on file if the four-colour scheme ever needs to be revisited. The current palette is the committed one.

### Wordmark

```css
font-family: Georgia, 'Times New Roman', serif;
font-weight: 400;
text-transform: uppercase;
letter-spacing: 0.32em;
margin-left: 0.32em;   /* compensates trailing tracking for optical centring */
```

In vertical lockups, centre the mark and the wordmark on the same axis — the blue dot should sit directly above the M.

---

## Building the static mark

Container + four absolutely-positioned dots. All dots sit at `top:50%; left:50%` and are placed by `transform: translate(...)` so the identical structure animates cleanly.

Proportions (fraction of container size `S`):

| Property | Value |
|---|---|
| Dot diameter | 0.26 × S |
| Top row y-offset | −0.20 × S from centre |
| Top row x-spacing | 0.37 × S between dot centres |
| Blue dot y-offset | +0.14 × S from centre |

```html
<div class="nomon-mark" style="width:40px;height:40px;">
  <div class="d d-green"></div>
  <div class="d d-amber"></div>
  <div class="d d-purple"></div>
  <div class="d d-blue"></div>
</div>
```

```css
.nomon-mark { position: relative; flex-shrink: 0; }
.nomon-mark .d {
  position: absolute;
  top: 50%; left: 50%;
  width: 26%; height: 26%;
  border-radius: 50%;
}
/* translate values are % of the dot's own size */
.d-green  { background: var(--nomon-green);  transform: translate(-146%, -108%); }
.d-amber  { background: var(--nomon-amber);  transform: translate(-50%,  -108%); }
.d-purple { background: var(--nomon-purple); transform: translate(46%,   -108%); }
.d-blue   { background: var(--nomon-blue);   transform: translate(-50%,   8%);  }
```

---

## The processing animation

One 5-second loop, five phases:

| Phase | Time | What happens |
|---|---|---|
| Rest | 0–22% | The static T formation |
| Converge | 22–34% | All four dots pull into centre and collide on the axis |
| Pulse | 34–44% | The merged body swells once (`scale 1.28`) |
| Expand + orbit | 44–78% | Dots burst into a diamond (N/E/S/W) and rotate 360° |
| Return | 78–100% | Converge briefly, then diverge back to the T |

Two animations cooperate:

1. **`nomon-cycle`** on each dot — moves between rest, centre, and diamond positions via per-dot custom properties.
2. **`nomon-spin`** on the wrapper — rotates the diamond during the orbit phase only (0° until 52%, reaching 360° at 80%, so rotation is invisible at rest).

`mix-blend-mode: screen` makes colours bloom toward white at the collision. **Dark backgrounds only** — strip the blend mode on light surfaces or the dots wash out.

### CSS to copy into the global stylesheet

```css
:root { --nomon-dur: 5s; --nomon-ease: cubic-bezier(0.45, 0, 0.55, 1); }

.nomon-mark { position: relative; flex-shrink: 0; }

.nomon-spin {
  position: absolute; inset: 0;
  animation: nomon-spin var(--nomon-dur) var(--nomon-ease) infinite;
}

.nomon-mark .d {
  position: absolute;
  top: 50%; left: 50%;
  border-radius: 50%;
  mix-blend-mode: screen;     /* dark bg only */
  will-change: transform;
  animation: nomon-cycle var(--nomon-dur) var(--nomon-ease) infinite;
}

@keyframes nomon-cycle {
  0%, 22%   { transform: translate(var(--rx), var(--ry)) scale(1); }
  32%        { transform: translate(0, 0) scale(0.88); }
  39%        { transform: translate(0, 0) scale(1.28); }
  44%        { transform: translate(0, 0) scale(0.94); }
  54%, 76%  { transform: translate(var(--ex), var(--ey)) scale(1); }
  86%        { transform: translate(0, 0) scale(0.85); }
  100%       { transform: translate(var(--rx), var(--ry)) scale(1); }
}

@keyframes nomon-spin {
  0%, 52%   { transform: rotate(0deg); }
  80%, 100% { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .nomon-spin, .nomon-mark .d { animation: none; }
}
```

### HTML structure (animated instance)

Dots are centred with negative margins (half the dot size) so translate values are pure offsets from centre. Each dot carries its offsets as custom properties:

```html
<div class="nomon-mark" style="width:150px;height:150px;">
  <div class="nomon-spin">
    <div class="d d-green"  style="width:38px;height:38px;margin:-19px 0 0 -19px;
         --rx:-56px; --ry:-30px;  --ex:0px;   --ey:-52px;"></div>
    <div class="d d-amber"  style="width:38px;height:38px;margin:-19px 0 0 -19px;
         --rx:0px;   --ry:-30px;  --ex:52px;  --ey:0px;"></div>
    <div class="d d-purple" style="width:38px;height:38px;margin:-19px 0 0 -19px;
         --rx:56px;  --ry:-30px;  --ex:0px;   --ey:52px;"></div>
    <div class="d d-blue"   style="width:38px;height:38px;margin:-19px 0 0 -19px;
         --rx:0px;   --ry:26px;   --ex:-52px; --ey:0px;"></div>
  </div>
</div>
```

**Scaling formula** for any mark size `S`:

```
dot diameter    = S × 0.25
margin          = −(dot / 2)
rest --rx       = green −0.37S · amber 0 · purple +0.37S · blue 0
rest --ry       = top row −0.20S · blue +0.17S
diamond --ex/ey = ±0.35S on one axis, 0 on the other
                  (green N, amber E, purple S, blue W)
```

---

## Where each state lives

| Context | State | Notes |
|---|---|---|
| `nomon.ai` hero | Animated, ~150px + wordmark | Loop continuously |
| Nav / page header | Static horizontal lockup, 30–46px mark | Never animated in nav |
| Extension popup header | Static horizontal lockup, 30px | |
| **FAB (page overlay)** | Static at idle → one animated loop while scoring | See below |
| Thinking indicator | Animated, 26px + "processing…" label | Label fade synced to loop |
| Chrome toolbar icon | Static PNG exports 16/32/48/128 | From static file |
| Favicon | Static, 16px PNG | |

---

## FAB — replacing the white dot

Swap the current white dot for the 28–30px `nomon-mark` inside the existing FAB shell. Idle = static (no animation). While Nomon is scoring a message or a signal fires, add `.is-active` for exactly one loop:

```css
/* Idle: animations off */
.fab .nomon-spin,
.fab .d { animation: none; }

/* Active: run exactly one loop */
.fab.is-active .nomon-spin { animation: nomon-spin var(--nomon-dur) var(--nomon-ease) 1; }
.fab.is-active .d          { animation: nomon-cycle var(--nomon-dur) var(--nomon-ease) 1; }
```

```js
// In the scoring / signal pipeline:
function fabPulse() {
  const fab = document.querySelector('.nomon-fab')
  fab.classList.add('is-active')
  fab.addEventListener('animationend', () => fab.classList.remove('is-active'), { once: true })
}
```

One loop per event, never infinite — a perpetually animating FAB is a nag, and Nomon is a mirror, not a nanny.

---

## React component (web app)

```tsx
// components/NomonMark.tsx
interface Props {
  size?: number
  animate?: boolean
  className?: string
}

const DOTS = [
  { c: '#5BA85C', rx: -0.37, ry: -0.20, ex: 0,     ey: -0.35 }, // green  → N
  { c: '#E5A33D', rx: 0,     ry: -0.20, ex: 0.35,  ey: 0     }, // amber  → E
  { c: '#8E44AD', rx: 0.37,  ry: -0.20, ex: 0,     ey: 0.35  }, // purple → S
  { c: '#5B9BD5', rx: 0,     ry: 0.17,  ex: -0.35, ey: 0     }, // blue   → W
]

export function NomonMark({ size = 40, animate = false, className }: Props) {
  const d = size * 0.25
  return (
    <div
      className={`nomon-mark${animate ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      aria-label="Nomon"
    >
      <div className="nomon-spin" style={{ position: 'absolute', inset: 0 }}>
        {DOTS.map((dot, i) => (
          <div
            key={i}
            className="d"
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: d, height: d,
              margin: `${-d / 2}px 0 0 ${-d / 2}px`,
              borderRadius: '50%',
              background: dot.c,
              ['--rx' as string]: `${dot.rx * size}px`,
              ['--ry' as string]: `${dot.ry * size}px`,
              ['--ex' as string]: `${dot.ex * size}px`,
              ['--ey' as string]: `${dot.ey * size}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

Usage:

```tsx
<NomonMark size={150} animate />            // hero (pair with wordmark)
<NomonMark size={46} />                     // nav lockup
<NomonMark size={30} animate={isScoring} /> // FAB
<NomonMark size={26} animate />             // thinking state
```

Requires the `nomon-cycle` / `nomon-spin` keyframes plus idle/active rules in the global stylesheet.

---

## Wordmark component

```tsx
// components/NomonWordmark.tsx
export function NomonWordmark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{
      fontFamily: `Georgia, 'Times New Roman', serif`,
      fontWeight: 400,
      fontSize: size,
      letterSpacing: '0.32em',
      marginLeft: '0.32em',
      textTransform: 'uppercase',
      lineHeight: 1,
      color: light ? '#191917' : '#F5F2EC',
    }}>
      Nomon
    </span>
  )
}
```

---

## Checklist for Cursor

- [ ] Rename product strings: `manifest.json`, extension UI copy, `web/` metadata — Lumen → Nomon
- [ ] Keep `chrome.storage` keys unchanged (no user-data migration for a rename); alias `globalThis.Lumen = globalThis.Nomon` during transition
- [ ] Add `nomon-cycle`, `nomon-spin`, and reduced-motion rules to the global stylesheet (extension: shared content-script CSS; web: `globals.css`)
- [ ] Replace the FAB white dot with the 30px `nomon-mark` (static idle)
- [ ] Wire `.is-active` to the scoring pipeline — one loop per event via `animationend`, never infinite on the FAB
- [ ] Infinite loop only on the `nomon.ai` hero and the thinking indicator
- [ ] `mix-blend-mode: screen` on dark surfaces only; strip on light backgrounds
- [ ] Export toolbar icons (16/32/48/128 PNG) and favicon from `nomon-logo-static.html`
- [ ] Wordmark everywhere: Georgia/Times, uppercase, `letter-spacing: 0.32em`, tracking-compensation margin
- [ ] In vertical lockups, align the blue dot with the wordmark's central M (palindrome axis)
- [ ] Verify the 16px mark in the Chrome toolbar — if muddy, increase dot size to 30% for icon exports only
- [ ] Secure domains (nomon.ai / getnomon.com / nomon.so) and run UKIPO/EUIPO/USPTO checks in classes 9 & 42 before public launch
