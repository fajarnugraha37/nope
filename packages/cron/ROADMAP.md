# @fajarnugraha37/cron – Working Roadmap

## 0. Foundation (done)
- Repo scaffolding, strict TS/ESM config, exports wire-up.
- Core shared utilities: logger, errors, clock, heap, parse + backoff helpers.
- Storage contracts with in-memory reference implementation + Redis adapter sketch.
- Event bus, job runner, baseline scheduler loop with cron/every/at planners.

## 1. MVP (in progress)
Focus: cron/at/every triggers, in-memory store, job execution core, lifecycle events, pause/resume, graceful shutdown, progress heartbeats, retries/backoff, concurrency primitives.
- [x] Flesh out cron planner to full Quartz parity (W/L/#/? and nicknames) + timezone boundaries.
- [x] Implement retries/backoff per-job, including `retry` events and failure semantics.
- [x] Add concurrency control + semaphores to runner, expose per-job/global limits.
- [x] Persist progress/touch heartbeats + stalled detection hooks.
- [x] Human syntax helpers (`every`, `at`) bloom tests + docs.
- [x] Deterministic virtual clock harness + unit tests for planners/store/scheduler basics.

## 2. Beta
Focus: RRULE + calendars, rate limiter, delayed/repeatable/priority runs, result persistence, stalled detection, sandbox workers.
- [ ] RRULE & EXDATE parser, calendar include/exclude lists, multi-timezone triggers.
- [ ] Rate limiter (token bucket + optional sliding window) integrated with dequeue loop.
- [ ] Long-running queue semantics: delayed/repeatable jobs, per-trigger priority, misfire policies.
- [ ] Persist job results w/ retention policies and retrieval API.
- [ ] Sandboxed worker modes (inline/thread/process) incl. shell command execution opt-in.

## 3. RC
Focus: ecosystem integration + ops polish.
- [ ] Redis adapter implementation + tests; document idempotency keys & atomic ops.
- [ ] Global events via store pub/sub for distributed schedulers.
- [ ] Examples (quickstart, cron W/L/#, RRULE, shell command) + README sections (API, recipes, storage guide, safety).
- [ ] Bench/soak scripts (5k triggers, rate-limit scenario) with tabular output.

## 4. GA
Focus: doc/test completeness, dx polish.
- [ ] 90%+ public API TSDoc coverage, deterministic integration suite.
- [ ] DX refinements (error codes, logger fields, adapter guide) and publish pipeline.
- [ ] README benchmarks + final change log for release.
