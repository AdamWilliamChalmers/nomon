"use client";

import { useEffect, useRef, useState } from "react";
import { approxTokenCount } from "./cost";
import { countTokensExact } from "./tokenize";
import type { TokenizerFamily, TokenCount } from "./types";

/**
 * Debounced token count. Prefers a Web Worker; falls back to async main-thread.
 */
export function useTokenCount(
  text: string,
  family: TokenizerFamily,
  debounceMs = 120
): TokenCount {
  const [result, setResult] = useState<TokenCount>(() => ({
    tokens: approxTokenCount(text),
    exact: false,
    tokenizer: family,
  }));
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      workerRef.current = new Worker(
        new URL("../workers/tokenize.worker.ts", import.meta.url)
      );
      workerRef.current.onmessage = (e: MessageEvent) => {
        if (e.data.id === reqId.current) {
          setResult(e.data.result);
        }
      };
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = ++reqId.current;
    const timer = window.setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.postMessage({ id, text, family });
      } else {
        void countTokensExact(text, family).then((r) => {
          if (id === reqId.current) setResult(r);
        });
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [text, family, debounceMs]);

  return result;
}
