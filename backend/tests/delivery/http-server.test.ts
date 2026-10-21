import { afterEach, describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "../../src/composition/in-memory-job-store.js";
import { createInMemoryOutputArtifactStore } from "../../src/composition/in-memory-output-artifact-store.js";
import { createHttpServer } from "../../src/delivery/http-server.js";
import { executeQueuedEnrichmentJob } from "../../src/job-execution/execute-queued-enrichment-job.js";
import { listEnrichmentJobs } from "../../src/job-history/list-enrichment-jobs.js";
import { createOperationLibrary } from "../../src/operation-library/operation-library.js";

describe("HTTP delivery", () => {
  const servers: Array<ReturnType<typeof createHttpServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("accepts an Owner's Enrichment Job through HTTP and returns its queued identity", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
      payload: {
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
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      status: "Queued",
      jobId: expect.any(String),
    });
    await expect(
      listEnrichmentJobs(
        { ownerId: "owner-1" },
        { jobHistoryStore: jobStore },
      ),
    ).resolves.toEqual({
      jobs: [
        {
          id: response.json().jobId,
          kind: "Job",
          fileName: "contacts.csv",
          status: "Queued",
          progress: { total: 1, completed: 0, failed: 0, remaining: 1 },
        },
      ],
    });
  });

  it("previews Configured Operations on selected rows without queuing an Enrichment Job", async () => {
    const jobStore = createInMemoryJobStore();
    const prompts: Array<string> = [];
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore: createInMemoryOutputArtifactStore(),
      },
      operationLibrary: createOperationLibrary(),
      customOperationProvider: {
        async execute(request) {
          prompts.push(request.prompt);
          return "Series F, $400M, Feb 2021";
        },
      },
    });
    servers.push(server);
    const configuredOperations = [
      {
        kind: "custom-operation",
        name: "AI Research",
        promptTemplate: "Company: {company}\nQuestion: What was the last funding they got?",
        expectedOutputType: "Text",
        inputBindings: [
          { variable: "company", input: { kind: "source-field", field: "Company Name" } },
        ],
        generatedField: "Last Funding",
      },
    ];

    const response = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/preview",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        sourceList: { fileName: "contacts.csv", csv: "Company Name\nToast\n" },
        configuredOperations,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      rows: [{ "Last Funding": "Series F, $400M, Feb 2021" }],
    });
    expect(prompts).toEqual([
      "Company: Toast\nQuestion: What was the last funding they got?",
    ]);
    await expect(
      listEnrichmentJobs({ ownerId: "owner-1" }, { jobHistoryStore: jobStore }),
    ).resolves.toEqual({ jobs: [] });

    const tooManyRows = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/preview",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        sourceList: { fileName: "contacts.csv", csv: "Company Name\nA\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\n" },
        configuredOperations,
      },
    });

    expect(tooManyRows.statusCode).toBe(400);
    expect(tooManyRows.json()).toEqual({ code: "PREVIEW_TOO_MANY_ROWS", maximumRows: 10 });
  });

  it("accepts a multi-megabyte Source List through HTTP", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        sourceList: {
          fileName: "large-contacts.csv",
          csv: `company_name\n${"Acme ".repeat(350_000)}\n`,
        },
        configuredOperations: [],
      },
    });

    expect(response.statusCode).toBe(202);
  });

  it("shows an Owner their queued Enrichment Jobs through HTTP", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const submission = await server.inject({
      method: "POST",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
      payload: {
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
    });

    const response = await server.inject({
      method: "GET",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
    });

    expect(submission.statusCode).toBe(202);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      jobs: [
        {
          id: submission.json().jobId,
          kind: "Job",
          fileName: "contacts.csv",
          status: "Queued",
          progress: { total: 1, completed: 0, failed: 0, remaining: 1 },
        },
      ],
    });
  });

  it("lets only the Owner download a completed Enriched List", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const submission = await server.inject({
      method: "POST",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
      payload: {
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
    });
    const jobId = submission.json().jobId as string;

    await executeQueuedEnrichmentJob(
      { jobId },
      { jobExecutionStore: jobStore, outputArtifactStore },
    );

    const ownerResponse = await server.inject({
      method: "GET",
      url: `/enrichment-jobs/${jobId}/enriched-list`,
      headers: { "x-owner-id": "owner-1" },
    });
    const otherOwnerResponse = await server.inject({
      method: "GET",
      url: `/enrichment-jobs/${jobId}/enriched-list`,
      headers: { "x-owner-id": "owner-2" },
    });

    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.headers["content-type"]).toContain("text/csv");
    expect(ownerResponse.headers["content-disposition"]).toContain(
      'filename="contacts_enriched.csv"',
    );
    expect(ownerResponse.body).toBe(
      "company_name,company_name_cleaned\nAcme Inc.,Acme\n",
    );
    expect(otherOwnerResponse.statusCode).toBe(404);
  });

  it("saves preview answers to the Owner's Job History under the uploaded file name", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      saveEnrichmentPreviewDependencies: {
        savedPreviewStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const saved = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/previews",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        fileName: "leads.csv",
        csv: "Company Name,Last funding?\nToast,\"Series F, $400M\"\nAcme,[Not Found]\n",
      },
    });

    expect(saved.statusCode).toBe(201);
    const jobId = saved.json().jobId as string;

    const history = await server.inject({
      method: "GET",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-1" },
    });
    expect(history.json()).toEqual({
      jobs: [
        {
          id: jobId,
          kind: "Preview",
          fileName: "leads.csv",
          status: "Completed",
          progress: { total: 2, completed: 2, failed: 0, remaining: 0 },
        },
      ],
    });

    const download = await server.inject({
      method: "GET",
      url: `/enrichment-jobs/${jobId}/enriched-list`,
      headers: { "x-owner-id": "owner-1" },
    });
    expect(download.headers["content-disposition"]).toContain('filename="leads_preview.csv"');
    expect(download.body).toBe(
      "Company Name,Last funding?\nToast,\"Series F, $400M\"\nAcme,[Not Found]\n",
    );

    const otherOwnerHistory = await server.inject({
      method: "GET",
      url: "/enrichment-jobs",
      headers: { "x-owner-id": "owner-2" },
    });
    expect(otherOwnerHistory.json()).toEqual({ jobs: [] });

    const tooManyRows = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/previews",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        fileName: "leads.csv",
        csv: `Company Name,Answer\n${"A,1\n".repeat(11)}`,
      },
    });
    expect(tooManyRows.statusCode).toBe(400);
    expect(tooManyRows.json()).toEqual({ code: "PREVIEW_TOO_MANY_ROWS", maximumRows: 10 });

    const ragged = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/previews",
      headers: { "x-owner-id": "owner-1" },
      payload: { fileName: "leads.csv", csv: "Company Name,Answer\nToast\n" },
    });
    expect(ragged.statusCode).toBe(400);
    expect(ragged.json()).toEqual({ code: "INVALID_PREVIEW_CSV" });
  });

  it("lets an Owner create and list only their active Custom Operations", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const operationLibrary = createOperationLibrary();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary,
    });
    servers.push(server);

    const created = await server.inject({
      method: "POST",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        name: "Company category",
        promptTemplate: "Classify {company_name}.",
        expectedOutputType: "Text",
      },
    });
    const ownerList = await server.inject({
      method: "GET",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-1" },
    });
    const otherOwnerList = await server.inject({
      method: "GET",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-2" },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      customOperation: {
        id: expect.any(String),
        ownerId: "owner-1",
        name: "Company category",
        promptTemplate: "Classify {company_name}.",
        expectedOutputType: "Text",
        version: 1,
      },
    });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json()).toEqual({
      customOperations: [created.json().customOperation],
    });
    expect(otherOwnerList.statusCode).toBe(200);
    expect(otherOwnerList.json()).toEqual({ customOperations: [] });
  });

  it("lists Generation Models and previews and saves Generation Custom Operations with one", async () => {
    const jobStore = createInMemoryJobStore();
    const requests: Array<unknown> = [];
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore: createInMemoryOutputArtifactStore(),
      },
      operationLibrary: createOperationLibrary(),
      customOperationProvider: {
        async execute(request) {
          requests.push(request);
          return "Hi Jane";
        },
      },
    });
    servers.push(server);

    const models = await server.inject({
      method: "GET",
      url: "/generation-models",
      headers: { "x-owner-id": "owner-1" },
    });

    expect(models.statusCode).toBe(200);
    expect(models.json().generationModels.map((model: { id: string }) => model.id)).toEqual([
      "gpt-6-luna",
      "gpt-6.1-sol",
      "gpt-6-astra",
    ]);
    expect(models.json().generationModels[0]).toEqual({
      id: "gpt-6-luna",
      label: expect.any(String),
      description: expect.any(String),
      inputDollarsPerMillionTokens: 0.1,
      outputDollarsPerMillionTokens: 0.5,
      estimatedOutputTokensPerRow: expect.any(Number),
    });

    const preview = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/preview",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        sourceList: { fileName: "contacts.csv", csv: "First Name\nJane\n" },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Ice breaker",
            promptTemplate: "Write an ice breaker for {first}.",
            expectedOutputType: "Text",
            generationModel: "gpt-6.1-sol",
            inputBindings: [
              { variable: "first", input: { kind: "source-field", field: "First Name" } },
            ],
            generatedField: "Ice Breaker",
          },
        ],
      },
    });

    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({ rows: [{ "Ice Breaker": "Hi Jane" }] });
    expect(requests).toEqual([
      {
        prompt: "Write an ice breaker for Jane.",
        expectedOutputType: "Text",
        generationModel: "gpt-6.1-sol",
      },
    ]);

    const created = await server.inject({
      method: "POST",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        name: "Ice breaker",
        promptTemplate: "Write an ice breaker for {first}.",
        expectedOutputType: "Text",
        generationModel: "gpt-6-astra",
      },
    });
    const unknownModel = await server.inject({
      method: "POST",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-1" },
      payload: {
        name: "Ice breaker",
        promptTemplate: "Write an ice breaker for {first}.",
        expectedOutputType: "Text",
        generationModel: "gpt-5.5-pro",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().customOperation).toMatchObject({ generationModel: "gpt-6-astra" });
    expect(unknownModel.statusCode).toBe(400);
  });

  it("lets an Owner revise and retire their Custom Operation", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const operationLibrary = createOperationLibrary();
    const definition = await operationLibrary.createCustomOperation({
      ownerId: "owner-1",
      name: "Company category",
      promptTemplate: "Classify {company_name}.",
      expectedOutputType: "Text",
    });
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary,
    });
    servers.push(server);

    const revised = await server.inject({
      method: "PUT",
      url: `/custom-operations/${definition.id}`,
      headers: { "x-owner-id": "owner-1" },
      payload: {
        name: "Industry category",
        promptTemplate: "Classify the industry of {company_name}.",
        expectedOutputType: "Text",
      },
    });
    const otherOwnerRetirement = await server.inject({
      method: "DELETE",
      url: `/custom-operations/${definition.id}`,
      headers: { "x-owner-id": "owner-2" },
    });
    const retired = await server.inject({
      method: "DELETE",
      url: `/custom-operations/${definition.id}`,
      headers: { "x-owner-id": "owner-1" },
    });
    const list = await server.inject({
      method: "GET",
      url: "/custom-operations",
      headers: { "x-owner-id": "owner-1" },
    });

    expect(revised.statusCode).toBe(200);
    expect(revised.json()).toEqual({
      customOperation: {
        id: definition.id,
        ownerId: "owner-1",
        name: "Industry category",
        promptTemplate: "Classify the industry of {company_name}.",
        expectedOutputType: "Text",
        version: 2,
      },
    });
    expect(otherOwnerRetirement.statusCode).toBe(404);
    expect(retired.statusCode).toBe(204);
    expect(list.json()).toEqual({ customOperations: [] });
  });

  it("serves the browser workflow shell", async () => {
    const jobStore = createInMemoryJobStore();
    const outputArtifactStore = createInMemoryOutputArtifactStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore,
      },
      operationLibrary: createOperationLibrary(),
    });
    servers.push(server);

    const response = await server.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("CSV Enrichment");
    expect(response.body).toContain('id="job-form"');
    expect(response.body).toContain('id="job-history"');
    expect(response.body).toContain('byId("authentication-form").reportValidity()');
    expect(response.body).toContain('window.setInterval(() => void loadJobs(), 1000)');
  });
  it("previews a Lead Lookup that matches on several columns and returns one column per field", async () => {
    const jobStore = createInMemoryJobStore();
    const lookups: Array<unknown> = [];
    const server = createHttpServer({
      ownerIdForRequest: () => "owner-1",
      jobIntakeDependencies: {},
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: {
        jobHistoryStore: jobStore,
        outputArtifactStore: createInMemoryOutputArtifactStore(),
      },
      operationLibrary: createOperationLibrary(),
      leadLookup: {
        async lookUpField(request) {
          lookups.push(request);
          return request.inputs["full-name"] === "Ada Lovelace"
            ? { status: "Found", value: request.outputField === "job-title" ? "CTO" : "92%" }
            : { status: "NotFound", reason: "No person matches the row" };
        },
      },
    });
    servers.push(server);
    const lookup = (outputField: string, generatedField: string) => ({
      kind: "lead-lookup",
      subject: "person",
      inputBindings: [
        { role: "full-name", input: { kind: "source-field", field: "Name" } },
        { role: "company-name", input: { kind: "source-field", field: "Company" } },
      ],
      outputField,
      generatedField,
    });

    const response = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/preview",
      payload: {
        sourceList: { fileName: "people.csv", csv: "Name,Company\nAda Lovelace,Acme\nNobody,Acme\n" },
        configuredOperations: [lookup("job-title", "Title"), lookup("match-confidence", "Confidence")],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      rows: [
        { Title: "CTO", Confidence: "92%", processing_errors: "" },
        {
          Title: "[Not Found]",
          Confidence: "[Not Found]",
          processing_errors: "Title: No person matches the row; Confidence: No person matches the row",
        },
      ],
    });
    expect(lookups[0]).toEqual({
      subject: "person",
      inputs: { "full-name": "Ada Lovelace", "company-name": "Acme" },
      outputField: "job-title",
    });

    const unidentifiable = await server.inject({
      method: "POST",
      url: "/enrichment-jobs/preview",
      payload: {
        sourceList: { fileName: "people.csv", csv: "Company\nAcme\n" },
        configuredOperations: [{
          kind: "lead-lookup",
          subject: "person",
          inputBindings: [{ role: "company-name", input: { kind: "source-field", field: "Company" } }],
          outputField: "email",
          generatedField: "Email",
        }],
      },
    });

    expect(unidentifiable.statusCode).toBe(400);
    expect(unidentifiable.json().errors).toEqual([{
      code: "INVALID_LEAD_LOOKUP",
      generatedField: "Email",
      message: "A person lookup needs a name, LinkedIn URL, email or phone column",
    }]);
  });
});
