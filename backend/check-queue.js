import { Queue } from "bullmq";
import { enrichmentExecutionQueueName } from "./src/composition/bullmq-job-dispatcher.js";

async function main() {
  const queue = new Queue(enrichmentExecutionQueueName, {
    connection: { host: "127.0.0.1", port: 6379 }
  });
  
  const jobs = await queue.getJobs();
  console.log("Total jobs:", jobs.length);
  for (const job of jobs) {
    console.log("Job ID:", job.id, job.name, job.data);
    if (job.data === "e42f49cf-5939-48d6-a0cc-ae37a5210da9") {
       await job.remove();
       console.log("Removed job", job.data);
    }
  }
  process.exit(0);
}

main().catch(console.error);
