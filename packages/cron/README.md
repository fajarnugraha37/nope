# @fajarnugraha37/cron

Quartz-style scheduler + job queue for Bun/Node with persistence, retries, progress, and deterministic time controls.

## Current Capabilities
- Quartz cron planner (W/L/#/? nicknames, per-trigger timezone, include/exclude calendars)
- RRULE planner (calendars, EXDATE, BYSETPOS monthly/weekly, BYHOUR/MINUTE/SECOND)
- Human syntax helpers `every()` and `at()` for ergonomic trigger definitions
- Concurrency + token bucket rate limiting (global + per job)
- Retries with configurable backoff, misfire policies, stalled detection via heartbeats
- Deterministic virtual clock harness for planner/store/scheduler tests
- In-memory store + Redis adapter sketch; scheduler emits all lifecycle events

## Human Scheduling Helpers

```ts
import { every, at } from "@fajarnugraha37/cron";

const refresh = every("5m", { maxRuns: 10 }); // TriggerOptions
const nightly = at("2024-12-31T23:55:00Z", { timezone: "UTC" });
```

Both helpers return plain `TriggerOptions`, so they slot into `scheduler.schedule(jobName, every("10m"))`.

## Deterministic Virtual Clock

Use `createVirtualClock({ startAt })` from `src/util/clock.ts` to advance time manually in tests:

```ts
const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00Z") });
const scheduler = createScheduler({ clock, store: new InMemoryStore({ clock }) });
clock.advance(5_000); // deterministically trigger runs scheduled 5s ahead
```

See `tests/unit/util/clock.test.ts`, `tests/unit/store/memory.test.ts`, and `tests/unit/scheduler/virtualClock.test.ts` for reference patterns.
