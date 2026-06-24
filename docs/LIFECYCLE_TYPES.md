# Praxis Lifecycle Types

This document explains each lifecycle type used to tell the useful story of a task.

The goal is not heavy auditing. The goal is to answer, simply: what happened with this task?

## Core Types

### `LifecycleEntityType`

The entity that owns the event.

- `task`: the event is about the task itself.
- `tag`: the event is about a tag that can appear in task timelines.
- `reminder`: the event is about a reminder linked to a task.
- `checklistItem`: the event is about a visual checklist item inside a task.

### `LifecycleActorType`

Who or what caused the event.

- `user`: direct user action, such as completing a task.
- `system`: app behavior, such as cleanup or migration.
- `recurrence`: recurrence engine generated a task occurrence.
- `scheduler`: notification/native reminder scheduler did something.

### `LifecycleValueChange`

Represents a before/after change.

Examples:

- title changed from `Call client` to `Call Ana`
- due date changed from `null` to `2026-06-20T14:00:00Z`
- reminder changed from `09:00` to `10:30`

### `LifecycleEvent`

One item in the timeline.

Fields:

- `id`: stable event id.
- `entityType`: whether this is a task/tag/reminder event.
- `entityId`: id of the direct entity.
- `taskId`: task id when the event should appear in a task timeline.
- `type`: event type.
- `occurredAt`: when it happened.
- `actor`: who caused it.
- `summary`: user-facing timeline text.
- `metadata`: structured details for future UI.

## Task Events

### `taskCreated`

The task was created.

Useful feedback:

- "Tarefa criada"
- shows the beginning of the task lifecycle

### `taskTitleUpdated`

The task title changed.

Useful feedback:

- "Titulo alterado"
- metadata may include `from` and `to`

### `taskNotesUpdated`

The task note changed.

Useful feedback:

- "Nota atualizada"

Privacy rule:

- do not store old note body text by default
- use `notesChanged: true`

### `taskPlannedForUpdated`

The day planned for "Meu Dia" changed.

Useful feedback:

- "Planejada para hoje"
- "Removida de Meu Dia"
- "Planejamento alterado"

### `taskDueAtUpdated`

The due date changed.

Useful feedback:

- "Vencimento definido"
- "Vencimento alterado"
- "Vencimento removido"

### `taskCompleted`

The task was completed.

Useful feedback:

- "Tarefa concluida"

### `taskReopened`

The task went from completed back to pending.

Useful feedback:

- "Tarefa reaberta"

### `taskDeleted`

The task was deleted.

Useful feedback:

- "Tarefa removida"

Current behavior:

- if the task is hard-deleted, its timeline may be inaccessible from normal task UI later
- this event is still useful if trash/restore exists later

### `taskRestored`

A deleted task was restored.

Useful feedback:

- "Tarefa restaurada"

Future event; not used until trash/restore exists.

### `taskArchived`

A completed task left the operational views because of retention or a manual archive action.

Useful feedback:

- "Tarefa arquivada"
- metadata keeps the completion date, archive date, and applied cutoff

### `taskUnarchived`

The user restored an archived task.

Useful feedback:

- "Tarefa restaurada do arquivo"
- preserves the original completion date
- prevents the automatic retention policy from immediately archiving it again

### `taskRecurrenceGenerated`

The task was generated from a recurrence rule.

Useful feedback:

- "Criada pela recorrencia"

### `checklistCompletedTask`

All checklist items were completed, so the parent task was completed automatically.

Useful feedback:

- "Checklist concluiu a tarefa"

### `checklistReopenedTask`

At least one checklist item became pending, so the parent task was reopened automatically.

Useful feedback:

- "Checklist reabriu a tarefa"

## Checklist Item Events

Checklist items are visual execution steps only. They do not have due dates, reminders, tags, recurrence, or badge behavior.

### `checklistItemAdded`

An item was added to the task checklist.

Useful feedback:

- "Item de checklist adicionado"

### `checklistItemRenamed`

An item title changed.

Useful feedback:

- "Item de checklist renomeado"

### `checklistItemCompleted`

The user marked a checklist item as completed.

Useful feedback:

- "Item de checklist concluido"

### `checklistItemReopened`

The user marked a checklist item as pending again.

Useful feedback:

- "Item de checklist reaberto"

### `checklistItemRemoved`

An item was removed from the checklist.

Useful feedback:

- "Item de checklist removido"

## Tag Events

### `tagCreated`

A tag was created.

Useful feedback:

- "Tag +work criada"

### `tagAddedToTask`

A tag was assigned to a task.

Useful feedback:

- "Tag +work adicionada"

### `tagRemovedFromTask`

A tag was removed from a task.

Useful feedback:

- "Tag +work removida"

### `tagRenamed`

A tag name changed.

Useful feedback:

- "Tag +personal renomeada para +casa"

Modeling rule:

- store this once as a tag event
- do not duplicate it for every task that uses the tag

### `tagColorUpdated`

A tag color changed.

Useful feedback:

- "Cor da tag +work alterada"

### `tagDeleted`

A tag was deleted.

Useful feedback:

- "Tag +work removida"

## Reminder Events

### `reminderCreated`

A task received a reminder for the first time.

Useful feedback:

- "Lembrete criado para 14:00"

### `reminderUpdated`

The reminder date/time changed.

Useful feedback:

- "Lembrete alterado"

### `reminderRemoved`

The user removed the reminder from the task.

Useful feedback:

- "Lembrete removido"

### `reminderScheduledNative`

The reminder was mirrored into the native OS scheduler.

Useful feedback:

- "Lembrete agendado no Windows"

Use sparingly in UI. This is mostly a trust/diagnostic event.

### `reminderNativeScheduleFailed`

The native scheduler failed to register the reminder.

Useful feedback:

- "Nao foi possivel agendar lembrete no Windows"

This should not block task saving.

### `reminderFired`

The reminder notification fired.

Useful feedback:

- "Lembrete disparado"

This is important because it helps the user trust that Praxis actually warned them.

### `reminderMissed`

The reminder time passed while the app could not notify immediately.

Useful feedback:

- "Lembrete perdido e reconciliado depois"

Use when the app detects a missed reminder on startup.

### `reminderCancelled`

A scheduled reminder was cancelled.

Useful feedback:

- "Lembrete cancelado"

Common causes:

- task completed
- reminder removed
- task deleted

## What Not To Track

Do not persist noisy events for:

- app opened
- task list hydrated
- badge recalculated
- due date becoming overdue
- every native scheduler command output

Overdue state should be derived from `dueAt` and the current date.
