import catalog from "@/data/models.json";
import type { ModelPricing, ModelsCatalog } from "./types";

export const MODELS_CATALOG = catalog as ModelsCatalog;

export function listModels(): ModelPricing[] {
  return MODELS_CATALOG.models;
}

export function getModel(id: string): ModelPricing | undefined {
  return MODELS_CATALOG.models.find((m) => m.id === id);
}

export function defaultModelId(): string {
  return "gpt-4o";
}

export function pricesUpdatedAt(): string {
  return MODELS_CATALOG.updatedAt;
}
