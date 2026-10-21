import { randomUUID } from "node:crypto";
import { isEmptyCsvRow, parseCsv } from "../csv/csv-codec.js";
import { findGenerationModel } from "../operation-library/generation-models.js";
import {
  canIdentify,
  isInputRole,
  isOutputField,
  type LookupSubject,
} from "../lead-lookup/lead-lookup.js";
import type {
  CustomOperationDefinition,
  ExpectedOutputType,
} from "../operation-library/custom-operation-definition.js";

export type { ExpectedOutputType };

export type InputReference =
  | {
      kind: "source-field";
      field: string;
    }
  | {
      kind: "generated-field";
      field: string;
    };

type ConfiguredOperationBase = {
  generatedField: string;
};

type StandardOperationBase = ConfiguredOperationBase & {
  input: InputReference;
};

export type CleanCompanyNameOperation = StandardOperationBase & {
  kind: "clean-company-name";
};

export type CleanFirstNameOperation = StandardOperationBase & {
  kind: "clean-first-name";
};

export type FormatWebsiteOperation = StandardOperationBase & {
  kind: "format-website";
};

export type ExtractDomainFromEmailOperation = StandardOperationBase & {
  kind: "extract-domain-from-email";
};

export type CapitalizeJobTitlesOperation = StandardOperationBase & {
  kind: "capitalize-job-titles";
};

export type PromptInputBinding = {
  variable: string;
  input: InputReference;
};

type InlineCustomOperationDefinition = {
  definition?: undefined;
  name: string;
  promptTemplate: string;
  expectedOutputType: ExpectedOutputType;
  generationModel?: string;
};

type LibraryCustomOperationDefinition = {
  definition: CustomOperationDefinition;
};

export type CustomOperation = ConfiguredOperationBase & {
  kind: "custom-operation";
  inputBindings: Array<PromptInputBinding>;
} & (InlineCustomOperationDefinition | LibraryCustomOperationDefinition);

export type LookupInputBinding = {
  /** What the column holds, e.g. "full-name" or "company-domain"; see lead-lookup/lead-lookup.ts. */
  role: string;
  input: InputReference;
};

/**
 * One field of the closest directory match for the row's bound values. Lookups with the same
 * subject and bindings share one search per row, so several fields cost what one does.
 */
export type LeadLookupOperation = ConfiguredOperationBase & {
  kind: "lead-lookup";
  subject: LookupSubject;
  inputBindings: Array<LookupInputBinding>;
  outputField: string;
  /** Below this, 0 to 1, the closest match is not trusted; omitted means the configured default. */
  minimumConfidence?: number;
};

export type ConfiguredOperation =
  | LeadLookupOperation
  | CleanCompanyNameOperation
  | CleanFirstNameOperation
  | FormatWebsiteOperation
  | ExtractDomainFromEmailOperation
  | CapitalizeJobTitlesOperation
  | CustomOperation;

export type ColumnMapping = {
  sourceField: string;
  canonicalDataType: string;
};

export type SubmitEnrichmentJobInput = {
  ownerId: string;
  sourceList: {
    fileName: string;
    csv: string;
  };
  columnMappings?: Array<ColumnMapping>;
  configuredOperations: Array<ConfiguredOperation>;
};

export type JobSnapshot = {
  id: string;
  ownerId: string;
  sourceList: {
    fileName: string;
    sourceFields: Array<string>;
    rows: Array<Array<string>>;
  };
  columnMappings: Array<ColumnMapping>;
  configuredOperations: Array<ConfiguredOperation>;
};

export type JobSnapshotStore = {
  /** Stores the Job Snapshot and its durable request for dispatch as one action. */
  store(job: JobSnapshot): Promise<void>;
};

export type JobDispatcher = {
  dispatch(jobId: string): Promise<void>;
};

export type JobDispatchIntentStore = {
  listPendingJobIds(): Promise<Array<string>>;
  markDispatched(jobId: string): Promise<void>;
};

export type JobIntakeDependencies = {
  jobSnapshotStore?: JobSnapshotStore;
  jobDispatchIntentStore?: JobDispatchIntentStore;
  jobDispatcher?: JobDispatcher;
};

