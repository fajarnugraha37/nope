import type { JobDefinition, JobHandlerContext } from "../api.js";
import type { Clock } from "../util/clock.js";
import type { Logger } from "../util/logger.js";
import { createCronError } from "../util/errors.js";
import { createWorkerHandler } from "./workers.js";

export interface RunRequest<TPayload = unknown, TResult = unknown> {
  job: JobDefinition<TPayload, TResult>;
  runId: string;
  triggerId: string;
  scheduledAt: Date;
  attempt: number;
  payload?: TPayload;
  clock: Clock;
  logger: Logger;
  touch: (progress?: number) => Promise<void>;
  timeoutMs?: number;
}

export class JobRunner {
  async run<TPayload, TResult>(request: RunRequest<TPayload, TResult>): Promise<TResult> {
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? request.job.timeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    return new Promise<TResult>((resolve, reject) => {
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          controller.abort();
          reject(createCronError("E_TIMEOUT", `Job ${request.job.name} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        if (typeof timer === "object" && "unref" in timer && typeof (timer as any).unref === "function") {
          (timer as any).unref();
        }
      }

      const context: JobHandlerContext<TPayload> = {
        runId: request.runId,
        triggerId: request.triggerId,
        job: request.job.name,
        payload: request.payload as TPayload,
        scheduledAt: request.scheduledAt,
        attempt: request.attempt,
        signal: controller.signal,
        touch: request.touch,
        logger: request.logger,
        clock: request.clock,
      };

      const handler = request.job.handler ?? (request.job.worker ? createWorkerHandler(request.job.worker) : undefined);
      if (!handler) {
        reject(createCronError("E_CONFIGURATION", `Job ${request.job.name} is missing a handler`));
        return;
      }

      Promise.resolve(handler(context))
        .then((result) => resolve(result as TResult), reject)
        .finally(() => {
          if (timer) {
            clearTimeout(timer);
          }
        });
    });
  }
}
