# Progress Log

## Current Snapshot
- ✅ Utilities shipped: `clock`, `logger`, `errors`, `heap`, `parse`, `backoff`.
- ✅ Event system (`events/bus.ts`) + execution helper (`queue/runner.ts`).
- ✅ Storage contracts + in-memory store + Redis adapter sketch.
- ✅ Scheduler engine with job registry, cron/every/at/rrule planners, lifecycle events, pause/resume/shutdown hooks.
- ✅ Cron planner: Quartz W/L/#/? + timezone evaluation + include/exclude calendars.
- ✅ RRULE planner: calendars, exdates, BYSETPOS (monthly/weekly), BYHOUR/MINUTE/SECOND, per-trigger shell workers.
- ✅ Concurrency controls + token bucket rate limiter guard global/job execution with burst acceptance tests.
- ✅ Heartbeat monitor marks stalled runs, emits `stalled` → `retry`, enforces monotonic progress, honors misfire policies (result persistence still pending).
- ✅ Retry policies/backoff + `retry` events wired per job (result persistence still pending).
- ✅ Human syntax helpers (`every`, `at`) exported with deterministic tests + README note.
- ✅ Deterministic virtual clock harness powers planner/store/scheduler unit tests.

## Open Threads / Next Tasks
1. Build RRULE multi-timezone acceptance vectors (weekday morning report, last-day billing) and add duration-style recurrence support once scenarios demand it.
2. Result persistence: expose retrieval APIs + policies so completed runs can be fetched after scheduler restarts.
3. Rate-limited burst + concurrency acceptance tests; expose DX knobs in README once stable.
4. Flesh out queue/store features (delayed/repeatable jobs, priorities, misfire policies, result persistence) + adapter expectations.
5. Build README, examples, tests (unit/integration/soak), and bench script once core behaviors stabilize.

## Risks & Watchouts
- Cron edge cases + timezone math need golden vectors and property tests to avoid double fires.
- Heartbeat-based stalled detection must balance false positives vs responsiveness; consider adaptive grace windows.
- Shell/process execution requires opt-in configuration, sanitized environment, strong timeout enforcement before GA.
