# Praxis Data Model

Praxis is a local-first, private task app for daily execution and simple planning. The product promise is: create tasks quickly, never forget what matters today, and finish the day with no pending alerts.

## Product Principles

- All user data is local by default.
- Stored user data must be encrypted at rest before the app is considered production-ready.
- The app should remain simple: tasks, due dates, reminders, recurrence, completion, tags, and focused lists.
- Badge count always represents actionable pending work for the current day.
- The app should optimize for clearing pending work, not for building a complex project-management system.
- Praxis should not organize MVP tasks through folders, areas, projects, or nested hierarchy.
- Tasks must surface through action/time/status views so work is not hidden.

## Privacy And Storage

### Local Data Only

Praxis must not send task, tag, reminder, or settings data to any remote service.

Allowed local storage responsibilities:

- encrypted application database
- local notification/reminder queue
- local app settings
- local badge state cache

Disallowed by default:

- telemetry containing task metadata
- cloud sync
- remote backups
- third-party analytics

User-controlled portable data files are allowed and required. Praxis should let the user choose where the encrypted source file lives. That file may be stored in Google Drive, OneDrive, Dropbox, an external drive, or any synced folder. Praxis must not upload it automatically; it only reads and writes the encrypted file path chosen by the user.

### Encryption At Rest

The intended production storage is an encrypted SQLite database.

Recommended approach:

- Use SQLite as the durable data store.
- Use SQLCipher or an equivalent encrypted SQLite layer.
- Store the encryption key using the OS secure store when possible.
- On Windows, prefer DPAPI-backed key storage or a trusted keyring plugin.
- Never store the raw encryption key next to the database.

For MVP development, a temporary unencrypted store can exist only behind a clear `dev` boundary. It must not become the default production path.

### Portable Data File

Praxis should use a user-controlled encrypted data file as the source of truth. This is not just a backup. It is the file Praxis reads from and writes to during normal use.

Principles:

- The data file must be encrypted at rest.
- The user can place the data file in a synced folder such as Google Drive or OneDrive.
- Praxis must treat that file as the active source of truth.
- The cloud provider should only see encrypted bytes.
- The app should keep a recent local safety copy before writing risky migrations or imports.
- The app should detect when the configured file is missing, locked, corrupted, or being synced.
- The app must avoid silent data loss if two devices edit the same file at the same time.

Recommended file format:

```text
my-tasks.praxis
```

Recommended file payload:

```text
header:
  app: praxis
  format_version: 1
  file_id: stable uuid
  updated_at: ISO timestamp
  encryption: algorithm metadata
  database_schema_version: number

body:
  encrypted SQLite database or encrypted structured document
```

The portable file should include:

- tasks
- tags
- task/tag relations
- checklist items
- reminders
- recurrence rules
- lifecycle events for task/tag/reminder history
- app settings that are safe to restore

The portable file should not include:

- raw encryption keys
- machine-specific secrets
- temporary badge cache
- build artifacts

Data file encryption options:

1. User password protected data file
   - User enters a file password.
   - Praxis derives a file key with Argon2id.
   - File can be opened on another machine.
   - This is the best portability option.

2. Device-bound local unlock
   - Key is protected by Windows DPAPI or OS keyring.
   - Easier after first unlock on the same device.
   - Should wrap/cache the file unlock key locally, never replace the portable password model.

Decision for Praxis: use a password-protected encrypted `.praxis` data file as the portable source of truth. Device-bound key storage can remember/unlock that file on a trusted device, but the user password is what makes multi-device sync possible.

### Multi-Device Sync Model

Praxis should support sync by file location, not by owning a cloud service.

Example flow:

1. User creates `my-tasks.praxis`.
2. User saves it inside a Google Drive or OneDrive folder.
3. Praxis reads/writes that encrypted file.
4. Another device opens the same `.praxis` file from its synced folder.
5. User unlocks it with the file password.

Conflict strategy for MVP:

- Prefer one open writer at a time.
- Store `last_opened_at`, `last_written_at`, and a `device_id`.
- Before saving, check whether the file changed on disk since it was loaded.
- If the file changed externally, stop writing and ask the user to reload or create a conflict copy.
- On risky writes, create a local safety copy first.

Future conflict strategy:

- Event log / operation log per task change.
- Merge non-conflicting edits by entity id and timestamp.
- Surface conflicts only when the same entity changed on multiple devices.

