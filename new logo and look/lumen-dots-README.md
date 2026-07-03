# Lumen — Dot Mark & Processing Animation

Brand package for the four-dot mark. One static reference, one animated, this README. Drop the folder into the repo as `brand/` and hand to Cursor.

---

## Files

| File | Purpose |
|---|---|
| `logo-dots-static.html` | Master lockup (vertical + horizontal), FAB sizes, light/dark, scale strip |
| `logo-dots-animated.html` | The processing animation at every size — hero, lockup, FAB, thinking state |

---

## The mark

Four dots in a T formation. Three across the top (green, amber, purple), one below centre (blue). Serif wordmark, uppercase, wide tracking.

```
   ●   ●   ●        green · amber · purple
       ●            blue

   L U M E N        Georgia / Times, 400, letter-spacing 0.32em
```

Optional narrative mapping (use if it ever helps marketing copy): the four dots can stand for four of the signals, with the blue dot — set apart below — as the user's own reflection. Don't over-explain it in product UI; the mark works as pure geometry.

### Tokens

```css
--lumen-bg:     #0A0A09   /* near-black background */
--lumen-green:  #5BA85C
--lumen-amber:  #E5A33D
--lumen-purple: #8E44AD
--lumen-blue:   #5B9BD5
--lumen-white:  #F5F2EC   /* wordmark on dark */
--lumen-ink:    #191917   /* wordmark on light */
```

### Wordmark

```css
font-family: Georgia, 'Times New Roman', serif;
font-weight: 400;
text-transform: uppercase;
letter-spacing: 0.32em;
margin-left: 0.32em;   /* compensates trailing tracking for optical centring */
```

---

## Building the static mark

Container + four absolutely-positioned dots. All dots sit at `top:50%; left:50%` and are placed by `transform: translate(...)` so the same structure animates cleanly.

Proportions (as fraction of container size `S`):

| Property | Value |
|---|---|
| Dot diameter | 0.26 × S |
| Top row y-offset | −0.20 × S from centre |
| Top row x-spacing | 0.37 × S between dot centres |
| Blue dot y-offset | +0.14 × S from centre |

```html
<div class="dot-mark" style="width:40px;height:40px;">
  <div class="d d-green"></div>
  <div class="d d-amber"></div>
  <div class="d d-purple"></div>
  <div class="d d-blue"></div>
</div>
```

```css
.dot-mark { position: relative; flex-shrink: 0; }
.dot-mark .d {
  position: absolute;
  top: 50%; left: 50%;
  width: 26%; height: 26%;
  border-radius: 50%;
}
/* translate values are % of the dot's own size */
.d-green  { background: var(--lumen-green);  transform: translate(-146%, -108%); }
.d-amber  { background: var(--lumen-amber);  transform: translate(-50%,  -108%); }
.d-purple { background: var(--lumen-purple); transform: translate(46%,   -108%); }
.d-blue   { background: var(--lumen-blue);   transform: translate(-50%,   8%);  }
```

---

## The processing animation

One 5-second loop, five phases:

| Phase | Time | What happens |
|---|---|---|
| Rest | 0–22% | The static T formation |
| Converge | 22–34% | All four dots pull into centre and overlap |
| Pulse | 34–44% | The merged body swells once (`scale 1.28`) |
| Expand + orbit | 44–78% | Dots burst into a diamond (N/E/S/W) and the diamond rotates 360° |
| Return | 78–100% | Converge briefly, then diverge back to the T |

Two animations working together:

1. **`dot-cycle`** on each dot — moves it between rest position, centre, and diamond position using per-dot CSS custom properties.
2. **`spin`** on a wrapper — rotates the whole diamond during the orbit phase only (0° until 52%, reaching 360° at 80%, so rotation is invisible at rest).

Plus `mix-blend-mode: screen` on the dots, so colours bloom toward white when they collide. **Dark backgrounds only** — remove the blend mode on light backgrounds or the dots wash out.

### The CSS to copy

