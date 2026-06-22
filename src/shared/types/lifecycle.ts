export type LifecycleEntityType = "task" | "tag" | "reminder" | "checklistItem";

export type LifecycleActorType = "user" | "system" | "recurrence" | "scheduler";

export type LifecycleActor = {
	type: LifecycleActorType;
	label?: string | null;
};

export type LifecycleValueChange<TValue = string | null> = {
	from?: TValue;
	to?: TValue;
};

export type TaskLifecycleEventType =
	| "taskCreated"
	| "taskTitleUpdated"
	| "taskNotesUpdated"
	| "taskPlannedForUpdated"
	| "taskDueAtUpdated"
	| "taskCompleted"
	| "taskReopened"
	| "taskDeleted"
	| "taskRestored"
	| "taskRecurrenceGenerated"
	| "checklistCompletedTask"
	| "checklistReopenedTask";

export type ChecklistLifecycleEventType =
	| "checklistItemAdded"
	| "checklistItemRenamed"
	| "checklistItemCompleted"
	| "checklistItemReopened"
	| "checklistItemRemoved";

export type TagLifecycleEventType =
	| "tagCreated"
	| "tagAddedToTask"
	| "tagRemovedFromTask"
	| "tagRenamed"
	| "tagColorUpdated"
	| "tagDeleted";

export type ReminderLifecycleEventType =
	| "reminderCreated"
	| "reminderUpdated"
	| "reminderRemoved"
	| "reminderScheduledNative"
	| "reminderNativeScheduleFailed"
	| "reminderFired"
	| "reminderMissed"
	| "reminderCancelled";

export type TaskLifecycleEventMetadata = {
	title?: LifecycleValueChange;
	notesChanged?: boolean;
	plannedFor?: LifecycleValueChange;
	dueAt?: LifecycleValueChange;
	completedAt?: string | null;
	recurrenceId?: string | null;
	occurrenceDate?: string | null;
	progress?: {
		totalItems: number;
		completedItems: number;
		percentage: number;
	};
};

export type ChecklistLifecycleEventMetadata = {
	checklistItemId?: string;
	title?: string | LifecycleValueChange;
	completedAt?: string | null;
};

export type TagLifecycleEventMetadata = {
	tagId?: string;
	taskId?: string;
	name?: LifecycleValueChange;
	color?: LifecycleValueChange;
};

export type ReminderLifecycleEventMetadata = {
	reminderId?: string;
	taskId?: string;
	scheduledAt?: LifecycleValueChange;
	firedAt?: string | null;
	notificationId?: number | null;
	nativeTaskName?: string | null;
	failureReason?: string | null;
};

export type LifecycleEventMetadata =
	| TaskLifecycleEventMetadata
	| ChecklistLifecycleEventMetadata
	| TagLifecycleEventMetadata
	| ReminderLifecycleEventMetadata;

export type LifecycleEventType =
	| TaskLifecycleEventType
	| ChecklistLifecycleEventType
	| TagLifecycleEventType
	| ReminderLifecycleEventType;

export type LifecycleEvent = {
	id: string;
	entityType: LifecycleEntityType;
	entityId: string;
	taskId?: string | null;
	type: LifecycleEventType;
	occurredAt: string;
	actor: LifecycleActor;
	summary: string;
	metadata?: LifecycleEventMetadata;
};

export type TaskTimeline = {
	taskId: string;
	events: LifecycleEvent[];
};
