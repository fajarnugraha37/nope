# @fajarnugraha37/cron

Quartz-style scheduler + job queue for Bun/Node with persistence, retries, progress reporting, deterministic time controls, and pluggable storage/rate limiting primitives. It combines the ergonomics of human-friendly helpers (`every()`, `at()`) with the precision of cron/RRule planners and emits rich lifecycle events so you can observe everything.

1. [Installation](#installation)
2. [Why this lib?](#why-this-lib)
2. [Technical architecture](#technical-architecture)
2. [How it works](#how-it-works)
3. [Quick start](#quick-start)
4. [Core concepts](#core-concepts)
5. [Usage catalog](#usage-catalog)
6. [Advanced features](#advanced-features)
7. [Cookbook](#cookbook)
9. [API reference](#api-reference)

## Installation

### Requirements
- Node.js 18+ or Bun 1.1+ (uses AbortController, EventTarget, and ESM modules).
- TypeScript 5+ for typings (runtime works in plain JavaScript).
- A persistence layer if you need durability beyond the built-in in-memory store.

### Using a package manager

```bash
# npm
npm install @fajarnugraha37/cron

# pnpm
pnpm add @fajarnugraha37/cron

# yarn
yarn add @fajarnugraha37/cron

# bun
bun add @fajarnugraha37/cron
```

### From source

Clone the monorepo, then run `bun install && bun run build` inside `packages/cron`. The build emits ESM, CJS, and type definitions in `dist/`.

## Why this lib?

- **Quartz-grade recurrence** – The planner in `src/planner` understands cron nicknames, `L`, `W`, `#`, per-trigger timezones, RRULE strings (BYSETPOS, EXDATE), and calendar allow/deny lists so you can model real calendars.
- **Scheduler + queue in one** – `SchedulerEngine` (see `src/scheduler.ts`) owns persistence, dispatching, concurrency, retries, tokens, and events so you don’t have to juggle separate tools for planning and running jobs.
- **Deterministic + testable** – `createVirtualClock` lets you freeze and advance time, making unit/integration tests reliable (see `tests/unit/**` for patterns).
- **Observability-first** – Lifecycle events (`scheduled`, `run`, `progress`, `retry`, `completed`, etc.) flow through a lightweight event bus, and the `touch()` API gives precise progress + heartbeats for long-running work.
- **Pluggable persistence** – The `Store` interface (in `src/store/interfaces.ts`) makes it trivial to back the scheduler with SQL/Redis/anything that can list/lease triggers.

## Technical architecture

```
+-------------------+      +-----------------+      +-----------------+
| SchedulerEngine   |----->| EventBus        |----->| Observability   |
| (src/scheduler.ts)|      | (events/bus.ts) |      | (your hooks)    |
+---------+---------+      +-----------------+      +-----------------+
          |
          | uses plans from
          v
+-------------------+      +-----------------+      +-----------------+
| Planner (cron,    |----->| Store interface |<---->| Persistence     |
| every, at, rrule) |      | (store/*.ts)    |      | (memory/redis)  |
+-------------------+      +-----------------+      +-----------------+
          |
          | dispatches runs via
          v
+-------------------+      +-----------------+
| JobRunner +       |----->| Workers/Handlers|
| Semaphore/Token   |      | (queue/*.ts)    |
| Bucket            |      +-----------------+
+-------------------+
```

- **SchedulerEngine** boots, hydrates jobs/triggers from the store, polls for due triggers, handles misfires, enforces concurrency + rate limiting, and emits events.
- **Planner** (`createPlan`) normalizes `TriggerOptions` into deterministic iterators.
- **Store** is responsible for persisting jobs, triggers, runs, leases, and run results. The default `InMemoryStore` is great for tests; swap in your own for durability.
- **Queue utilities** (`JobRunner`, `Semaphore`, `TokenBucket`, `workers.ts`) enforce concurrency, rate limits, abortable timeouts, and optional shell-based workers.
- **Utilities** – `createSystemClock`/`createVirtualClock`, structured logger, cron-specific errors – keep deterministic behavior and rich diagnostics consistent.

## How it works

1. **Bootstrap** – `createScheduler()` instantiates `SchedulerEngine`, which initializes the configured store, rehydrates persisted jobs/triggers, creates plans per trigger, and arms timers.
2. **Register jobs** – `registerJob()` stores the definition (`handler`, `worker`, `concurrency`, `retries`, etc.) and configures semaphores/token buckets per job.
3. **Create triggers** – `schedule(jobName, triggerOptions)` persists a trigger record with next run time, misfire policy, priority, and metadata. The planner snapshot is cached in-memory.
4. **Poll & lease** – A tight loop lists due triggers via `store.listDueTriggers`, attempts to `claimTrigger` with a lease owner/TTL, and prevents double execution across processes.
5. **Misfire handling** – Before running, `handleMisfire` evaluates lateness against `misfireToleranceMs` and the trigger’s `misfirePolicy` (`skip`, `fire-now`, `catch-up`) to decide whether to execute immediately, skip forward, or catch up.
6. **Run preparation** – The scheduler records a pending run, acquires global + job-specific concurrency slots, honors global/job rate limits, and pushes the run through `JobRunner`.
7. **Execution & progress** – Inside the handler, you receive a `touch(progress?)` helper. It updates heartbeats in the store, emits `progress` events, and resets the stalled timer.
8. **Retries & errors** – Failures consult the job-level `RetryPolicy` (backoff strategy or function). Retries yield `retry` events, requeue with delay, and increment attempts until exhausted.
9. **Completion** – Successful/terminal results persist through `store.recordRunEnd`. Slots release, the plan computes the next occurrence, and observers receive `completed`, `canceled`, or `stalled` events. `shutdown()` drains active runs before disposing resources.

## Quick start

```ts
import { createScheduler, every, at } from "@fajarnugraha37/cron";

const scheduler = createScheduler({
  id: "billing-scheduler",
  heartbeatIntervalMs: 5_000,
  stalledAfterMs: 30_000,
  globalRateLimit: { capacity: 10, refillRate: 5, refillIntervalMs: 1_000 },
});

await scheduler.registerJob({
  name: "sync-invoices",
  concurrency: 4,
  retries: {
    maxAttempts: 5,
    strategy: (attempt) => Math.min(60_000, attempt ** 2 * 1_000),
  },
  handler: async ({ payload, attempt, logger, touch, signal }) => {
    logger.info(`Starting sync for ${payload.accountId} (attempt ${attempt})`);
    await touch(5);
    if (signal.aborted) throw new Error("aborted");
    // ...do work...
    await touch(100);
    return { status: "ok" };
  },
});

scheduler.on("completed", ({ job, runId, result }) => {
  console.info(`[${job}] run ${runId} finished`, result);
});

await scheduler.schedule(
  "sync-invoices",
  every("15m", { timezone: "UTC", metadata: { source: "maintenance" } }),
);

await scheduler.schedule(
  "sync-invoices",
  at("2024-12-31T23:55:00Z", { misfirePolicy: "fire-now", metadata: { reason: "final run" } }),
);

// Clean shutdown
process.on("SIGINT", () => scheduler.shutdown({ graceful: true, graceMs: 10_000 }));
```

## Core concepts

### Scheduler
`createScheduler(options)` returns the orchestrator that polls triggers, enforces limits, and exposes lifecycle hooks. Options let you set IDs, inject a custom store/clock/logger, tweak polling cadence (`heartbeatIntervalMs`, `stalledAfterMs`, `misfireToleranceMs`), cap concurrency (`maxConcurrentRuns`), and enable a global token bucket (`globalRateLimit`).

### Jobs & handlers
A job definition names the job, provides either a `handler` function or a `worker`, and optionally sets `concurrency`, `timeoutMs`, `retries`, `rateLimit`, and metadata. Handlers receive `JobHandlerContext` (payload, attempt, abort signal, progress touch helper, logger, clock).

### Triggers & plans
Triggers are declarative `TriggerOptions` (`cron`, `every`, `at`, `rrule`). Each becomes a `Plan` object that deterministically yields the next run while honoring start/end bounds, calendars, max runs, and misfire policies.

### Persistence & leases
The store persists jobs, triggers, and run records, and exposes APIs for leasing triggers so multiple scheduler processes can coordinate safely. The default `InMemoryStore` is non-durable; bring your own by implementing `Store`.

### Clock & determinism
Everything runs against an injected `Clock`. System clocks run in real time, while `createVirtualClock` lets you freeze and advance time for deterministic testing or simulation.

### Events & observability
`SchedulerEventName` spans `scheduled`, `run`, `progress`, `retry`, `completed`, `canceled`, `stalled`, `paused`, `resumed`, `drain`, `shutdown`. Subscribe via `scheduler.on(event, listener)` or `once` for instrumentation, metrics, or auditing.

## Usage catalog

### Cron + timezone scheduling

```ts
await scheduler.schedule(
  "rollup",
  {
    kind: "cron",
    expression: "0 0 6 ? * MON-FRI *",
    timezone: "America/New_York",
    calendars: [{ exclude: ["2024-12-25"] }],
    misfirePolicy: "catch-up",
  },
);
```

Supports Quartz nicknames, `L/W/#`, per-trigger calendars, and custom priorities (`priority`).

### RRULE windows and EXDATEs

```ts
await scheduler.schedule("report", {
  kind: "rrule",
  rrule: "FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=1",
  exdates: ["2024-05-01T09:00:00-04:00"],
  timezone: "America/Toronto",
});
```

RRULE triggers share the same calendar filtering pipeline as cron so you can combine ICS-like logic with deterministic plans.

### Interval helpers (`every`)

```ts
scheduler.schedule("purge", every("30s", { maxRuns: 10, offset: 5_000 }));
```

`every()` accepts strings (`"15m"`, `"5s"`) or numbers (ms) plus overrides like timezone, metadata, or start/end bounds.

### Pause/resume scopes

```ts
const handle = await scheduler.schedule("sync", every("5m"));
await handle.pause();   // pause a single trigger
await handle.resume();

const job = await scheduler.registerJob({ name: "sync", handler: fn });
await job.pause();      // job-level pause

await scheduler.pauseAll();  // global pause
await scheduler.resumeAll();
```

All operations emit `paused` / `resumed` events with scope metadata.

### Progress reporting

```ts
await scheduler.registerJob({
  name: "long-task",
  handler: async ({ touch, clock }) => {
    for (let step = 0; step <= 10; step++) {
      await touch(step * 10);
      await clock.sleep(500);
    }
  },
});
```

`touch(progress)` records a heartbeat and optional 0–100 progress value, preventing stalled detection and broadcasting `progress` events.

### Shell workers

```ts
await scheduler.registerJob({
  name: "render-pdf",
  worker: {
    kind: "shell",
    command: ["node", "./scripts/render.js"],
    cwd: process.cwd(),
    env: { SERVICE_TOKEN: process.env.SERVICE_TOKEN ?? "" },
    timeoutMs: 120_000,
  },
});
```

When `worker` is provided, `JobRunner` spawns the process, streams stdout/stderr, and enforces aborts/timeouts.

## Advanced features

- **Misfire strategies** – Per-trigger `misfirePolicy` combined with `misfireToleranceMs` decides whether overdue runs skip, fire immediately, or catch up with logging.
- **Retries with backoff** – Jobs opt into `RetryPolicy` using built-in exponential strategy helpers or custom functions returning delay per attempt.
- **Backpressure controls** – Global and job-specific `Semaphore`s plus `TokenBucket` rate limiters keep compute/utilization predictable.
- **Heartbeat & stalled detection** – `touch()` updates run heartbeats; the monitor thread marks runs as `stalled` once `stalledAfterMs` elapses, emits events, and retries or cancels.
- **Deterministic clocks** – Inject `createVirtualClock` to freeze time, fast-forward schedules, or simulate long windows instantly in tests.
- **Pluggable persistence** – Implement `Store` on top of Redis, Postgres, etc. The scheduler already calls `listDueTriggers`, `claimTrigger`, and `recordRun*`, so adapters only need to honor those contracts.

## Cookbook

### Multi-tenant ingestion with per-tenant caps

```ts
const scheduler = createScheduler({ maxConcurrentRuns: 20 });

await scheduler.registerJob({
  name: "ingest-account",
  concurrency: 2, // per tenant
  rateLimit: { capacity: 5, refillRate: 1, refillIntervalMs: 1_000 },
  handler: async ({ payload, logger }) => {
    logger.info(`Ingesting ${payload.accountId}`);
    // ingest...
  },
});

for (const account of accounts) {
  await scheduler.schedule("ingest-account", every("10m", { metadata: { accountId: account.id }, timezone: account.tz }));
}
```

Each account gets its own trigger metadata; concurrency + rate limits guard noisy neighbors.

### Backfill windows with RRULE + catch-up

```ts
await scheduler.schedule("backfill-ledger", {
  kind: "rrule",
  rrule: "FREQ=DAILY;COUNT=90",
  startAt: new Date("2024-01-01T00:00:00Z"),
  misfirePolicy: "catch-up",
  priority: -10, // run before normal triggers
  metadata: { mode: "backfill" },
});
```

If the process is down, `catch-up` replays missed occurrences sequentially while logging misfire delays.

### Deterministic testing with virtual clocks

```ts
import { createVirtualClock, createScheduler, InMemoryStore } from "@fajarnugraha37/cron";

const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00Z") });
const store = new InMemoryStore({ clock });
const scheduler = createScheduler({ clock, store });

await scheduler.registerJob({ name: "tick", handler: ({ scheduledAt }) => events.push(scheduledAt) });
await scheduler.schedule("tick", every("1h"));

clock.advance(60 * 60 * 1000); // triggers synchronously in tests
```

Advancing the virtual clock immediately flushes pending timers, letting you assert on run order without sleeping.

### Observability hook for metrics

```ts
const unsubscribe = scheduler.on("progress", ({ job, progress }) => {
  metrics.histogram(`jobs.${job}.progress`).record(progress);
});

// Later
unsubscribe();
```

Every listener receives strongly-typed payloads so you can wire logs, metrics, or tracing quickly.

## API reference

### `createScheduler(options?: CreateSchedulerOptions): Scheduler`
Creates a scheduler. Notable `CreateSchedulerOptions`:
- `id` – identifies the scheduler instance/lease owner.
- `store` – any implementation of `Store` (`InMemoryStore` by default).
- `clock` – `createSystemClock()` by default; injectable for tests.
- `logger` – structured logger (defaults to console-like logger).
- `heartbeatIntervalMs`, `stalledAfterMs` – control heartbeat cadence and stall detection threshold.
- `maxConcurrentRuns` – global semaphore limit.
- `globalRateLimit` – `RateLimitOptions` to cap total throughput.
- `misfireToleranceMs` – lateness threshold before misfire policies engage.

### `Scheduler` interface
Key methods:
- `registerJob(definition): Promise<JobHandle>`
- `schedule(jobName, triggerOptions): Promise<TriggerHandle>`
- `on(eventName, listener)` / `once` / `off`
- `pauseAll()`, `resumeAll()`
- `getRun(runId)`
- `shutdown({ graceful, graceMs, reason })`

`JobHandle` exposes `pause()`, `resume()`, `unregister()`. `TriggerHandle` exposes `pause()`, `resume()`, `cancel()`.

### `JobDefinition`
Fields:
- `name` (required)
- `handler` or `worker` (at least one required)
- `concurrency`, `timeoutMs`
- `retries: RetryPolicy` (`maxAttempts`, `strategy`)
- `rateLimit: RateLimitOptions` (`capacity`, `refillRate`, `refillIntervalMs`, `burst`)
- `metadata` (stored alongside job)
- `worker` currently supports `{ kind: "shell" }`.

### Trigger helpers & options
- `every(interval, overrides?)` – interval string (`"5m"`, `"1h30m"`) or milliseconds.
- `at(runAt, overrides?)` – schedule one-off runs.
- Manual triggers via `TriggerOptions` union:
  - `cron`: `{ expression, timezone?, calendars?, ... }`
  - `every`: `{ every, offset?, ... }`
  - `at`: `{ runAt }`
  - `rrule`: `{ rrule, exdates? }`
Shared fields include `idempotencyKey`, `priority`, `startAt`, `endAt`, `maxRuns`, `misfirePolicy`, `metadata`.

### `Store` interface and `InMemoryStore`
See `src/store/interfaces.ts` for the full contract: `init`, `upsertJob`, `listDueTriggers`, `claimTrigger`, `recordRunStart`, `recordRunEnd`, `touchRun`, `findStalledRuns`, etc. `createInMemoryStore()` gives you a reference implementation.

### Events
`SchedulerEventName` covers:
`scheduled`, `run`, `completed`, `canceled`, `error`, `stalled`, `retry`, `progress`, `paused`, `resumed`, `drain`, `shutdown`.
Each listener receives the typed payload defined in `SchedulerEventMap` (`src/api.ts`).

### Utilities & types
- `JobHandlerContext` – payload/metadata provided to handlers.
- `Clock`, `VirtualClock` – time abstractions exposed via `createSystemClock`, `createVirtualClock`.
- `MisfirePolicy`, `RateLimitOptions`, `RetryPolicy`, `WorkerDefinition` – re-exported from `src/api.ts` for type-safe configs.

---

Need more? Check `tests/` for runnable scenarios or open `PROGRESS.md`/`ROADMAP.md` for upcoming work. Contributions welcome!
