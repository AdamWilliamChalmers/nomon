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

export async function anthropicJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: judgeUserPayload(body) }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const content = data.content?.find((block: { type: string }) => block.type === "text")?.text;
  if (!content) throw new Error("Anthropic empty response");
  return parseJudgeJson(content);
}

export async function geminiJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  const model = "gemini-3.1-flash-lite";
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

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");
  if (!content) throw new Error("Gemini empty response");
  return parseJudgeJson(content);
}

export async function openaiJudge(body: JudgeRequest, apiKey: string): Promise<JudgeVerdict> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: judgeUserPayload(body) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return parseJudgeJson(content);
}
