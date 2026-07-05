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
const scopedIpWindows = new Map<string, Window>();
let globalDay: Window = { count: 0, resetAt: 0 };
let judgeBudgetLoggedPct = 0;

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

function sweepExpiredWindows(store: Map<string, Window>, now: number) {
  if (store.size <= 10_000) return;
  store.forEach((w, key) => {
    if (now >= w.resetAt) store.delete(key);
  });
}

function logJudgeBudgetUsage(count: number, cap: number) {
  const pct = Math.floor((count / cap) * 100);
  for (const threshold of [50, 80, 100]) {
    if (pct >= threshold && judgeBudgetLoggedPct < threshold) {
      judgeBudgetLoggedPct = threshold;
      console.warn(
        `[judge-budget] ${pct}% of daily cap used (${count}/${cap}). ` +
          (threshold === 100 ? "Further judge calls will be rejected until reset." : ""),
      );
    }
  }
}

/** Generic per-IP fixed-window limiter for unauthenticated extension APIs. */
export function checkIpRateLimit(
  scope: string,
  ip: string,
  perMin: number,
): RateLimitResult {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  let win = scopedIpWindows.get(key);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + MINUTE };
    scopedIpWindows.set(key, win);
  }
  if (win.count >= perMin) {
    return { ok: false, reason: "ip", retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }
  win.count += 1;
  sweepExpiredWindows(scopedIpWindows, now);
  return { ok: true };
}

export function checkJudgeRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const perIpPerMin = envInt("JUDGE_IP_PER_MIN", 20);
  const globalPerDay = envInt("JUDGE_DAILY_BUDGET", 20_000);

  // Global daily budget — the wallet guard. Checked before anything else.
  if (now >= globalDay.resetAt) {
    globalDay = { count: 0, resetAt: now + DAY };
    judgeBudgetLoggedPct = 0;
  }
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
  logJudgeBudgetUsage(globalDay.count, globalPerDay);

  sweepExpiredWindows(ipWindows, now);

  return { ok: true };
}

export function checkSessionRateLimit(ip: string): RateLimitResult {
  return checkIpRateLimit("session", ip, envInt("SESSION_IP_PER_MIN", 30));
}

export function checkSurveyRateLimit(ip: string): RateLimitResult {
  return checkIpRateLimit("survey", ip, envInt("SURVEY_IP_PER_MIN", 10));
}
