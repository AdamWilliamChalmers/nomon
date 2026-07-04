// In-memory rate limiting + a global daily budget cap for the LLM judge.
//
// The judge endpoint is an unauthenticated proxy to paid LLM providers, so the
// real risk is "denial of wallet": a bot hammering /api/judge to run up the
// bill. Two independent guards defend against that:
//   1. Per-IP window   — stops a single client from flooding.
//   2. Global daily cap — hard ceiling on total judge calls/day across all
//                          clients, so cost can never exceed a fixed budget.
//
// State is in-process. On Render's free tier that's a single instance, which is
// fine. If this ever scales to multiple instances, move the counters to a
// shared store (Supabase/Upstash) so the caps stay global — see NOTE below.

const MINUTE = 60_000;
const DAY = 86_400_000;

interface Window {
  count: number;
  resetAt: number;
}

const ipWindows = new Map<string, Window>();
let globalDay: Window = { count: 0, resetAt: 0 };

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface RateLimitResult {
  ok: boolean;
  reason?: "ip" | "global";
  retryAfter?: number; // seconds
}

// Best-effort client IP. Render/most proxies set x-forwarded-for as a
// comma-separated chain with the client first; fall back to x-real-ip.
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkJudgeRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const perIpPerMin = envInt("JUDGE_IP_PER_MIN", 20);
  const globalPerDay = envInt("JUDGE_DAILY_BUDGET", 20_000);

  // Global daily budget — the wallet guard. Checked before anything else.
  if (now >= globalDay.resetAt) globalDay = { count: 0, resetAt: now + DAY };
  if (globalDay.count >= globalPerDay) {
    return { ok: false, reason: "global", retryAfter: Math.ceil((globalDay.resetAt - now) / 1000) };
  }

  // Per-IP fixed window.
  let win = ipWindows.get(ip);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + MINUTE };
    ipWindows.set(ip, win);
  }
  if (win.count >= perIpPerMin) {
    return { ok: false, reason: "ip", retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }

  win.count += 1;
  globalDay.count += 1;

  // Bound memory: sweep expired IP windows occasionally.
  if (ipWindows.size > 10_000) {
    ipWindows.forEach((w, key) => {
      if (now >= w.resetAt) ipWindows.delete(key);
    });
  }

  return { ok: true };
}
