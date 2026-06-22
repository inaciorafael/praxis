export type ReminderId = number;

export type ReminderPayload = {
	taskId?: string;
	tagIds?: string[];
	source?: "task" | "system";
	[key: string]: unknown;
};

export type ReminderInput = {
	id?: ReminderId;
	title: string;
	body?: string;
	scheduledAt?: Date | string;
	repeating?: boolean;
	allowWhileIdle?: boolean;
	group?: string;
	sound?: string;
	payload?: ReminderPayload;
};

export type ReminderResult = {
	id: ReminderId;
	title: string;
	body: string;
	scheduledAt: string | null;
};

export type ReminderStatus = "scheduled" | "fired" | "cancelled";

export type PersistedReminder = {
	id: string;
	taskId: string;
	notificationId: ReminderId;
	scheduledAt: string;
	status: ReminderStatus;
	createdAt: string;
	updatedAt: string;
};

export type PendingReminder = {
	id: ReminderId;
	reminderId: string | null;
	taskId: string | null;
	title: string;
	body: string;
	scheduledAt: string | null;
};

export type NotificationPermissionStatus = "granted" | "denied" | "default";

export type NotificationLaunchContext = {
	source: "nativeReminder";
	reminderId: string;
};

export type NotificationInteractionAction =
	| "open"
	| "complete"
	| "dismiss"
	| "unknown";

export type NotificationInteraction = {
	action: NotificationInteractionAction;
	notificationId: ReminderId | null;
	reminderId: string | null;
	taskId: string | null;
	receivedAt: string;
};
