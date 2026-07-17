import { approxTokenCount } from "./cost";
import type { TokenizerFamily, TokenCount } from "./types";

type TiktokenEncoding = "cl100k_base" | "o200k_base";

const encodingCache = new Map<string, { encode: (t: string) => number[] }>();
let encodingLoader: Promise<typeof import("js-tiktoken")> | null = null;

function loadTiktoken() {
  if (!encodingLoader) encodingLoader = import("js-tiktoken");
  return encodingLoader;
}

async function getEnc(name: TiktokenEncoding) {
  let enc = encodingCache.get(name);
  if (!enc) {
    const { getEncoding } = await loadTiktoken();
    enc = getEncoding(name);
    encodingCache.set(name, enc);
  }
  return enc;
}

/** Sync count — exact for OpenAI only after encodings are warmed; else approx. */
export function countTokens(
  text: string,
  family: TokenizerFamily
): TokenCount {
  if (!text) {
    return { tokens: 0, exact: true, tokenizer: family };
  }

  if (family === "cl100k_base" || family === "o200k_base") {
    const enc = encodingCache.get(family);
    if (enc) {
      return {
        tokens: enc.encode(text).length,
        exact: true,
        tokenizer: family,
      };
    }
  }

  return {
    tokens: approxTokenCount(text),
    exact: false,
    tokenizer: family,
  };
}

/** Async exact count (warms js-tiktoken on first OpenAI call). */
export async function countTokensExact(
  text: string,
  family: TokenizerFamily
): Promise<TokenCount> {
  if (!text) {
    return { tokens: 0, exact: true, tokenizer: family };
  }

  if (family === "cl100k_base" || family === "o200k_base") {
    try {
      const enc = await getEnc(family);
      return {
        tokens: enc.encode(text).length,
        exact: true,
        tokenizer: family,
      };
    } catch {
      return {
        tokens: approxTokenCount(text),
        exact: false,
        tokenizer: family,
      };
    }
  }

  return {
    tokens: approxTokenCount(text),
    exact: false,
    tokenizer: family,
  };
}

/** Estimate how many tokens a substring would remove if excised. */
export function estimateSubstringTokens(
  full: string,
  start: number,
  end: number,
  family: TokenizerFamily
): number {
  const slice = full.slice(start, end);
  return countTokens(slice, family).tokens;
}
