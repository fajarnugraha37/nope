import { describe, expect, test } from "bun:test";

import {
  escapeRegex,
  makeRe,
  withFlag,
  withoutFlag,
  has,
  count,
} from "../src/regex/common";
import {
  isValidRoutingKey,
  isValidBindingKey,
  topicMatch,
  bindingToRegExp,
  topic,
  route,
  EXAMPLES,
} from "../src/regex/amqp";
import {
  directMatch,
  directRoute,
  headersMatch,
  headersRoute,
  TopicAtoms,
  segs,
  compileTopic,
  topicKey,
} from "../src/regex/amqp-extras";
import {
  runRegexWithTimeout,
  timedCount,
  hasIndicesFlag,
  execWithIndices,
  matchAllWithIndices,
  lit,
  raw,
  seq,
  alt,
  cap,
  nonCap,
  opt,
  rep,
  plus,
  star,
  cls,
  notCls,
  start,
  end,
  wb,
  nb,
  dot,
  ws,
  nws,
  compile,
  tok,
  pathLike,
} from "../src/regex/extras";
import { extractNamedGroups } from "../src/regex/groups";
import {
  matchAll as matchAllSimple,
  groups,
  replaceAllFn,
  splitKeep,
  anyOf as regexAnyOf,
  re,
  rx,
  wordFinder,
} from "../src/regex/match";
import { wildcard, isAllWildcards } from "../src/regex/wildcards";

describe("regex common helpers", () => {
  test("escapeRegex escapes metacharacters", () => {
    expect(escapeRegex("file.*")).toBe("file\\.\\*");
  });

  test("makeRe deduplicates flags", () => {
    expect(makeRe("a", "ggm").flags).toBe("gm");
  });

  test("withFlag and withoutFlag toggle flags", () => {
    const re = /test/;
    expect(withFlag(re, "g").flags).toContain("g");
    expect(withoutFlag(/test/g, "g").flags).not.toContain("g");
  });

  test("has tests string against regex safely", () => {
    expect(has("abc", /b/)).toBe(true);
  });

  test("count counts matches", () => {
    expect(count("aabb", /a/)).toBe(2);
  });
});

describe("regex timeout helpers", () => {
  test("runRegexWithTimeout uses worker-like environment when available", async () => {
    const originalWorker = (globalThis as any).Worker;
    const originalBlob = (globalThis as any).Blob;
    const originalURL = (globalThis as any).URL;

    class FakeWorker {
      onmessage?: (event: { data: any }) => void;
      constructor(_url: string) {}
      postMessage(data: any) {
        const [body, args] = data;
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(
            ...args.map((_: unknown, i: number) => `a${i}`),
            body
          ) as (...xs: unknown[]) => unknown;
          const value = fn(...(args as unknown[]));
          setTimeout(() => this.onmessage?.({ data: { ok: true, value } }), 0);
        } catch (error) {
          setTimeout(
            () =>
              this.onmessage?.({
                data: { ok: false, error: String(error) },
              }),
            0
          );
        }
      }
      terminate() {
        /* no-op */
      }
    }

    (globalThis as any).Blob = class {};
    (globalThis as any).URL = {
      createObjectURL: () => "fake://worker",
    };
    (globalThis as any).Worker = FakeWorker;

    const result = await runRegexWithTimeout<number>(
      "return a0 + a1;",
      [2, 3],
      20
    );
    expect(result).toEqual({ ok: true, value: 5, timedOut: false });

    (globalThis as any).Worker = originalWorker;
    (globalThis as any).Blob = originalBlob;
    (globalThis as any).URL = originalURL;
  });

  test("runRegexWithTimeout falls back to same-thread execution on errors", async () => {
    const originalWorker = (globalThis as any).Worker;
    const originalBlob = (globalThis as any).Blob;
    const originalURL = (globalThis as any).URL;
    const originalRequire = (globalThis as any).require;

    (globalThis as any).Worker = undefined;
    (globalThis as any).Blob = undefined;
    (globalThis as any).URL = undefined;
    (globalThis as any).require = () => {
      throw new Error("no worker_threads");
    };

    const result = await runRegexWithTimeout("throw new Error('boom')", [], 5);
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);

    const success = await runRegexWithTimeout("return 7;", [], 5);
    expect(success).toEqual({ ok: true, value: 7, timedOut: false });

    (globalThis as any).Worker = originalWorker;
    (globalThis as any).Blob = originalBlob;
    (globalThis as any).URL = originalURL;
    if (originalRequire === undefined) delete (globalThis as any).require;
    else (globalThis as any).require = originalRequire;
  });

  test("runRegexWithTimeout uses node worker fallback when available", async () => {
    const originalWorker = (globalThis as any).Worker;
    const originalBlob = (globalThis as any).Blob;
    const originalURL = (globalThis as any).URL;
    const originalRequire = (globalThis as any).require;

    (globalThis as any).Worker = undefined;
    (globalThis as any).Blob = undefined;
    (globalThis as any).URL = undefined;

    class FakeNodeWorker {
      static last: FakeNodeWorker | null = null;
      private listeners = new Map<string, (msg: any) => void>();
      public terminated = false;

      constructor(_src: string, _opts: any) {
        FakeNodeWorker.last = this;
      }

      on(event: string, handler: (msg: any) => void) {
        this.listeners.set(event, handler);
      }

      postMessage({ fnBody, args }: { fnBody: string; args: unknown[] }) {
        setTimeout(() => {
          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(
              ...args.map((_, i) => `a${i}`),
              fnBody
            ) as (...xs: unknown[]) => unknown;
            const value = fn(...args);
            this.listeners.get("message")?.({
              ok: true,
              value,
            });
          } catch (error) {
            this.listeners.get("message")?.({
              ok: false,
              error: String(error),
            });
          }
        }, 0);
      }

      terminate() {
        this.terminated = true;
      }
    }
    FakeNodeWorker.last = null;

    let requireCalls = 0;
    (globalThis as any).require = (moduleName: string) => {
      requireCalls++;
      if (moduleName === "worker_threads") {
        return { Worker: FakeNodeWorker };
      }
      throw new Error(`Unexpected module ${moduleName}`);
    };

    const success = await runRegexWithTimeout("return a0 * a1;", [2, 4], 20);
    expect(success).toEqual({ ok: true, value: 8, timedOut: false });
    expect(FakeNodeWorker.last?.terminated).toBe(true);
    expect(requireCalls).toBeGreaterThan(0);

    const failure = await runRegexWithTimeout("throw new Error('oops')", [], 20);
    expect(failure.ok).toBe(false);
    expect(failure.timedOut).toBe(true);
    expect(failure).toHaveProperty("error");
    expect(FakeNodeWorker.last?.terminated).toBe(true);

    (globalThis as any).Worker = originalWorker;
    (globalThis as any).Blob = originalBlob;
    (globalThis as any).URL = originalURL;
    if (originalRequire === undefined) delete (globalThis as any).require;
    else (globalThis as any).require = originalRequire;
  });

  test("timedCount counts matches via timeout helper", async () => {
    const result = await timedCount("abracadabra", /a/g, 20);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(5);
      expect(result.timedOut).toBe(false);
    }
  });
});

