import { describe, expect, test } from "bun:test";

import {
  readRelativeFile,
  __configureReadRelativeFile,
} from "../src/file/read-relative-file.esm";

describe("readRelativeFile", () => {
  test("loads JSON relative to module root", async () => {
    const parts = ["tests", "fixtures", "sample.json"];
    const data = await readRelativeFile<{ message: string }>(parts);
    expect(data.message).toBe("hello from fixture");
    const cached = await readRelativeFile<{ message: string }>(parts);
    expect(cached.message).toBe("hello from fixture");
  });

  test("uses fetch when environment root provided", async () => {
    const originalFetch = globalThis.fetch;
    __configureReadRelativeFile({ reset: true });
    __configureReadRelativeFile({
      fileSystem: false,
      environmentRoot: "https://data.example.com/base",
    });
    const responseBody = { message: "via fetch" };
    globalThis.fetch = (async (url: RequestInfo) => {
      expect(url).toBe("https://data.example.com/base/tests/fixtures/sample.json");
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const data = await readRelativeFile<{ message: string }>([
      "tests",
      "fixtures",
      "sample.json",
    ]);
    expect(data).toEqual(responseBody);

    globalThis.fetch = originalFetch;
    __configureReadRelativeFile({ reset: true });
  });

  test("throws descriptive error when fetch fails", async () => {
    const originalFetch = globalThis.fetch;
    __configureReadRelativeFile({ reset: true });
    __configureReadRelativeFile({
      fileSystem: false,
      environmentRoot: "https://data.example.com",
    });
    globalThis.fetch = (async () =>
      new Response("missing", { status: 404 })) as typeof fetch;

    await expect(
      readRelativeFile(["missing.json"])
    ).rejects.toThrow("Failed to fetch JSON data");

    globalThis.fetch = originalFetch;
    __configureReadRelativeFile({ reset: true });
  });
});
