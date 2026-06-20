# Praxis Quality Audit

Last updated: 2026-06-18

This audit answers what currently works, what has been validated by build checks, and what is not implemented yet.

## Current Validation Commands

Latest known successful checks:

```bash
npm run build
cargo fmt
npm run tauri build
```

Latest known successful Rust domain test command:

```powershell
$env:PATH='C:\Users\rafae\.cargo\bin;' + $env:PATH; cargo test
```

Current Rust domain tests:

- recurrence: weekly generation without duplicates
- recurrence: monthly date clamping
- recurrence: recurring reminder time projection
- recurrence: invalid interval/time validation
- reminders: schedule pending task reminder
- reminders: cancel reminder when task is completed
- reminders: remove reminders for deleted tasks
- tasks: classify action views (`myDay`, overdue, upcoming)
- tags: name/color normalization
- tags: unique slug generation
- tags: slug fallback

These prove the app compiles and packages, but they do not prove every runtime behavior such as OS notification delivery.

## Capability Matrix

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Public route `/vault` | Implemented | Vue Router guard/build | User can only open cofre from public route. |
| Protected route `/today` | Implemented | Vue Router guard/build | Redirects to `/vault` when cofre is not active. |
| Encrypted `.praxis` file | Implemented | Rust build | Uses Argon2id + XChaCha20-Poly1305. |
| External file change detection | Implemented, needs runtime confirmation | Build | Compares file length + modified timestamp before writes. |
| Safety copies before writes | Implemented, needs runtime confirmation | Build | Copies encrypted `.praxis` to app data `safety-copies/`. |
| Conflict overwrite prevention | Implemented, needs runtime confirmation | Build | Refuses write if file changed externally and preserves conflict copy. |
| Remember unlock on trusted device | Implemented | Rust build | Uses OS credential store through `keyring` plus Windows DPAPI fallback. |
| Lock/logout cofre | Implemented | Code path/build | Deletes saved credential, clears tasks, clears badge. |
| Create task | Implemented | Build | Persists inside encrypted `.praxis`. |
| Task notes | Implemented | Build | Notes are stored and displayed. |
| Complete/reopen task | Implemented | Build | Updates task status and badge. |
| Delete task | Implemented | Build | Removes task and updates badge. |
| Meu Dia badge count | Implemented | Build | Derived from pending `plannedFor` today or due/overdue tasks. |
| Minimal action views | Implemented, partially tested | Rust tests + build | `myWeek`, `pending`, `overdue`, `upcoming`, `withReminders`, `completed` are returned by task collection. |
| Reminder field on task | Implemented | Build | `reminderAt` is stored. |
| Persisted reminder metadata | Implemented | Build | `reminders` lives in encrypted `.praxis`. |
| Reminder scheduling while app is open | Implemented, needs runtime confirmation | Build + code audit | Schedules JS timer from persisted `scheduled` reminders. |
| Missed reminder reconciliation | Implemented, needs runtime confirmation | Build + code audit | Due reminders fire on hydration and are marked `fired` if notification permission is available. |
| OS-level durable scheduled reminder | Not implemented | Audit | Current scheduler is app/webview timer based. |
| Tags CRUD | Implemented | Build | Tags persist in encrypted `.praxis` under `tags`. |
| Assign tags to tasks | Implemented | Build | Relations persist in encrypted `.praxis` under `taskTags`. |
| Rename/recolor tag reflecting in tasks | Implemented | Build + derived state | Tasks resolve tag display by id from the tag store. |
| Recurrence rules CRUD | Implemented | Build | Rules persist in encrypted `.praxis` under `recurrenceRules`. |
| Recurring task generation | Implemented, partially tested | Rust tests + build | `list_tasks` generates due missing occurrences through today without duplicates. |
| Recurring reminders | Implemented, partially tested | Rust tests + build | Generated tasks receive `reminderAt` when rule `notify` is true. |
| High-performance filtered lists | Not proven | Audit | Current full JSON read/write is MVP-only. |

## Reminder Runtime Test

Manual test to run inside the packaged or dev app:

1. Open or create a cofre.
2. Create a task planned for today.
3. Add a reminder 1 minute in the future.
4. Keep the app open or minimized.
5. Confirm OS notification permission is granted.
6. Wait for the reminder.
7. Expected result: notification appears with task title and notes.
8. Complete the task before the reminder time.
9. Expected result: notification does not fire.
10. Create a task with a reminder 1 minute in the future.
11. Close/minimize Praxis using the window `X`, keeping the tray process alive.
12. Wait for the reminder.
13. Expected result: notification appears and the reminder is marked fired.
14. Create a task with a reminder in the past, then reopen/hydrate the cofre.
15. Expected result: notification fires during hydration and the reminder is marked fired.

Known caveats:

- Windows notification settings can block delivery.
- Focus Assist / Do Not Disturb can hide notification banners.
- Current scheduler depends on the app/webview staying alive.
- If the user exits through tray `Sair`, no OS-level scheduled notification is currently registered.

## Tags Runtime Test

The following manual runtime tests should pass in the app:

1. Create tag `work` with color blue.
2. Create tag `personal` with color green.
3. Assign `work` to a task.
4. Filter `Meu Dia` by `work`.
5. Rename `work` to `client`.
6. Verify the task now displays `client` without changing the task record.
7. Change `client` color.
8. Verify all task displays update immediately.
9. Remove tag from task.
10. Delete tag and confirm task relation cleanup.

Current result: build-ready, but manual runtime execution in the desktop app is still recommended after opening a real cofre.

## Recurrence Runtime Test

The following manual/domain tests should pass before recurrence is considered ready for user-facing UI:

1. Create a weekly recurrence starting today.
2. Hydrate/list tasks.
3. Expected result: one pending task appears for today with `recurrenceId` and `occurrenceDate`.
4. Hydrate/list tasks again.
5. Expected result: no duplicate task is created for the same recurrence/date.
6. Create a monthly recurrence starting on the 31st.
7. Generate through a shorter month.
8. Expected result: occurrence date is clamped to the valid last day of that month.
9. Create recurrence with `notify = true` and `reminderTime = 09:00`.
10. Expected result: generated task has `reminderAt` and the reminder scheduler receives it.
11. Complete a generated occurrence.
12. Expected result: only that occurrence is completed; future due occurrences can still generate.

Current result: core fixture tests pass. More end-to-end runtime testing is still needed through Tauri commands and a real cofre.

## Performance Test That Cannot Be Claimed Yet

Required test before claiming high-performance filtered lists:

1. Generate 1,000 tasks.
2. Generate 25 tags.
3. Assign 1-5 tags per task.
4. Filter by `Meu Dia`, completed, pending, and tag.
5. Measure list refresh time.
6. Repeat with 10,000 tasks.

Current result: not run. Current storage model reads/writes the full encrypted JSON document and filters in memory, so this should be considered an MVP storage strategy, not a final high-performance strategy.

## Recommended Next Implementation

1. Add user-facing conflict resolution: reload, preserve current session, or create explicit conflict file.
2. Avoid no-op writes during hydration/reconciliation to reduce safety-copy churn.
3. Add a native/runtime manual test path for reminders in dev builds.
4. Add a small generator/test command for performance fixtures.
5. Investigate OS-level durable scheduled reminders or a native background agent.
