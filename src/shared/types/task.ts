import type { BadgeSnapshot } from "@/shared/types/badge";
import type { ChecklistItem, TaskProgress } from "@/shared/types/checklist";
import type { PersistedReminder } from "@/shared/types/notification";

export type TaskStatus = "pending" | "completed";

export type Task = {
	id: string;
	title: string;
	notes: string | null;
	status: TaskStatus;
	plannedFor: string | null;
	dueAt: string | null;
	reminderAt: string | null;
	recurrenceId: string | null;
	occurrenceDate: string | null;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
	isOverdue: boolean;
	progress: TaskProgress;
};

export type CreateTaskInput = {
	title: string;
	notes?: string | null;
	plannedFor?: string | null;
	dueAt?: string | null;
	reminderAt?: string | null;
};

export type UpdateTaskInput = {
	title?: string;
	notes?: string | null;
	plannedFor?: string | null;
	dueAt?: string | null;
	reminderAt?: string | null;
};

export type TaskCollection = {
	tasks: Task[];
	myDay: Task[];
	myWeek: Task[];
	pending: Task[];
	overdue: Task[];
	upcoming: Task[];
	withReminders: Task[];
	completed: Task[];
	checklistItems: ChecklistItem[];
	reminders: PersistedReminder[];
	badge: BadgeSnapshot;
};

export type TaskListOptions = {
	limit?: number;
	offset?: number;
};

export type TaskListResult = {
	tasks: Task[];
	checklistItems: ChecklistItem[];
	reminders: PersistedReminder[];
	badge: BadgeSnapshot;
};

export type TaskViewCounts = {
	today: number;
	week: number;
	pending: number;
	overdue: number;
	upcoming: number;
	reminders: number;
	completed: number;
	badge: BadgeSnapshot;
};
