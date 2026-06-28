# Lumen — GTM Build Prompt: Free Tier + Pro One-Time Purchase

## Read this entire document before writing a single line of code.
## Output a numbered implementation plan and STOP. Wait for confirmation before building.

---

## Context

Lumen is a Chrome extension that detects cognitive offloading patterns in real-time across
ChatGPT, Claude, Gemini and Grok. The v3 extension codebase already exists at
`~/Desktop/Lumen/extension/`. The companion web app lives at `~/Desktop/Lumen/web/`.

This prompt covers ONE specific build task: implementing the free/Pro tier split across
both codebases, following the Cursorful GTM model (generous free tier, one-time Pro
payment, no subscription, no ads).

Do not touch signal scoring logic, adapter files, or session POST logic unless
explicitly instructed below. Scope is strictly the tier system and its UI surfaces.

---

## The model

### Free tier — no sign-up, no watermark, no time limit

Everything the extension does today is free. The heuristic signal engine is fully
local — it costs nothing to serve, so there is no reason to gate it.

Free users get:
- Full extension: all four signals (Loop, Drift, Mismatch, Depth)
- Inline strip on every message
- FAB with session score
- Intervention cards (Overwhelmed, Stuck, Unaware, Intentional)
- Exemption learning (task-type exemptions stored in chrome.storage.sync)
- Session sparkline in popup
- Session summary POST to lumen.so API (stored anonymously if no account)

Free users do NOT get:
- lumen.so dashboard (weekly card, historical trends, self-comparison)
- Shareable card URL
- Weekly digest email
- Cross-session Drift analysis (more than 1 week of history)
- The community feed on lumen.so

### Pro tier — one-time payment, lifetime access

Price: £49 one-time (early bird). No subscription. No renewal. Yours forever.
Payment processor: Polar.sh (same as Cursorful — simple, developer-friendly, no Stripe
complexity for one-time payments).

Pro users get everything in Free plus:
- lumen.so dashboard unlocked
- Full session history (unlimited)
- Weekly card generated every Monday
- Shareable card URL (lumen.so/card/[userId])
- Weekly digest email via Resend
- Community feed (opt-in sharing)
- Self-comparison (this week vs last week vs 4-week baseline)

Pro is per-user, not per-device. The Pro status is stored in the database and verified
via the API token that links the extension to the user's lumen.so account.

---

## What to build — scoped task list

### Task 1: Tier gating in lumen.so (web app)

In `web/app/dashboard/page.tsx`:
- Check `user.pro` boolean from Supabase on page load
- If `user.pro === false`: render a locked state for the dashboard
- The locked state shows:
  - A preview of what the weekly card looks like (static mockup, not real data)
  - A single CTA: "Unlock Pro — £49 one-time"
  - Three bullet points: "Full session history · Weekly card · Shareable link"
  - No other content. No teaser data. No blurred charts.
- If `user.pro === true`: render the full dashboard as currently specced

In `web/app/card/[userId]/page.tsx`:
- If the user whose card is being viewed is not Pro: return a 404 or a
  "This user hasn't unlocked card sharing yet" page. Do not expose any data.

In `web/app/community/page.tsx`:
- Only show users where `user.pro === true` AND `user.share_card_public === true`

Add `pro boolean default false` to the users table in `web/supabase/schema.sql` if
not already present.

### Task 2: Polar.sh checkout integration

In `web/app/upgrade/page.tsx` (create this file):
- A minimal upgrade page. No marketing copy — that lives on lumen.so landing page.
- Just: Lumen wordmark, "Unlock Pro", the three bullet points, price, and the
  Polar.sh checkout button.
- Use Polar.sh's hosted checkout. The checkout URL is configured via environment
  variable: `POLAR_CHECKOUT_URL`.
- On successful payment, Polar.sh webhooks to `web/app/api/upgrade/route.ts`

In `web/app/api/upgrade/route.ts` (create this file):
- Receives Polar.sh webhook POST on successful payment
- Validates the webhook signature using `POLAR_WEBHOOK_SECRET` env var
- Looks up the user by email from the webhook payload
- Sets `user.pro = true` in Supabase
- Returns 200

Environment variables needed (add to `.env.local` and Vercel):
```
POLAR_CHECKOUT_URL=
POLAR_WEBHOOK_SECRET=
```

Do not hardcode prices or product IDs. All Polar config via environment variables.

### Task 3: Pro status sync to extension

The extension needs to know whether the current user is Pro so it can show or hide
the "Open dashboard →" link in the popup as active vs locked.

In `web/app/api/me/route.ts` (create this file):
- GET endpoint, authenticated via bearer token (the user's API token stored in
  chrome.storage.sync)
- Returns: `{ userId, pro, displayName }`

In `extension/session.js`:
- On extension startup, if `apiToken` exists in chrome.storage.sync, call
  `GET https://api.lumen.so/v1/me` with the token as bearer
- Store the response `{ userId, pro }` in chrome.storage.sync as `lumenUser`
- Refresh this check once per day (use chrome.alarms with a 24h interval)

In `extension/popup/popup.js`:
- Read `lumenUser` from chrome.storage.sync
- If `lumenUser.pro === true`: render the "Open dashboard →" link as a normal
  clickable link to `https://lumen.so/dashboard`
