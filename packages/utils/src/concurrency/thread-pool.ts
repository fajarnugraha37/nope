import { JobQueue } from "./job-queue.js";

// runs CPU-bound functions in workers when possible (fn as string); otherwise just schedules
export class ThreadPool {
  private nodeWorkerCtor: any | null = null;
  private webWorkerCtor: any | null = null;
  private webWorkerScriptUrl: string | null = null;

  constructor(
    concurrency = Math.max(
      1,
      typeof navigator !== "undefined"
        ? (navigator as any).hardwareConcurrency ?? 4
        : 4
    ),
    private queue = new JobQueue(concurrency)
  ) {
    this.nodeWorkerCtor = this.initNodeWorker();

    if (!this.nodeWorkerCtor) {
      const webWorkerSetup = this.initWebWorker();
      if (webWorkerSetup) {
        this.webWorkerCtor = webWorkerSetup.ctor;
        this.webWorkerScriptUrl = webWorkerSetup.url;
      }
    }
  }

  /** run `fnBody` (string) with `args` in a worker if possible */
  run<T>(fnBody: string, args: any[] = []): Promise<T> {
    if (this.nodeWorkerCtor) {
      return this.queue.add(() => this.runInNodeWorker<T>(fnBody, args));
    }

    if (this.webWorkerCtor && this.webWorkerScriptUrl) {
      return this.queue.add(() => this.runInWebWorker<T>(fnBody, args));
    }

    return this.runInMainThread(fnBody, args);
  }

  private runInMainThread<T>(fnBody: string, args: any[]): Promise<T> {
    // fallback: run in-process via Function
    return this.queue.add(() => {
      // eslint-disable-next-line no-new-func
      const f = new Function(...args.map((_, i) => `a${i}`), fnBody) as (
        ...xs: any[]
      ) => T;
      return Promise.resolve(f(...args));
    });
  }

  private runInNodeWorker<T>(fnBody: string, args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const worker = new this.nodeWorkerCtor!(
        `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', ({ fnBody, args }) => {
            try {
              const f = new Function(...Array.from({length: args.length}, (_,i)=>"a"+i), fnBody);
              Promise.resolve(f(...args)).then(
                v => parentPort.postMessage({ ok: true, v }),
                e => parentPort.postMessage({ ok: false, e: String(e) })
              );
            } catch (e) {
              parentPort.postMessage({ ok: false, e: String(e) });
            }
          });
        `,
        { eval: true }
      );

      const handleMessage = (m: any) => {
        cleanup();
        m.ok ? resolve(m.v as T) : reject(new Error(m.e));
      };

      const handleError = (e: any) => {
        cleanup();
        reject(e);
      };

      const cleanup = () => {
        worker.terminate();
        worker.off?.("message", handleMessage);
        worker.off?.("error", handleError);
        worker.removeListener?.("message", handleMessage);
        worker.removeListener?.("error", handleError);
      };

      if (typeof worker.on === "function") {
        worker.on("message", handleMessage);
        worker.on("error", handleError);
      } else if (typeof worker.addListener === "function") {
        worker.addListener("message", handleMessage);
        worker.addListener("error", handleError);
      } else {
        worker.once?.("message", handleMessage);
        worker.once?.("error", handleError);
      }

      worker.postMessage({ fnBody, args });
    });
  }

  private runInWebWorker<T>(fnBody: string, args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const WorkerCtor = this.webWorkerCtor!;
      const worker = new WorkerCtor(this.webWorkerScriptUrl!);

      const cleanup = () => {
        worker.terminate();
        worker.onmessage = null;
        worker.onerror = null;
      };

      worker.onmessage = (event: any) => {
        cleanup();
        const { ok, v, e } = event.data ?? {};
        ok ? resolve(v as T) : reject(new Error(e));
      };

      worker.onerror = (event: any) => {
        cleanup();
        reject(event?.error ?? new Error(event?.message ?? "Worker error"));
      };

      worker.postMessage({ fnBody, args });
    });
  }

  private initNodeWorker(): any | null {
    try {
      const globalProcess =
        typeof globalThis !== "undefined"
          ? (globalThis as any).process
          : undefined;
      const req = (() => {
        try {
          return Function(
            "return typeof require !== 'undefined' ? require : null"
          )();
        } catch {
          return null;
        }
      })();

      if (globalProcess?.versions?.node && typeof req === "function") {
        const { Worker } = req("node:worker_threads");
        return Worker;
      }
    } catch {
      // ignored: worker_threads not available
    }

    return null;
  }

  private initWebWorker():
    | { ctor: any; url: string }
    | null {
    const globalWorker =
      typeof globalThis !== "undefined"
        ? ((globalThis as unknown as { Worker?: any }).Worker ?? null)
        : null;

    if (!globalWorker) {
      return null;
    }

    if (typeof Blob === "undefined" || typeof URL === "undefined") {
      return null;
    }

    try {
      const script = `
        self.onmessage = (event) => {
          const { fnBody, args } = event.data || {};
          try {
            const argNames = Array.from({ length: (args || []).length }, (_, i) => "a" + i);
            const f = new Function(...argNames, fnBody);
            Promise.resolve(f(...(args || []))).then(
              (value) => self.postMessage({ ok: true, v: value }),
              (err) => self.postMessage({ ok: false, e: err && err.message ? err.message : String(err) })
            );
          } catch (err) {
            self.postMessage({ ok: false, e: err && err.message ? err.message : String(err) });
          }
        };
      `;
      const blob = new Blob([script], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      return { ctor: globalWorker, url };
    } catch {
      return null;
    }
  }
}
