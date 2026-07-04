import { NextResponse } from "next/server";

// Origins the extension's content scripts run on (kept in sync with the AI
// hosts in the extension manifest). CORS only governs *browser* fetches, so
// this list matters for the content-script fallback path; the extension's
// normal path goes through its background service worker, which is not
// CORS-restricted. Non-browser clients (curl/bots) ignore CORS entirely —
// abuse is defended by rate limiting, not this list.
const ALLOWED_ORIGINS = new Set([
  "https://chat.openai.com",
  "https://chatgpt.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://grok.com",
  "https://x.com",
  "https://copilot.microsoft.com",
  "https://www.perplexity.ai",
  "https://perplexity.ai",
  "https://chat.mistral.ai",
  "https://www.meta.ai",
  "https://meta.ai",
  "https://chat.deepseek.com",
  "https://chat.qwen.ai",
  "https://www.kimi.com",
  "https://kimi.com",
  "https://kimi.moonshot.cn",
  "https://agent.minimax.io",
  "https://chat.minimax.io",
  "https://chat.minimaxi.com",
  "https://huggingface.co",
  "https://www.doubao.com",
  "https://doubao.com",
]);

export function extensionCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };

  // Only reflect known origins. Unknown/absent origins get no allow header, so
  // arbitrary websites can't call the endpoint from a browser. (Previously this
  // fell back to "*", which allowed any site.)
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function handleExtensionOptions(request: Request) {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders(request) });
}

export function extensionJsonResponse(request: Request, data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...extensionCorsHeaders(request),
      ...(init?.headers || {}),
    },
  });
}
