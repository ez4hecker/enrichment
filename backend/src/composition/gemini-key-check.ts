import type { GeminiKeyCheck } from "../research/research-key-registry.js";

type GeminiFetch = (url: string, init: RequestInit) => Promise<Response>;

export type GeminiKeyCheckOptions = {
  fetch?: GeminiFetch;
  apiBaseUrl?: string;
  /** A cheap model on the free tier, used to confirm the key works. */
  workingModel?: string;
  /**
   * A model whose grounded search Google offers only to billed projects (Gemini 3 grounding is
   * "Not available" on the free tier). If a grounded request on it succeeds, the key is billed.
   */
  billingProbeModel?: string;
  timeoutMilliseconds?: number;
};

export function createGeminiKeyCheck(options: GeminiKeyCheckOptions = {}): GeminiKeyCheck {
  const apiBaseUrl = options.apiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const workingModel = options.workingModel ?? "gemini-2.5-flash-lite";
  const billingProbeModel = options.billingProbeModel ?? "gemini-3.1-flash-lite";
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 20_000;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));

  async function generate(apiKey: string, model: string, grounded: boolean): Promise<Response | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      return await request(`${apiBaseUrl}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
          ...(grounded ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: { maxOutputTokens: 5, temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  return async (apiKey) => {
    const working = await generate(apiKey, workingModel, false);

    if (working === undefined || working.status >= 500) {
      return { status: "Rejected", code: "CHECK_FAILED", message: "Google could not be reached to check the key. Try again in a minute." };
    }

    // 429 means the key works but is busy right now; anything else that is not OK means it does not work.
    if (!working.ok && working.status !== 429) {
      return { status: "Rejected", code: "KEY_INVALID", message: "Google rejected this key. Check that it was copied in full and is enabled for the Gemini API." };
    }

    const probe = await generate(apiKey, billingProbeModel, true);

    if (probe === undefined || probe.status >= 500) {
      return { status: "Rejected", code: "CHECK_FAILED", message: "Google could not be reached to check the key's billing. Try again in a minute." };
    }

    if (probe.ok) {
      return {
        status: "Rejected",
        code: "KEY_BILLED",
        message: "This key's Google Cloud project has billing turned on. Only keys from projects without billing can join the pool, so a search past the free allowance can never be charged.",
      };
    }

    return { status: "Accepted" };
  };
}