type InconsistentColumnCountError = {
  code: "INCONSISTENT_COLUMN_COUNT";
  row: number;
  expectedColumnCount: number;
  actualColumnCount: number;
};

type UnknownSourceFieldError = {
  code: "UNKNOWN_SOURCE_FIELD";
  sourceField: string;
};

type DuplicateGeneratedFieldError = {
  code: "DUPLICATE_GENERATED_FIELD";
  generatedField: string;
};

type InvalidCsvError = {
  code: "INVALID_CSV";
  message: string;
};

type GeneratedFieldConflictsWithSourceFieldError = {
  code: "GENERATED_FIELD_CONFLICTS_WITH_SOURCE_FIELD";
  generatedField: string;
};

type UnavailableGeneratedFieldError = {
  code: "UNAVAILABLE_GENERATED_FIELD";
  generatedField: string;
};

type UnknownMappingSourceFieldError = {
  code: "UNKNOWN_MAPPING_SOURCE_FIELD";
  sourceField: string;
};

type UnboundPromptVariableError = {
  code: "UNBOUND_PROMPT_VARIABLE";
  variable: string;
};

type UnknownGenerationModelError = {
  code: "UNKNOWN_GENERATION_MODEL";
  generatedField: string;
  generationModel: string;
};

type InvalidLeadLookupError = {
  code: "INVALID_LEAD_LOOKUP";
  generatedField: string;
  message: string;
};

type UnauthorizedCustomOperationError = {
  code: "UNAUTHORIZED_CUSTOM_OPERATION";
};

type PromptReferencesNoInputError = {
  code: "PROMPT_REFERENCES_NO_INPUT";
  generatedField: string;
};

type SubmitEnrichmentJobResult =
  | {
      status: "Accepted";
      job: JobSnapshot;
    }
  | {
      status: "Rejected";
      errors: Array<
        | InconsistentColumnCountError
        | UnknownSourceFieldError
        | DuplicateGeneratedFieldError
        | InvalidCsvError
        | GeneratedFieldConflictsWithSourceFieldError
        | UnavailableGeneratedFieldError
        | UnknownMappingSourceFieldError
        | UnboundPromptVariableError
        | UnauthorizedCustomOperationError
        | PromptReferencesNoInputError
        | UnknownGenerationModelError
        | InvalidLeadLookupError
      >;
    };

