/**
 * The OpenAI models a Generation Custom Operation may choose. Prices are OpenAI's standard
 * per-1M-token list prices (developers.openai.com/api/docs/pricing, checked 2026-10-06);
 * update them here when OpenAI changes them, since the cost estimate shown before a run uses them.
 */
export type GenerationModel = {
  id: string;
  label: string;
  /** What the writing is like, so a user can pick without knowing the model. */
  description: string;
  inputDollarsPerMillionTokens: number;
  outputDollarsPerMillionTokens: number;
  /** Visible answer plus reasoning tokens for a short Text answer such as an ice breaker. */
  estimatedOutputTokensPerRow: number;
  /** Lowest effort the model accepts; writing from row data needs little reasoning. */
  reasoningEffort: string;
};

export const generationModels: ReadonlyArray<GenerationModel> = [
  {
    id: "gpt-6-luna",
    label: "Luna (everyday)",
    description: "Fast and cheapest. Clear, natural lines that follow the prompt; can sound a little generic.",
    inputDollarsPerMillionTokens: 0.1,
    outputDollarsPerMillionTokens: 0.5,
    estimatedOutputTokensPerRow: 100,
    reasoningEffort: "none",
  },
  {
    id: "gpt-6.1-sol",
    label: "Sol (better writing)",
    description: "Noticeably more specific and human-sounding; picks up details in the row. About 20x Luna's cost.",
    inputDollarsPerMillionTokens: 2,
    outputDollarsPerMillionTokens: 10,
    estimatedOutputTokensPerRow: 300,
    reasoningEffort: "low",
  },
  {
    id: "gpt-6-astra",
    label: "Astra (best quality)",
    description: "OpenAI's most capable model. Best tone and personalization, for high-value lists. About 5x Sol's cost.",
    inputDollarsPerMillionTokens: 10,
    outputDollarsPerMillionTokens: 50,
    estimatedOutputTokensPerRow: 300,
    reasoningEffort: "low",
  },
];

export function findGenerationModel(id: string): GenerationModel | undefined {
  return generationModels.find((model) => model.id === id);
}