- If `lumenUser.pro === false` or `lumenUser` is null: render the link as
  "Unlock Pro →" pointing to `https://lumen.so/upgrade`
- If no `lumenUser` at all (not logged in): render "Create account →" pointing
  to `https://lumen.so/signup`

### Task 4: Popup UI — three states

The popup must cleanly communicate three states without being pushy.

**State A: Not connected (no account)**
```
[ Lumen ]

THIS SESSION
[sparkline]
[session stats]

────────────────
YOUR WEEK
Connect to see your weekly card
[ Create free account → ]

────────────────
PREFERENCES
[exemptions list]
```

**State B: Connected, Free**
```
[ Lumen ]

THIS SESSION
[sparkline]
[session stats]

────────────────
YOUR WEEK
Weekly cards require Pro
[ Unlock Pro — £49 once → ]

────────────────
PREFERENCES
[exemptions list]
```

**State C: Connected, Pro**
```
[ Lumen ]

THIS SESSION
[sparkline]
[session stats]

────────────────
YOUR WEEK
[ Open dashboard → ]
[mini weekly shape badge if available]

────────────────
PREFERENCES
[exemptions list]
```

The upsell in State B is one line + one button. Not a banner. Not a modal.
Not repeated. The user sees it once per popup open — it does not animate or
demand attention.

Style all three states using the existing design tokens from `widget.css`.
The upgrade CTA button uses `--lm-depth` (#4a9fd4) as its border colour —
the only coloured button in the entire extension UI, and only in this one place.

### Task 5: lumen.so landing page upgrade section

In `web/app/page.tsx`, add a pricing section (fourth section, after community):

```
Free                          Pro — £49 once
────────────────────────────  ──────────────────────────────
✓ Full signal extension       Everything in Free, plus:
✓ All four signals            ✓ Weekly card + history
✓ Exemption learning          ✓ Shareable card URL
✓ Session badge + popup       ✓ Weekly digest email
                              ✓ Community feed
                              ✓ Self-comparison

[Install free →]              [Unlock Pro →]
Chrome Web Store              One-time · No subscription
```

Design rules for this section:
- Background: `--lm-void` (#080808)
- Two columns, equal width, separated by a 1px `--lm-border` vertical line
- No cards, no rounded boxes around the columns — just the divider line
- Checkmarks: Unicode ✓ in `--lm-secondary` (#6a6a6a), not icon libraries
- Pro column has ONE difference from Free column: the price line uses
  `--lm-bright` (#f0f0f0) instead of `--lm-secondary`
- No "most popular" badge. No highlighting. No visual hierarchy between the two
  columns beyond the price treatment. The free tier is not lesser.

---

## What NOT to touch

- `engine.js` — signal scoring is unchanged
- `adapters/` — platform adapters are unchanged  
- `nudges.js` — copy library is unchanged
- `goals.js` — onboarding and goals logic is unchanged
- The session POST payload to `/api/session` — unchanged
- The WeeklyCard component internals — unchanged
- widget.css signal colours and strip styles — unchanged

---

## Design constraints (non-negotiable)

All new UI must follow the existing design system exactly:

```css
--lm-void:       #080808
--lm-surface:    #0f0f0f
--lm-raised:     #161616
--lm-border:     #222222
--lm-muted:      #3a3a3a
--lm-secondary:  #6a6a6a
--lm-primary:    #c8c8c8
--lm-bright:     #f0f0f0

--lm-loop:       #4caf50
--lm-drift:      #f0a500
--lm-mismatch:   #8040c0
--lm-depth:      #4a9fd4
```

- Font: Inter only
- No gradients, no shadows, no blur
- No aurora colours (#c8386a etc.) in any product UI surface
- Signal colours appear only as signal indicators — never decorative
- The word "Pro" is never shown in a badge, pill, or coloured chip inside the
  extension. It appears only as plain text.
- The upgrade prompt in the popup is never shown more than once per popup open.
  It does not animate, pulse, or draw attention to itself beyond its placement.

---

## Supabase schema addition

Add to `web/supabase/schema.sql`:

```sql
-- Add pro status to users table
alter table users add column if not exists pro boolean default false;
alter table users add column if not exists pro_activated_at timestamptz;
alter table users add column if not exists polar_order_id text unique;
```

---

## Environment variables summary

All new env vars required:

```
# Polar.sh
POLAR_CHECKOUT_URL=          # The hosted checkout URL for the Pro product
POLAR_WEBHOOK_SECRET=        # For validating incoming webhook signatures

# Already exists but confirm present
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Needed for webhook handler to update pro status
```

---

## Definition of done

- [ ] Free user sees full extension with no degradation
- [ ] Free user sees locked dashboard on lumen.so with single upgrade CTA
- [ ] Pro user sees full dashboard
- [ ] Successful Polar.sh payment sets `user.pro = true` in Supabase via webhook
- [ ] Extension popup shows correct state (A/B/C) based on account status
- [ ] Upgrade CTA in popup links to lumen.so/upgrade
- [ ] lumen.so/upgrade page exists with Polar.sh checkout button
- [ ] Landing page pricing section added with two-column layout
- [ ] No signal logic, adapter, or scoring code has been modified
- [ ] All new UI uses existing design tokens — no new colours introduced
- [ ] Zero console errors on ChatGPT, Claude, Gemini, Grok after changes
