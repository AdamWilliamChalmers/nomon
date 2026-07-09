# Nomon v3.6

Cognitive fitness layer for AI — four signals, no red, no judgment.

## Getting started (run the extension locally)

No build step is required for **Chrome**. After cloning the repo, load the extension folder directly.

### Prerequisites

- **Google Chrome** (or another Chromium browser with “Load unpacked”)
- **Git** — clone from GitHub

### Chrome (recommended)

1. **Clone the repo**
   ```bash
   git clone https://github.com/AdamWilliamChalmers/nomon.git
   cd nomon
   ```
   *(Replace the URL with your actual GitHub remote.)*

2. **Load the extension**
   - Open `chrome://extensions`
   - Turn on **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the **repo root** folder (the one that contains `manifest.json`)

3. **Try it**
   - Open a supported site, e.g. [chatgpt.com](https://chatgpt.com) or [claude.ai](https://claude.ai)
   - You should see the Nomon pill (bottom-right). Complete onboarding or choose **Skip** for Ambient mode.

4. **After pulling new changes**
   - Go to `chrome://extensions` → click **Reload** on Nomon
   - Hard-refresh any open AI chat tabs (`Cmd+Shift+R` on Mac)

### Safari (macOS)

The Safari build lives under `safari/Nomon/Nomon.xcodeproj`. To refresh it from the Chrome sources:

```bash
./scripts/package-safari.sh
```

Then open the project in **Xcode**, set your **Signing Team**, and **Product → Run**. Enable the extension in **Safari → Settings → Extensions**.

### Optional: companion website

The landing page and API live in `web/`:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [web/README.md](./web/README.md) for env vars.

### Optional: run tests

```bash
cd scripts && npm install && npm test
```

### Troubleshooting

| Problem | Fix |
|--------|-----|
| No Nomon pill on an AI site | Confirm the site is in `manifest.json` → reload extension + hard-refresh the tab |
| “Scripts failed to load” in console | Remove the extension, **Load unpacked** again from the repo root |
| Changes don’t appear | Reload extension at `chrome://extensions`, then hard-refresh the chat tab |
| Loaded wrong folder | Unpacked path must be the folder containing `manifest.json` (not `web/` or `safari/`) |

**Chrome Web Store / release builds:** see [CHROME_WEB_STORE.md](./CHROME_WEB_STORE.md).  
**Technical deep-dive:** see [NOMON-EXTENSION-OVERVIEW.md](./NOMON-EXTENSION-OVERVIEW.md).

## Setup (maintainers)

**Chrome Web Store:** see [CHROME_WEB_STORE.md](./CHROME_WEB_STORE.md). Build upload zip with `./scripts/package-extension.sh`.

**Local development (quick):**

1. `chrome://extensions` → Developer mode → Load unpacked → this folder
2. Open [chatgpt.com](https://chatgpt.com)
3. Complete onboarding (optional — **Skip** → Ambient mode: Loop + Drift only)

## The signals

The four named signals (Loop, Drift, Mismatch, Depth) plus **Hand-off**, the
first-message delegation cue. None of them ever hide or delay the AI response;
only the Loop *reconsider* overlay (Active/Guard mode, sustained passivity) is a
heavier interrupt.

| Signal | Colour | In-session |
|--------|--------|------------|
| **Hand-off** | Light blue | Strip only — "what do you already know?" on early full-task delegation |
| **Loop** | Green | Strip + contextual nudge; reconsider overlay only in Active/Guard at high intensity |
| **Drift** | Amber | Strip label only (full analysis in popover digest) |
| **Mismatch** | Purple | Strip + card quoting *your* protected goals |
| **Depth** | Blue | Strip + additive invitation card (never blocks AI response) |

## Visibility modes

| Mode | Behaviour |
|------|-----------|
| **Ghost** | No in-session signals |
| **Ambient** | Loop + Drift strips |
| **Active** | All signals + Mismatch/Depth cards |
| **Guard** | Active + optional pre-send hold on clear goal conflicts (opt-in, always bypassable) |

## Architecture

```
adapters/chatgpt.js   — ChatGPT adapter (role-attribute DOM)
adapters/base.js      — shared adapter factory (no-role-attribute sites)
adapters/claude.js    — Claude adapter (factory config)
adapters/gemini.js    — Gemini adapter (factory config, best-effort selectors)
adapters/grok.js      — Grok adapter (grok.com + x.com/i/grok, best-effort)
adapters/copilot.js   — Microsoft Copilot adapter (best-effort selectors)
adapters/perplexity.js— Perplexity adapter (best-effort selectors)
engine.js             — Loop scoring + four-signal evaluation
goals.js              — onboarding, protected goals, modes
session.js            — lumen_session_{date} + drift history + digest log
nudges.js             — signal copy + weekly digest builder
sparkline.js          — badge popover chart
widget.js             — strips, cards, badge, onboarding
content.js            — adapter bootstrap
```

## v3.1 additions (from lumen_v3_design.md)

- Use-case Loop calibration (Research / Writing / Admin / etc.)
- Week-over-week Drift (+ passive acceptance trend)
- Loop contextual strip nudges by dominant sub-signal
- Mismatch high-frequency card copy; "My goal changed" removes goal
- Depth "Let me think first" dims AI responses; warm tone on high-stakes prompts
- Cross-platform session key: `lumen_session_{date}`
- "This week" digest section in badge popover (local Pro placeholder)

## Not yet built (spec)

- Pro weekly email digest
- Phase 2 adapters: ~~Claude, Gemini, Grok~~ (done)
- Phase 3 adapters: ~~Copilot, Perplexity~~ (done)

> Adapters for Gemini, Grok, Copilot, and Perplexity use **best-effort
> selectors** validated against synthetic DOM fixtures; they may need live
> tuning against the real sites. The fail-soft guard in `content.js` means a
> selector mismatch shows nothing rather than breaking the page.

## Tests

```
cd scripts && npm install   # one-time: jsdom (dev-only, gitignored)
cd scripts && npm test      # all suites: engine + adapter wiring + real-DOM parsing
```

Individually from the repo root:

```
node scripts/smoke-test-shipped.mjs    # shipped engine + nudge-efficacy
node scripts/smoke-test-adapters.mjs   # adapter host matching + interface conformance
node scripts/test-adapter-dom.mjs      # real-DOM adapter parsing (jsdom)
node scripts/test-e2e-chatgpt.mjs      # full pipeline rendered into a mock ChatGPT DOM
```

`test-e2e-chatgpt.mjs` is the closest automated substitute for a live test: it
runs the real shipped modules against a simulated ChatGPT DOM and asserts the
rendered badge, strips, mismatch card, feedback button, and that no signal hides
the answer. It prints a **manual QA checklist** for the browser-only parts
(visual styling, real selectors, overlay click flows).

CI runs all of the above on push/PR (`.github/workflows/test.yml`). To run them
automatically before each commit, enable the bundled hook once:

```
git config core.hooksPath .githooks
```