### Storage Files

Target app data layout:

```text
Praxis/
  settings.json    selected data file path and local preferences
  badge-count.json non-sensitive derived cache only
  safety-copies/   local encrypted copies before migrations/risky writes
```

The selected `.praxis` file is the source of truth. Cache files are rebuildable.

## Core Concepts

### Paper Notebooks

`paperBooks` is an optional encrypted document collection of `{ id, name, revision, paperIds }` records. It groups Papers by project or topic, without introducing task projects or changing task views. Each Paper can belong to one notebook or remain unfiled. Notebook deletion only removes membership; drawings and linked tasks remain intact. Missing `paperBooks` means no notebooks, with no hydration write.

### Task

A task is one actionable item the user wants to complete.

Required fields:

- `id`: stable unique id
- `title`: short task title
- `status`: `pending` or `completed`
- `created_at`: when the task was created
- `updated_at`: when the task was last changed

Optional fields:

- `notes`: longer text, optional future field
- `planned_for`: the day the user intentionally placed the task in "Meu Dia"
- `due_at`: date/time when the task is due
- `reminder_at`: date/time when a notification should fire
- `completed_at`: when the task was completed
- `archived_at`: when a completed task was hidden from normal views by retention policy
- `retention_exempt`: prevents an explicitly restored task from being archived again automatically without changing its historical completion date
- `recurrence_id`: recurrence rule reference, when recurring
- `occurrence_date`: generated occurrence local date, when recurring

Rules:

- A completed task never counts toward the badge.
- A pending task counts in "Meu Dia" when it is due today or overdue.
- A pending task with no `planned_for`, no `due_at`, and no `reminder_at` stays in the general task list, not the daily badge.
- `created_at` is history. It should not decide whether the task is due today unless `planned_for` is also set.
- If a task has checklist items, the task status is controlled by the checklist: all items completed means the parent task is completed; any pending item reopens the parent task.
- Checklist progress is derived at read time and must not be persisted as a mutable task field.
- Task collections returned by the backend must be sorted by the official product order: overdue first, then nearest `due_at`, then pending tasks without `due_at` by `created_at`, and completed tasks last by recent completion.
- `due_at` is the only field that defines due urgency and overdue state.
- `reminder_at` is for notification and reminder filters. It must not outrank a due date.
- `planned_for` is for contextual grouping such as Minha Semana. It must not outrank a due date.
- Archived tasks remain in the encrypted vault but are excluded from normal task endpoints and badge/count logic.
- Only completed tasks can be archived automatically. Pending, overdue, recurring active, and reminder-bearing pending tasks must never be archived by retention policy.

### Checklist Item

Checklist items are not subtasks with official scheduling behavior. They are visual execution steps inside a parent task.

Fields:

- `id`
- `task_id`
- `title`
- `status`: `pending` or `completed`
- `sort_order`
- `completed_at`
- `created_at`
- `updated_at`

Rules:

- No due date.
- No reminder.
- No tags.
- No recurrence.
- No badge count of their own.
- They never appear as standalone tasks.
- Parent task `progress.percentage` is derived from completed checklist items.
- A task without checklist uses manual completion and reports progress as `0` or `100`.

### Status

Initial statuses:

- `pending`
- `completed`

Avoid adding more statuses too early. If a task is postponed, update `planned_for`, `due_at`, or `reminder_at` instead of inventing a status.

### Dates

Praxis uses three different date meanings:

- `created_at`: audit/history
- `planned_for`: intentional day list membership
- `due_at`: deadline
- `reminder_at`: notification time

Use UTC timestamps for stored instants:

```text
2026-06-17T13:30:00.000Z
```

Use local dates for day grouping:

```text
2026-06-17
```

The app should calculate "today" using the user's current local timezone.

### Reminder

A reminder is a notification request linked to a task.

Fields:

- `id`
- `task_id`
- `notification_id`
- `scheduled_at`
- `status`: `scheduled`, `fired`, `cancelled`
- `created_at`
- `updated_at`

Rules:

- Completing a task cancels future reminders for that task.
- Changing `reminder_at` reschedules the reminder.
- If the app was not running when a reminder should have fired, the app detects missed reminders during hydration and notifies when permission is available.
- The current MVP keeps timer scheduling inside the running webview; fully exited apps do not fire native OS reminders yet.

