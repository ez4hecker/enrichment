import { describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "../../src/composition/in-memory-job-store.js";
import { createInMemoryOutputArtifactStore } from "../../src/composition/in-memory-output-artifact-store.js";
import { createEnrichmentExecutionProcessor } from "../../src/delivery/enrichment-job-worker.js";
import { listEnrichmentJobs } from "../../src/job-history/list-enrichment-jobs.js";
import { submitEnrichmentJob } from "../../src/job-intake/submit-enrichment-job.js";

describe("Enrichment Job worker delivery", () => {
  it("executes a queued Enrichment Job using only its queue identity", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
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
      { jobSnapshotStore: jobStore },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected valid Enrichment Job to be accepted");
    }

    const processor = createEnrichmentExecutionProcessor({
      jobExecutionStore: jobStore,
      outputArtifactStore,
    });

    await processor({ data: { jobId: submission.job.id } });

    await expect(
      listEnrichmentJobs(
        { ownerId: "owner-1" },
        { jobHistoryStore: jobStore },
      ),
    ).resolves.toEqual({
      jobs: [
        {
          id: submission.job.id,
          kind: "Job",
          fileName: "contacts.csv",
          status: "Completed",
          progress: { total: 1, completed: 1, failed: 0, remaining: 0 },
        },
      ],
    });
  });
});
