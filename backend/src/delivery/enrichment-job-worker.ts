import { Worker, type ConnectionOptions } from "bullmq";

import { enrichmentExecutionQueueName } from "../composition/bullmq-job-dispatcher.js";
import {
  executeQueuedEnrichmentJob,
  type ExecuteQueuedEnrichmentJobDependencies,
} from "../job-execution/execute-queued-enrichment-job.js";

export type EnrichmentExecutionQueueDelivery = {
  data: unknown;
};

export type BullMqEnrichmentExecutionWorkerOptions =
  & ExecuteQueuedEnrichmentJobDependencies
  & {
    connection: ConnectionOptions;
    concurrency?: number;
  };

export function createEnrichmentExecutionProcessor(
  dependencies: ExecuteQueuedEnrichmentJobDependencies,
): (delivery: EnrichmentExecutionQueueDelivery) => Promise<void> {
  return async (delivery) => {
    const jobId = jobIdFromDelivery(delivery);

    if (jobId === undefined) {
      throw new Error("Enrichment execution delivery has no job identity");
    }

    await executeQueuedEnrichmentJob({ jobId }, dependencies);
  };
}

export function createBullMqEnrichmentExecutionWorker(
  options: BullMqEnrichmentExecutionWorkerOptions,
): Worker<{ jobId: string }, void, "execute-enrichment-job"> {
  const processor = createEnrichmentExecutionProcessor(options);

  return new Worker<{ jobId: string }, void, "execute-enrichment-job">(
    enrichmentExecutionQueueName,
    async (job) => processor({ data: job.data }),
    {
      connection: options.connection,
      concurrency: options.concurrency,
    },
  );
}

function jobIdFromDelivery(
  delivery: EnrichmentExecutionQueueDelivery,
): string | undefined {
  return typeof delivery.data === "object" &&
    delivery.data !== null &&
    "jobId" in delivery.data &&
    typeof delivery.data.jobId === "string" &&
    delivery.data.jobId.length > 0
    ? delivery.data.jobId
    : undefined;
}
