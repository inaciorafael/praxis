# Praxis Technical Decisions

This document records implementation decisions that future maintenance must preserve unless there is a deliberate migration plan.

## 1. App Surface

- Praxis is a Tauri 2 desktop app with Vue 3, Vite, TypeScript, Pinia, and TailwindCSS.
- The app uses Vue Router for access boundaries.
- Public route:
  - `/vault`
- Authenticated route:
  - `/today`
- Authenticated routes must be protected by router guards, not only by conditional rendering.
- When the vault is open, the app minimizes to taskbar/tray on window close so badge/reminder behavior can continue.
- When the vault is closed, the window close button exits the app instead of keeping a tray process alive.
- The tray `Sair` action is the intentional full app exit.
- Praxis must run as a single desktop instance.
- Launching Praxis while it is already running should restore/show/focus the existing main window instead of creating another process/tray.
- Single-instance behavior is implemented with `tauri-plugin-single-instance`.
- Optional OS autostart is implemented with `tauri-plugin-autostart`.
- Autostart launches Praxis with `--minimized` so the app can restore badge/reminder state without interrupting the user.
- Local app preferences and health diagnostics live behind the app config boundary.
- Rust commands:
  - `get_app_config`
  - `update_app_config`
  - `get_app_health`
- Frontend service/store:
  - `src/shared/lib/app/app-config.service.ts`
  - `src/stores/app.store.ts`
- After startup auto-unlock, the frontend must redirect public vault routes to `/today` when `vault.active` is true.

## 2. Privacy And Storage

- User data lives in a portable encrypted `.praxis` file chosen by the user.
- The `.praxis` file is the source of truth, not a backup export.
- The user may place the `.praxis` file in a synced folder such as Google Drive or OneDrive.
- Praxis does not own cloud sync. It only reads and writes the selected local file path.
- The cloud provider must only see encrypted bytes.

## 3. Encryption

- File password is provided by the user.
- Key derivation: Argon2id.
- Encryption: XChaCha20-Poly1305.
- Salt: random 16 bytes.
- Nonce: random 24 bytes.
- The password is not written to `settings.json`.
- The derived key lives only in memory while the cofre is open.
- A trusted device can remember the password through the OS credential store via `keyring`.
- On Windows, Praxis also stores a device-local DPAPI encrypted credential fallback in app data.
- The DPAPI fallback is bound to the current Windows user profile and is used when `keyring` cannot find the credential.
- Clicking `Bloquear cofre` removes the saved credential and clears in-memory task state.
- Closing/minimizing the app window must not remove the saved credential.
- Vault status exposes `credentialSaved` and `autoUnlockError` so the UI can diagnose whether auto-unlock failed because the file is missing, the saved credential is unavailable, or decryption failed.

## 4. Current File Format

The current `.praxis` file is a JSON envelope:

- public header
- encrypted structured JSON body

The encrypted body currently contains:

- `tasks`
- `tags`
- `taskTags`
- `checklistItems`
- `reminders`
- `recurrenceRules`
- `settings`
- `metadata`

Tags and task/tag relations are now active data in the encrypted body.

## 5. Persistence Strategy

Current MVP persistence:

- read full encrypted document
- decrypt
- mutate structured JSON
- encrypt full document again with a fresh nonce
- write full file

This is acceptable for early MVP validation and small task lists.

This is not the final high-performance storage plan. For large datasets and fast filtered lists, Praxis should migrate to one of these:

- encrypted SQLite inside the `.praxis` container; or
- encrypted append-only/event-log document with in-memory indexes.

Until that migration exists, do not claim high-performance filtering at scale.

Conflict/safety behavior:

- The active vault stores the file fingerprint from open/last successful write.
- The fingerprint is based on file length and modification timestamp.
- Every `write_active_document` checks the current on-disk fingerprint before writing.
- If the file changed externally, Praxis creates an encrypted copy in local `safety-copies/` and refuses to overwrite.
- Before normal writes, Praxis also creates an encrypted `before-write` safety copy.
- Safety copies are encrypted `.praxis` envelopes; they do not expose plaintext task data.
- The Rust API exposes `list_safety_copies`, `get_safety_copies_dir`, and `reload_active_data_file` for the future conflict UI.
- Read/hydration commands must avoid writing unless domain data actually changed.

Current limitation:

- Conflict resolution is still not a polished user-facing screen.
- Future UI should guide reload/merge/conflict-file decisions using the Rust APIs above.

## 6. Tasks

Current task fields:

