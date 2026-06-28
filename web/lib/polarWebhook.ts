import crypto from "crypto";

interface WebhookHeaders {
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
}

export function verifyPolarWebhook(
  secret: string,
  body: string,
  headers: WebhookHeaders
): boolean {
  const { webhookId, webhookTimestamp, webhookSignature } = headers;
  if (!webhookId || !webhookTimestamp || !webhookSignature || !secret) return false;

  const ts = parseInt(webhookTimestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretKey, "base64");
  } catch {
    key = Buffer.from(secretKey, "utf8");
  }

  const expected = crypto.createHmac("sha256", key).update(signedPayload).digest("base64");
  const parts = webhookSignature.split(" ");

  for (const part of parts) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      // length mismatch
    }
  }

  return false;
}

export function extractOrderEmail(payload: Record<string, unknown>): string | null {
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const customer = data.customer as Record<string, unknown> | undefined;
  if (customer?.email) return String(customer.email).trim().toLowerCase();

  const user = data.user as Record<string, unknown> | undefined;
  if (user?.email) return String(user.email).trim().toLowerCase();

  if (data.customer_email) return String(data.customer_email).trim().toLowerCase();
  if (data.email) return String(data.email).trim().toLowerCase();

  return null;
}

export function extractOrderId(payload: Record<string, unknown>): string | null {
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const id = data.id ?? data.order_id;
  return id ? String(id) : null;
}

export function isPaidEvent(payload: Record<string, unknown>): boolean {
  const type = String(payload.type || "");
  if (type === "order.paid" || type === "order.created") return true;
  if (type === "checkout.updated") {
    const data = payload.data as Record<string, unknown> | undefined;
    return data?.status === "paid" || data?.status === "confirmed";
  }
  return false;
}
