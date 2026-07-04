import { extensionJsonResponse, handleExtensionOptions } from "@/lib/extensionCors";
import {
  geminiJudge,
  heuristicJudge,
  openaiJudge,
  xaiJudge,
  type JudgeRequest,
  type JudgeVerdict,
} from "@/lib/judge";
import { checkJudgeRateLimit, clientIp } from "@/lib/rateLimit";

// Reject oversized bodies before parsing — the judge only ever needs a short
// prompt slice, so anything large is either a bug or an attempt to strain the
// instance. The forwarded prompt is separately capped in judgeUserPayload.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_CHARS = 8000;

export async function OPTIONS(request: Request) {
  return handleExtensionOptions(request);
}

// Capability probe: lets the extension auto-enable the LLM judge only when a
// real model key is configured (otherwise it would fall back to heuristics).
export async function GET(request: Request) {
  const provider = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.XAI_API_KEY
        ? "xai"
        : null;
  return extensionJsonResponse(request, { ok: true, llm: Boolean(provider), provider });
}

export async function POST(request: Request) {
  // Rate limit + global daily budget cap (denial-of-wallet guard).
  const limit = checkJudgeRateLimit(clientIp(request));
  if (!limit.ok) {
    return extensionJsonResponse(
      request,
      { error: "rate_limited", scope: limit.reason },
      { status: 429, headers: limit.retryAfter ? { "Retry-After": String(limit.retryAfter) } : {} },
    );
  }

  // Reject oversized payloads early.
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return extensionJsonResponse(request, { error: "payload too large" }, { status: 413 });
  }

  let body: JudgeRequest;
  try {
    body = await request.json();
  } catch {
    return extensionJsonResponse(request, { error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return extensionJsonResponse(request, { error: "text required" }, { status: 400 });
  }
  if (body.text.length > MAX_TEXT_CHARS) {
    body.text = body.text.slice(0, MAX_TEXT_CHARS);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Ordered LLM cascade: OpenAI (gpt-4o-mini) -> Gemini -> xAI (Grok), falling
  // through to the next provider on error, then finally the local heuristic.
  // Each provider only runs if its key exists.
  const providers: Array<{ name: string; run: () => Promise<JudgeVerdict> }> = [];
  if (openaiKey) providers.push({ name: "openai", run: () => openaiJudge(body, openaiKey) });
  if (geminiKey) providers.push({ name: "gemini", run: () => geminiJudge(body, geminiKey) });
  if (xaiKey) providers.push({ name: "xai", run: () => xaiJudge(body, xaiKey) });

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const verdict = await provider.run();
      return extensionJsonResponse(request, {
        ok: true,
        ...verdict,
        ...(errors.length ? { fellBackFrom: errors } : {}),
      });
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  const fallback = heuristicJudge(body);
  return extensionJsonResponse(request, {
    ok: true,
    ...fallback,
    ...(errors.length ? { fallback: true, error: errors.join("; ") } : {}),
  });
}