- `id`
- `title`
- `notes`
- `status`
- `plannedFor`
- `dueAt`
- `reminderAt`
- `recurrenceId`
- `occurrenceDate`
- `completedAt`
- `archivedAt`
- `createdAt`
- `updatedAt`

Current task commands:

- `list_tasks`
- `list_today_tasks`
- `list_week_tasks`
- `list_pending_tasks`
- `list_overdue_tasks`
- `list_upcoming_tasks`
- `list_reminder_tasks`
- `list_completed_tasks`
- `generate_due_recurring_tasks`
- `create_task`
- `update_task`
- `set_task_completed`
- `delete_task`
- `archive_completed_tasks_before`

Missing task commands:

- none for the current MVP domain surface

`update_task` is the domain API for editing/rescheduling a task. Its patch semantics:

- omitted field keeps the current value
- `null` clears nullable text/date fields
- non-empty string updates the field
- empty title is rejected
- after every update, badge and persisted reminders are resynchronized

Task ordering rule:

- Rust is responsible for returning task collections in the default product order.
- Real UI routes must prefer specific task view endpoints instead of hydrating all tasks.
- `list_tasks` remains for compatibility/lab hydration, not for normal screen loading.
- `list_today_tasks` and `list_week_tasks` are view endpoints and return every relevant status for their time window.
- `list_pending_tasks`, `list_overdue_tasks`, `list_reminder_tasks`, and `list_completed_tasks` are strict status/filter endpoints.
- `list_upcoming_tasks` means pending tasks scheduled for a future local date.
- Badge counting remains a separate pending-only rule: pending tasks due today or overdue.
- `list_week_tasks` keeps `today` and `startDate` as separate parameters. A future view date must never redefine the badge's current day.
- Do not duplicate or override the default order in page components unless a user-selected sort mode exists.
- Pending task lists sort by the official urgency order: overdue first, then nearest `dueAt`, then tasks without `dueAt` by `createdAt`.
- `dueAt` is the only field that defines due urgency and overdue state.
- `reminderAt` is for notifications and reminder filters; it must not outrank a due date.
- `plannedFor` is for view membership, such as Meu Dia and Minha Semana; it must not outrank a due date.
- Tasks without `dueAt` sort after due tasks.
- Completed tasks sort after pending tasks in all-task collections and by most recent `completedAt` in completed collections.
- Archived tasks stay encrypted inside the vault but are excluded from normal task endpoints.
- The default completed-task retention is 730 days.
- A user may disable completed-task retention by setting `completedTaskRetentionDays` to `null`.
- Automatic retention must archive only completed tasks whose `completedAt` is older than the configured cutoff.
- Retention is archival, not deletion. It keeps historical data recoverable for future export/restore tooling.
- Archived tasks have a dedicated paginated endpoint and a recovery view outside the main navigation.
- Restoring a task preserves `completedAt`; historical dates must never be rewritten to bypass retention.
- A restored task receives a retention exemption until its completion cycle changes or the user explicitly runs a manual archive.
- Permanent deletion is not part of automatic retention and must always be a separate explicit user action.

## 7. Minimal Organization Model

Praxis should not implement folders, areas, projects, or nested organization in the MVP.

Product decision:

- The app is about surfacing actionable work, not filing tasks away.
- No task should become hidden inside a folder.
- Main navigation should be based on time, status, and action.
- Tags remain optional lightweight filters.
- Future saved filters/views can be considered only if they reinforce daily execution.

Core derived views:

- `myDay`
- `myWeek`
- `pending`
- `overdue`
- `upcoming`
- `withReminders`
- `completed`

Checklist items are allowed because they are not nested tasks. They are visual execution steps inside one parent task.

Checklist rules:

- no due date
- no reminder
- no tags
- no recurrence
- no standalone list membership
- no badge count of their own
- parent task owns official scheduling/status properties
- parent progress is derived from checklist completion
- with checklist items, parent status is automatic: all items complete means completed; any pending item means pending

`myWeek` means pending overdue tasks plus pending tasks planned/due from today through today + 6 days. It does not affect the badge; the badge remains scoped to `myDay`.

## 8. Meu Dia And Badge

Current rule:

- pending task counts in `Meu Dia` if `dueAt` is today or overdue
- completed task appears in `Meu Dia` only if it was completed today
- completed task never counts

The badge count is derived from `Meu Dia`.

On Windows, the badge is implemented as a taskbar overlay icon. It requires the app to keep a taskbar button alive, so the close action minimizes instead of hiding the window.

## 8.1 Day Status Clock