### Recurrence

Recurring tasks generate new task instances over time.

Supported MVP frequencies:

- `weekly`
- `monthly`
- `yearly`

Fields:

- `id`
- `title`
- `notes`: optional
- `frequency`
- `interval`: default `1`
- `starts_on`
- `ends_on`: optional
- `notify`: boolean
- `reminder_time`: optional local time, used when `notify` is true

Rules:

- Completing a recurring task completes only that occurrence.
- Missing occurrences are generated during task hydration/listing.
- Recurrence should not duplicate an occurrence that already exists for the same recurrence/date.
- If `notify` is false, recurrence creates tasks without reminders.
- If `notify` is true, generated tasks receive `reminder_at` from `occurrence_date + reminder_time`.
- Deleting a recurrence rule stops future generation but does not delete already generated tasks.

### Tag

Tags are user-created labels for filtering and visual grouping.

Fields:

- `id`
- `name`
- `slug`
- `color`
- `created_at`
- `updated_at`

Rules:

- Tag names are editable.
- Tag colors are editable.
- The `slug` supports stable matching/filtering but should be updated carefully when renaming.
- Task/tag relation is many-to-many.
- Example display names: `work`, `personal`.
- The UI may display them as `+work`, but the stored name should not require the `+` prefix.

### Lifecycle Events

Lifecycle events describe the useful life story of a task without making the task record itself heavy.

Praxis should use lifecycle history for trust and context:

- when the task was created
- when it was completed or reopened
- when important dates changed
- when tags were added/removed
- when a tag used by the task was renamed/recolored
- when a reminder was created, changed, fired, cancelled, or failed to schedule natively
- when a recurring occurrence was generated

Lifecycle history should not become surveillance or noisy audit logging. It exists to answer: "what happened with this task?"

Recommended encrypted document field:

```json
{
  "lifecycleEvents": []
}
```

Base event shape:

```ts
type LifecycleEvent = {
  id: string;
  entityType: "task" | "tag" | "reminder" | "checklistItem";
  entityId: string;
  taskId?: string | null;
  type: LifecycleEventType;
  occurredAt: string;
  actor: {
    type: "user" | "system" | "recurrence" | "scheduler";
    label?: string | null;
  };
  summary: string;
  metadata?: Record<string, unknown>;
};
```

`summary` should be stored or generated at write time so future UI can render a useful timeline without re-implementing domain interpretation in components.

Task event types:

- `taskCreated`
- `taskTitleUpdated`
- `taskNotesUpdated`
- `taskPlannedForUpdated`
- `taskDueAtUpdated`
- `taskCompleted`
- `taskReopened`
- `taskDeleted`
- `taskRestored`
- `taskArchived`
- `taskUnarchived`
- `taskRecurrenceGenerated`
- `checklistCompletedTask`
- `checklistReopenedTask`

Checklist item event types:

- `checklistItemAdded`
- `checklistItemRenamed`
- `checklistItemCompleted`
- `checklistItemReopened`
- `checklistItemRemoved`

Tag event types:

- `tagCreated`
- `tagAddedToTask`
- `tagRemovedFromTask`
- `tagRenamed`
- `tagColorUpdated`
- `tagDeleted`

Reminder event types:

- `reminderCreated`
- `reminderUpdated`
- `reminderRemoved`
- `reminderScheduledNative`
- `reminderNativeScheduleFailed`
- `reminderFired`
- `reminderMissed`
- `reminderCancelled`

Rules:

- Store task history as lifecycle events, not extra task columns.
- Keep task mutation events linked by `taskId`.
- Store tag rename/color events once for the tag, not duplicated into every task using that tag.
- When rendering a task timeline, combine direct task events with tag events for tags attached to that task during the relevant period.
- Store reminder lifecycle events with `taskId` when the reminder belongs to a task.
- Avoid storing old note body text by default. `notesChanged: true` is enough for useful feedback and reduces sensitive duplication.
- Do not persist `overdueReached` as a normal event. Due/overdue is derived from `due_at` and the current date. UI can show "venceu em" from `due_at`.
- Native scheduler details are useful for trust, but should be concise: success/failure and task name/reason, not command output unless debugging.