export async function submitEnrichmentJob(
  input: SubmitEnrichmentJobInput,
  dependencies: JobIntakeDependencies = {},
): Promise<SubmitEnrichmentJobResult> {
  let sourceFields: Array<string>;
  let sourceRows: Array<Array<string>>;

  try {
    [sourceFields, ...sourceRows] = parseCsv(input.sourceList.csv);
  } catch (error) {
    return {
      status: "Rejected",
      errors: [
        {
          code: "INVALID_CSV",
          message:
            error instanceof Error ? error.message : "CSV could not be parsed",
        },
      ],
    };
  }

  const expectedColumnCount = sourceFields.length;
  const columnCountErrors = sourceRows.flatMap((row, index) => {
    if (isEmptyCsvRow(row)) {
      return [];
    }

    const actualColumnCount = row.length;

    if (actualColumnCount === expectedColumnCount) {
      return [];
    }

    return [
      {
        code: "INCONSISTENT_COLUMN_COUNT" as const,
        row: index + 2,
        expectedColumnCount,
        actualColumnCount,
      },
    ];
  });
  const sourceFieldErrors = input.configuredOperations.flatMap((operation) =>
    inputReferencesFor(operation).flatMap((inputReference) =>
      inputReference.kind !== "source-field" ||
      sourceFields.includes(inputReference.field)
        ? []
        : [
            {
              code: "UNKNOWN_SOURCE_FIELD" as const,
              sourceField: inputReference.field,
            },
          ],
    ),
  );
  const generatedFieldCounts = new Map<string, number>();

  for (const operation of input.configuredOperations) {
    generatedFieldCounts.set(
      operation.generatedField,
      (generatedFieldCounts.get(operation.generatedField) ?? 0) + 1,
    );
  }

  const duplicateGeneratedFieldErrors = [...generatedFieldCounts].flatMap(
    ([generatedField, count]) =>
      count > 1
        ? [
            {
              code: "DUPLICATE_GENERATED_FIELD" as const,
              generatedField,
            },
          ]
        : [],
  );
  const generatedFieldConflictErrors = input.configuredOperations.flatMap(
    (operation) =>
      sourceFields.includes(operation.generatedField)
        ? [
            {
              code: "GENERATED_FIELD_CONFLICTS_WITH_SOURCE_FIELD" as const,
              generatedField: operation.generatedField,
            },
          ]
        : [],
  );
  const availableGeneratedFields = new Set<string>();
  const unavailableGeneratedFieldErrors = input.configuredOperations.flatMap(
    (operation) => {
      const errors = inputReferencesFor(operation).flatMap((inputReference) =>
        inputReference.kind === "generated-field" &&
        !availableGeneratedFields.has(inputReference.field)
          ? [
              {
                code: "UNAVAILABLE_GENERATED_FIELD" as const,
                generatedField: inputReference.field,
              },
            ]
          : [],
      );

      availableGeneratedFields.add(operation.generatedField);

      return errors;
    },
  );
  const mappingSourceFieldErrors = (input.columnMappings ?? []).flatMap(
    (columnMapping) =>
      sourceFields.includes(columnMapping.sourceField)
        ? []
        : [
            {
              code: "UNKNOWN_MAPPING_SOURCE_FIELD" as const,
              sourceField: columnMapping.sourceField,
            },
        ],
  );
  const unboundPromptVariableErrors = input.configuredOperations.flatMap(
    (operation) => {
      if (operation.kind !== "custom-operation") {
        return [];
      }

      const boundVariables = new Set(
        operation.inputBindings.map((binding) => binding.variable),
      );

      return [...new Set(promptVariablesFor(operation))].flatMap((variable) =>
        boundVariables.has(variable)
          ? []
          : [
              {
                code: "UNBOUND_PROMPT_VARIABLE" as const,
                variable,
              },
            ],
      );
    },
  );
  // Without a row variable every row receives the same prompt, so the provider
  // cannot know which company or contact it is being asked about.
  const promptReferencesNoInputErrors = input.configuredOperations.flatMap(
    (operation) =>
      operation.kind === "custom-operation" &&
      promptVariablesFor(operation).length === 0
        ? [
            {
              code: "PROMPT_REFERENCES_NO_INPUT" as const,
              generatedField: operation.generatedField,
            },
          ]
        : [],
  );
  const unknownGenerationModelErrors = input.configuredOperations.flatMap(
    (operation) => {
      if (operation.kind !== "custom-operation") {
        return [];
      }

      const generationModel = generationModelFor(operation);

      return generationModel === undefined ||
        findGenerationModel(generationModel) !== undefined
        ? []
        : [
            {
              code: "UNKNOWN_GENERATION_MODEL" as const,
              generatedField: operation.generatedField,
              generationModel,
            },
          ];
    },
  );
  const unauthorizedCustomOperationErrors = input.configuredOperations.flatMap(
    (operation) =>
      operation.kind === "custom-operation" &&
      operation.definition !== undefined &&
      operation.definition.ownerId !== input.ownerId
        ? [{ code: "UNAUTHORIZED_CUSTOM_OPERATION" as const }]
        : [],
  );
  const leadLookupErrors = input.configuredOperations.flatMap((operation) => {
    if (operation.kind !== "lead-lookup") {
      return [];
    }

    const roles = operation.inputBindings.map((binding) => binding.role);
    const message = !isOutputField(operation.subject, operation.outputField)
      ? `Unknown ${operation.subject} field: ${operation.outputField}`
      : roles.find((role) => !isInputRole(operation.subject, role)) !== undefined
      ? `Unknown ${operation.subject} input: ${roles.find((role) => !isInputRole(operation.subject, role))}`
      : new Set(roles).size !== roles.length
      ? "Each input kind can be chosen once"
      : operation.minimumConfidence !== undefined &&
          !(Number.isFinite(operation.minimumConfidence) && operation.minimumConfidence >= 0 && operation.minimumConfidence <= 1)
      ? "Minimum match confidence must be between 0 and 1"
      : !canIdentify(operation.subject, roles)
      ? operation.subject === "person"
        ? "A person lookup needs a name, LinkedIn URL, email or phone column"
        : "A company lookup needs a company name, website or LinkedIn URL column"
      : undefined;

    return message === undefined
      ? []
      : [{ code: "INVALID_LEAD_LOOKUP" as const, generatedField: operation.generatedField, message }];
  });
  const errors = [
    ...columnCountErrors,
    ...sourceFieldErrors,
    ...duplicateGeneratedFieldErrors,
    ...generatedFieldConflictErrors,
    ...unavailableGeneratedFieldErrors,
    ...mappingSourceFieldErrors,
    ...unboundPromptVariableErrors,
    ...promptReferencesNoInputErrors,
    ...unknownGenerationModelErrors,
    ...leadLookupErrors,
    ...unauthorizedCustomOperationErrors,
  ];

  if (errors.length > 0) {
    return {
      status: "Rejected",
      errors,
    };
  }

  const job: JobSnapshot = {
    id: randomUUID(),
    ownerId: input.ownerId,
    sourceList: {
      fileName: input.sourceList.fileName,
      sourceFields,
      rows: sourceRows.filter((row) => !isEmptyCsvRow(row)),
    },
    columnMappings: (input.columnMappings ?? []).map((columnMapping) => ({
      ...columnMapping,
    })),
    configuredOperations: input.configuredOperations.map(copyConfiguredOperation),
  };

  if (dependencies.jobSnapshotStore !== undefined) {
    await dependencies.jobSnapshotStore.store(job);
  }

  if (dependencies.jobDispatcher !== undefined) {
    try {
      await dependencies.jobDispatcher.dispatch(job.id);
      await dependencies.jobDispatchIntentStore?.markDispatched(job.id);
    } catch {
      // The stored dispatch request remains available for later delivery.
    }
  }

  return {
    status: "Accepted",
    job,
  };
}