Praxis may show a real-time clock inside the authenticated workspace, but it must be useful, not decorative.

Decision:

- The clock is a day-status indicator for `Meu Dia`.
- The pure rule lives in `src/shared/lib/tasks/day-status.service.ts`.
- The visible Vue component lives in `src/features/tasks/components/DayStatusClock.vue`.
- Page components should not duplicate urgency rules.

Current status levels:

- `normal`: no urgent due task; may still have pending tasks.
- `warning`: at least one pending task is due within the warning window, currently 60 minutes.
- `critical`: at least one pending task is already due or overdue.

Derived status must ignore completed tasks. Overdue and due-soon state are computed from `dueAt`; they are not persisted as task fields.

The clock component uses one lightweight interval while mounted so the UI can update without reloading task data. Do not add extra polling loops for this behavior.

## 9. Reminders

Current reminder behavior:

- `reminderAt` is stored on the task.
- `reminders` is stored in the encrypted `.praxis` document.
- Rust syncs one reminder record per pending task with `reminderAt`.
- A reminder has `scheduled`, `fired`, or `cancelled` status.
- Frontend syncs only persisted `scheduled` reminders into the notification scheduler.
- Pending task with `reminderAt` schedules a local timer while the app/webview is alive.
- Completing a task cancels its pending persisted reminder.
- Deleting a task removes its reminder metadata.
- When a scheduled reminder is already due during hydration, the frontend fires it immediately and marks it `fired` in the cofre if notification permission is available.
- The reminder notification body uses task notes when available.

Current implementation:

- Rust module: `src-tauri/src/reminders.rs`
- Native Windows scheduler bridge: `src-tauri/src/native_reminders.rs`
- Frontend scheduler: `src/shared/lib/notifications/notification.service.ts`
- Pinia store: `src/stores/notification.store.ts`
- Task collection includes `reminders` so task hydration can reconcile timers from encrypted storage.
- On Windows, scheduled task reminders are mirrored into Task Scheduler.
- The native scheduled task launches Praxis with `--minimized --from-native-reminder <id>` at the reminder time.
- When launched this way, trusted-device auto-unlock plus normal reminder hydration can fire overdue reminders even if Praxis was fully exited.
- Launches caused by native reminders are captured from `--from-native-reminder <id>` and exposed to the frontend through `get_notification_launch_context`.
- During hydration, Praxis must not fire every overdue scheduled reminder. It should only fire the overdue reminder that caused the native launch, preventing notification cascades on startup.
- Notification click/action handling is registered in the frontend notification service. The UI can inspect the last interaction to know the task/reminder that was clicked and can complete the task from a notification action.
- Native reminder task names are tracked in local app data `native-reminders/native-reminders.json`.
- Updating/completing/deleting tasks reconciles native scheduled tasks, removing stale ones.
- Native reminder reconciliation is best effort and must not block task persistence or UI updates.
- Native scheduler errors are stored locally in `native-reminders/native-reminders-error.txt` for future diagnostics.
- Task Scheduler XML must be generated without an XML encoding declaration and with local `StartBoundary` format `YYYY-MM-DDTHH:mm:ss`.

Current limitation:

- JavaScript timers are still used while the app/webview is alive.
- Windows Task Scheduler is used as durable wake-up/relaunch support when the process is closed.
- Missed reminders are reconciled when the app opens and the cofre is available.
- If the cofre cannot auto-unlock on that device, the app can be relaunched but cannot read encrypted reminder/task details until the user unlocks it.
- If notification permission is denied, the reminder remains `scheduled` and can retry later.
- Native durable reminder scheduling is currently Windows-only.

Do not promise reminders with absolute certainty while the app is fully exited unless the device has trusted auto-unlock available and Windows Task Scheduler registration succeeds.

## 10. Tags

Current tag behavior:

- create tag
- edit tag name/color
- assign tag to task
- remove tag from task
- filter task lists by tag
- tag edits reflect in all tasks because tasks reference tag ids

Current implementation:

- Rust module: `src-tauri/src/tags.rs`
- Frontend service: `src/shared/lib/tags/tag.service.ts`
- Pinia store: `src/stores/tag.store.ts`
- Types: `src/shared/types/tag.ts`
- UI wiring: `src/pages/today/TodayPage.vue`

Storage rule:

- tasks do not store tag names or colors
- `tags` stores tag identity/name/color
- `taskTags` stores many-to-many relations
- renaming or recoloring a tag updates task display through derived UI state

Current limitation:

