import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";

import { browserAppHtml } from "./browser-app.js";
import {
  submitEnrichmentJob,
  type ConfiguredOperation,
  type CustomOperation,
  type ExpectedOutputType,
  type InputReference,
  type JobIntakeDependencies,
  type SubmitEnrichmentJobInput,
} from "../job-intake/submit-enrichment-job.js";
import {
  listEnrichmentJobs,
  requestEnrichedList,
  saveEnrichmentPreview,
  type JobHistoryDependencies,
  type RequestEnrichedListDependencies,
  type SaveEnrichmentPreviewDependencies,
} from "../job-history/list-enrichment-jobs.js";
import {
  executeEnrichmentJob,
  type CustomOperationProvider,
} from "../job-execution/execute-enrichment-job.js";
import { parseCsv } from "../csv/csv-codec.js";
import type { OperationLibrary } from "../operation-library/operation-library.js";
import {
  findGenerationModel,
  generationModels,
} from "../operation-library/generation-models.js";
import type { UserAuthentication } from "../user-authentication/user-authentication.js";
import type { ResearchKeyRegistry } from "../research/research-key-registry.js";
import {
  companyFields,
  companyInputRoles,
  personFields,
  personInputRoles,
  type LeadLookup,
} from "../lead-lookup/lead-lookup.js";

type RequestBody = Omit<SubmitEnrichmentJobInput, "ownerId">;
type RecordValue = Record<string, unknown>;

const standardOperationKinds = new Set([
  "clean-company-name",
  "clean-first-name",
  "format-website",
  "extract-domain-from-email",
  "capitalize-job-titles",
]);
const sessionCookieName = "csv_enrichment_session";
const maximumRequestBodyBytes = 50 * 1024 * 1024;
// Each previewed row can trigger a paid web search per Custom Operation.
const maximumPreviewRows = 10;

export type OwnerIdForRequest = (
  request: FastifyRequest,
) => string | undefined | Promise<string | undefined>;

export type HttpServerDependencies = {
  ownerIdForRequest: OwnerIdForRequest;
  jobIntakeDependencies: JobIntakeDependencies;
  jobHistoryDependencies: JobHistoryDependencies;
  requestEnrichedListDependencies: RequestEnrichedListDependencies;
  saveEnrichmentPreviewDependencies?: SaveEnrichmentPreviewDependencies;
  operationLibrary: OperationLibrary;
  customOperationProvider?: CustomOperationProvider;
  leadLookup?: LeadLookup;
  /** Directory records a searched lookup may fetch per row, shown with the cost estimate. */
  leadLookupCandidateLimit?: number;
  leadLookupDeepCandidateLimit?: number;
  leadLookupMinimumConfidence?: number;
  researchKeyRegistry?: ResearchKeyRegistry;
  userAuthentication?: UserAuthentication;
  sessionCookieSecure?: boolean;
};

