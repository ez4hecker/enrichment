import type {
  ColumnMapping,
  ConfiguredOperation,
  CustomOperation,
  ExpectedOutputType,
  InputReference,
  LeadLookupOperation,
} from "../job-intake/submit-enrichment-job.js";
import {
  LeadDirectoryUnavailableError,
  type LeadLookup,
  type LookupInputRole,
} from "../lead-lookup/lead-lookup.js";
import type { EnrichmentJobProgress } from "../enrichment-job-progress.js";
import { isEmptyCsvRow, parseCsv, serializeCsv } from "../csv/csv-codec.js";

export type ExecuteEnrichmentJobInput = {
  jobId: string;
  sourceList: {
    fileName: string;
    csv: string;
  };
  configuredOperations: Array<ConfiguredOperation>;
  /** The row's Website and Company Name, from these mappings, identify the company researched. */
  columnMappings?: Array<ColumnMapping>;
};

export type CustomOperationProvider = {
  execute(request: {
    prompt: string;
    expectedOutputType: ExpectedOutputType;
    /** Present for Generation: write with this model from the prompt alone, without searching. */
    generationModel?: string;
    /** The Enrichment Job asking, so research can hold each job to its own Spend Limit. */
    jobId?: string;
    /** From the Source Field mapped to Website; research identifies the company by its domain. */
    companyWebsite?: string;
    /** From the Source Field mapped to Company Name. */
    companyName?: string;
  }): Promise<string | number | boolean>;
};

/** Thrown by a provider when answering would take the job past its Spend Limit. */
export class SpendLimitReachedError extends Error {
  constructor() {
    super("Spend limit reached");
  }
}

export type JobExecutionDependencies = {
  customOperationProvider?: CustomOperationProvider;
  leadLookup?: LeadLookup;
  onOperationResult?: (result: {
    rowIndex: number;
    operationIndex: number;
    failed: boolean;
  }) => Promise<void>;
};

export type EnrichedList = {
  fileName: string;
  csv: string;
};

export type ExecuteEnrichmentJobResult = {
  jobId: string;
  status: "Completed";
  output: EnrichedList;
  progress: EnrichmentJobProgress;
};

type OperationResult = {
  value: string;
  error?: string;
};

type ResolvedInput = {
  value?: string;
  error?: string;
};

type StandardOperation = Exclude<ConfiguredOperation, CustomOperation | LeadLookupOperation>;

type CustomOperationDetails = {
  name: string;
  promptTemplate: string;
  expectedOutputType: ExpectedOutputType;
  generationModel?: string;
};

export async function executeEnrichmentJob(
  input: ExecuteEnrichmentJobInput,
  dependencies: JobExecutionDependencies = {},
): Promise<ExecuteEnrichmentJobResult> {
  const [sourceFields, ...sourceRows] = parseCsv(input.sourceList.csv);
  const sourceFieldIndexes = new Map(
    sourceFields.map((field, index) => [field, index]),
  );

  const rows = sourceRows.filter((row) => !isEmptyCsvRow(row));
  const websiteIndex = mappedFieldIndex(input.columnMappings, "website", sourceFieldIndexes);
  const companyNameIndex = mappedFieldIndex(input.columnMappings, "companyname", sourceFieldIndexes);
  const outputRows = await Promise.all(rows.map(async (sourceValues, rowIndex) => {
    const operationResults: Array<OperationResult> = [];
    const generatedResults = new Map<string, OperationResult>();
    const subject: ResearchSubject = {
      jobId: input.jobId,
      ...nonEmptyField("companyWebsite", websiteIndex === undefined ? undefined : sourceValues[websiteIndex]),
      ...nonEmptyField("companyName", companyNameIndex === undefined ? undefined : sourceValues[companyNameIndex]),
    };

    for (const [operationIndex, operation] of input.configuredOperations.entries()) {
      const operationResult = await executeConfiguredOperation(
        operation,
        sourceFieldIndexes,
        sourceValues,
        generatedResults,
        dependencies,
        subject,
      );

      operationResults.push(operationResult);
      generatedResults.set(operation.generatedField, operationResult);
      await dependencies.onOperationResult?.({
        rowIndex,
        operationIndex,
        failed: operationResult.error !== undefined,
      });
    }

    return {
      sourceValues,
      operationResults,
    };
  }));
  const hasProcessingErrors = outputRows.some((row) =>
    row.operationResults.some((result) => result.error !== undefined),
  );
  const totalOperationCount =
    rows.length * input.configuredOperations.length;
  const failedOperationCount = outputRows.reduce(
    (failedCount, row) =>
      failedCount +
      row.operationResults.filter((result) => result.error !== undefined).length,
    0,
  );

  return {
    jobId: input.jobId,
    status: "Completed",
    output: {
      fileName: enrichedFileName(input.sourceList.fileName),
      csv: serializeCsv([
        [
          ...sourceFields,
          ...input.configuredOperations.map((operation) => operation.generatedField),
          ...(hasProcessingErrors ? ["processing_errors"] : []),
        ],
        ...outputRows.map((row) => {
          const generatedValues = row.operationResults.map((result) => result.value);
          const processingErrors = row.operationResults.flatMap((result, index) =>
            result.error === undefined
              ? []
              : [`${input.configuredOperations[index].generatedField}: ${result.error}`],
          );

          return [
            ...row.sourceValues,
            ...generatedValues,
            ...(hasProcessingErrors ? [processingErrors.join("; ")] : []),
          ];
        }),
      ]),
    },
    progress: {
      total: totalOperationCount,
      completed: totalOperationCount,
      failed: failedOperationCount,
      remaining: 0,
    },
  };
}

