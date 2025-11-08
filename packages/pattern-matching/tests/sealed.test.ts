import { describe, expect, test } from "bun:test";
import { matchSealed, Pattern as P } from "../src/index.ts";

type Status =
  | { type: "loading" }
  | { type: "success"; data: number }
  | { type: "error"; message: string };

describe("matchSealed", () => {
  const sealedStatus = P.sealed(
    { type: "loading" },
    { type: "success", data: P.number },
    { type: "error", message: P.string }
  );

  test("matches all declared variants", () => {
    const status: Status = { type: "success", data: 42 };

    const result = matchSealed(status, sealedStatus)
      .with({ type: "loading" }, () => "loading")
      .with({ type: "success", data: P.number }, ({ data }) => data.toString())
      .with({ type: "error", message: P.string }, ({ message }) => message)
      .run();

    expect(result).toBe("42");
  });
});
