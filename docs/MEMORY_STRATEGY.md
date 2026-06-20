# Praxis Memory Strategy

Praxis is designed to stay available in the background. The app should feel resident, not heavy.

## Goals

- Keep idle CPU near zero.
- Avoid unnecessary disk writes while opening or hydrating the app.
- Keep memory predictable for normal daily task usage.
- Preserve badge/reminder behavior while the cofre is open.
- Make future scale work measurable before adding complexity.

## Current Resident Behavior

- When the cofre is open, closing the window minimizes Praxis and keeps the process alive.
- When the cofre is closed, closing the window exits the process.
- Single-instance prevents duplicate processes/trays.
- Autostart launches with `--minimized`.
- Badge state is persisted and reapplied on startup.
- Reminders are scheduled in the frontend while the app/webview is alive.
- On Windows, future reminders are also mirrored into Task Scheduler so the OS can relaunch Praxis if the process was fully closed.
- `get_app_health` exposes a lightweight diagnostic snapshot for future settings/support UI.

## Rules

- Do not add polling loops for task counts, reminders, or file sync.
- Prefer explicit events: task mutation, vault open/reload, recurrence generation, reminder timer fire.
- Do not write the `.praxis` file during read-only hydration.
- `list_tasks` may write only when recurrence generated tasks or reminder metadata changed.
- Avoid loading heavyweight UI views when the app starts minimized.
- Keep completed/history-heavy screens lazy when they become real UI.
- Keep tags, task filters, and derived lists behind stores/services instead of duplicating large reactive arrays in page components.
- Do not store decrypted task data outside the active process memory.
- Do not run health checks on an interval by default. Trigger them from settings/debug UI or explicit user action.

## Current MVP Tradeoff

The MVP decrypts the full `.praxis` document into memory, mutates JSON, and rewrites the encrypted file.

This is acceptable while Praxis is validating the product shape because:

- the user is expected to manage daily tasks, not massive project databases;
- the encrypted document keeps backup/sync simple;
- the domain model can still migrate later without changing the UX promise.

Do not call this final high-scale storage. Before supporting very large datasets, add benchmarks and consider:

- encrypted SQLite;
- an encrypted append-only event log with compacted snapshots;
- Rust-side indexes for due dates, status, tags, and reminders.

## Near-Term Optimization Plan

1. Measure release-build idle memory after startup, after unlock, and after minimizing.
2. Add a generated fixture benchmark for 1k, 5k, and 10k tasks with tags/reminders.
3. Move expensive derived filtering into stable Rust/domain APIs before the UI becomes complex.
4. Add lazy pagination for completed tasks and future history views.
5. Prune or cap local safety copies after adding a user-visible recovery screen.
6. Expand durable reminder scheduling beyond Windows if Praxis becomes cross-platform.

## Acceptance Target

For MVP, Praxis should:

- open quickly;
- avoid visible CPU usage while idle;
- not create new safety copies during no-op app open/hydration;
- keep only one process/tray;
- keep resident behavior opt-in/configurable once the settings UI exists.