export function createHttpServer(
  dependencies: HttpServerDependencies,
): FastifyInstance {
  const server = Fastify({
    logger: false,
    bodyLimit: maximumRequestBodyBytes,
  });

  server.get("/", async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(browserAppHtml)
  );

  if (dependencies.userAuthentication !== undefined) {
    registerAuthenticationRoutes(server, dependencies);
  }

  server.get("/generation-models", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    // Prices travel with the list so the browser can estimate a run's cost before it starts.
    return {
      generationModels: generationModels.map((model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
        inputDollarsPerMillionTokens: model.inputDollarsPerMillionTokens,
        outputDollarsPerMillionTokens: model.outputDollarsPerMillionTokens,
        estimatedOutputTokensPerRow: model.estimatedOutputTokensPerRow,
      })),
    };
  });

  server.get("/lead-lookup", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    return {
      available: dependencies.leadLookup !== undefined,
      candidateLimit: dependencies.leadLookupCandidateLimit ?? 3,
      deepCandidateLimit: dependencies.leadLookupDeepCandidateLimit ?? 10,
      minimumConfidence: dependencies.leadLookupMinimumConfidence ?? 0.5,
      person: { inputRoles: personInputRoles, fields: fieldList(personFields) },
      company: { inputRoles: companyInputRoles, fields: fieldList(companyFields) },
    };
  });

  server.get("/research-keys", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (dependencies.researchKeyRegistry === undefined) {
      return reply.code(503).send({ code: "RESEARCH_KEYS_UNAVAILABLE" });
    }

    return dependencies.researchKeyRegistry.listKeys(ownerId);
  });

  server.post("/research-keys", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (dependencies.researchKeyRegistry === undefined) {
      return reply.code(503).send({ code: "RESEARCH_KEYS_UNAVAILABLE" });
    }

    const body = request.body;

    // Contributors volunteer knowing the risk to their own Google account, so it is confirmed every time.
    if (
      !isRecord(body) ||
      !isNonEmptyString(body.apiKey) ||
      (body.label !== undefined && typeof body.label !== "string") ||
      body.acknowledgedRisk !== true
    ) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const result = await dependencies.researchKeyRegistry.addKey({
      contributorId: ownerId,
      apiKey: body.apiKey,
      ...(typeof body.label === "string" ? { label: body.label } : {}),
    });

    return result.status === "Rejected"
      ? reply.code(result.code === "KEY_DUPLICATE" ? 409 : result.code === "CHECK_FAILED" ? 502 : 400)
          .send({ code: result.code, message: result.message })
      : reply.code(201).send({ key: result.key });
  });

  server.delete("/research-keys/:keyId", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);
    const keyId = routeParameter(request.params, "keyId");

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (dependencies.researchKeyRegistry === undefined) {
      return reply.code(503).send({ code: "RESEARCH_KEYS_UNAVAILABLE" });
    }

    const removed = keyId !== undefined &&
      await dependencies.researchKeyRegistry.removeKey({ id: keyId, contributorId: ownerId });

    return removed
      ? reply.code(204).send()
      : reply.code(404).send({ code: "RESEARCH_KEY_UNAVAILABLE" });
  });

  server.get("/custom-operations", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    return {
      customOperations:
        await dependencies.operationLibrary.listCustomOperations(ownerId),
    };
  });

  server.post("/custom-operations", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    const input = parseCustomOperationDefinitionInput(request.body);

    if (input === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const customOperation =
      await dependencies.operationLibrary.createCustomOperation({
        ownerId,
        ...input,
      });

    return reply.code(201).send({ customOperation });
  });

  server.put("/custom-operations/:customOperationId", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);
    const customOperationId = routeParameter(request.params, "customOperationId");

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    const input = parseCustomOperationDefinitionInput(request.body);

    if (customOperationId === undefined || input === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    try {
      const customOperation =
        await dependencies.operationLibrary.reviseCustomOperation({
          id: customOperationId,
          ownerId,
          ...input,
        });

      return { customOperation };
    } catch (error) {
      return isUnavailableCustomOperationError(error)
        ? reply.code(404).send({ code: "CUSTOM_OPERATION_UNAVAILABLE" })
        : Promise.reject(error);
    }
  });

  server.delete("/custom-operations/:customOperationId", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);
    const customOperationId = routeParameter(request.params, "customOperationId");

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (customOperationId === undefined) {
      return reply.code(404).send({ code: "CUSTOM_OPERATION_UNAVAILABLE" });
    }

    try {
      await dependencies.operationLibrary.retireCustomOperation({
        id: customOperationId,
        ownerId,
      });

      return reply.code(204).send();
    } catch (error) {
      return isUnavailableCustomOperationError(error)
        ? reply.code(404).send({ code: "CUSTOM_OPERATION_UNAVAILABLE" })
        : Promise.reject(error);
    }
  });

  server.get("/enrichment-jobs", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    return listEnrichmentJobs(
      { ownerId },
      dependencies.jobHistoryDependencies,
    );
  });

  server.get("/enrichment-jobs/:jobId/enriched-list", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);
    const jobId = routeParameter(request.params, "jobId");

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (jobId === undefined) {
      return reply.code(404).send({ code: "ENRICHED_LIST_UNAVAILABLE" });
    }

    const result = await requestEnrichedList(
      { ownerId, jobId },
      dependencies.requestEnrichedListDependencies,
    );

    return result.status === "Unavailable"
      ? reply.code(404).send({ code: "ENRICHED_LIST_UNAVAILABLE" })
      : reply
        .type("text/csv; charset=utf-8")
        .header("content-disposition", attachmentDisposition(result.output.fileName))
        .send(result.output.csv);
  });

  server.post("/enrichment-jobs", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    const parsedBody = parseRequestBody(request.body);

    if (parsedBody === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const result = await submitEnrichmentJob(
      {
        ownerId,
        ...parsedBody,
      },
      dependencies.jobIntakeDependencies,
    );

    if (result.status === "Rejected") {
      return reply.code(400).send(result);
    }

    return reply.code(202).send({
      status: "Queued",
      jobId: result.job.id,
    });
  });

  server.post("/enrichment-jobs/preview", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    const parsedBody = parseRequestBody(request.body);

    if (parsedBody === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    // Validated like a real submission, but with no stores so nothing is queued.
    const result = await submitEnrichmentJob({ ownerId, ...parsedBody });

    if (result.status === "Rejected") {
      return reply.code(400).send(result);
    }

    if (result.job.sourceList.rows.length > maximumPreviewRows) {
      return reply.code(400).send({
        code: "PREVIEW_TOO_MANY_ROWS",
        maximumRows: maximumPreviewRows,
      });
    }

    const execution = await executeEnrichmentJob(
      {
        jobId: result.job.id,
        sourceList: parsedBody.sourceList,
        configuredOperations: result.job.configuredOperations,
        columnMappings: result.job.columnMappings,
      },
      {
        customOperationProvider: dependencies.customOperationProvider,
        leadLookup: dependencies.leadLookup,
      },
    );
    const [enrichedFields, ...enrichedRows] = parseCsv(execution.output.csv);
    const sourceFieldCount = result.job.sourceList.sourceFields.length;

    return {
      rows: enrichedRows.map((row) =>
        Object.fromEntries(
          enrichedFields
            .slice(sourceFieldCount)
            .map((field, index) => [field, row[sourceFieldCount + index]]),
        ),
      ),
    };
  });

  server.post("/enrichment-jobs/previews", async (request, reply) => {
    const ownerId = await dependencies.ownerIdForRequest(request);

    if (ownerId === undefined) {
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }

    if (dependencies.saveEnrichmentPreviewDependencies === undefined) {
      return reply.code(404).send({ code: "PREVIEW_SAVING_UNAVAILABLE" });
    }

    const body = parseSourceList(request.body);

    if (body === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const result = await saveEnrichmentPreview(
      { ownerId, ...body, maximumRows: maximumPreviewRows },
      dependencies.saveEnrichmentPreviewDependencies,
    );

    return result.status === "Rejected"
      ? reply.code(400).send(
          result.code === "PREVIEW_TOO_MANY_ROWS"
            ? { code: result.code, maximumRows: maximumPreviewRows }
            : { code: result.code },
        )
      : reply.code(201).send({ status: "Saved", jobId: result.id });
  });

  return server;
}

