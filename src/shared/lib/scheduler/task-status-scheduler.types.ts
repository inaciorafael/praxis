export type SchedulerTaskStatus = "pending" | "completed";

export type SchedulerTask = {
	id: string;
	status: SchedulerTaskStatus;
	dueAt: string | null;
	isOverdue: boolean;
};

export type TaskStatusSchedulerOptions = {
	getTasks: () => SchedulerTask[];
	onDueStateMayHaveChanged: () => Promise<void> | void;
};

export type TaskStatusScheduler = {
	start: () => void;
	stop: () => void;
	reschedule: () => void;
};