type ResearchSubject = {
  jobId: string;
  companyWebsite?: string;
  companyName?: string;
};

/** Mapping roles arrive as "website", "Website" or "company-name"; compare them loosely. */
function mappedFieldIndex(
  columnMappings: Array<ColumnMapping> | undefined,
  role: string,
  sourceFieldIndexes: Map<string, number>,
): number | undefined {
  const mapping = (columnMappings ?? []).find((columnMapping) =>
    columnMapping.canonicalDataType.toLowerCase().replace(/[^a-z]/g, "") === role,
  );

  return mapping === undefined ? undefined : sourceFieldIndexes.get(mapping.sourceField);
}

function nonEmptyField<Name extends string>(
  name: Name,
  value: string | undefined,
): Partial<Record<Name, string>> {
  const trimmed = (value ?? "").trim();

  return trimmed === "" ? {} : { [name]: trimmed } as Partial<Record<Name, string>>;
}

function cleanCompanyName(value: string | undefined): string {
  return (value ?? "").replace(/,?\s+(?:inc\.?|llc)$/i, "").trim();
}

function cleanFirstName(value: string | undefined): string {
  return (value ?? "")
    .replace(/^(?:mr|mrs|ms|dr|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter((part) => !/^[a-z]\.$/i.test(part))
    .join(" ");
}

function formatWebsite(value: string | undefined): string {
  const website = (value ?? "").trim();

  if (website === "" || /^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
}

function extractDomainFromEmail(value: string | undefined): OperationResult {
  const email = (value ?? "").trim();
  const separatorIndex = email.lastIndexOf("@");

  if (separatorIndex > 0 && separatorIndex < email.length - 1) {
    return { value: email.slice(separatorIndex + 1) };
  }

  return {
    value: "[Not Found]",
    error: "Invalid email address",
  };
}

function capitalizeJobTitles(value: string | undefined): string {
  const acronyms = new Set(["ai", "b2b", "b2c", "ceo", "cfo", "coo", "cto", "hr", "it", "qa", "seo", "ui", "ux", "vp"]);
  const lowerCaseWords = new Set(["and", "at", "for", "in", "of", "on", "the", "to", "with"]);

  return (value ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (acronyms.has(word)) {
        return word.toUpperCase();
      }

      if (index > 0 && lowerCaseWords.has(word)) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function executeOperation(
  operation: StandardOperation,
  value: string | undefined,
): OperationResult {
  switch (operation.kind) {
    case "clean-company-name":
      return { value: cleanCompanyName(value) };
    case "clean-first-name":
      return { value: cleanFirstName(value) };
    case "format-website":
      return { value: formatWebsite(value) };
    case "extract-domain-from-email":
      return extractDomainFromEmail(value);
    case "capitalize-job-titles":
      return { value: capitalizeJobTitles(value) };
  }
}

async function executeConfiguredOperation(
  operation: ConfiguredOperation,
  sourceFieldIndexes: Map<string, number>,
  sourceValues: Array<string>,
  generatedResults: Map<string, OperationResult>,
  dependencies: JobExecutionDependencies,
  subject: ResearchSubject,
): Promise<OperationResult> {
  if (operation.kind === "lead-lookup") {
    return executeLeadLookup(
      operation,
      sourceFieldIndexes,
      sourceValues,
      generatedResults,
      dependencies.leadLookup,
    );
  }

  if (operation.kind === "custom-operation") {
    return executeCustomOperation(
      operation,
      sourceFieldIndexes,
      sourceValues,
      generatedResults,
      dependencies.customOperationProvider,
      subject,
    );
  }

  const resolvedInput = resolveInputValue(
    operation.input,
    sourceFieldIndexes,
    sourceValues,
    generatedResults,
  );

  return resolvedInput.error === undefined
    ? executeOperation(operation, resolvedInput.value)
    : {
        value: "[Not Found]",
        error: resolvedInput.error,
      };
}

async function executeCustomOperation(
  operation: CustomOperation,
  sourceFieldIndexes: Map<string, number>,
  sourceValues: Array<string>,
  generatedResults: Map<string, OperationResult>,
  provider: CustomOperationProvider | undefined,
  subject: ResearchSubject,
): Promise<OperationResult> {
  const definition = customOperationDetails(operation);
  const boundValues = new Map<string, string>();

  for (const binding of operation.inputBindings) {
    const resolvedInput = resolveInputValue(
      binding.input,
      sourceFieldIndexes,
      sourceValues,
      generatedResults,
    );

    if (resolvedInput.error !== undefined) {
      return customOperationFailure(
        definition.expectedOutputType,
        resolvedInput.error,
      );
    }

    boundValues.set(binding.variable, resolvedInput.value ?? "");
  }

  if (provider === undefined) {
    return customOperationFailure(
      definition.expectedOutputType,
      "Custom Operation provider is unavailable",
    );
  }

  let value: string | number | boolean;

  try {
    value = await provider.execute({
      prompt: renderPromptTemplate(definition.promptTemplate, boundValues),
      expectedOutputType: definition.expectedOutputType,
      ...(definition.generationModel === undefined
        ? subject
        : { generationModel: definition.generationModel }),
    });
  } catch (error) {
    return customOperationFailure(
      definition.expectedOutputType,
      error instanceof SpendLimitReachedError
        ? error.message
        : "Custom Operation could not be completed",
    );
  }

  return normalizeCustomOperationOutput(value, definition.expectedOutputType);
}

async function executeLeadLookup(
  operation: LeadLookupOperation,
  sourceFieldIndexes: Map<string, number>,
  sourceValues: Array<string>,
  generatedResults: Map<string, OperationResult>,
  leadLookup: LeadLookup | undefined,
): Promise<OperationResult> {
  const inputs: Partial<Record<LookupInputRole, string>> = {};

  for (const binding of operation.inputBindings) {
    const resolvedInput = resolveInputValue(
      binding.input,
      sourceFieldIndexes,
      sourceValues,
      generatedResults,
    );

    if (resolvedInput.error !== undefined) {
      return { value: "[Not Found]", error: resolvedInput.error };
    }

    if ((resolvedInput.value ?? "").trim() !== "") {
      inputs[binding.role as LookupInputRole] = resolvedInput.value;
    }
  }

  if (Object.keys(inputs).length === 0) {
    return { value: "[Not Found]", error: "Row has no values to look up" };
  }

  if (leadLookup === undefined) {
    return { value: "[Not Found]", error: "Lead lookup is not configured" };
  }

  try {
    const result = await leadLookup.lookUpField({
      subject: operation.subject,
      inputs,
      outputField: operation.outputField,
      minimumConfidence: operation.minimumConfidence,
    });

    return result.status === "Found"
      ? { value: result.value }
      : { value: "[Not Found]", error: result.reason };
  } catch (error) {
    return {
      value: "[Not Found]",
      error: error instanceof LeadDirectoryUnavailableError
        ? error.message
        : "Lead lookup could not be completed",
    };
  }
}

function customOperationDetails(operation: CustomOperation): CustomOperationDetails {
  return "name" in operation ? operation : operation.definition;
}

function customOperationFailure(
  expectedOutputType: ExpectedOutputType,
  error: string,
): OperationResult {
  return {
    value: expectedOutputType === "Boolean" ? "[Uncertain]" : "[Not Found]",
    error,
  };
}

function resolveInputValue(
  input: InputReference,
  sourceFieldIndexes: Map<string, number>,
  sourceValues: Array<string>,
  generatedResults: Map<string, OperationResult>,
): ResolvedInput {
  if (input.kind === "source-field") {
    const sourceFieldIndex = sourceFieldIndexes.get(input.field);

    return {
      value:
        sourceFieldIndex === undefined ? undefined : sourceValues[sourceFieldIndex],
    };
  }

  const upstreamResult = generatedResults.get(input.field);

  if (upstreamResult?.error !== undefined) {
    return {
      error: `Unavailable generated field: ${input.field}`,
    };
  }

  return { value: upstreamResult?.value };
}

function renderPromptTemplate(
  promptTemplate: string,
  boundValues: Map<string, string>,
): string {
  return promptTemplate.replace(/\{([^{}]+)\}/g, (placeholder, variable) =>
    boundValues.get(variable) ?? placeholder,
  );
}

function normalizeCustomOperationOutput(
  value: string | number | boolean,
  expectedOutputType: ExpectedOutputType,
): OperationResult {
  const valid =
    (expectedOutputType === "Text" && typeof value === "string") ||
    (expectedOutputType === "Number" &&
      typeof value === "number" &&
      Number.isFinite(value)) ||
    (expectedOutputType === "Boolean" && typeof value === "boolean");

  if (valid) {
    return { value: String(value) };
  }

  return {
    value: expectedOutputType === "Boolean" ? "[Uncertain]" : "[Not Found]",
    error: `Custom Operation returned an invalid ${expectedOutputType}`,
  };
}

function enrichedFileName(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}_enriched`;
  }

  return `${fileName.slice(0, extensionIndex)}_enriched${fileName.slice(extensionIndex)}`;
}
