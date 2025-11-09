import { describe, expect, it } from "bun:test";
import { createScheduler } from "../../../src/scheduler.js";

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000, intervalMs = 10) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor timeout");
};

describe("scheduler shell worker", () => {
  it("executes shell commands and captures output", async () => {
    const scheduler = createScheduler();
    const completions: any[] = [];

    scheduler.on("completed", (event) => completions.push(event.result));

    await scheduler.registerJob({
      name: "shell-job",
      worker: {
        kind: "shell",
        command: [process.execPath, "-e", "process.stdout.write('ok')"],
      },
    });

    await scheduler.schedule("shell-job", {
      kind: "at",
      runAt: new Date(Date.now() + 10),
    });

    await waitFor(() => completions.length === 1, 5_000);
    expect(completions[0]).toMatchObject({ stdout: "ok" });

    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