## Suggested Database Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  planned_for TEXT,
  due_at TEXT,
  reminder_at TEXT,
  recurrence_id TEXT,
  occurrence_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE task_tags (
  task_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  sort_order INTEGER NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  notification_id INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'fired', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE recurrence_rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  interval INTEGER NOT NULL DEFAULT 1,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  notify INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE lifecycle_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'tag', 'reminder', 'checklistItem')),
  entity_id TEXT NOT NULL,
  task_id TEXT,
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'recurrence', 'scheduler')),
  actor_label TEXT,
  summary TEXT NOT NULL,
  metadata TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Derived Views

Each derived view should have its own backend endpoint. The UI must not load all tasks just to render one screen.

Current view endpoints:

- `list_today_tasks`
- `list_week_tasks`
- `list_pending_tasks`
- `list_overdue_tasks`
- `list_upcoming_tasks`
- `list_reminder_tasks`
- `list_completed_tasks`
- `archive_completed_tasks_before`

### Meu Dia

`list_today_tasks` is the screen endpoint for today's work context. It includes all task
statuses that belong to today:

- pending tasks where `due_at` is today
- pending tasks where `due_at` is before today
- completed tasks where `completed_at` is today

Sort order:

1. pending overdue tasks
2. pending tasks with `due_at`, from the nearest date/time to the farthest
3. pending tasks without `due_at`, sorted by `created_at`
4. completed tasks, sorted by most recent completion

`due_at` is the official ordering field for task urgency. `reminder_at` is for notification
delivery and reminder filters. `planned_for` is for view membership, such as Meu Dia and
Minha Semana. The UI should render backend results in the returned order.

### Badge Count

The badge count is:

```text
count(pending tasks in Meu Dia)
```

Rules:

- Completed tasks do not count.
- Future tasks do not count unless planned for today.
- Overdue tasks count until completed or rescheduled.
- Badge should update after create, complete, uncomplete, reschedule, delete, and recurrence generation.

### Minha Semana

`list_week_tasks` is the screen endpoint for the rolling week context. The window starts
at the user's local today and ends at today + 6 days. It includes all task statuses that
belong to that period:

- pending tasks that are overdue
- tasks where `planned_for` is inside the rolling week
- tasks where `due_at` date is inside the rolling week
- completed tasks where `completed_at` is inside the rolling week

Rules:

- The badge does not count `Minha Semana`; it remains scoped to `Meu Dia`.

### Completed

Includes tasks where:

```text
status = 'completed'
```

Sort by `completed_at` descending.

### Pending

Includes all tasks where:

```text
status = 'pending'
```

Sort by the official task order: overdue first, then nearest `due_at`, then pending
without `due_at` by `created_at`, then completed if the endpoint includes them.

### Overdue

Includes pending tasks where:

```text
due_at < now
```

Sort by the official task order. Since this endpoint only returns overdue pending tasks,
older due dates appear first.

### Upcoming

Includes pending tasks where:

```text
planned_for > today OR due_at date > today
```

Sort by the official task order. Future tasks with `due_at` appear before tasks that are
only planned through `planned_for`.

This endpoint is intentionally narrow: it means "pending tasks scheduled for a future
local date". If the product language changes later, this can be renamed to
`list_future_tasks` without changing the storage model.

### With Reminders

Includes pending tasks where:

```text
reminder_at IS NOT NULL
```

Sort by the official task order. A reminder does not outrank a due date; it only qualifies
the task for this reminder-focused endpoint.

### Tag Filter

Includes tasks linked through `task_tags`.

Tag filters should support:

- all pending by tag
- completed by tag
- Meu Dia by tag

## Domain Services

Recommended feature structure:

```text
src/features/tasks/
  model/
    task.types.ts
    task.rules.ts
  services/
    task.service.ts
    task.repository.ts
  components/
  index.ts

src/features/tags/
  model/
  services/
  components/

src/features/reminders/
  model/
  services/
```

Rust/Tauri side:

```text
src-tauri/src/storage/
  mod.rs
  database.rs
  encryption.rs
  migrations.rs

src-tauri/src/tasks.rs
src-tauri/src/tags.rs
src-tauri/src/reminders.rs
```

Frontend should not directly access persistence. It should call service boundaries, and service boundaries should call Tauri commands.

## MVP Implementation Order

1. Storage foundation
   - define `.praxis` encrypted file format
   - let user create/open/select the data file
   - create migrations
   - create typed Tauri commands
   - define repository layer

