import type { JobDispatcher } from "../job-intake/submit-enrichment-job.js";

export const enrichmentExecutionQueueName = "enrichment-execution";

export type EnrichmentExecutionQueue = {
  add(
    name: "execute-enrichment-job",
    data: { jobId: string },
    options: { jobId: string },
  ): Promise<unknown>;
};

export type BullMqJobDispatcherOptions = {
  queue: EnrichmentExecutionQueue;
};

export function createBullMqJobDispatcher(
  options: BullMqJobDispatcherOptions,
): JobDispatcher {
  return {
    async dispatch(jobId) {
      await options.queue.add(
        "execute-enrichment-job",
        { jobId },
        { jobId },
      );
    },
  };
}