- tag filters are in-memory over the loaded encrypted JSON document
- this is correct for MVP behavior, but not yet a proven high-performance indexed query layer
- a benchmark with generated task/tag fixtures is required before claiming scale performance

## 11. Recurrence

Current recurrence behavior:

- Recurrence rules live in encrypted `.praxis` under `recurrenceRules`.
- Rust module: `src-tauri/src/recurrence.rs`.
- Frontend contract: `src/shared/types/recurrence.ts`.
- Frontend service boundary: `src/shared/lib/recurrence/recurrence.service.ts`.
- Supported frequencies: `weekly`, `monthly`, `yearly`.
- A recurrence rule stores the task template: `title`, `notes`, `frequency`, `interval`, `startsOn`, `endsOn`, `notify`, and `reminderTime`.
- Generated tasks are normal tasks with `recurrenceId` and `occurrenceDate`.
- Generation happens during `list_tasks`, before badge and reminder sync.
- `list_tasks` writes the `.praxis` file only when recurrence generation or reminder reconciliation changed persisted data.
- Generation creates missing occurrences from `startsOn` through today, capped at 370 occurrences per run.
- Duplicate prevention is based on `(recurrenceId, occurrenceDate)`.
- Generated occurrences are planned for their occurrence date.
- If `notify` is true, `reminderAt` is created from `occurrenceDate + reminderTime`.
- Completing an occurrence completes only that generated task.

Current recurrence commands:

- `list_recurrence_rules`
- `create_recurrence_rule`
- `update_recurrence_rule`
- `delete_recurrence_rule`

Current limitation:

- Deleting a recurrence rule stops future generation but does not delete already generated occurrences.
- There is no polished UI for recurrence yet.
- Runtime edge cases around month-end recurrence should receive fixture tests before calling recurrence production-ready.

## 12. Lifecycle Timeline

Praxis should support a useful timeline for each task, but it must stay minimal.

Decision:

- Keep `Task` records focused on current state.
- Store task/tag/reminder history as lifecycle events.
- Frontend contract: `src/shared/types/lifecycle.ts`.
- Rust module: `src-tauri/src/lifecycle.rs`.
- Encrypted document field: `lifecycleEvents`.
- Tauri command: `list_task_timeline`.
- Frontend service: `listTaskTimeline` in `src/shared/lib/tasks/task.service.ts`.
- Pinia store action: `tasks.loadTimeline(taskId)`.
- Timeline UI should answer "what happened with this task?" without turning Praxis into a complex audit platform.

Track:

- task creation
- title/date/status changes
- completion and reopening
- tag add/remove
- tag rename/color changes as tag events
- reminder create/update/remove/fire/cancel
- native reminder schedule success/failure when useful for trust
- recurrence-generated task occurrences

Do not track as persisted normal events:

- overdue reaching time, because overdue is derived from `dueAt`
- every read/hydration/reconciliation
- full old note bodies by default
- noisy native command output unless exposed through diagnostic logs

## 13. Quality Gates

Before considering a feature reliable:

- `npm run build`
- `cargo fmt`
- `npm run tauri build`
- manual runtime test for notifications, because OS permission and focus rules affect delivery

Before claiming tags/filtros are ready:

- create tag
- assign to task
- edit tag name/color
- verify task display updates without rewriting every task
- filter `Meu Dia`, pending, and completed by tag
- test with hundreds/thousands of generated tasks

## 14. E-Ink Themes

Praxis supports two explicit appearance modes:

- `light`: warm electronic-paper background with dark ink
- `dark`: charcoal electronic-paper background with soft light ink

Rules:

- The selected theme is persisted in `app-config.json`.
- A localStorage mirror is applied before Vue mounts to avoid a light-theme flash.
- The backend configuration remains the authoritative preference.
- Tauri's native application theme is synchronized so the Windows title bar follows the selected mode.
- Neutral tokens (`paper`, `surface`, `hover`, `selection`, `border`, `ink`, `ink-soft`, and `ink-muted`) change by theme.
- Status and identity colors remain stable between themes.
- Text placed over accent/status colors must use `on-accent`, never `paper`.
- Hardcoded black and white classes are not allowed in product UI; use semantic neutral tokens.
- The light theme represents matte electronic paper, not a bright white display.
- Light-mode neutral surfaces intentionally use reduced luminance and softened contrast for prolonged desktop use.
- Pure white and pure black are not allowed in light-mode controls, shortcut keys or toggles.

## 15. Windows Jump List Navigation

On Windows, Praxis registers native Jump List tasks for its main product views:

