import { spawn, type ChildProcess } from "child_process";
import type { JobHandler, JobHandlerContext, WorkerDefinition } from "../api.js";
import { createCronError } from "../util/errors.js";

interface ShellResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export const createWorkerHandler = (worker: WorkerDefinition): JobHandler => {
  switch (worker.kind) {
    case "shell":
      return (context) => runShellWorker(worker, context);
    default:
      throw createCronError("E_UNSUPPORTED", `Worker kind '${(worker as { kind: string }).kind}' is not supported`);
  }
};

const runShellWorker = async (worker: WorkerDefinition & { kind: "shell" }, context: JobHandlerContext): Promise<ShellResult> => {
  const env = {
    ...process.env,
    ...(worker.env ?? {}),
  };

  const stdio = { stdout: "", stderr: "" };

  const child = spawnCommand(worker, env, stdio);

  const cleanupAbort = setupAbort(context, child);

  return new Promise<ShellResult>((resolve, reject) => {
    child.on("error", (error) => {
      cleanupAbort();
      reject(createCronError("E_INTERNAL", `Shell worker failed to spawn for job ${context.job}`, { cause: error }));
    });

    child.on("close", (code, signal) => {
      cleanupAbort();
      if (context.signal.aborted) {
        reject(createCronError("E_CANCELED", `Shell worker aborted for job ${context.job}`, { details: stdio }));
        return;
      }
      if (code !== 0) {
        reject(
          createCronError("E_INTERNAL", `Shell worker exited with code ${code} for job ${context.job}`, {
            details: { ...stdio, code, signal },
          })
        );
        return;
      }
      resolve({
        code,
        signal,
        stdout: stdio.stdout,
        stderr: stdio.stderr,
      });
    });
  });
};

const spawnCommand = (
  worker: WorkerDefinition & { kind: "shell" },
  env: NodeJS.ProcessEnv,
  stdio: { stdout: string; stderr: string }
): ChildProcess => {
  const options = {
    cwd: worker.cwd,
    env,
    shell: typeof worker.command === "string" ? worker.shell ?? true : worker.shell,
  };

  const child =
    typeof worker.command === "string"
      ? spawn(worker.command, { ...options, windowsHide: true })
      : spawn(resolveCommand(worker.command), worker.command.slice(1), { ...options, windowsHide: true });

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdio.stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stdio.stderr += chunk;
  });

  return child;
};

const resolveCommand = (command: string[]): string => {
  const [exe] = command;
  if (!exe) {
    throw createCronError("E_CONFIGURATION", "Shell worker command array must include executable");
  }
  return exe;
};

const setupAbort = (context: JobHandlerContext, child: ChildProcess) => {
  const onAbort = () => {
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 2_000);
  };
  context.signal.addEventListener("abort", onAbort);
  return () => context.signal.removeEventListener("abort", onAbort);
};