export function ownerIdForRequestFromSession(
  userAuthentication: UserAuthentication,
): OwnerIdForRequest {
  return (request) =>
    userAuthentication.ownerIdForSession(
      cookieValue(request.headers.cookie, sessionCookieName),
    );
}

function registerAuthenticationRoutes(
  server: FastifyInstance,
  dependencies: HttpServerDependencies,
): void {
  const userAuthentication = dependencies.userAuthentication;

  if (userAuthentication === undefined) {
    return;
  }

  server.post("/auth/register", async (request, reply) => {
    const credentials = parseCredentials(request.body);

    if (credentials === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const result = await userAuthentication.register(credentials);

    if (result.status === "Rejected") {
      return reply.code(result.code === "EMAIL_ALREADY_REGISTERED" ? 409 : 400)
        .send({ code: result.code });
    }

    setSessionCookie(reply, result.sessionToken, result.expiresAt, dependencies);

    return reply.code(201).send({ status: "Authenticated" });
  });

  server.post("/auth/login", async (request, reply) => {
    const credentials = parseCredentials(request.body);

    if (credentials === undefined) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }

    const result = await userAuthentication.login(credentials);

    if (result.status === "Rejected") {
      return reply.code(401).send({ code: "INVALID_CREDENTIALS" });
    }

    setSessionCookie(reply, result.sessionToken, result.expiresAt, dependencies);

    return { status: "Authenticated" };
  });

  server.post("/auth/logout", async (request, reply) => {
    await userAuthentication.logout(
      cookieValue(request.headers.cookie, sessionCookieName),
    );
    reply.header("set-cookie", expiredSessionCookie(dependencies));

    return reply.code(204).send();
  });

  server.get("/auth/session", async (request, reply) => {
    const ownerId = await userAuthentication.ownerIdForSession(
      cookieValue(request.headers.cookie, sessionCookieName),
    );

    return ownerId === undefined
      ? reply.code(401).send({ code: "UNAUTHENTICATED" })
      : { status: "Authenticated" };
  });
}