```css
:root { --dur: 5s; --ease: cubic-bezier(0.45, 0, 0.55, 1); }

.dot-mark { position: relative; flex-shrink: 0; }

.dot-spin {
  position: absolute; inset: 0;
  animation: spin var(--dur) var(--ease) infinite;
}

.dot-mark .d {
  position: absolute;
  top: 50%; left: 50%;
  border-radius: 50%;
  mix-blend-mode: screen;     /* dark bg only */
  will-change: transform;
  animation: dot-cycle var(--dur) var(--ease) infinite;
}

@keyframes dot-cycle {
  0%, 22%   { transform: translate(var(--rx), var(--ry)) scale(1); }
  32%        { transform: translate(0, 0) scale(0.88); }
  39%        { transform: translate(0, 0) scale(1.28); }
  44%        { transform: translate(0, 0) scale(0.94); }
  54%, 76%  { transform: translate(var(--ex), var(--ey)) scale(1); }
  86%        { transform: translate(0, 0) scale(0.85); }
  100%       { transform: translate(var(--rx), var(--ry)) scale(1); }
}

@keyframes spin {
  0%, 52%   { transform: rotate(0deg); }
  80%, 100% { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .dot-spin, .dot-mark .d { animation: none; }
}
```

### HTML structure (animated)

Each dot carries its own offsets as custom properties. Dots are centred with negative margins (half the dot size) so translate values are pure offsets from centre.

```html
<div class="dot-mark" style="width:150px;height:150px;">
  <div class="dot-spin">
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
| `lumen.so` hero | Animated, ~150px + wordmark | Loop continuously |
| Nav / page header | Static horizontal lockup, 30–46px mark | Never animated in nav |
| Extension popup header | Static horizontal lockup, 30px | |
| **FAB (page overlay)** | Static at idle → animate while scoring | See below |
| Thinking indicator | Animated, 26px + "processing…" label | Label fade synced to loop |
| Chrome toolbar icon | Static, export PNG 16/32/48/128 | From static file |
| Favicon | Static, 16px PNG | |

---

## FAB — replacing the white dot

Swap the current white dot for the 28–30px `dot-mark` inside the existing FAB shell. Idle = static (no animation classes). While Lumen is scoring a message or a signal is firing, add `.is-active` for one loop:

```css
/* Idle: animations off */
.fab .dot-spin,
.fab .d { animation: none; }

/* Active: run exactly one loop */
.fab.is-active .dot-spin { animation: spin var(--dur) var(--ease) 1; }
.fab.is-active .d        { animation: dot-cycle var(--dur) var(--ease) 1; }
```

```js
// In the scoring / signal pipeline:
function fabPulse() {
  const fab = document.querySelector('.lumen-fab')
  fab.classList.add('is-active')
  fab.addEventListener('animationend', () => fab.classList.remove('is-active'), { once: true })
}
```

One loop per event, not infinite — consistent with the "mirror, not nanny" bar. A perpetually animating FAB is a nag.

---

## React component (web app)

```tsx
// components/LumenDots.tsx
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

export function LumenDots({ size = 40, animate = false, className }: Props) {
  const d = size * 0.25
  return (
    <div
      className={`dot-mark${animate ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      aria-label="Lumen"
    >
      <div className="dot-spin" style={{ position: 'absolute', inset: 0 }}>
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
<LumenDots size={150} animate />            // hero (pair with wordmark)
<LumenDots size={46} />                     // nav lockup
<LumenDots size={30} animate={isScoring} /> // FAB
<LumenDots size={26} animate />             // thinking state
```

Requires the `dot-cycle` / `spin` keyframes and idle/active rules from above in the global stylesheet.

---

## Checklist for Cursor

- [ ] Add `dot-cycle`, `spin`, and reduced-motion rules to the global stylesheet (extension: a shared CSS file injected by content script; web: `globals.css`)
- [ ] Replace the FAB white dot with the 30px dot-mark (static idle)
- [ ] Wire `.is-active` to the scoring pipeline — one loop per event via `animationend`, never infinite on the FAB
- [ ] Use the infinite loop only on the `lumen.so` hero and the thinking indicator
- [ ] Keep `mix-blend-mode: screen` on dark surfaces only; strip it for any light-background placement
- [ ] Export toolbar icons (16/32/48/128 PNG) and favicon from `logo-dots-static.html`
- [ ] Wordmark everywhere: Georgia/Times, uppercase, `letter-spacing: 0.32em`, with the `margin-left` tracking compensation
- [ ] Verify the 16px mark stays legible in the Chrome toolbar — if muddy, drop to three dots or increase dot size to 30% for icon exports only