2. Portable sync safety
   - store selected data file path in local settings
   - validate file header and integrity on open
   - detect external changes before writing
   - create local safety copy before migrations/risky writes
   - create conflict copy instead of overwriting when needed

3. Tasks CRUD
   - create task
   - edit task
   - complete/uncomplete
   - delete task
   - list pending and completed

4. Meu Dia and badge
   - implement daily query rules
   - connect badge count to daily pending count
   - update count after task mutations

5. Reminders
   - persist reminder metadata
   - schedule/cancel reminders when task changes
   - reconcile missed reminders on startup

6. Tags
   - create/edit/delete tags
   - assign tags to tasks
   - filter by tag

7. Recurrence
   - create recurrence rules
   - generate occurrences
   - handle reminders for recurring tasks
   - prevent duplicate occurrences

## Open Decisions

### Implemented visual document extension

The encrypted structured document contains an optional `boards` collection. All its visual documents are Papers in the product. Legacy metadata `kind: board|paper`, including missing kind, is preserved for compatibility without writing during hydration. It does not distinguish libraries or capabilities. Every document uses the versioned scene, elements and revision checks described in `BOARDS.md`. Each Paper stores `background: plain|grid|ruled|dots` and `colorScheme: light|dark`. Missing fields default to plain/light during reading without hydration writes. Save requests that omit these fields preserve their current values; invalid values are rejected. Appearance changes participate in revision checking and PNG exports.

Optional `paperLinks` entries contain `taskId`, `paperId` and `createdAt`. A reference must point to an official task and an existing visual document, including a legacy Board. One Paper can serve several tasks. Archived tasks retain links. Permanent task deletion removes only its references; Paper deletion removes only its references and document. Optional `paperCreateOperations` entries record `operationId`, `taskId` and `paperId` for atomic creation retry protection. Deleted Papers are not recreated by replaying an old operation.

Each Paper optionally stores ordered `scenes` for presentation: `{ id, title, x, y, width, height, aspectRatio }`, where `aspectRatio` is `16:9`, `4:3` or `free`. These are camera windows, independent of visual elements. Missing scenes read as an empty list without migration writes; save requests omitting scenes preserve existing scenes. An explicit empty list clears them. A Paper allows up to 100 scenes with unique valid IDs, nonempty titles of at most 200 characters and finite coordinates/dimensions bounded to 1,000,000; dimensions must be positive. Scenes share the Paper revision, encrypted storage, autosave and read-only guards. Summaries omit scene data. Unlock requests must preserve scenes as well as elements and appearance.

Task `notes` and `reminderAt` remain unchanged. There is no separate annotation entity in this implementation. Reading older vaults does not create Paper sections.

Visual elements may carry `strokeWidth` (0.5–32, optional), `strokeColor` (strict hexadecimal `#RRGGBB`, optional) and `opacity` (0.05–1, default 1). Missing stroke width/color retain existing style defaults. These fields are encrypted with the scene, validated on write, and participate in autosave, undo and PNG export.

`fillColor` is optional: missing/null retains legacy appearance; `transparent` removes the fill; `#RRGGBB` selects an independent fill. Only geometry/cards and text with a rectangle/ellipse background accept it. `fillStyle` is an optional enum (`solid`, `hachure`, `cross-hatch`, `dots`, `zigzag`) on the same elements. Missing/null keeps the current default: hachure on geometric shapes/text backgrounds, solid on cards. Unknown styles are rejected; reading older documents does not migrate or write them. Rich text is also allowed in notes, geometric shapes, frames and semantic cards, preserving shape dimensions during edits. Linked task titles remain sourced from the task domain; retained rich text allows task linking without discarding prior formatting. Image, drawing and arrow elements reject rich text.

Boards and their summaries carry optional `locked` (legacy default false). Saving an omitted lock value preserves the existing state. While locked, content changes, deletion and task creation from an element are rejected. An unlock save must preserve title, elements and appearance; subsequent content saves use the newly returned revision. Locking saves pending edits first; state changes only after persistence succeeds. This does not alter the vault's independent authentication/lock lifecycle.

