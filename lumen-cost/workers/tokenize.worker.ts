import { countTokensExact } from "../lib/tokenize";
import type { TokenizerFamily } from "../lib/types";

export type WorkerRequest = {
  id: number;
  text: string;
  family: TokenizerFamily;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, text, family } = event.data;
  const result = await countTokensExact(text, family);
  self.postMessage({ id, result });
};