export async function dispatchPendingEnrichmentJobs(input: {
  jobDispatchIntentStore: JobDispatchIntentStore;
  jobDispatcher: JobDispatcher;
}): Promise<{ dispatchedJobIds: Array<string> }> {
  const dispatchedJobIds: Array<string> = [];

  for (const jobId of await input.jobDispatchIntentStore.listPendingJobIds()) {
    try {
      await input.jobDispatcher.dispatch(jobId);
      await input.jobDispatchIntentStore.markDispatched(jobId);
      dispatchedJobIds.push(jobId);
    } catch {
      // A later reconciliation attempt can deliver the still-pending intent.
    }
  }

  return { dispatchedJobIds };
}

function inputReferencesFor(
  operation: ConfiguredOperation,
): Array<InputReference> {
  return operation.kind === "custom-operation" || operation.kind === "lead-lookup"
    ? operation.inputBindings.map((binding) => binding.input)
    : [operation.input];
}

function copyConfiguredOperation(
  operation: ConfiguredOperation,
): ConfiguredOperation {
  if (operation.kind === "lead-lookup") {
    return {
      ...operation,
      inputBindings: operation.inputBindings.map((binding) => ({
        ...binding,
        input: { ...binding.input },
      })),
    };
  }

  if (operation.kind === "custom-operation") {
    return {
      ...operation,
      ...(operation.definition === undefined
        ? {}
        : { definition: { ...operation.definition } }),
      inputBindings: operation.inputBindings.map((binding) => ({
        ...binding,
        input: { ...binding.input },
      })),
    };
  }

  return {
    ...operation,
    input: { ...operation.input },
  };
}

function promptVariablesFor(operation: CustomOperation): Array<string> {
  const promptTemplate =
    "promptTemplate" in operation
      ? operation.promptTemplate
      : operation.definition.promptTemplate;

  return [...promptTemplate.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
}

function generationModelFor(operation: CustomOperation): string | undefined {
  return operation.definition === undefined
    ? operation.generationModel
    : operation.definition.generationModel;
}