describe("regex amqp helpers", () => {
  test("routing and binding validators", () => {
    expect(isValidRoutingKey("user.created")).toBe(true);
    expect(isValidBindingKey("user.*.#")).toBe(true);
    expect(isValidRoutingKey("user..created")).toBe(false);
  });

  test("topic match handles wildcards", () => {
    expect(topicMatch("kern.*", "kern.crit")).toBe(true);
    expect(topicMatch("kern.*", "kern.a.b")).toBe(false);
  });

  test("bindingToRegExp produces equivalent regex", () => {
    const re = bindingToRegExp("kern.*");
    expect(re.test("kern.info")).toBe(true);
    expect(re.test("kern.info.warn")).toBe(false);
  });

  test("topic helpers filter bindings", () => {
    const bindings = ["kern.*", "user.#"];
    expect(topic.any(bindings, "user.created")).toBe(true);
    expect(topic.all(["#.error", "app.#"], "app.api.error")).toBe(true);
    expect(topic.matchSet(bindings, "kern.info")).toEqual(["kern.*"]);
  });

  test("route picks first matching handler", () => {
    const handled = route(
      [
        { binding: "kern.*", handle: () => "kern" },
        { binding: "user.#", handle: () => "user" },
      ],
      "user.created"
    );
    expect(handled).toBe("user");
  });

  test("examples align with topicMatch", () => {
    for (const [binding, routing, ok] of EXAMPLES) {
      expect(topicMatch(binding, routing)).toBe(ok);
    }
  });
});

describe("amqp extras", () => {
  test("direct exchange helpers", () => {
    expect(directMatch("key", "key")).toBe(true);
    const routed = directRoute(
      [
        { key: "a", handle: () => "a" },
        { key: "b", handle: () => "b" },
      ],
      "b"
    );
    expect(routed).toBe("b");
  });

  test("headers exchange helpers", () => {
    expect(
      headersMatch(
        { "x-match": "all", foo: "bar" },
        { foo: "bar", other: "x" }
      )
    ).toBe(true);
    const routed = headersRoute(
      [
        { binding: { foo: "nope" }, handle: () => "nope" },
        { binding: { "x-match": "any", foo: "bar" }, handle: () => "ok" },
      ],
      { foo: "bar" }
    );
    expect(routed?.result).toBe("ok");
  });

  test("topic DSL builds bindings", () => {
    const bindings = compileTopic(
      segs(TopicAtoms.lit("user")),
      segs(TopicAtoms.one()),
      segs(TopicAtoms.anyOf("created", "deleted"))
    );
    expect(bindings).toEqual(["user.*.created", "user.*.deleted"]);

    const tpl = topicKey`user.${TopicAtoms.anyOf("api", "svc")}.${TopicAtoms.many()}`;
    expect(tpl).toEqual(["user.api.#", "user.svc.#"]);
  });
});

