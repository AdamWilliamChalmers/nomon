# Nomon — Signal-Reactive FAB
## Cursor implementation spec

---

## What this is

A floating action button (FAB) for the Nomon Chrome extension. It sits fixed in the bottom-right corner of ChatGPT, Claude, and Gemini pages. At rest it is minimal — four dots, no text. When a signal fires, the relevant dot pulses and a short signal label fades in. It returns to rest after 4 seconds.

---

## File to create

`src/content/fab/Nomon FAB.tsx` (or `.jsx` if not using TypeScript)

---

## Design tokens

```css
/* Nomon signal colours — use these exactly */
--nomon-green:  #1D9E75;   /* loop */
--nomon-amber:  #EF9F27;   /* drift */
--nomon-purple: #7F77DD;   /* mismatch */
--nomon-blue:   #378ADD;   /* depth */
--nomon-muted:  #888780;   /* ghost mode / at rest */
```

---

## States

| State | Dots | Border | Label | When |
|---|---|---|---|---|
| `rest` | all 4, static, muted | `1px solid #e0e0e0` | none | default |
| `loop` | green pulses | `1px solid #1D9E75` | "loop · still with it?" | loop signal fires |
| `drift` | amber pulses | `1px solid #EF9F27` | "drift · fewer questions" | drift signal fires |
| `mismatch` | purple pulses | `1px solid #7F77DD` | "mismatch · conflicts with your goal" | mismatch fires |
| `depth` | blue pulses | `1px solid #378ADD` | "depth · worth thinking first?" | depth signal fires |
| `ghost` | all 4, static, muted | `1px solid #e0e0e0` | "ghost" | ghost mode active |

---

## Behaviour rules

1. **At rest**: pill shows only the four-dot mark. No text. No border colour. Width ~40px.
2. **Signal fires**: pill expands to show dot (pulsing) + signal name + short copy. Width auto. Border adopts signal colour. Animation: fade-in + slight width expansion over 200ms.
3. **Returns to rest**: after 4 seconds, label fades out, dot stops pulsing, border returns to neutral. Transition: 300ms ease-out.
4. **One signal at a time**: if a second signal fires while one is active, the new one replaces the current one immediately.
5. **Click behaviour**: clicking the FAB at any state opens the Nomon settings panel (mode switcher). Does not dismiss an active signal.
6. **Ghost mode**: FAB shows "ghost" as a static text label with muted colour. No signals fire in ghost mode — the FAB is the only indicator Nomon is present.

---

## Four-dot layout

The dots are always in a 2×2 T-formation grid:

```
green  amber
purple blue
```

Each dot: 6px diameter, 3px gap. Total mark: ~15×15px.

When a signal fires, **only the relevant dot pulses** — the other three stay static and muted.

---

## Component spec

```tsx
type Signal = 'loop' | 'drift' | 'mismatch' | 'depth' | null
type Mode = 'ghost' | 'ambient' | 'active' | 'guard'

interface NomonfabProps {
  mode: Mode
  activeSignal: Signal
  onSignalClick?: (signal: Signal) => void
  onFabClick?: () => void
}
```

---

## CSS — full implementation

```css
/* nomon-fab.css */

.nomon-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  transition:
    border-color 200ms ease,
    padding 200ms ease,
    box-shadow 200ms ease;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  user-select: none;
}

.nomon-fab:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

/* dark mode support */
@media (prefers-color-scheme: dark) {
  .nomon-fab {
    background: #1e1e1e;
    border-color: #3a3a3a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
}

/* signal border states */
.nomon-fab[data-signal="loop"]     { border-color: #1D9E75; }
.nomon-fab[data-signal="drift"]    { border-color: #EF9F27; }
.nomon-fab[data-signal="mismatch"] { border-color: #7F77DD; }
.nomon-fab[data-signal="depth"]    { border-color: #378ADD; }

/* four-dot mark */
.nomon-dots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.nomon-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c0c0;
  transition: background 200ms ease;
}

/* dot colours when active */
.nomon-dot[data-id="loop"]     { background: #1D9E75; }
.nomon-dot[data-id="drift"]    { background: #EF9F27; }
.nomon-dot[data-id="mismatch"] { background: #7F77DD; }
.nomon-dot[data-id="depth"]    { background: #378ADD; }

/* pulse animation — only on the active dot */
.nomon-dot[data-pulsing="true"] {
  animation: nomon-pulse 1.8s ease-in-out infinite;
}

@keyframes nomon-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(1.35); }
}

/* signal label */
.nomon-label {
  font-size: 12px;
  font-weight: 500;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  transition:
    max-width 200ms ease,
    opacity 200ms ease;
}

@media (prefers-color-scheme: dark) {
  .nomon-label { color: #aaa; }
}

/* label visible state */
.nomon-fab[data-signal] .nomon-label,
.nomon-fab[data-mode="ghost"] .nomon-label {
  max-width: 200px;
  opacity: 1;
}

/* signal-specific label colours */
.nomon-fab[data-signal="loop"]     .nomon-label { color: #1D9E75; }
.nomon-fab[data-signal="drift"]    .nomon-label { color: #EF9F27; }
.nomon-fab[data-signal="mismatch"] .nomon-label { color: #7F77DD; }
.nomon-fab[data-signal="depth"]    .nomon-label { color: #378ADD; }
.nomon-fab[data-mode="ghost"]      .nomon-label { color: #888780; }
```

