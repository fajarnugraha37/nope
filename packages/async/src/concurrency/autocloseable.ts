// --- disposable symbols (polyfill-safe) ---
const ensureSymbol = (name: "dispose" | "asyncDispose"): symbol => {
  const existing = (Symbol as any)[name];
  if (typeof existing === "symbol") return existing;
  const fallback =
    typeof Symbol.for === "function"
      ? Symbol.for(`Symbol.${name}`)
      : Symbol(`Symbol.${name}`);
  (Symbol as any)[name] = fallback;
  return fallback;
};
const SYM_DISPOSE = ensureSymbol("dispose");
const SYM_ADISPOSE = ensureSymbol("asyncDispose");

// --- type faces we support ---
export interface AutoCloseable {
  close(): void | Promise<void>;
}
export interface Destroyable {
  destroy(err?: unknown): void | Promise<void>;
}
export interface Endable {
  end(): void | Promise<void>;
}
export type DisposableLike = { [k: symbol]: () => void | Promise<void> };

// pick the best close function available on an object
function pickCloser<T extends object>(res: T): (() => Promise<void>) | null {
  // symbols first (if lib already implements them)
  if (SYM_ADISPOSE in (res as any)) {
    const f = (res as any)[SYM_ADISPOSE].bind(res);
    return async () => {
      await f();
    };
  }
  if (SYM_DISPOSE in (res as any)) {
    const f = (res as any)[SYM_DISPOSE].bind(res);
    return async () => {
      await f();
    };
  }
  // common methods
  if (typeof (res as any).close === "function") {
    return async () => {
      await (res as any as AutoCloseable).close();
    };
  }
  if (typeof (res as any).destroy === "function") {
    return async () => {
      await (res as any as Destroyable).destroy();
    };
  }
  if (typeof (res as any).end === "function") {
    return async () => {
      await (res as any as Endable).end();
    };
  }
  return null;
}

// wrap any value into an object that exposes dispose/asyncDispose,
// using provided closer (or auto-detected one)
export function asAutoCloseable<T>(
  value: T,
  closer?: (v: T) => void | Promise<void>
): T & Disposable & AsyncDisposable {
  const runner =
    closer !== undefined
      ? () => Promise.resolve(closer(value))
      : pickCloser(value as any);

  let inFlight: Promise<void> | null = null;
  let finalized = false;

  const finalize = async () => {
    if (finalized) {
      return inFlight ?? Promise.resolve();
    }
    if (!inFlight) {
      inFlight = (async () => {
        try {
          if (runner) {
            await runner();
          }
        } finally {
          finalized = true;
        }
      })();
    }
    return inFlight;
  };

  // define symbol methods non-enumerable
  (value as any)[SYM_ADISPOSE] = () => finalize();
  (value as any)[SYM_DISPOSE] = () => {
    finalize().catch(() => {
      /* swallow sync dispose errors */
    });
  };

  return value as any & Disposable & AsyncDisposable;
}

/* -------------------------------------------------------
   usingScope: go-style defer with auto-closeable support
   ------------------------------------------------------- */

type Finalizer = () => void | Promise<void>;

export async function usingScope<T>(
  fn: (use: UseFn) => Promise<T> | T
): Promise<T> {
  const autoStack: Finalizer[] = [];
  const manualStack: Finalizer[] = [];

  // register anything (value or promise of value) and auto-attach finalizer
  const use = (async function use<V>(
    valOrP: V | Promise<V>,
    closer?: (v: V) => void | Promise<void>
  ): Promise<V> {
    const v = await valOrP;
    const run =
      closer !== undefined
        ? () => Promise.resolve(closer(v))
        : pickCloser(v as any);
    if (run) {
      autoStack.push(run);
    }
    return v;
  }) as UseFn;

  use.addFinalizer = (fn: Finalizer) => {
    manualStack.push(() => Promise.resolve(fn()));
  };

  async function flush(
    stack: Finalizer[],
    swallowErrors: boolean,
    errs?: unknown[]
  ) {
    for (let i = stack.length - 1; i >= 0; i--) {
      try {
        await stack[i]!();
      } catch (error) {
        if (!swallowErrors && errs) {
          errs.push(error);
        }
      }
    }
  }

  try {
    const out = await fn(use as UseFn);
    // success → unwind LIFO
    await flush(autoStack, true);
    await flush(manualStack, true);
    return out;
  } catch (e) {
    // failure → still unwind; collect errors but keep original
    const errs: unknown[] = [];
    await flush(autoStack, false, errs);
    await flush(manualStack, false, errs);
    if (errs.length) (e as any).suppressed = errs;
    throw e;
  }
}

export type UseFn = (<V>(
  valOrP: V | Promise<V>,
  closer?: (v: V) => void | Promise<void>
) => Promise<V>) & {
  addFinalizer: (fn: Finalizer) => void;
};

/* -------------------------------------------------------
   sugar: scope() that returns a guard for manual add()
   ------------------------------------------------------- */

export async function scope<T>(
  fn: (g: { add: (f: Finalizer) => void; use: UseFn }) => Promise<T> | T
): Promise<T> {
  return usingScope(async (use) => {
    const add = (f: Finalizer) => use.addFinalizer(f);
    return fn({ add, use });
  });
}
