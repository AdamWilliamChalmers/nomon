import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  ORG_SESSION_COOKIE,
  decodeOrgSession,
  encodeOrgSession,
  orgSessionCookieOptions,
  type OrgSession,
} from "@/lib/org-session";

function readSession(req: NextRequest): OrgSession | null {
  return decodeOrgSession(req.cookies.get(ORG_SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
    name: session.name,
    organisation: session.organisation,
  });
}

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string; organisation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const name = String(body.name || "").trim();
  const organisation = String(body.organisation || "").trim();

  if (!email || !email.includes("@") || email.length > 200) {
    return NextResponse.json({ error: "A valid work email is required." }, { status: 400 });
  }
  if (!organisation || organisation.length < 2) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const session: OrgSession = {
    email,
    name: name || email.split("@")[0],
    organisation,
    iat: Date.now(),
  };

  // Soft interest ping — no database. Falls back silently if Resend isn't configured.
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.ORG_INTEREST_EMAIL || "hello@nomon-app.com";
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: process.env.RESEND_FROM || "Nomon <onboarding@resend.dev>",
        to: notifyTo,
        subject: `Org interest — ${organisation}`,
        text: [
          `Organisation: ${organisation}`,
          `Name: ${session.name}`,
          `Email: ${email}`,
          `When: ${new Date().toISOString()}`,
        ].join("\n"),
      });
    } catch {
      // Never block sign-in on mail failure
    }
  }

  const res = NextResponse.json({
    ok: true,
    email: session.email,
    name: session.name,
    organisation: session.organisation,
  });
  res.cookies.set(ORG_SESSION_COOKIE, encodeOrgSession(session), orgSessionCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_SESSION_COOKIE, "", { ...orgSessionCookieOptions(0), maxAge: 0 });
  return res;
}