function parseRequestBody(value: unknown): RequestBody | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sourceList = parseSourceList(value.sourceList);
  const columnMappings = parseColumnMappings(value.columnMappings);
  const configuredOperations = parseConfiguredOperations(value.configuredOperations);

  if (
    sourceList === undefined ||
    columnMappings === undefined ||
    configuredOperations === undefined
  ) {
    return undefined;
  }

  return {
    sourceList,
    ...(value.columnMappings === undefined ? {} : { columnMappings }),
    configuredOperations,
  };
}

function parseSourceList(
  value: unknown,
): RequestBody["sourceList"] | undefined {
  return isRecord(value) &&
    isNonEmptyString(value.fileName) &&
    typeof value.csv === "string"
    ? { fileName: value.fileName, csv: value.csv }
    : undefined;
}

function parseCustomOperationDefinitionInput(
  value: unknown,
):
  | {
    name: string;
    promptTemplate: string;
    expectedOutputType: ExpectedOutputType;
    generationModel?: string;
  }
  | undefined {
  // A library definition is saved for later jobs, so its Generation Model must exist now.
  return isRecord(value) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.promptTemplate) &&
    isExpectedOutputType(value.expectedOutputType) &&
    (value.generationModel === undefined ||
      (typeof value.generationModel === "string" &&
        findGenerationModel(value.generationModel) !== undefined))
    ? {
        name: value.name,
        promptTemplate: value.promptTemplate,
        expectedOutputType: value.expectedOutputType,
        ...generationModelField(value.generationModel),
      }
    : undefined;
}

function isOptionalGenerationModel(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function generationModelField(value: unknown): { generationModel?: string } {
  return isNonEmptyString(value) ? { generationModel: value } : {};
}

function parseColumnMappings(
  value: unknown,
): RequestBody["columnMappings"] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const mappings: NonNullable<RequestBody["columnMappings"]> = [];

  for (const mapping of value) {
    if (
      !isRecord(mapping) ||
      !isNonEmptyString(mapping.sourceField) ||
      !isNonEmptyString(mapping.canonicalDataType)
    ) {
      return undefined;
    }

    mappings.push({
      sourceField: mapping.sourceField,
      canonicalDataType: mapping.canonicalDataType,
    });
  }

  return mappings;
}

function parseConfiguredOperations(
  value: unknown,
): Array<ConfiguredOperation> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const operations: Array<ConfiguredOperation> = [];

  for (const operationValue of value) {
    const operation = parseConfiguredOperation(operationValue);

    if (operation === undefined) {
      return undefined;
    }

    operations.push(operation);
  }

  return operations;
}

function parseConfiguredOperation(
  value: unknown,
): ConfiguredOperation | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.generatedField)) {
    return undefined;
  }

  if (standardOperationKinds.has(value.kind as string)) {
    const input = parseInputReference(value.input);

    return input === undefined || typeof value.kind !== "string"
      ? undefined
      : { kind: value.kind as Exclude<ConfiguredOperation["kind"], "custom-operation" | "lead-lookup">, input, generatedField: value.generatedField };
  }

  if (value.kind === "lead-lookup") {
    return parseLeadLookupOperation(value, value.generatedField);
  }

  return value.kind === "custom-operation"
    ? parseCustomOperation(value, value.generatedField)
    : undefined;
}

// Roles and fields are checked against the lookup's lists at intake, which names the bad one.
function fieldList(fields: typeof personFields) {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    group: field.group,
    isDefault: field.isDefault === true,
  }));
}

