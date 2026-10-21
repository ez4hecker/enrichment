import { randomUUID } from "node:crypto";

import type { OutputArtifactStore } from "../job-execution/execute-queued-enrichment-job.js";
import type { EnrichedList } from "../job-execution/execute-enrichment-job.js";
import type { EnrichmentJobStatus } from "../enrichment-job-status.js";
import type { EnrichmentJobProgress } from "../enrichment-job-progress.js";
import { isEmptyCsvRow, parseCsv, serializeCsv } from "../csv/csv-codec.js";

export type { EnrichmentJobStatus };

/** "Preview" entries are answers saved from a preview run rather than a processed job. */
export type JobHistoryEntryKind = "Job" | "Preview";

export type EnrichmentJobSummary = {
  id: string;
  kind: JobHistoryEntryKind;
  fileName: string;
  status: EnrichmentJobStatus;
  progress: EnrichmentJobProgress;
};

export type SavedPreview = {
  id: string;
  ownerId: string;
  /** The uploaded Source List's file name, shown in Job History. */
  fileName: string;
  rowCount: number;
  outputArtifactId: string;
};

export type SavedPreviewStore = {
  /** Records the preview as a Completed Job History entry whose output is already stored. */
  storeSavedPreview(preview: SavedPreview): Promise<void>;
};

export type JobHistoryStore = {
  listByOwner(ownerId: string): Promise<Array<EnrichmentJobSummary>>;
  findByOwner(
    ownerId: string,
    jobId: string,
  ): Promise<EnrichmentJobSummary | undefined>;
  findCompletedOutputArtifactIdByOwner(
    ownerId: string,
    jobId: string,
  ): Promise<string | undefined>;
};

export type ListEnrichmentJobsInput = {
  ownerId: string;
};

export type JobHistoryDependencies = {
  jobHistoryStore: JobHistoryStore;
};

export type RequestEnrichedListDependencies = JobHistoryDependencies & {
  outputArtifactStore: OutputArtifactStore;
};

export async function listEnrichmentJobs(
  input: ListEnrichmentJobsInput,
  dependencies: JobHistoryDependencies,
): Promise<{ jobs: Array<EnrichmentJobSummary> }> {
  return {
    jobs: await dependencies.jobHistoryStore.listByOwner(input.ownerId),
  };
}

export async function requestEnrichedList(
  input: { ownerId: string; jobId: string },
  dependencies: RequestEnrichedListDependencies,
): Promise<
  | { status: "Available"; output: EnrichedList }
  | { status: "Unavailable" }
> {
  const outputArtifactId =
    await dependencies.jobHistoryStore.findCompletedOutputArtifactIdByOwner(
    input.ownerId,
    input.jobId,
  );

  if (outputArtifactId === undefined) {
    return { status: "Unavailable" };
  }

  const output = await dependencies.outputArtifactStore.read(outputArtifactId);

  return output === undefined
    ? { status: "Unavailable" }
    : { status: "Available", output };
}

export type SaveEnrichmentPreviewDependencies = {
  savedPreviewStore: SavedPreviewStore;
  outputArtifactStore: OutputArtifactStore;
};

export type SaveEnrichmentPreviewResult =
  | { status: "Saved"; id: string }
  | { status: "Rejected"; code: "INVALID_PREVIEW_CSV" | "PREVIEW_TOO_MANY_ROWS" };

/** Saves already-computed preview answers so they can be downloaded later from Job History. */
export async function saveEnrichmentPreview(
  input: { ownerId: string; fileName: string; csv: string; maximumRows: number },
  dependencies: SaveEnrichmentPreviewDependencies,
): Promise<SaveEnrichmentPreviewResult> {
  let parsedRows: Array<Array<string>>;

  try {
    parsedRows = parseCsv(input.csv);
  } catch {
    return { status: "Rejected", code: "INVALID_PREVIEW_CSV" };
  }

  const [fields, ...rows] = parsedRows.filter((row) => !isEmptyCsvRow(row));

  if (
    fields === undefined ||
    rows.length === 0 ||
    rows.some((row) => row.length !== fields.length)
  ) {
    return { status: "Rejected", code: "INVALID_PREVIEW_CSV" };
  }

  if (rows.length > input.maximumRows) {
    return { status: "Rejected", code: "PREVIEW_TOO_MANY_ROWS" };
  }

  const outputArtifactId = await dependencies.outputArtifactStore.store({
    fileName: previewFileName(input.fileName),
    csv: serializeCsv([fields, ...rows]),
  });
  const id = randomUUID();

  await dependencies.savedPreviewStore.storeSavedPreview({
    id,
    ownerId: input.ownerId,
    fileName: input.fileName,
    rowCount: rows.length,
    outputArtifactId,
  });

  return { status: "Saved", id };
}

function previewFileName(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");

  return extensionIndex <= 0
    ? `${fileName}_preview`
    : `${fileName.slice(0, extensionIndex)}_preview${fileName.slice(extensionIndex)}`;
}
