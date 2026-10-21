import { serializeCsv } from "../csv/csv-codec.js";
import type { EnrichmentJobStatus } from "../enrichment-job-status.js";
import type { EnrichmentJobProgress } from "../enrichment-job-progress.js";
import type { JobSnapshot } from "../job-intake/submit-enrichment-job.js";
import {
  executeEnrichmentJob,
  type EnrichedList,
  type JobExecutionDependencies,
} from "./execute-enrichment-job.js";

export type JobExecutionStore = {
  claimQueued(jobId: string): Promise<JobExecutionClaim | undefined>;
  readStatus(jobId: string): Promise<EnrichmentJobStatus | undefined>;
  markCompleted(input: {
    jobId: string;
    leaseId: string;
    outputArtifactId: string;
    progress: EnrichmentJobProgress;
  }): Promise<boolean>;
  markFailed(input: {
    jobId: string;
    leaseId: string;
  }): Promise<boolean>;
  recordOperationResult(input: {
    jobId: string;
    leaseId: string;
    rowIndex: number;
    operationIndex: number;
    failed: boolean;
  }): Promise<boolean>;
};

export type JobExecutionClaim = {
  job: JobSnapshot;
  leaseId: string;
};

export type OutputArtifactStore = {
  store(output: EnrichedList): Promise<string>;
  read(outputArtifactId: string): Promise<EnrichedList | undefined>;
};

export type ExecuteQueuedEnrichmentJobDependencies = {
  jobExecutionStore: JobExecutionStore;
  outputArtifactStore: OutputArtifactStore;
  customOperationProvider?: JobExecutionDependencies["customOperationProvider"];
  leadLookup?: JobExecutionDependencies["leadLookup"];
};

export class UnrecoverableEnrichmentJobError extends Error {}

export async function executeQueuedEnrichmentJob(
  input: { jobId: string },
  dependencies: ExecuteQueuedEnrichmentJobDependencies,
): Promise<{ jobId: string; status: EnrichmentJobStatus }> {
  const claim = await dependencies.jobExecutionStore.claimQueued(input.jobId);

  if (claim === undefined) {
    const status = await dependencies.jobExecutionStore.readStatus(input.jobId);

    if (status === undefined) {
      throw new Error("Enrichment Job does not exist");
    }

    return { jobId: input.jobId, status };
  }

  const result = await executeEnrichmentJob(
    {
      jobId: claim.job.id,
      sourceList: {
        fileName: claim.job.sourceList.fileName,
        csv: serializeCsv([
          claim.job.sourceList.sourceFields,
          ...claim.job.sourceList.rows,
        ]),
      },
      configuredOperations: claim.job.configuredOperations,
      columnMappings: claim.job.columnMappings,
    },
    {
      customOperationProvider: dependencies.customOperationProvider,
      leadLookup: dependencies.leadLookup,
      onOperationResult: async (operationResult) => {
        await dependencies.jobExecutionStore.recordOperationResult({
          jobId: claim.job.id,
          leaseId: claim.leaseId,
          rowIndex: operationResult.rowIndex,
          operationIndex: operationResult.operationIndex,
          failed: operationResult.failed,
        });
      },
    },
  );

  let outputArtifactId: string;

  try {
    outputArtifactId = await dependencies.outputArtifactStore.store(result.output);
  } catch (error) {
    if (!(error instanceof UnrecoverableEnrichmentJobError)) {
      throw error;
    }

    const failed = await dependencies.jobExecutionStore.markFailed({
      jobId: claim.job.id,
      leaseId: claim.leaseId,
    });

    if (failed) {
      return { jobId: claim.job.id, status: "Failed" };
    }

    const status = await dependencies.jobExecutionStore.readStatus(claim.job.id);

    if (status === undefined) {
      throw new Error("Enrichment Job does not exist");
    }

    return { jobId: claim.job.id, status };
  }

  const completed = await dependencies.jobExecutionStore.markCompleted({
    jobId: claim.job.id,
    leaseId: claim.leaseId,
    outputArtifactId,
    progress: result.progress,
  });

  if (completed) {
    return { jobId: claim.job.id, status: "Completed" };
  }

  const status = await dependencies.jobExecutionStore.readStatus(claim.job.id);

  if (status === undefined) {
    throw new Error("Enrichment Job does not exist");
  }

  return { jobId: claim.job.id, status };
}
