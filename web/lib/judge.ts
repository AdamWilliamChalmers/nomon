export type JudgeSignal = "handoff" | "loop" | "engaged" | "none";
export type JudgeConfidence = "high" | "medium" | "low";

export interface JudgeRequest {
  text: string;
  messageIndex: number;
  taskType?: string;
  rulePrimary?: string | null;
  ruleConfidence?: string;
  ruleReasons?: string[];
  loopScore?: number;
}

export interface JudgeVerdict {
  signal: JudgeSignal;
  confidence: JudgeConfidence;
  rationale: string;
  delegation: boolean;
  source: "llm" | "heuristic";
}

const DELEGATION_HINTS =
  /\b(write|draft|produce|generate|complete|finish)\b.*\b(essay|paper|assignment|thesis|report|for me|entire|whole)\b/i;

const ENGAGED_HINTS =
  /\b(here'?s my|my draft|i wrote|i think|my view|review my|what would you change|help me understand|explain)\b/i;

export function heuristicJudge(body: JudgeRequest): JudgeVerdict {
  const text = body.text || "";
  const idx = body.messageIndex || 1;

  if (ENGAGED_HINTS.test(text) && !/\b(write my (essay|paper)|can you write the entire)\b/i.test(text)) {
    return {
      signal: "engaged",
      confidence: "medium",
      rationale: "Prompt includes your own thinking or a learning/review frame.",
      delegation: false,
      source: "heuristic",
    };
  }

  if (idx <= 2 && (DELEGATION_HINTS.test(text) || body.rulePrimary === "handoff")) {
    return {
      signal: "handoff",
      confidence: body.ruleConfidence === "gray" ? "medium" : "high",
      rationale: "Whole-task delegation on an early message.",
      delegation: true,
      source: "heuristic",
    };
  }

  if (idx > 2 && (body.loopScore || 0) >= 55) {
    return {
      signal: "loop",
      confidence: "medium",
      rationale: "Passive pattern likely developing mid-conversation.",
      delegation: true,
      source: "heuristic",
    };
  }

  return {
    signal: "none",
    confidence: "low",
    rationale: "No clear offload pattern.",
    delegation: false,
    source: "heuristic",
  };
}

const JUDGE_SYSTEM = `You classify AI chat prompts for cognitive engagement. Reply JSON only:
{
  "signal": "handoff" | "loop" | "engaged" | "none",
  "confidence": "high" | "medium" | "low",
  "rationale": "one short sentence",
  "delegation": boolean
}
Rules:
- handoff: user asks AI to produce a whole deliverable they haven't started (essay, paper, code, email) especially message 1-2
- loop: message 3+, mostly passive continuation of AI output
- engaged: user shares draft, asks for critique, learning, or pushback
- none: administrative, factual, or unclear
Never moralize. Be concise.`;

function judgeUserPayload(body: JudgeRequest) {
  return JSON.stringify({
    messageIndex: body.messageIndex,
    taskType: body.taskType,
    rulePrimary: body.rulePrimary,
    ruleReasons: body.ruleReasons,
    loopScore: body.loopScore,
    prompt: body.text.slice(0, 2000),
  });
}

function parseJudgeJson(content: string): JudgeVerdict {
  let raw = content.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) raw = raw.slice(start, end + 1);
  const parsed = JSON.parse(raw) as JudgeVerdict;
  return { ...parsed, source: "llm" };
}

// Both OpenAI and xAI expose the same Chat Completions shape, so a single
// caller serves both — only the base URL, model, and key differ.
async function chatCompletionsJudge(
  body: JudgeRequest,
  opts: { apiKey: string; baseUrl: string; model: string; provider: string },
): Promise<JudgeVerdict> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: judgeUserPayload(body) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`${opts.provider} ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${opts.provider} empty response`);
  return parseJudgeJson(content);
}

// Primary judge.
export function openaiJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  return chatCompletionsJudge(body, {
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_JUDGE_MODEL || "gpt-4o-mini",
    provider: "openai",
  });
}

// Secondary judge — xAI is OpenAI-compatible. Model is overridable via
// XAI_MODEL so a deprecated/renamed Grok tier can be repointed without a
// code change; default is a cheap Grok tier.
export function xaiJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  return chatCompletionsJudge(body, {
    apiKey,
    baseUrl: "https://api.x.ai/v1",
    model: process.env.XAI_MODEL || "grok-3-mini",
    provider: "xai",
  });
}

// Tertiary judge — Gemini uses its own generateContent shape (not OpenAI-
// compatible), so it can't share chatCompletionsJudge. Model is overridable
// via GEMINI_MODEL.
export async function geminiJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: JUDGE_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: judgeUserPayload(body) }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 256 },
      }),
    },
  );

  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");
  if (!content) throw new Error("gemini empty response");
  return parseJudgeJson(content);
}
