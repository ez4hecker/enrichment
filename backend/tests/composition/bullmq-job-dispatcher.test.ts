import { describe, expect, it } from "vitest";

import {
  createBullMqJobDispatcher,
  enrichmentExecutionQueueName,
} from "../../src/composition/bullmq-job-dispatcher.js";

describe("BullMQ Job Dispatcher", () => {
  it("enqueues only the Enrichment Job identity", async () => {
    const calls: Array<unknown> = [];
    const dispatcher = createBullMqJobDispatcher({
      queue: {
        async add(name, data, options) {
          calls.push({ name, data, options });
        },
      },
    });

    await dispatcher.dispatch("d58c69d8-dab7-4e03-9a83-095e2403f9ea");

    expect(calls).toEqual([
      {
        name: "execute-enrichment-job",
        data: { jobId: "d58c69d8-dab7-4e03-9a83-095e2403f9ea" },
        options: { jobId: "d58c69d8-dab7-4e03-9a83-095e2403f9ea" },
      },
    ]);
    expect(enrichmentExecutionQueueName).toBe("enrichment-execution");
  });
});
