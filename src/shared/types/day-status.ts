import type { Task } from "@/shared/types/task";

export type DayStatusLevel = "normal" | "warning" | "critical";

export type DayStatusReason = "clear" | "pending" | "due-soon" | "overdue";

export type DayStatusOptions = {
	warningWindowMinutes?: number;
};

export type DayStatusSnapshot = {
	level: DayStatusLevel;
	reason: DayStatusReason;
	clockLabel: string;
	dateLabel: string;
	title: string;
	message: string;
	pendingTodayCount: number;
	overdueCount: number;
	dueSoonCount: number;
	nextDueTask: Task | null;
	nextReminderTask: Task | null;
	minutesUntilNextDue: number | null;
	minutesUntilNextReminder: number | null;
	checkedAt: string;
};