Freehand draw elements optionally carry `drawBrush: graphite|fountain|charcoal|marker|watercolor|spray`; absent/null means the classic pencil/pen renderer. The current UI offers graphite and fountain, alongside classic pencil/pen. Charcoal, marker, watercolor and spray remain readable for compatibility with existing documents. `points` may include optional finite `pressure` in 0–1. Mouse gestures omit pressure; compatible pen input records it. Vector points, material, color, width and opacity are the authoritative encrypted scene data, with no hydration writes for older documents. Graphite and fountain use identical SVG geometry while drawing, after release, and in exports; classic pencil uses fine vector fibers as well. The lazy `p5.brush/standalone` renderer remains for legacy materials, producing temporary PNG snapshots bounded to 1024 pixels per side and a cache of 64 entries/16 MiB. These snapshots are not persisted as attachments. No continuously running draw loop is introduced.

One bounded 1024 × 1024 WebGL2 surface is retained across Papers until app shutdown. Closing a Paper clears its raster cache and drawing buffers, and invalidates its pending renders before the next canvas mounts (`onBeforeUnmount`). The warm graphics context is retained, but prior Paper ink is cleared; reopening regenerates snapshots from the authoritative vectors.

Text elements optionally carry `textAnnotation`; rich text runs optionally carry `annotation`. Missing or null values mean no annotation, with no hydration writes. The typed configuration uses `type: underline|box|circle|highlight|strike-through|crossed-off|bracket`, strict `#RRGGBB` color, `strokeWidth` 0.5–8, `padding` 0–24 as a scalar or 2-/4-item tuple, `iterations` 1–4, and a nonempty set of `brackets: top|right|bottom|left`. Boolean options are `animate`, `multiline` and `rtl`; `animationDuration` is 100–5000 ms and `animationDelay` 0–5000 ms. Existing legacy highlights remain compatible. Annotation changes participate in the scene's revision checking, autosave and undo; exports remove animation dash state to show the complete final drawing.

- Whether the user must create a password, or whether the encryption key is fully OS-managed.
- Whether file password recovery is explicitly impossible, or whether Praxis offers a recovery key flow.
- Whether the first MVP stores encrypted SQLite directly in `.praxis`, or stores an encrypted structured document and later migrates to SQLite.
- Whether Praxis should support one active file only or multiple workspaces later.
- Whether completed recurring occurrences remain individual tasks forever or are compacted later.
- Whether deleting a tag removes only the relation or asks for confirmation when many tasks use it.
- Whether overdue tasks should show a separate visual state in "Meu Dia".
- Whether missed reminders should fire immediately on startup or appear as in-app alerts first.
- Whether saved filters/views should exist later; folders/areas are intentionally out of the MVP.

### BoardElement.sketch

Objeto opcional: strokePattern (solid/dashed/dotted), roughness e bowing (multiplicadores de 0 a 2), hachureAngle (-90 a 90), hachureGap (5 a 24). Apenas formas, conectores e texto com fundo possuem acabamento; draw e image nao aceitam o objeto. Ausencia preserva o desenho anterior sem migracao ou escrita na leitura. Rust valida os limites e rejeita propriedades desconhecidas dentro do objeto. Ao remover o fundo do texto, seu acabamento e preenchimento sao removidos na mesma edicao.

### BoardElement.groupId

String opcional, nao vazia, com ate 100 bytes. Elementos com o mesmo groupId pertencem a um grupo plano dentro do Paper. Os elementos mantem seus tipos, estilos, ids e coordenadas individuais; nao ha imagem rasterizada ou entidade de tarefa adicional. Ausencia ou null indica elemento livre, sem migracao ou escrita na leitura. O historico inclui agrupamento, desagrupamento e transformacoes de membros. Duplicacao cria um novo groupId.


### Camadas do Paper

Board.layers e opcional (ausencia ou lista vazia representa a camada virtual base). BoardLayer: id (1 a 100 bytes, unico), name (ate 80 caracteres), visible, locked e opacity (0 a 1). Ordem da lista: fundo para topo. Limite 32. BoardElement.layerId e opcional e usa base quando ausente. Referencias devem existir; grupos nao podem atravessar camadas. SaveBoardInput.layers omitido preserva as camadas atuais. Rust rejeita alteracoes nos elementos de uma camada que permanece bloqueada. O salvamento e o historico incluem elementos, cenas e camadas juntos. Miniaturas sao projecoes visiveis, ordenadas e com opacidade composta, sem alterar dados originais.

