import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EnrichedList } from "../job-execution/execute-enrichment-job.js";
import type { OutputArtifactStore } from "../job-execution/execute-queued-enrichment-job.js";

type OutputArtifactMetadata = {
  fileName: string;
};

export type FileOutputArtifactStoreOptions = {
  directory: string;
};

export function createFileOutputArtifactStore(
  options: FileOutputArtifactStoreOptions,
): OutputArtifactStore {
  return {
    async store(output) {
      const outputArtifactId = randomUUID();
      const temporarySuffix = `${outputArtifactId}.${randomUUID()}.tmp`;

      await mkdir(options.directory, { recursive: true });
      await writeFile(
        join(options.directory, `${temporarySuffix}.csv`),
        output.csv,
        "utf8",
      );
      await writeFile(
        join(options.directory, `${temporarySuffix}.json`),
        JSON.stringify({ fileName: output.fileName }),
        "utf8",
      );
      await rename(
        join(options.directory, `${temporarySuffix}.csv`),
        csvPath(options.directory, outputArtifactId),
      );
      await rename(
        join(options.directory, `${temporarySuffix}.json`),
        metadataPath(options.directory, outputArtifactId),
      );

      return outputArtifactId;
    },
    async read(outputArtifactId) {
      if (!isOutputArtifactId(outputArtifactId)) {
        return undefined;
      }

      try {
        const [metadataText, csv] = await Promise.all([
          readFile(metadataPath(options.directory, outputArtifactId), "utf8"),
          readFile(csvPath(options.directory, outputArtifactId), "utf8"),
        ]);
        const metadata = parseMetadata(metadataText);

        return metadata === undefined
          ? undefined
          : { fileName: metadata.fileName, csv } satisfies EnrichedList;
      } catch (error) {
        if (isMissingFileError(error)) {
          return undefined;
        }

        throw error;
      }
    },
  };
}

function csvPath(directory: string, outputArtifactId: string): string {
  return join(directory, `${outputArtifactId}.csv`);
}

function metadataPath(directory: string, outputArtifactId: string): string {
  return join(directory, `${outputArtifactId}.json`);
}

function isOutputArtifactId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseMetadata(value: string): OutputArtifactMetadata | undefined {
  try {
    const parsed: unknown = JSON.parse(value);

    return typeof parsed === "object" &&
      parsed !== null &&
      "fileName" in parsed &&
      typeof parsed.fileName === "string"
      ? { fileName: parsed.fileName }
      : undefined;
  } catch {
    return undefined;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
