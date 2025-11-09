import { describe, expect, it } from "bun:test";
import { createLogger } from "../../../src/util/logger.js";

describe("util/logger", () => {
  it("respects log levels and writes entries", () => {
    const entries: string[] = [];
    const logger = createLogger({
      level: "warn",
      name: "test",
      writer: (entry) => {
        entries.push(`${entry.level}:${entry.message}`);
      },
    });

    logger.debug("ignored");
    logger.error("boom", { id: 1 });
    expect(entries).toEqual(["error:boom"]);
  });

  it("supports child loggers inheriting fields", () => {
    const entries: Array<Record<string, unknown>> = [];
    const parent = createLogger({
      name: "parent",
      writer: (entry) => entries.push(entry.fields),
    });
    const child = parent.child({ runId: "run-1" });
    child.info("hello");
    expect(entries[0]).toMatchObject({ logger: "parent", runId: "run-1" });
  });

  it("allows level mutation", () => {
    const entries: string[] = [];
    const logger = createLogger({ writer: (entry) => entries.push(entry.level) });
    logger.level = "debug";
    logger.debug("hello");
    expect(entries).toEqual(["debug"]);
  });
});
