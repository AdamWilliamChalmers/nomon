import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://x.com",
]);

export function extensionCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Private-Network": "true",
  };
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
