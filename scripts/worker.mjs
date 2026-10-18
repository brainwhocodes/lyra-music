import "dotenv/config";
import { runWorkerLoop } from "../server/jobs/worker.ts";

// A separate entry point avoids platform-dependent file:// argv comparisons.
runWorkerLoop().catch((error) => {
  console.error("Worker exited due to unhandled error", error);
  process.exitCode = 1;
});
