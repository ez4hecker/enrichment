import { createProductionRuntime } from "../composition/create-production-runtime.js";
import { productionRuntimeOptionsFromEnvironment } from "../composition/production-runtime-environment.js";

const runtime = createProductionRuntime(
  productionRuntimeOptionsFromEnvironment(process.env),
);

const address = await runtime.start();
process.stdout.write(`CSV Enrichment is listening at ${address}\n`);

let closing = false;

async function close(): Promise<void> {
  if (closing) {
    return;
  }

  closing = true;

  try {
    await runtime.close();
  } catch (error) {
    process.stderr.write(
      `CSV Enrichment shutdown failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