function parseLeadLookupOperation(
  value: RecordValue,
  generatedField: string,
): ConfiguredOperation | undefined {
  if (
    (value.subject !== "person" && value.subject !== "company") ||
    !isNonEmptyString(value.outputField) ||
    !Array.isArray(value.inputBindings) ||
    (value.minimumConfidence !== undefined && typeof value.minimumConfidence !== "number")
  ) {
    return undefined;
  }

  const inputBindings: Array<{ role: string; input: InputReference }> = [];

  for (const binding of value.inputBindings) {
    const input = isRecord(binding) ? parseInputReference(binding.input) : undefined;

    if (!isRecord(binding) || !isNonEmptyString(binding.role) || input === undefined) {
      return undefined;
    }

    inputBindings.push({ role: binding.role, input });
  }

  return {
    kind: "lead-lookup",
    subject: value.subject,
    inputBindings,
    outputField: value.outputField,
    ...(value.minimumConfidence === undefined ? {} : { minimumConfidence: value.minimumConfidence as number }),
    generatedField,
  };
}

function parseCustomOperation(
  value: RecordValue,
  generatedField: string,
): CustomOperation | undefined {
  const inputBindings = parseInputBindings(value.inputBindings);

  if (inputBindings === undefined) {
    return undefined;
  }

  if (isRecord(value.definition)) {
    const definition = value.definition;

    return isNonEmptyString(definition.id) &&
      isNonEmptyString(definition.ownerId) &&
      isNonEmptyString(definition.name) &&
      isNonEmptyString(definition.promptTemplate) &&
      isExpectedOutputType(definition.expectedOutputType) &&
      isOptionalGenerationModel(definition.generationModel) &&
      typeof definition.version === "number" &&
      Number.isInteger(definition.version) &&
      definition.version > 0
      ? {
          kind: "custom-operation",
          definition: {
            id: definition.id,
            ownerId: definition.ownerId,
            name: definition.name,
            promptTemplate: definition.promptTemplate,
            expectedOutputType: definition.expectedOutputType,
            ...generationModelField(definition.generationModel),
            version: definition.version,
          },
          inputBindings,
          generatedField,
        }
      : undefined;
  }

  return isNonEmptyString(value.name) &&
    isNonEmptyString(value.promptTemplate) &&
    isExpectedOutputType(value.expectedOutputType) &&
    isOptionalGenerationModel(value.generationModel)
    ? {
        kind: "custom-operation",
        name: value.name,
        promptTemplate: value.promptTemplate,
        expectedOutputType: value.expectedOutputType,
        ...generationModelField(value.generationModel),
        inputBindings,
        generatedField,
      }
    : undefined;
}

function parseInputBindings(
  value: unknown,
): CustomOperation["inputBindings"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const bindings: NonNullable<CustomOperation["inputBindings"]> = [];

  for (const binding of value) {
    if (!isRecord(binding) || !isNonEmptyString(binding.variable)) {
      return undefined;
    }

    const input = parseInputReference(binding.input);

    if (input === undefined) {
      return undefined;
    }

    bindings.push({ variable: binding.variable, input });
  }

  return bindings;
}

function parseInputReference(value: unknown): InputReference | undefined {
  return isRecord(value) &&
    (value.kind === "source-field" || value.kind === "generated-field") &&
    isNonEmptyString(value.field)
    ? { kind: value.kind, field: value.field }
    : undefined;
}

function isExpectedOutputType(value: unknown): value is ExpectedOutputType {
  return value === "Text" || value === "Number" || value === "Boolean";
}

function attachmentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function routeParameter(
  value: unknown,
  parameterName: string,
): string | undefined {
  return isRecord(value) && isNonEmptyString(value[parameterName])
    ? value[parameterName]
    : undefined;
}

function isUnavailableCustomOperationError(error: unknown): boolean {
  return error instanceof Error &&
    error.message === "Custom Operation Definition is unavailable";
}

function parseCredentials(
  value: unknown,
): { email: string; password: string } | undefined {
  return isRecord(value) &&
    isNonEmptyString(value.email) &&
    isNonEmptyString(value.password)
    ? { email: value.email, password: value.password }
    : undefined;
}

function setSessionCookie(
  reply: { header(name: string, value: string): unknown },
  sessionToken: string,
  expiresAt: Date,
  dependencies: HttpServerDependencies,
): void {
  reply.header(
    "set-cookie",
    `${sessionCookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${dependencies.sessionCookieSecure === false ? "" : "; Secure"}`,
  );
}

function expiredSessionCookie(dependencies: HttpServerDependencies): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${dependencies.sessionCookieSecure === false ? "" : "; Secure"}`;
}

function cookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...value] = cookie.trim().split("=");

    if (cookieName === name) {
      return value.length === 0 ? undefined : value.join("=");
    }
  }

  return undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
