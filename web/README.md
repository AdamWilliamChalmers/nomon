# nomon-app.com — Companion Web App

Next.js 14 + Supabase + Tailwind per `lumen_cursor_v3.md`.

## Setup

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CRON_SECRET=
```

Without Supabase, `/api/session` stores sessions in memory for local extension testing.

## Extension integration

Point the extension at `http://localhost:3000/api/session` (default in `extension/session.js`).

## Routes

- `/` — landing page
- `/dashboard` — weekly card + self-comparison
- `/card/[userId]` — public shareable card
- `/community` — opted-in shapes feed
- `POST /api/session` — extension session ingest
- `GET /api/card` — weekly card data
- `POST /api/digest` — Monday cron (Vercel)

## Family (lumen_family.md)

Child-led sharing — parents see **weekly card only**.

| Route | Purpose |
|-------|---------|
| `/signup` | Age-gated signup (13+); 13–17 needs parent consent |
| `/family/consent` | Parent confirms child account |
| `/dashboard?userId=` | Child invites up to 2 parent emails |
| `/family/parent?shareId=&token=` | Parent view-only weekly card + conversation starter |
| `POST /api/family/invite` | Child creates share invitation |
| `DELETE /api/family/invite` | Child revokes instantly |
| `POST /api/family/digest` | Parent weekly email (cron) |

**Not built (by design):** message content, session logs, time limits, topic blocks, peer comparison, hidden modes.

**Before launch:** obtain legal advice on age verification and GDPR Article 8 (see `lumen_family.md`).

Run `supabase/schema.sql` against your Supabase project.
