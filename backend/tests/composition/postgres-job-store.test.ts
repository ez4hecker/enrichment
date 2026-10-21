import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createPostgresJobStore } from "../../src/composition/postgres-job-store.js";
import { submitEnrichmentJob } from "../../src/job-intake/submit-enrichment-job.js";

const databaseUrl = process.env.CSV_ENRICHMENT_TEST_DATABASE_URL;
const integrationIt = databaseUrl === undefined ? it.skip : it;

describe("Postgres Enrichment Job Store", () => {
  integrationIt("persists one job across intake, dispatch, execution, and Job History", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const ownerId = `integration-owner-${randomUUID()}`;
    const store = createPostgresJobStore({ pool });

    try {
      const submission = await submitEnrichmentJob(
        {
          ownerId,
          sourceList: {
            fileName: "contacts.csv",
            csv: "company_name\nAcme Inc.\n",
          },
          configuredOperations: [
            {
              kind: "clean-company-name",
              input: { kind: "source-field", field: "company_name" },
              generatedField: "company_name_cleaned",
            },
          ],
        },
        { jobSnapshotStore: store },
      );

      if (submission.status !== "Accepted") {
        throw new Error("Expected valid Enrichment Job to be accepted");
      }

      const jobId = submission.job.id;
      const claim = await store.claimQueued(jobId);

      expect(await store.listPendingJobIds()).toContain(jobId);
      expect(claim?.job).toMatchObject({ id: jobId, ownerId });
      expect(claim?.leaseId).toEqual(expect.any(String));

      if (claim === undefined) {
        throw new Error("Expected queued Enrichment Job to be claimed");
      }

      await expect(
        store.recordOperationResult({
          jobId,
          leaseId: claim.leaseId,
          rowIndex: 0,
          operationIndex: 0,
          failed: false,
        }),
      ).resolves.toBe(true);
      await expect(
        store.markCompleted({
          jobId,
          leaseId: claim.leaseId,
          outputArtifactId: randomUUID(),
          progress: { total: 1, completed: 1, failed: 0, remaining: 0 },
        }),
      ).resolves.toBe(true);
      await expect(store.listByOwner(ownerId)).resolves.toEqual([
        {
          id: jobId,
          kind: "Job",
          fileName: "contacts.csv",
          status: "Completed",
          progress: { total: 1, completed: 1, failed: 0, remaining: 0 },
        },
      ]);
    } finally {
      await pool.query("DELETE FROM enrichment_jobs WHERE owner_id = $1", [ownerId]);
      await pool.end();
    }
  });

  integrationIt("does not let a stale lease create a Row-Operation checkpoint", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const ownerId = `integration-owner-${randomUUID()}`;
    const store = createPostgresJobStore({
      pool,
      leaseDurationMilliseconds: 1,
    });

    try {
      const submission = await submitEnrichmentJob(
        {
          ownerId,
          sourceList: {
            fileName: "contacts.csv",
            csv: "company_name\nAcme Inc.\n",
          },
          configuredOperations: [
            {
              kind: "clean-company-name",
              input: { kind: "source-field", field: "company_name" },
              generatedField: "company_name_cleaned",
            },
          ],
        },
        { jobSnapshotStore: store },
      );

      if (submission.status !== "Accepted") {
        throw new Error("Expected valid Enrichment Job to be accepted");
      }

      const firstClaim = await store.claimQueued(submission.job.id);
      await pool.query("SELECT pg_sleep(0.01)");
      const recoveredClaim = await store.claimQueued(submission.job.id);

      if (firstClaim === undefined || recoveredClaim === undefined) {
        throw new Error("Expected the Enrichment Job to be reclaimed");
      }

      await expect(
        store.recordOperationResult({
          jobId: submission.job.id,
          leaseId: firstClaim.leaseId,
          rowIndex: 0,
          operationIndex: 0,
          failed: false,
        }),
      ).resolves.toBe(false);
      await expect(
        store.recordOperationResult({
          jobId: submission.job.id,
          leaseId: recoveredClaim.leaseId,
          rowIndex: 0,
          operationIndex: 0,
          failed: false,
        }),
      ).resolves.toBe(true);
      await expect(store.listByOwner(ownerId)).resolves.toEqual([
        {
          id: submission.job.id,
          kind: "Job",
          fileName: "contacts.csv",
          status: "In Progress",
          progress: { total: 1, completed: 1, failed: 0, remaining: 0 },
        },
      ]);
    } finally {
      await pool.query("DELETE FROM enrichment_jobs WHERE owner_id = $1", [ownerId]);
      await pool.end();
    }
  });
});
