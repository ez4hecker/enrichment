import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

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
  JobDispatchIntentStore,
  JobSnapshot,
  JobSnapshotStore,
} from "../job-intake/submit-enrichment-job.js";

export type PostgresJobStore =
  & JobSnapshotStore
  & JobDispatchIntentStore
  & JobHistoryStore
  & SavedPreviewStore
  & JobExecutionStore;

export type PostgresJobStoreOptions = {
  pool: Pick<Pool, "query">;
  leaseDurationMilliseconds?: number;
};

type JobSummaryRow = {
  id: string;
  kind: string | null;
  file_name: string | null;
  status: EnrichmentJobStatus;
  total_operations: number;
  completed_operations: number;
  failed_operations: number;
  remaining_operations: number;
};

export function createPostgresJobStore(
  options: PostgresJobStoreOptions,
): PostgresJobStore {
  const leaseDurationMilliseconds = options.leaseDurationMilliseconds ?? 300_000;

  return {
    async store(job) {
      const totalOperationCount =
        job.sourceList.rows.length * job.configuredOperations.length;

      await options.pool.query(
        `INSERT INTO enrichment_jobs (
          id, owner_id, snapshot, status, dispatch_pending,
          total_operations, completed_operations, failed_operations, remaining_operations
        ) VALUES ($1, $2, $3::jsonb, 'Queued', TRUE, $4, 0, 0, $4)`,
        [job.id, job.ownerId, JSON.stringify(job), totalOperationCount],
      );
    },
    async storeSavedPreview(preview) {
      // A saved preview reuses the job table as an already-Completed entry. Its snapshot only
      // carries what Job History reads; it is never claimed because it is never Queued.
      await options.pool.query(
        `INSERT INTO enrichment_jobs (
          id, owner_id, snapshot, status, dispatch_pending, output_artifact_id,
          total_operations, completed_operations, failed_operations, remaining_operations
        ) VALUES ($1, $2, $3::jsonb, 'Completed', FALSE, $4, $5, $5, 0, 0)`,
        [
          preview.id,
          preview.ownerId,
          JSON.stringify({
            kind: "Preview",
            id: preview.id,
            ownerId: preview.ownerId,
            sourceList: { fileName: preview.fileName },
          }),
          preview.outputArtifactId,
          preview.rowCount,
        ],
      );
    },
    async listPendingJobIds() {
      const result = await options.pool.query<{ id: string }>(
        `SELECT id
         FROM enrichment_jobs
         WHERE dispatch_pending = TRUE
         ORDER BY created_at ASC`,
      );

      return result.rows.map((row) => row.id);
    },
    async markDispatched(jobId) {
      const result = await options.pool.query(
        `UPDATE enrichment_jobs
         SET dispatch_pending = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId],
      );

      if (result.rowCount === 0) {
        throw new Error("Enrichment Job does not exist");
      }
    },
    async listByOwner(ownerId) {
      const result = await options.pool.query<JobSummaryRow>(
        `SELECT ${jobSummaryColumns}
         FROM enrichment_jobs
         WHERE owner_id = $1
         ORDER BY created_at ASC`,
        [ownerId],
      );

      return result.rows.map(toEnrichmentJobSummary);
    },
    async findByOwner(ownerId, jobId) {
      const result = await options.pool.query<JobSummaryRow>(
        `SELECT ${jobSummaryColumns}
         FROM enrichment_jobs
         WHERE owner_id = $1 AND id = $2`,
        [ownerId, jobId],
      );

      return result.rows[0] === undefined
        ? undefined
        : toEnrichmentJobSummary(result.rows[0]);
    },
    async findCompletedOutputArtifactIdByOwner(ownerId, jobId) {
      const result = await options.pool.query<{ output_artifact_id: string }>(
        `SELECT output_artifact_id
         FROM enrichment_jobs
         WHERE owner_id = $1
           AND id = $2
           AND status = 'Completed'`,
        [ownerId, jobId],
      );

      return result.rows[0]?.output_artifact_id;
    },
    async readStatus(jobId) {
      const result = await options.pool.query<{ status: EnrichmentJobStatus }>(
        "SELECT status FROM enrichment_jobs WHERE id = $1",
        [jobId],
      );

      return result.rows[0]?.status;
    },
    async claimQueued(jobId) {
      const leaseId = randomUUID();
      const result = await options.pool.query<{ snapshot: unknown }>(
        `UPDATE enrichment_jobs
         SET status = 'In Progress',
             lease_id = $2,
             lease_expires_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND (
             status = 'Queued'
             OR (status = 'In Progress' AND lease_expires_at <= CURRENT_TIMESTAMP)
           )
         RETURNING snapshot`,
        [jobId, leaseId, leaseDurationMilliseconds],
      );

      return result.rows[0] === undefined
        ? undefined
        : { job: parseJobSnapshot(result.rows[0].snapshot), leaseId };
    },
    async markCompleted(input) {
      const result = await options.pool.query(
        `UPDATE enrichment_jobs
         SET status = 'Completed',
             lease_id = NULL,
             lease_expires_at = NULL,
             output_artifact_id = $3,
             total_operations = $4,
             completed_operations = $5,
             failed_operations = $6,
             remaining_operations = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'In Progress'
           AND lease_id = $2`,
        [
          input.jobId,
          input.leaseId,
          input.outputArtifactId,
          input.progress.total,
          input.progress.completed,
          input.progress.failed,
          input.progress.remaining,
        ],
      );

      return result.rowCount === 1;
    },
    async markFailed(input) {
      const result = await options.pool.query(
        `UPDATE enrichment_jobs
         SET status = 'Failed',
             lease_id = NULL,
             lease_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'In Progress'
           AND lease_id = $2`,
        [input.jobId, input.leaseId],
      );

      return result.rowCount === 1;
    },
    async recordOperationResult(input) {
      const result = await options.pool.query(
        `WITH active_job AS (
           SELECT id
           FROM enrichment_jobs
           WHERE id = $1
             AND status = 'In Progress'
             AND lease_id = $2
         ),
         inserted_result AS (
           INSERT INTO enrichment_job_operation_results (
             job_id, row_index, operation_index, failed
           ) SELECT $1, $3, $4, $5
             FROM active_job
           ON CONFLICT DO NOTHING
           RETURNING failed
         )
         UPDATE enrichment_jobs
         SET completed_operations = completed_operations + (
               SELECT COUNT(*)::INTEGER FROM inserted_result
             ),
             failed_operations = failed_operations + COALESCE(
               (SELECT SUM(CASE WHEN failed THEN 1 ELSE 0 END)::INTEGER FROM inserted_result),
               0
             ),
             remaining_operations = remaining_operations - (
               SELECT COUNT(*)::INTEGER FROM inserted_result
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'In Progress'
           AND lease_id = $2`,
        [
          input.jobId,
          input.leaseId,
          input.rowIndex,
          input.operationIndex,
          input.failed,
        ],
      );

      return result.rowCount === 1;
    },
  };
}

const jobSummaryColumns = `id, snapshot->>'kind' AS kind,
                snapshot->'sourceList'->>'fileName' AS file_name,
                status, total_operations, completed_operations,
                failed_operations, remaining_operations`;

function toEnrichmentJobSummary(row: JobSummaryRow): EnrichmentJobSummary {
  const kind: JobHistoryEntryKind = row.kind === "Preview" ? "Preview" : "Job";

  return {
    id: row.id,
    kind,
    fileName: row.file_name ?? "",
    status: row.status,
    progress: {
      total: row.total_operations,
      completed: row.completed_operations,
      failed: row.failed_operations,
      remaining: row.remaining_operations,
    },
  };
}

function parseJobSnapshot(value: unknown): JobSnapshot {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;

  return structuredClone(parsed as JobSnapshot);
}
