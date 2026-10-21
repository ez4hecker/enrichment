import { randomUUID } from "node:crypto";
import type {
  EnrichedList,
} from "../job-execution/execute-enrichment-job.js";
import type {
  OutputArtifactStore,
} from "../job-execution/execute-queued-enrichment-job.js";

export function createInMemoryOutputArtifactStore(): OutputArtifactStore {
  const outputs = new Map<string, EnrichedList>();

  return {
    async store(output) {
      const outputArtifactId = randomUUID();
      outputs.set(outputArtifactId, structuredClone(output));
      return outputArtifactId;
    },
    async read(outputArtifactId) {
      const output = outputs.get(outputArtifactId);
      return output === undefined ? undefined : structuredClone(output);
    },
  };
}