---

## React component — full implementation

```tsx
// NomonfFab.tsx
import { useEffect, useState, useRef } from 'react'
import './nomon-fab.css'

type Signal = 'loop' | 'drift' | 'mismatch' | 'depth' | null
type Mode = 'ghost' | 'ambient' | 'active' | 'guard'

const SIGNAL_LABELS: Record<NonNullable<Signal>, string> = {
  loop:     'loop · still with it?',
  drift:    'drift · fewer questions',
  mismatch: 'mismatch · conflicts with your goal',
  depth:    'depth · worth thinking first?',
}

const DOT_ORDER: NonNullable<Signal>[] = ['loop', 'drift', 'mismatch', 'depth']

interface NomonfabProps {
  mode?: Mode
  activeSignal?: Signal
  onFabClick?: () => void
}

export function NomonfFab({
  mode = 'ambient',
  activeSignal = null,
  onFabClick,
}: NomonfabProps) {
  const [displaySignal, setDisplaySignal] = useState<Signal>(activeSignal)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeSignal) {
      // clear any existing timer
      if (timerRef.current) clearTimeout(timerRef.current)
      setDisplaySignal(activeSignal)
      // return to rest after 4s
      timerRef.current = setTimeout(() => {
        setDisplaySignal(null)
      }, 4000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeSignal])

  const fabAttrs = {
    'data-signal': displaySignal ?? undefined,
    'data-mode': mode,
  }

  return (
    <div
      className="nomon-fab"
      onClick={onFabClick}
      role="button"
      aria-label={`Nomon — ${mode} mode${displaySignal ? `, ${displaySignal} signal` : ''}`}
      {...fabAttrs}
    >
      <div className="nomon-dots">
        {DOT_ORDER.map((id) => (
          <div
            key={id}
            className="nomon-dot"
            data-id={displaySignal === id ? id : undefined}
            data-pulsing={displaySignal === id ? 'true' : undefined}
          />
        ))}
      </div>

      <span className="nomon-label">
        {mode === 'ghost'
          ? 'ghost'
          : displaySignal
            ? SIGNAL_LABELS[displaySignal]
            : null}
      </span>
    </div>
  )
}
```

---

## Chrome extension integration

In your content script, inject the FAB after the page loads:

```ts
// content.ts
import { createRoot } from 'react-dom/client'
import { NomonfFab } from './fab/NomonfFab'

const mount = document.createElement('div')
mount.id = 'nomon-fab-root'
document.body.appendChild(mount)

const root = createRoot(mount)

// call this whenever your signal detector fires
export function fireSignal(signal: 'loop' | 'drift' | 'mismatch' | 'depth') {
  root.render(
    <NomonfFab
      mode={getCurrentMode()}   // read from chrome.storage.sync
      activeSignal={signal}
      onFabClick={openSettingsPanel}
    />
  )
}
```

---

## Cursor prompt to paste

> Build the Nomon signal-reactive FAB using the spec in `nomon-fab.md`. Create `src/content/fab/NomonfFab.tsx` and `src/content/fab/nomon-fab.css` exactly matching the component and CSS in the spec. Do not add any additional styling, animation, or behaviour not listed. After creating the files, check that all four signal states and ghost mode render correctly by reviewing the data-attribute logic in the CSS selectors.
