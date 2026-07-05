# Chrome Web Store — publish checklist

## Before you upload

1. Run tests: `cd scripts && npm install && npm test`
2. Build the store zip: `./scripts/package-extension.sh` → `dist/nomon-extension.zip`
3. Confirm [nomon-app.com/privacy](https://nomon-app.com/privacy) is live (required for review)
4. Pay the **$5 one-time** [developer registration fee](https://chrome.google.com/webstore/devconsole)

Local dev still uses **Load unpacked** from the repo root (includes `localhost` permission). The zip script strips that for the store build.

---

## Upload

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New item**
2. Upload `dist/nomon-extension.zip`
3. Fill listing fields below
4. Submit for review (typically 1–3 business days)

After approval, set on Render:

```env
NEXT_PUBLIC_CHROME_STORE_URL=https://chromewebstore.google.com/detail/nomon/YOUR_EXTENSION_ID
```

Redeploy `nomon-web` so landing-page install buttons point to the real listing.

---

## Store listing copy (ready to paste)

### Name

`Nomon`

### Short description (≤132 characters)

`Notices when you've stopped evaluating AI output — five quiet signals under your messages. A mirror, not a nanny.`

### Detailed description

```
Nomon is a cognitive-fitness layer for AI chat tools. It reads the shape of your conversation — pace, question patterns, delegation cues — never the content of your messages for storage or analysis.

When you've stopped engaging critically, Nomon surfaces a quiet one-line signal under your prompt. No red. No nagging. No blocking the AI's reply.

SIGNALS
• Hand-off — early full-task delegation
• Loop — passive acceptance patterns
• Drift — engagement fading over the session
• Mismatch — prompts that conflict with goals you set
• Depth — invitations to think before you send

WORKS ON
ChatGPT, Claude, Gemini, Grok, Copilot, Perplexity, Mistral, Meta AI, DeepSeek, Qwen, Kimi, MiniMax, HuggingChat, and Doubao.

PRIVACY
All scoring runs locally in your browser. Optional research sharing (daily counts and feedback snippets only — never full chats) is on by default; turn off any time under Privacy & data in the pill. Privacy policy: https://nomon-app.com/privacy

Companion app: https://nomon-app.com
Contact: hello@nomon-app.com
```

### Category

Productivity

### Language

English

### Privacy policy URL

`https://nomon-app.com/privacy`

### Single purpose

Help users stay critically engaged while using AI chat assistants.

---

## Permission justifications (for the review form)

| Permission | Justification |
|---|---|
| **storage** | Save your mode (Ambient / Active / Ghost / Guard), protected goals, and preferences across sessions. |
| **nomon-app.com** | Optional LLM second opinion on borderline prompts; anonymised session summaries when sharing is enabled; crowd calibration weights. |
| **AI chat sites** (ChatGPT, Claude, etc.) | Content script reads message structure from the page DOM to score engagement locally. No message text is transmitted unless you explicitly mark a signal wrong (≤200 char snippet) with sharing enabled. |

---

## Assets needed

| Asset | File / spec |
|---|---|
| **Icon** | `icons/icon128.png` (128×128) |
| **Screenshots** | At least 1, ideally 3–5 at **1280×800** or **640×400**. Show: AI chat with Nomon pill + signal strip; Privacy & data panel; weekly digest if possible. |
| **Promotional tile** (optional) | 440×280 |

---

## Updates after launch

1. Bump `"version"` in `manifest.json` (semver)
2. `./scripts/package-extension.sh`
3. Dashboard → your item → **Package** → upload new zip
4. Submit for review

---

## Post-launch env (Render)

Already in `render.yaml` — set the value once you have the listing URL:

- `NEXT_PUBLIC_CHROME_STORE_URL`
