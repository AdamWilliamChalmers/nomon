import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ORG_SESSION_COOKIE = "nomon_org_session";

export type OrgSession = {
  email: string;
  name: string;
  organisation: string;
  iat: number;
};

function secret(): string {
  return (
    process.env.ORG_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "nomon-org-dev-secret-change-me"
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function encodeOrgSession(session: OrgSession): string {
  const payloadB64 = b64url(JSON.stringify(session));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeOrgSession(token: string | undefined | null): OrgSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const raw = JSON.parse(fromB64url(payloadB64).toString("utf8")) as OrgSession;
    if (!raw?.email || !raw?.organisation || typeof raw.iat !== "number") return null;
    // 90-day soft expiry — this is a waitlist/preview session, not SSO
    if (Date.now() - raw.iat > 90 * 24 * 60 * 60 * 1000) return null;
    return {
      email: String(raw.email).slice(0, 200),
      name: String(raw.name || "").slice(0, 120),
      organisation: String(raw.organisation).slice(0, 160),
      iat: raw.iat,
    };
  } catch {
    return null;
  }
}

export function getOrgSession(): OrgSession | null {
  return decodeOrgSession(cookies().get(ORG_SESSION_COOKIE)?.value);
}

export function orgSessionCookieOptions(maxAgeSeconds = 90 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
