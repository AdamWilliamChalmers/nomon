import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  verifyPolarWebhook,
  extractOrderEmail,
  extractOrderId,
  isPaidEvent,
} from "@/lib/polarWebhook";

export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const valid = verifyPolarWebhook(secret, body, {
    webhookId: req.headers.get("webhook-id"),
    webhookTimestamp: req.headers.get("webhook-timestamp"),
    webhookSignature: req.headers.get("webhook-signature"),
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isPaidEvent(payload)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const email = extractOrderEmail(payload);
  if (!email) {
    return NextResponse.json({ error: "No customer email in payload" }, { status: 422 });
  }

  const orderId = extractOrderId(payload);
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  if (orderId) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("polar_order_id", orderId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const { data: user, error: lookupError } = await supabase
    .from("users")
    .select("id, pro")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found for email" }, { status: 404 });
  }

  if (user.pro) {
    return NextResponse.json({ ok: true, alreadyPro: true });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      pro: true,
      pro_activated_at: new Date().toISOString(),
      ...(orderId ? { polar_order_id: orderId } : {}),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
