import { extensionJsonResponse, handleExtensionOptions } from "@/lib/extensionCors";
import {
  anthropicJudge,
  geminiJudge,
  heuristicJudge,
  openaiJudge,
  type JudgeRequest,
  type JudgeVerdict,
} from "@/lib/judge";

export async function OPTIONS(request: Request) {
  return handleExtensionOptions(request);
}

// Capability probe: lets the extension auto-enable the LLM judge only when a
// real model key is configured (otherwise it would fall back to heuristics).
export async function GET(request: Request) {
  const provider = process.env.ANTHROPIC_API_KEY
    ? "anthropic"
    : process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : null;
  return extensionJsonResponse(request, { ok: true, llm: Boolean(provider), provider });
}

export async function POST(request: Request) {
  let body: JudgeRequest;
  try {
    body = await request.json();
  } catch {
    return extensionJsonResponse(request, { error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return extensionJsonResponse(request, { error: "text required" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Ordered LLM cascade: Anthropic -> OpenAI -> Gemini, falling through to the
  // next provider on error, then finally the local heuristic. Each provider
  // only runs if its key exists.
  const providers: Array<{ name: string; run: () => Promise<JudgeVerdict> }> = [];
  if (anthropicKey) providers.push({ name: "anthropic", run: () => anthropicJudge(body, anthropicKey) });
  if (openaiKey) providers.push({ name: "openai", run: () => openaiJudge(body, openaiKey) });
  if (geminiKey) providers.push({ name: "gemini", run: () => geminiJudge(body, geminiKey) });

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
