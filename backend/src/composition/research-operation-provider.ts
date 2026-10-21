import type { CustomOperationProvider } from "../job-execution/execute-enrichment-job.js";
import type { ResearchChain } from "../research/research-chain.js";
import type { CustomOperationAnswerCache } from "./openai-custom-operation-provider.js";

/**
 * Generation Custom Operations go to the OpenAI writer; Research goes to the research chain,
 * never to OpenAI web search. Rows asking the same question about the same company share one
 * answer, so a list that repeats a company researches it once.
 */
export function createResearchOperationProvider(options: {
  generation: CustomOperationProvider;
  research: ResearchChain;
  answerCache: CustomOperationAnswerCache;
}): CustomOperationProvider {
  return {
    execute(request) {
      if (request.generationModel !== undefined) {
        return options.generation.execute(request);
      }

      const company = (request.companyWebsite ?? request.companyName ?? "").trim().toLowerCase();

      return options.answerCache.answer(
        `research\n${request.expectedOutputType}\n${company}\n${request.prompt}`,
        () => options.research.research(request),
      );
    },
  };
}
