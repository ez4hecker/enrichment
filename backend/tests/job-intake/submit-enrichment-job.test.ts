import { describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "../../src/composition/in-memory-job-store.js";
import {
  dispatchPendingEnrichmentJobs,
  submitEnrichmentJob as submit,
  type JobIntakeDependencies,
  type SubmitEnrichmentJobInput,
} from "../../src/job-intake/submit-enrichment-job.js";

function submitEnrichmentJob(
  input: Omit<SubmitEnrichmentJobInput, "ownerId">,
  dependencies?: JobIntakeDependencies,
) {
  return submit({ ownerId: "owner-1", ...input }, dependencies);
}

describe("Job Intake", () => {
  it("rejects a Source List with inconsistent column counts", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name,first_name\nAcme Inc.,Ada\nGlobex LLC\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "company_name_cleaned",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "INCONSISTENT_COLUMN_COUNT",
          row: 3,
          expectedColumnCount: 2,
          actualColumnCount: 1,
        },
      ],
    });
  });

  it("accepts a valid Source List as a Job Snapshot without blank rows", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name,first_name\nAcme Inc.,Ada\n\nGlobex LLC,Bob\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "company_name_cleaned",
        },
      ],
    });

    expect(result).toMatchObject({
      status: "Accepted",
      job: {
        sourceList: {
          fileName: "contacts.csv",
          sourceFields: ["company_name", "first_name"],
          rows: [
            ["Acme Inc.", "Ada"],
            ["Globex LLC", "Bob"],
          ],
        },
        configuredOperations: [
          {
            kind: "clean-company-name",
            input: { kind: "source-field", field: "company_name" },
            generatedField: "company_name_cleaned",
          },
        ],
      },
    });

    if (result.status === "Accepted") {
      expect(result.job.id).toEqual(expect.any(String));
    }
  });

  it("rejects a Configured Operation that references a missing Source Field", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "website" },
          generatedField: "company_name_cleaned",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNKNOWN_SOURCE_FIELD",
          sourceField: "website",
        },
      ],
    });
  });

  it("rejects Configured Operations that would create duplicate Generated Fields", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name,website\nAcme Inc.,acme.example\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "normalized",
        },
        {
          kind: "format-website",
          input: { kind: "source-field", field: "website" },
          generatedField: "normalized",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "DUPLICATE_GENERATED_FIELD",
          generatedField: "normalized",
        },
      ],
    });
  });

  it("rejects a Source List with an unterminated quoted field", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: 'company_name\n"Acme Inc.\n',
      },
      configuredOperations: [],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "INVALID_CSV",
          message: "CSV contains an unterminated quoted field",
        },
      ],
    });
  });

  it("rejects a Generated Field that would collide with a Source Field", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "company_name",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "GENERATED_FIELD_CONFLICTS_WITH_SOURCE_FIELD",
          generatedField: "company_name",
        },
      ],
    });
  });

  it("rejects a generated-field input that has no earlier producer in the job", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "email\nada@acme.example\n",
      },
      configuredOperations: [
        {
          kind: "format-website",
          input: { kind: "generated-field", field: "email_domain" },
          generatedField: "company_website",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNAVAILABLE_GENERATED_FIELD",
          generatedField: "email_domain",
        },
      ],
    });
  });

  it("retains user-selected Column Mappings in the accepted Job Snapshot", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company,contact\nAcme Inc.,Ada Lovelace\n",
      },
      columnMappings: [
        { sourceField: "company", canonicalDataType: "company-name" },
        { sourceField: "contact", canonicalDataType: "first-name" },
      ],
      configuredOperations: [],
    });

    expect(result).toMatchObject({
      status: "Accepted",
      job: {
        columnMappings: [
          { sourceField: "company", canonicalDataType: "company-name" },
          { sourceField: "contact", canonicalDataType: "first-name" },
        ],
      },
    });
  });

  it("rejects a Column Mapping that references a missing Source Field", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company\nAcme Inc.\n",
      },
      columnMappings: [
        { sourceField: "website", canonicalDataType: "website" },
      ],
      configuredOperations: [],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNKNOWN_MAPPING_SOURCE_FIELD",
          sourceField: "website",
        },
      ],
    });
  });

  it("stores an accepted Job Snapshot before dispatching only its identity", async () => {
    const storedSnapshots: Array<unknown> = [];
    const dispatchedJobIds: Array<string> = [];
    const result = await submitEnrichmentJob(
      {
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      {
        jobSnapshotStore: {
          async store(snapshot) {
            storedSnapshots.push(snapshot);
          },
        },
        jobDispatcher: {
          async dispatch(jobId) {
            dispatchedJobIds.push(jobId);
          },
        },
      },
    );

    expect(result).toMatchObject({ status: "Accepted" });

    if (result.status !== "Accepted") {
      throw new Error("Expected the Job Snapshot to be accepted");
    }

    expect(storedSnapshots).toEqual([result.job]);
    expect(dispatchedJobIds).toEqual([result.job.id]);
  });

  it("accepts a stored Job Snapshot when immediate dispatch is unavailable", async () => {
    const storedSnapshots: Array<unknown> = [];
    const result = await submitEnrichmentJob(
      {
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      {
        jobSnapshotStore: {
          async store(snapshot) {
            storedSnapshots.push(snapshot);
          },
        },
        jobDispatcher: {
          async dispatch() {
            throw new Error("Queue is unavailable");
          },
        },
      },
    );

    expect(result).toMatchObject({ status: "Accepted" });

    if (result.status !== "Accepted") {
      throw new Error("Expected the stored Enrichment Job to be accepted");
    }

    expect(storedSnapshots).toEqual([result.job]);
  });

  it("later dispatches a stored Enrichment Job after immediate queue delivery fails", async () => {
    const dispatchedJobIds: Array<string> = [];
    let queueIsAvailable = false;
    const dispatch = async (jobId: string) => {
      if (!queueIsAvailable) {
        throw new Error("Queue is unavailable");
      }

      dispatchedJobIds.push(jobId);
    };
    const jobStore = createInMemoryJobStore();
    const submission = await submitEnrichmentJob(
      {
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [],
      },
      {
        jobSnapshotStore: jobStore,
        jobDispatchIntentStore: jobStore,
        jobDispatcher: { dispatch },
      },
    );

    if (submission.status !== "Accepted") {
      throw new Error("Expected the Enrichment Job to be accepted");
    }

    queueIsAvailable = true;

    await expect(
      dispatchPendingEnrichmentJobs({
        jobDispatchIntentStore: jobStore,
        jobDispatcher: { dispatch },
      }),
    ).resolves.toEqual({ dispatchedJobIds: [submission.job.id] });
    await expect(
      dispatchPendingEnrichmentJobs({
        jobDispatchIntentStore: jobStore,
        jobDispatcher: { dispatch },
      }),
    ).resolves.toEqual({ dispatchedJobIds: [] });
  });

  it("rejects a Custom Operation Prompt Template with an unbound variable", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          name: "Company category",
          promptTemplate: "Classify {company_name} for {market}.",
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
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNBOUND_PROMPT_VARIABLE",
          variable: "market",
        },
      ],
    });
  });

  it("rejects a Custom Operation whose Prompt Template references no row input", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          name: "recent funded",
          promptTemplate: "findout if they are recently funded company",
          expectedOutputType: "Text",
          inputBindings: [],
          generatedField: "fund",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "PROMPT_REFERENCES_NO_INPUT",
          generatedField: "fund",
        },
      ],
    });
  });

  it("rejects a Generation Custom Operation whose model is not in the Generation Model catalog", async () => {
    const result = await submitEnrichmentJob({
      sourceList: {
        fileName: "contacts.csv",
        csv: "first_name\nJane\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          name: "Ice breaker",
          promptTemplate: "Write an ice breaker for {first_name}.",
          expectedOutputType: "Text",
          generationModel: "gpt-5.5-pro",
          inputBindings: [
            {
              variable: "first_name",
              input: { kind: "source-field", field: "first_name" },
            },
          ],
          generatedField: "ice_breaker",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNKNOWN_GENERATION_MODEL",
          generatedField: "ice_breaker",
          generationModel: "gpt-5.5-pro",
        },
      ],
    });
  });

  it("rejects a library Custom Operation Definition owned by someone else", async () => {
    const result = await submit({
      ownerId: "owner-1",
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          definition: {
            id: "a65ed204-2bd8-478c-958c-ffb4724a1f6a",
            ownerId: "owner-2",
            name: "Company category",
            promptTemplate: "Classify {company_name}.",
            expectedOutputType: "Text",
            version: 1,
          },
          inputBindings: [
            {
              variable: "company_name",
              input: { kind: "source-field", field: "company_name" },
            },
          ],
          generatedField: "company_category",
        },
      ],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [{ code: "UNAUTHORIZED_CUSTOM_OPERATION" }],
    });
  });
});
