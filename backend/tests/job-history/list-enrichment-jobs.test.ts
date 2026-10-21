import { describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "../../src/composition/in-memory-job-store.js";
import { createInMemoryOutputArtifactStore } from "../../src/composition/in-memory-output-artifact-store.js";
import {
  executeQueuedEnrichmentJob,
  UnrecoverableEnrichmentJobError,
} from "../../src/job-execution/execute-queued-enrichment-job.js";
import {
  listEnrichmentJobs,
  requestEnrichedList,
} from "../../src/job-history/list-enrichment-jobs.js";
import { submitEnrichmentJob } from "../../src/job-intake/submit-enrichment-job.js";

describe("Job History", () => {
  it("shows a queued Enrichment Job only to its Owner", async () => {
    const jobStore = createInMemoryJobStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      { jobSnapshotStore: jobStore },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

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
          status: "Queued",
          progress: { total: 0, completed: 0, failed: 0, remaining: 0 },
        },
      ],
    });
    await expect(
      listEnrichmentJobs(
        { ownerId: "owner-2" },
        { jobHistoryStore: jobStore },
      ),
    ).resolves.toEqual({ jobs: [] });
  });

  it("shows Completed only after worker execution stores the Enriched List", async () => {
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
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    await expect(
      executeQueuedEnrichmentJob(
        { jobId: submission.job.id },
        { jobExecutionStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
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
    await expect(
      requestEnrichedList(
        { ownerId: "owner-1", jobId: submission.job.id },
        { jobHistoryStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({
      status: "Available",
      output: {
        fileName: "contacts_enriched.csv",
        csv: ["company_name,company_name_cleaned", "Acme Inc.,Acme", ""].join("\n"),
      },
    });
    await expect(
      requestEnrichedList(
        { ownerId: "owner-2", jobId: submission.job.id },
        { jobHistoryStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({ status: "Unavailable" });
  });

  it("returns the existing Completed status when delivery repeats", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      { jobSnapshotStore: jobStore },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    await executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      { jobExecutionStore: jobStore, outputArtifactStore },
    );

    await expect(
      executeQueuedEnrichmentJob(
        { jobId: submission.job.id },
        { jobExecutionStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
  });

  it("returns In Progress when delivery repeats while a worker holds the Enrichment Job", async () => {
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
            kind: "custom-operation",
            name: "Company category",
            promptTemplate: "Classify {company_name} using one category.",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "company_category",
          },
        ],
      },
      { jobSnapshotStore: jobStore },
    );
    let notifyProviderStarted: () => void = () => undefined;
    let completeProvider: (value: string) => void = () => undefined;
    const providerStarted = new Promise<void>((resolve) => {
      notifyProviderStarted = resolve;
    });
    const providerResponse = new Promise<string>((resolve) => {
      completeProvider = resolve;
    });

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    const firstDelivery = executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      {
        jobExecutionStore: jobStore,
        outputArtifactStore,
        customOperationProvider: {
          async execute() {
            notifyProviderStarted();
            return providerResponse;
          },
        },
      },
    );
    await providerStarted;

    await expect(
      executeQueuedEnrichmentJob(
        { jobId: submission.job.id },
        { jobExecutionStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({
      jobId: submission.job.id,
      status: "In Progress",
    });

    completeProvider("Technology");

    await expect(firstDelivery).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
  });

  it("recovers an expired worker claim without replacing the completed Output Artifact", async () => {
    let now = 0;
    const jobStore = createInMemoryJobStore({
      now: () => now,
      leaseDurationMilliseconds: 60_000,
    });
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
            kind: "custom-operation",
            name: "Company category",
            promptTemplate: "Classify {company_name} using one category.",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "company_category",
          },
        ],
      },
      { jobSnapshotStore: jobStore },
    );
    let notifyFirstProviderStarted: () => void = () => undefined;
    let completeFirstProvider: (value: string) => void = () => undefined;
    const firstProviderStarted = new Promise<void>((resolve) => {
      notifyFirstProviderStarted = resolve;
    });
    const firstProviderResponse = new Promise<string>((resolve) => {
      completeFirstProvider = resolve;
    });

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    const abandonedDelivery = executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      {
        jobExecutionStore: jobStore,
        outputArtifactStore,
        customOperationProvider: {
          async execute() {
            notifyFirstProviderStarted();
            return firstProviderResponse;
          },
        },
      },
    );
    await firstProviderStarted;
    now = 60_001;

    await expect(
      executeQueuedEnrichmentJob(
        { jobId: submission.job.id },
        {
          jobExecutionStore: jobStore,
          outputArtifactStore,
          customOperationProvider: {
            async execute() {
              return "Technology";
            },
          },
        },
      ),
    ).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });

    completeFirstProvider("Outdated category");

    await expect(abandonedDelivery).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
    await expect(
      requestEnrichedList(
        { ownerId: "owner-1", jobId: submission.job.id },
        { jobHistoryStore: jobStore, outputArtifactStore },
      ),
    ).resolves.toEqual({
      status: "Available",
      output: {
        fileName: "contacts_enriched.csv",
        csv: [
          "company_name,company_category",
          "Acme Inc.,Technology",
          "",
        ].join("\n"),
      },
    });
  });

  it("does not double-count a checkpointed Row-Operation Result after lease recovery", async () => {
    let now = 0;
    const jobStore = createInMemoryJobStore({
      now: () => now,
      leaseDurationMilliseconds: 60_000,
    });
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
            kind: "custom-operation",
            name: "First category",
            promptTemplate: "First {company_name}",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "first_category",
          },
          {
            kind: "custom-operation",
            name: "Second category",
            promptTemplate: "Second {company_name}",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "second_category",
          },
        ],
      },
      { jobSnapshotStore: jobStore },
    );
    let releaseAbandonedSecond: (value: string) => void = () => undefined;
    let notifyAbandonedSecondStarted: () => void = () => undefined;
    const abandonedSecondStarted = new Promise<void>((resolve) => {
      notifyAbandonedSecondStarted = resolve;
    });
    const abandonedSecond = new Promise<string>((resolve) => {
      releaseAbandonedSecond = resolve;
    });

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    const abandonedDelivery = executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      {
        jobExecutionStore: jobStore,
        outputArtifactStore,
        customOperationProvider: {
          async execute(request) {
            if (request.prompt.startsWith("First")) {
              return "Original first category";
            }

            notifyAbandonedSecondStarted();
            return abandonedSecond;
          },
        },
      },
    );
    await abandonedSecondStarted;
    now = 60_001;

    let releaseRecoveredSecond: (value: string) => void = () => undefined;
    let notifyRecoveredSecondStarted: () => void = () => undefined;
    const recoveredSecondStarted = new Promise<void>((resolve) => {
      notifyRecoveredSecondStarted = resolve;
    });
    const recoveredSecond = new Promise<string>((resolve) => {
      releaseRecoveredSecond = resolve;
    });
    const recoveredDelivery = executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      {
        jobExecutionStore: jobStore,
        outputArtifactStore,
        customOperationProvider: {
          async execute(request) {
            if (request.prompt.startsWith("First")) {
              return "Recovered first category";
            }

            notifyRecoveredSecondStarted();
            return recoveredSecond;
          },
        },
      },
    );
    await recoveredSecondStarted;

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
          status: "In Progress",
          progress: { total: 2, completed: 1, failed: 0, remaining: 1 },
        },
      ],
    });

    releaseRecoveredSecond("Recovered second category");

    await expect(recoveredDelivery).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });

    releaseAbandonedSecond("Abandoned second category");
    await expect(abandonedDelivery).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
  });

  it("reports completed and failed Row-Operation Results in Job History progress", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
        sourceList: {
          fileName: "contacts.csv",
          csv: "email\nada@acme.example\nnot-an-email\n",
        },
        configuredOperations: [
          {
            kind: "extract-domain-from-email",
            input: { kind: "source-field", field: "email" },
            generatedField: "email_domain",
          },
        ],
      },
      { jobSnapshotStore: jobStore },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    await executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      { jobExecutionStore: jobStore, outputArtifactStore },
    );

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
          progress: {
            total: 2,
            completed: 2,
            failed: 1,
            remaining: 0,
          },
        },
      ],
    });
  });

  it("updates Job Progress while a worker still has Row-Operation Results remaining", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\nGlobex LLC\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Company category",
            promptTemplate: "Classify {company_name} using one category.",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "company_category",
          },
        ],
      },
      { jobSnapshotStore: jobStore },
    );
    let notifySecondResultStarted: () => void = () => undefined;
    let completeSecondResult: (value: string) => void = () => undefined;
    const secondResultStarted = new Promise<void>((resolve) => {
      notifySecondResultStarted = resolve;
    });
    const secondResult = new Promise<string>((resolve) => {
      completeSecondResult = resolve;
    });

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    const delivery = executeQueuedEnrichmentJob(
      { jobId: submission.job.id },
      {
        jobExecutionStore: jobStore,
        outputArtifactStore,
        customOperationProvider: {
          async execute(request) {
            if (request.prompt.includes("Globex")) {
              await Promise.resolve();
              notifySecondResultStarted();
              return secondResult;
            }

            return true;
          },
        },
      },
    );
    await secondResultStarted;

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
          status: "In Progress",
          progress: { total: 2, completed: 1, failed: 1, remaining: 1 },
        },
      ],
    });

    completeSecondResult("Technology");

    await expect(delivery).resolves.toEqual({
      jobId: submission.job.id,
      status: "Completed",
    });
  });

  it("marks an Enrichment Job Failed without exposing an Enriched List after an unrecoverable worker failure", async () => {
    const jobStore = createInMemoryJobStore();
    const submission = await submitEnrichmentJob(
      {
        ownerId: "owner-1",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      { jobSnapshotStore: jobStore },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    await expect(
      executeQueuedEnrichmentJob(
        { jobId: submission.job.id },
        {
          jobExecutionStore: jobStore,
          outputArtifactStore: {
            async store() {
              throw new UnrecoverableEnrichmentJobError(
                "Storage failure for C:/sensitive/customer-output.csv",
              );
            },
            async read() {
              return undefined;
            },
          },
        },
      ),
    ).resolves.toEqual({
      jobId: submission.job.id,
      status: "Failed",
    });
    await expect(
      listEnrichmentJobs(
        { ownerId: "owner-1" },
        { jobHistoryStore: jobStore },
      ),
    ).resolves.toMatchObject({
      jobs: [{ id: submission.job.id, status: "Failed" }],
    });
    await expect(
      requestEnrichedList(
        {
          ownerId: "owner-1",
          jobId: submission.job.id,
        },
        {
          jobHistoryStore: jobStore,
          outputArtifactStore: createInMemoryOutputArtifactStore(),
        },
      ),
    ).resolves.toEqual({ status: "Unavailable" });
  });
});