- Meu Dia
- Minha Semana

Product rule:

- Keep the Jump List intentionally short.
- It exists for immediate access to today and the next seven days, not as a copy of the sidebar.

Implementation rules:

- Native module: `src-tauri/src/jump_list.rs`.
- Every shortcut launches the current executable with `--open-view=<view>`.
- Allowed destinations are validated in Rust by `src-tauri/src/app_navigation.rs`.
- Unknown values are ignored and can never become arbitrary frontend routes.
- The Windows AppUserModelID is `com.rafael.praxis`, matching the Tauri identifier.
- If Praxis is already running, the single-instance plugin emits `praxis://app-navigation`.
- If Praxis is closed, the initial request is retained until the frontend consumes it.
- Authenticated-route protection remains authoritative. A locked vault is shown first.
- When the user unlocks the vault, a deferred Jump List destination is opened instead of always redirecting to Meu Dia.
- Jump List registration failures must not prevent Praxis from starting.
- Each Jump List task uses a dedicated transparent PNG source and multi-resolution `.ico` generated from the same Lucide icon language used by the frontend.
- Icon resources live in `src-tauri/resources/jump-list` and are bundled under `resources/jump-list`.
- Icon generation is reproducible through `node scripts/generate-jump-list-icons.mjs`.
- Every shortcut falls back to the main executable icon if its dedicated resource is unavailable.

## 16. Runtime Performance

Native reminder reconciliation is incremental:

- `native-reminders.json` records the Windows task name and scheduled time.
- `schtasks /Create` runs only for a new reminder or when its scheduled time changes.
- Removed or cancelled reminders still delete their corresponding Windows task.
- Legacy index entries are refreshed once and migrated automatically.
- The index includes the executable path, so changing between development and installed builds refreshes the Windows task.
- Reading a task view must not recreate unchanged Windows scheduled tasks.

Native reminder delivery is a frozen reliability boundary:

- Windows builds use the GUI subsystem in debug and release; scheduled reminders must never open a console window.
- A native launch resolves its notification payload directly by reminder ID from the encrypted vault.
- Delivery never depends on the currently visible route or on whether that task belongs to the loaded page.
- A reminder is marked as fired only after the notification command is sent.
- Changes to this flow require regression tests for launch parsing, payload resolution, scheduling and fired-state transitions.

Frontend task rendering rules:

- Page-specific task reads keep the in-memory reminder synchronization required to surface native Windows launches as visible notifications.
- Checklist items are indexed by task ID in Pinia and reused by every `TaskCard`.
- Task lookup is indexed by ID instead of rebuilding and scanning all view arrays per card.

## 17. Startup Splash

The startup splash is rendered directly by `index.html`, before Vue and the application stylesheet load.

Rules:

- Never show an unstyled white frame while the WebView initializes.
- Apply the locally stored light or dark theme before the first paint.
- Keep the splash lightweight and independent from Vue, Pinia, Tauri commands and remote assets.
- Remove it only after configuration and vault initialization complete and the mounted UI paints.
- Keep a ten-second failsafe so initialization errors can never leave the application permanently covered.
- The splash uses the Praxis E-Ink palette and respects reduced-motion preferences.

## 18. Inline Task Tags

Task creation supports inline tag commands in the title field.

Rules:

- Typing `+` after whitespace opens the tag selector at the title input.
- The text after `+` filters existing tags by name.
- `ArrowUp` and `ArrowDown` navigate suggestions; `Enter` or `Tab` confirms.
- A name without an exact match is staged as a new tag.
- Staged tags appear as removable chips and the `+name` command is removed from the final task title.
- New tags are persisted only after task creation succeeds, preventing orphan tags when the modal is cancelled.
- New tag colors are selected deterministically through `pickTagColorByName`.
- Every selected or newly created tag is assigned automatically to the created task.
- A plus sign inside a word, such as `C++`, is not interpreted as a tag command.

## 19. Creator Support

The Help Center includes a quiet creator-support section.

Rules:

- Support is voluntary and never blocks, limits or changes product functionality.
- Do not use popups, recurring banners, countdowns, guilt language or donation prompts outside Help.
- Explain concretely that contributions support development, Windows testing and maintenance.
- The public Pix key is configured at build time through `VITE_PRAXIS_PIX_KEY`.
- Never commit a real key to source files; `.env.example` documents the configuration contract.
- Display only a masked version of the key and copy the complete value through an explicit user action.
- When no key is configured, show a neutral availability message instead of fake donation data.
