import { extensionJsonResponse, handleExtensionOptions } from "@/lib/extensionCors";
import { anthropicJudge, heuristicJudge, openaiJudge, type JudgeRequest } from "@/lib/judge";

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

  try {
    const verdict = anthropicKey
      ? await anthropicJudge(body, anthropicKey)
      : openaiKey
        ? await openaiJudge(body, openaiKey)
        : heuristicJudge(body);
    return extensionJsonResponse(request, { ok: true, ...verdict });
  } catch (err) {
    const fallback = heuristicJudge(body);
    return extensionJsonResponse(request, {
      ok: true,
      ...fallback,
      fallback: true,
      error: err instanceof Error ? err.message : "judge failed",
    });
  }
}
