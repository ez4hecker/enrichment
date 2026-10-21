import { randomUUID } from "node:crypto";
import type {
  EnrichmentJobSummary,
  JobHistoryEntryKind,
  JobHistoryStore,
  SavedPreviewStore,
} from "../job-history/list-enrichment-jobs.js";
import type {
  JobExecutionStore,
} from "../job-execution/execute-queued-enrichment-job.js";
import type { EnrichmentJobStatus } from "../enrichment-job-status.js";
import type { EnrichmentJobProgress } from "../enrichment-job-progress.js";
import type {
  JobSnapshot,
  JobDispatchIntentStore,
  JobSnapshotStore,
} from "../job-intake/submit-enrichment-job.js";

export type InMemoryJobStore =
  & JobSnapshotStore
  & JobDispatchIntentStore
  & JobHistoryStore
  & SavedPreviewStore
  & JobExecutionStore;

type StoredJob = {
  kind: JobHistoryEntryKind;
  snapshot: JobSnapshot;
  status: EnrichmentJobStatus;
  lease?: {
    id: string;
    expiresAt: number;
  };
  outputArtifactId?: string;
  dispatchPending: boolean;
  progress: EnrichmentJobProgress;
  completedOperationKeys: Set<string>;
};

export type InMemoryJobStoreOptions = {
  now?: () => number;
  leaseDurationMilliseconds?: number;
};

export function createInMemoryJobStore(
  options: InMemoryJobStoreOptions = {},
): InMemoryJobStore {
  const jobs = new Map<string, StoredJob>();
  const now = options.now ?? Date.now;
  const leaseDurationMilliseconds = options.leaseDurationMilliseconds ?? 300_000;

  return {
    async store(job) {
      jobs.set(job.id, {
        kind: "Job",
        snapshot: structuredClone(job),
        status: "Queued",
        dispatchPending: true,
        progress: pendingProgressFor(job),
        completedOperationKeys: new Set(),
      });
    },
    async storeSavedPreview(preview) {
      jobs.set(preview.id, {
        kind: "Preview",
        snapshot: {
          id: preview.id,
          ownerId: preview.ownerId,
          sourceList: { fileName: preview.fileName, sourceFields: [], rows: [] },
          columnMappings: [],
          configuredOperations: [],
        },
        status: "Completed",
        outputArtifactId: preview.outputArtifactId,
        dispatchPending: false,
        progress: {
          total: preview.rowCount,
          completed: preview.rowCount,
          failed: 0,
          remaining: 0,
        },
        completedOperationKeys: new Set(),
      });
    },
    async listPendingJobIds() {
      return [...jobs.values()].flatMap((job) =>
        job.dispatchPending ? [job.snapshot.id] : [],
      );
    },
    async markDispatched(jobId) {
      const job = jobs.get(jobId);

      if (job === undefined) {
        throw new Error("Enrichment Job does not exist");
      }

      job.dispatchPending = false;
    },
    async listByOwner(ownerId) {
      return [...jobs.values()].flatMap((job): Array<EnrichmentJobSummary> =>
        job.snapshot.ownerId === ownerId
          ? [summaryOf(job)]
          : [],
      );
    },
    async findByOwner(ownerId, jobId) {
      const job = jobs.get(jobId);

      return job === undefined || job.snapshot.ownerId !== ownerId
        ? undefined
        : summaryOf(job);
    },
    async findCompletedOutputArtifactIdByOwner(ownerId, jobId) {
      const job = jobs.get(jobId);

      return job === undefined ||
        job.snapshot.ownerId !== ownerId ||
        job.status !== "Completed"
        ? undefined
        : job.outputArtifactId;
    },
    async readStatus(jobId) {
      return jobs.get(jobId)?.status;
    },
    async claimQueued(jobId) {
      const job = jobs.get(jobId);

      const canClaim =
        job?.status === "Queued" ||
        (job?.status === "In Progress" &&
          job.lease !== undefined &&
          job.lease.expiresAt <= now());

      if (!canClaim || job === undefined) {
        return undefined;
      }

      job.status = "In Progress";
      job.lease = {
        id: randomUUID(),
        expiresAt: now() + leaseDurationMilliseconds,
      };

      return {
        job: structuredClone(job.snapshot),
        leaseId: job.lease.id,
      };
    },
    async markCompleted(input) {
      const job = jobs.get(input.jobId);

      if (
        job === undefined ||
        job.status !== "In Progress" ||
        job.lease?.id !== input.leaseId
      ) {
        return false;
      }

      job.status = "Completed";
      job.lease = undefined;
      job.outputArtifactId = input.outputArtifactId;
      job.progress = input.progress;
      return true;
    },
    async markFailed(input) {
      const job = jobs.get(input.jobId);

      if (
        job === undefined ||
        job.status !== "In Progress" ||
        job.lease?.id !== input.leaseId
      ) {
        return false;
      }

      job.status = "Failed";
      job.lease = undefined;
      return true;
    },
    async recordOperationResult(input) {
      const job = jobs.get(input.jobId);

      if (
        job === undefined ||
        job.status !== "In Progress" ||
        job.lease?.id !== input.leaseId
      ) {
        return false;
      }

      const operationKey = `${input.rowIndex}:${input.operationIndex}`;

      if (job.completedOperationKeys.has(operationKey)) {
        return true;
      }

      job.completedOperationKeys.add(operationKey);
      job.progress.completed += 1;
      job.progress.failed += input.failed ? 1 : 0;
      job.progress.remaining = job.progress.total - job.progress.completed;
      return true;
    },
  };
}

function summaryOf(job: StoredJob): EnrichmentJobSummary {
  return {
    id: job.snapshot.id,
    kind: job.kind,
    fileName: job.snapshot.sourceList.fileName,
    status: job.status,
    progress: job.progress,
  };
}

function pendingProgressFor(job: JobSnapshot): EnrichmentJobProgress {
  const total = job.sourceList.rows.length * job.configuredOperations.length;

  return {
    total,
    completed: 0,
    failed: 0,
    remaining: total,
  };
}