describe("regex extras", () => {
  test("runRegexWithTimeout returns result", async () => {
    const result = await runRegexWithTimeout<number>(
      "return a0 + a1;",
      [1, 2],
      100
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
  });

  test("timedCount counts matches with timeout", async () => {
    const result = await timedCount("aabb", /a/, 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(2);
  });

  test("hasIndicesFlag reflects platform support", () => {
    expect(typeof hasIndicesFlag).toBe("boolean");
  });

  test("execWithIndices annotates match", () => {
    const res = execWithIndices("aabb", /(a)(b)/);
    expect(res?.[0]).toBe("ab");
    expect((res as any).indices).toBeDefined();
  });

  test("matchAllWithIndices returns spans", () => {
    const matches = matchAllWithIndices("aabb", /a/g);
    expect(matches[0].span[0]).toBe(0);
  });

  test("pattern builder composes expressions", () => {
    const pattern = compile(
      seq(
        start,
        cap(plus(tok.digit), "digits"),
        wb,
        plus(ws),
        alt(lit("cats"), raw("dogs")),
        opt(seq(ws, cls("?!"))),
        end
      ),
      "u"
    );
    const match = pattern.exec("123 cats");
    expect(match?.groups?.digits).toBe("123");
  });

  test("helper tokens and pathLike", () => {
    const pathRe = pathLike();
    expect(pathRe.test("foo/bar.txt")).toBe(true);
    expect(pathRe.test("/invalid")).toBe(false);
    expect(cls("a").src).toBe("[a]");
    expect(notCls("a").src).toBe("[^a]");
    expect(dot.src).toBe(".");
    expect(ws.src).toBe("\\s");
    expect(nws.src).toBe("\\S");
    expect(wb.src).toBe("\\b");
    expect(nb.src).toBe("\\B");
    expect(plus(lit("a")).src).toContain("{");
    expect(star(lit("a")).src).toContain("{");
    expect(rep(lit("a"), 1, 3).src).toContain("{1,3}");
  });
});

describe("regex groups and match utilities", () => {
  test("extractNamedGroups returns null when no match", () => {
    const result = extractNamedGroups(/(?<word>hi)/, "bye");
    expect(result).toBeNull();
  });

  test("extractNamedGroups returns groups", () => {
    const groupsResult = extractNamedGroups(
      /(?<year>\d{4})-(?<month>\d{2})/,
      "2024-05"
    );
    expect(groupsResult).toEqual({ year: "2024", month: "05" });
  });

  test("matchAll captures matches with groups", () => {
    const hits = matchAllSimple("aabb", /(a)/g);
    expect(hits[0]).toEqual({
      match: "a",
      index: 0,
      captures: ["a"],
      groups: undefined,
    });
  });

  test("groups extracts named groups", () => {
    const result = groups<{ word: string }>("Hello, world", /(?<word>world)/);
    expect(result?.word).toBe("world");
  });

  test("replaceAllFn rewrites matches", () => {
    const out = replaceAllFn("aabb", /a/g, ({ match }) => match.toUpperCase());
    expect(out).toBe("AAbb");
  });

  test("splitKeep preserves delimiters", () => {
    const parts = splitKeep("a,b;c", /[;,]\s*/g);
    expect(parts).toEqual(["a", ",", "b", ";", "c"]);
  });

  test("regex anyOf merges regex sources", () => {
    const reAny = regexAnyOf([/cat/i, /dog/g], "m");
    expect(reAny.flags).toContain("g");
    expect(reAny.flags).toContain("i");
    expect(reAny.flags).toContain("m");
  });

  test("template re escapes string interpolations", () => {
    const word = "hello.*";
    const pattern = re`^${word}$`;
    expect(pattern.test("hello.*")).toBe(true);
    expect(pattern.test("helloAB")).toBe(false);
  });

  test("rx patterns match expected input", () => {
    expect(rx.uuid.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(rx.emailSimple.test("foo@example.com")).toBe(true);
  });

  test("wordFinder builds whole-word regex", () => {
    const finder = wordFinder("hello");
    expect(finder.test("Hello there")).toBe(true);
    expect(finder.test("ahellob")).toBe(false);
  });
});

describe("wildcard helpers", () => {
  test("wildcard builds regex", () => {
    const reWildcard = wildcard("file-*.txt");
    expect(reWildcard.test("file-123.txt")).toBe(true);
    expect(reWildcard.test("file-123.md")).toBe(false);
  });

  test("isAllWildcards checks pattern", () => {
    expect(isAllWildcards("***")).toBe(true);
    expect(isAllWildcards("*a*")).toBe(false);
  });
});
