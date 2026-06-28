import { NextRequest, NextResponse } from "next/server";
import {
  FAMILY_LIMITS,
  isBelowMinimumAge,
  requiresParentalConsent,
} from "@/lib/familyQuestions";
import { createPendingConsent } from "@/lib/familyMemory";
import { generateApiToken } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const displayName = String(body.displayName || "Lumen user").trim();
  const birthYear = Number(body.birthYear);
  const parentEmail = String(body.parentEmail || "").trim().toLowerCase();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!birthYear || birthYear < 1990 || birthYear > new Date().getFullYear()) {
    return NextResponse.json({ error: "Valid birth year required" }, { status: 400 });
  }

  if (isBelowMinimumAge(birthYear)) {
    return NextResponse.json(
      {
        error: `Lumen is for ages ${FAMILY_LIMITS.minAge}+. Under-13 accounts are not supported.`,
        code: "AGE_TOO_YOUNG",
      },
      { status: 403 }
    );
  }

  const userId = crypto.randomUUID();
  const apiToken = generateApiToken();
  const needsConsent = requiresParentalConsent(birthYear);

  if (needsConsent && !parentEmail.includes("@")) {
    return NextResponse.json(
      {
        error: "Parent/guardian email required for ages 13–17",
        code: "PARENT_EMAIL_REQUIRED",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    await supabase.from("users").upsert({
      id: userId,
      email,
      display_name: displayName,
      birth_year: birthYear,
      api_token: apiToken,
      account_status: needsConsent ? "pending_parent_consent" : "active",
      parent_guardian_email: needsConsent ? parentEmail : null,
    });
  }

  if (needsConsent) {
    const pending = createPendingConsent({
      childUserId: userId,
      childEmail: email,
      parentEmail,
      birthYear,
    });
    return NextResponse.json({
      ok: true,
      userId,
      apiToken,
      accountStatus: "pending_parent_consent",
      consentUrl: `/family/consent?token=${pending.consentToken}`,
      message:
        "We've emailed your parent/guardian to confirm. Your account activates after they approve.",
    });
  }

  return NextResponse.json({
    ok: true,
    userId,
    apiToken,
    displayName,
    accountStatus: "active",
  });
}
