import LZString from "lz-string";

export interface ShareState {
  p: string; // prompt
  m: string; // model id
  v: number; // monthly volume
  o: number; // assumed output tokens
  x?: number | null; // max_tokens
}

const MAX_ENCODED = 6000; // keep URLs shareable

export function encodeShareState(state: ShareState): string | null {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(json);
  if (compressed.length > MAX_ENCODED) return null;
  return compressed;
}

export function decodeShareState(raw: string): ShareState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const parsed = JSON.parse(json) as ShareState;
    if (typeof parsed.p !== "string" || typeof parsed.m !== "string") {
      return null;
    }
    return {
      p: parsed.p,
      m: parsed.m,
      v: Number(parsed.v) || 1000,
      o: Number(parsed.o) || 500,
      x: parsed.x ?? null,
    };
  } catch {
    return null;
  }
}
