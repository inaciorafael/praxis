import { defineStore } from "pinia";

import { playTaskCompletedSound } from "@/shared/lib/audio/task-sounds";
import { syncTaskReminders } from "@/shared/lib/notifications/notification.service";
import {
	archiveCompletedTasksBefore,
	createChecklistItem,
	createTask,
	deleteChecklistItem,
	deleteTask,
	getTaskViewCounts,
	listArchivedTasks,
	listCompletedTasks,
	listOverdueTasks,
	listPendingTasks,
	listReminderTasks,
	listTaskTimeline,
	listTasks,
	listTodayTasks,
	listUpcomingTasks,
	listWeekTasks,
	setChecklistItemCompleted,
	setTaskCompleted,
	restoreArchivedTask,
	updateChecklistItem,
	updateTask,
} from "@/shared/lib/tasks/task.service";
import type {
	ChecklistItem,
	CreateChecklistItemInput,
	UpdateChecklistItemInput,
} from "@/shared/types/checklist";
import type { TaskTimeline } from "@/shared/types/lifecycle";
import type {
	CreateTaskInput,
	Task,
	TaskCollection,
	TaskListOptions,
	TaskListResult,
	TaskViewCounts,
	UpdateTaskInput,
} from "@/shared/types/task";
import { useBadgeStore } from "@/stores/badge.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useVaultStore } from "@/stores/vault.store";
import {
	todayLocalDate,
	tomorrowLocalDate,
} from "@/shared/lib/tasks/task.rules";

type TaskActiveView =
	| "today"
	| "week"
	| "pending"
	| "overdue"
	| "upcoming"
	| "reminders"
	| "completed"
	| "archived";
type TaskListTarget =
	| "myDay"
	| "myWeek"
	| "pending"
	| "overdue"
	| "upcoming"
	| "withReminders"
	| "completed"
	| "archived";
type TaskCreateContext = {
	source: TaskActiveView;
	label: string;
	plannedFor: string | null;
	dueDate: string | null;
};

type TaskStoreState = {
	tasks: Task[];
	myDay: Task[];
	myWeek: Task[];
	pending: Task[];
	overdue: Task[];
	upcoming: Task[];
	withReminders: Task[];
	completed: Task[];
	archived: Task[];
	checklistItems: ChecklistItem[];
	viewCounts: Omit<TaskViewCounts, "badge">;
	timelinesByTaskId: Record<string, TaskTimeline>;
	selectedTaskId: string;
	activeTaskView: TaskActiveView;
	activeWeekStartDate: string;
	createModalOpen: boolean;
	createContext: TaskCreateContext;
	isReady: boolean;
	error: string;
};

export const useTaskStore = defineStore("tasks", {
	state: (): TaskStoreState => ({
		tasks: [],
		myDay: [],
		myWeek: [],
		pending: [],
		overdue: [],
		upcoming: [],
		withReminders: [],
		completed: [],
		archived: [],
		checklistItems: [],
		viewCounts: emptyViewCounts(),
		timelinesByTaskId: {},
		selectedTaskId: "",
		activeTaskView: "today",
		activeWeekStartDate: tomorrowLocalDate(),
		createModalOpen: false,
		createContext: defaultCreateContext(),
		isReady: false,
		error: "",
	}),

	getters: {
		tasksById(state): Record<string, Task> {
			return Object.fromEntries(
				allKnownTasks(state).map((task) => [task.id, task]),
			);
		},

		checklistItemsByTask(state): Record<string, ChecklistItem[]> {
			const itemsByTask: Record<string, ChecklistItem[]> = {};

			for (const item of state.checklistItems) {
				(itemsByTask[item.taskId] ??= []).push(item);
			}

			for (const items of Object.values(itemsByTask)) {
				items.sort((left, right) => left.sortOrder - right.sortOrder);
			}

			return itemsByTask;
		},
	},

	actions: {
		findTaskById(taskId: string) {
			return this.tasksById[taskId] ?? null;
		},

		getSelectedTask() {
			return this.selectedTaskId
				? this.findTaskById(this.selectedTaskId)
				: null;
		},

		checklistItemsByTaskId(taskId: string) {
			return this.checklistItemsByTask[taskId] ?? [];
		},

		async applyCollection(collection: TaskCollection) {
			this.tasks = collection.tasks;
			this.myDay = collection.myDay;
			this.myWeek = collection.myWeek;
			this.pending = collection.pending;
			this.overdue = collection.overdue;
			this.upcoming = collection.upcoming;
			this.withReminders = collection.withReminders;
			this.completed = collection.completed;
			this.checklistItems = collection.checklistItems;
			this.viewCounts = countsFromCollection(
				collection,
				this.activeWeekStartDate,
				this.viewCounts.archived,
			);
			this.isReady = true;
			this.error = "";
			const notifications = useNotificationStore();
			if (!notifications.nativeLaunchReminderId) {
				await notifications.hydrateLaunchContext();
			}
			useBadgeStore().applySnapshot(collection.badge);
			notifications.applyPendingReminders(
				await syncTaskReminders(collection.tasks, collection.reminders, {
					fireDueReminderIds: notifications.nativeLaunchReminderId
						? [notifications.nativeLaunchReminderId]
						: [],
				}),
			);
			await useVaultStore().refreshStatus();
		},

		async applyTaskList(
			result: TaskListResult,
			target: TaskListTarget,
			append = false,
		) {
			this[target] = append
				? mergeTasksById(this[target], result.tasks)
				: result.tasks;
			this.checklistItems = mergeChecklistItemsForTasks(
				this.checklistItems,
				result.checklistItems,
				result.tasks.map((task) => task.id),
			);
			this.isReady = true;
			this.error = "";
			const notifications = useNotificationStore();
			if (!notifications.nativeLaunchReminderId) {
				await notifications.hydrateLaunchContext();
			}
			useBadgeStore().applySnapshot(result.badge);
			notifications.applyPendingReminders(
				await syncTaskReminders(result.tasks, result.reminders, {
					fireDueReminderIds: notifications.nativeLaunchReminderId
						? [notifications.nativeLaunchReminderId]
						: [],
				}),
			);
		},

		applyViewCounts(counts: TaskViewCounts) {
			const { badge, ...viewCounts } = counts;
			this.viewCounts = viewCounts;
			useBadgeStore().applySnapshot(badge);
			this.error = "";
		},

		resetLocal() {
			this.tasks = [];
			this.myDay = [];
			this.myWeek = [];
			this.pending = [];
			this.overdue = [];
			this.upcoming = [];
			this.withReminders = [];
			this.completed = [];
			this.archived = [];
			this.checklistItems = [];
			this.viewCounts = emptyViewCounts();
			this.timelinesByTaskId = {};
			this.selectedTaskId = "";
			this.activeTaskView = "today";
			this.activeWeekStartDate = tomorrowLocalDate();
			this.createModalOpen = false;
			this.createContext = defaultCreateContext();
			this.isReady = false;
			this.error = "";
		},

		async hydrate() {
			try {
				await this.applyCollection(await listTasks());
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Abra o cofre para carregar tarefas.";
			}
		},

		async hydrateViewCounts() {
			try {
				this.applyViewCounts(await getTaskViewCounts(this.activeWeekStartDate));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar contadores de tarefas.";
			}
		},

		async hydrateToday(options?: TaskListOptions) {
			try {
				await this.applyTaskList(await listTodayTasks(options), "myDay");
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas de hoje.";
			}
		},

		async hydrateWeek(options?: TaskListOptions, startDate?: string) {
			try {
				const resolvedStartDate = startDate ?? this.activeWeekStartDate;
				this.activeWeekStartDate = resolvedStartDate;
				await this.applyTaskList(
					await listWeekTasks(options, resolvedStartDate),
					"myWeek",
				);
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas da semana.";
			}
		},

		async hydratePending(options?: TaskListOptions) {
			try {
				await this.applyTaskList(await listPendingTasks(options), "pending");
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas pendentes.";
			}
		},

		async hydrateOverdue(options?: TaskListOptions) {
			try {
				await this.applyTaskList(await listOverdueTasks(options), "overdue");
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas vencidas.";
			}
		},

		async hydrateUpcoming(options?: TaskListOptions) {
			try {
				await this.applyTaskList(await listUpcomingTasks(options), "upcoming");
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar proximas tarefas.";
			}
		},

		async hydrateWithReminders(options?: TaskListOptions) {
			try {
				await this.applyTaskList(
					await listReminderTasks(options),
					"withReminders",
				);
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas com lembrete.";
			}
		},

		async hydrateCompleted(options?: TaskListOptions) {
			try {
				await this.applyTaskList(
					await listCompletedTasks(options),
					"completed",
				);
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas concluidas.";
			}
		},

		async hydrateArchived(options?: TaskListOptions, append = false) {
			try {
				await this.applyTaskList(
					await listArchivedTasks(options),
					"archived",
					append,
				);
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar tarefas arquivadas.";
			}
		},

		setActiveTaskView(view: TaskActiveView) {
			this.activeTaskView = view;
		},

		setCreateContext(context: Partial<TaskCreateContext>) {
			this.createContext = {
				...this.createContext,
				...context,
			};
		},

		openCreateTaskModal(context?: Partial<TaskCreateContext>) {
			if (context) {
				this.setCreateContext(context);
			}

			this.createModalOpen = true;
		},

		openFreeCreateTaskModal() {
			this.openCreateTaskModal({
				source: "pending",
				label: "Nova tarefa",
				plannedFor: null,
				dueDate: null,
			});
		},

		closeCreateTaskModal() {
			this.createModalOpen = false;
		},

		getSchedulerTasks() {
			return this.getActiveTaskList();
		},

		getActiveTaskList(): Task[] {
			switch (this.activeTaskView) {
				case "today":
					return this.myDay;
				case "week":
					return this.myWeek;
				case "pending":
					return this.pending;
				case "overdue":
					return this.overdue;
				case "upcoming":
					return this.upcoming;
				case "reminders":
					return this.withReminders;
				case "completed":
					return this.completed;
				case "archived":
					return this.archived;
			}
		},

		async refreshActiveTaskView() {
			switch (this.activeTaskView) {
				case "today":
					await this.hydrateToday({ limit: 100 });
					break;
				case "week":
					await this.hydrateWeek({ limit: 150 }, this.activeWeekStartDate);
					break;
				case "pending":
					await this.hydratePending({ limit: 150 });
					break;
				case "overdue":
					await this.hydrateOverdue({ limit: 150 });
					break;
				case "upcoming":
					await this.hydrateUpcoming({ limit: 150 });
					break;
				case "reminders":
					await this.hydrateWithReminders({ limit: 150 });
					break;
				case "completed":
					await this.hydrateCompleted({ limit: 150 });
					break;
				case "archived":
					await this.hydrateArchived({ limit: 150 });
					break;
			}

			await this.hydrateViewCounts();
		},

		async create(input: CreateTaskInput) {
			try {
				await this.applyCollection(await createTask(input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel criar a tarefa.";
				return false;
			}
		},

		async update(id: string, input: UpdateTaskInput) {
			try {
				await this.applyCollection(await updateTask(id, input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar a tarefa.";
				return false;
			}
		},

		async setCompleted(id: string, completed: boolean) {
			try {
				const wasCompleted = this.findTaskById(id)?.status === "completed";
				await this.applyCollection(await setTaskCompleted(id, completed));

				if (completed && !wasCompleted) {
					void playTaskCompletedSound();
				}
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar a tarefa.";
			}
		},

		async delete(id: string) {
			try {
				await this.applyCollection(await deleteTask(id));
				if (this.selectedTaskId === id) {
					this.clearSelectedTask();
				}
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel remover a tarefa.";
			}
		},

		async archiveCompletedBefore(beforeDate: string) {
			try {
				await this.applyCollection(await archiveCompletedTasksBefore(beforeDate));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel arquivar tarefas concluidas.";
				return false;
			}
		},

		async restoreArchived(id: string) {
			try {
				await this.applyCollection(await restoreArchivedTask(id));
				this.archived = this.archived.filter((task) => task.id !== id);
				await this.hydrateViewCounts();
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel restaurar a tarefa arquivada.";
				return false;
			}
		},

		async createChecklistItem(input: CreateChecklistItemInput) {
			try {
				await this.applyCollection(await createChecklistItem(input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel criar o item.";
				return false;
			}
		},

		async updateChecklistItem(id: string, input: UpdateChecklistItemInput) {
			try {
				await this.applyCollection(await updateChecklistItem(id, input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar o item.";
				return false;
			}
		},

		async setChecklistItemCompleted(id: string, completed: boolean) {
			try {
				const taskId = this.checklistItems.find((item) => item.id === id)?.taskId;
				const wasTaskCompleted = taskId
					? this.findTaskById(taskId)?.status === "completed"
					: false;

				await this.applyCollection(
					await setChecklistItemCompleted(id, completed),
				);

				const isTaskCompleted = taskId
					? this.findTaskById(taskId)?.status === "completed"
					: false;

				if (completed && !wasTaskCompleted && isTaskCompleted) {
					void playTaskCompletedSound();
				}
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar o item.";
			}
		},

		async deleteChecklistItem(id: string) {
			try {
				await this.applyCollection(await deleteChecklistItem(id));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel remover o item.";
			}
		},

		async loadTimeline(taskId: string) {
			try {
				const timeline = await listTaskTimeline(taskId);
				this.timelinesByTaskId[taskId] = timeline;
				this.error = "";
				return timeline;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar a timeline da tarefa.";
				return null;
			}
		},

		selectTask(taskId: string) {
			this.selectedTaskId = taskId;
		},

		clearSelectedTask() {
			this.selectedTaskId = "";
		},
	},
});

function allKnownTasks(state: TaskStoreState): Task[] {
	const tasksById = new Map<string, Task>();

	for (const task of [
		...state.tasks,
		...state.myDay,
		...state.myWeek,
		...state.pending,
		...state.overdue,
		...state.upcoming,
		...state.withReminders,
		...state.completed,
		...state.archived,
	]) {
		tasksById.set(task.id, task);
	}

	return [...tasksById.values()];
}

function mergeChecklistItemsForTasks(
	existing: ChecklistItem[],
	incoming: ChecklistItem[],
	taskIds: string[],
) {
	const refreshedTaskIds = new Set(taskIds);

	return [
		...existing.filter((item) => !refreshedTaskIds.has(item.taskId)),
		...incoming,
	];
}

function mergeTasksById(existing: Task[], incoming: Task[]) {
	const tasksById = new Map(existing.map((task) => [task.id, task]));

	for (const task of incoming) {
		tasksById.set(task.id, task);
	}

	return [...tasksById.values()];
}

function emptyViewCounts(): Omit<TaskViewCounts, "badge"> {
	return {
		today: 0,
		week: 0,
		pending: 0,
		overdue: 0,
		upcoming: 0,
		reminders: 0,
		completed: 0,
		archived: 0,
	};
}

function defaultCreateContext(): TaskCreateContext {
	return {
		source: "pending",
		label: "Nova tarefa",
		plannedFor: null,
		dueDate: null,
	};
}

function countsFromCollection(
	collection: TaskCollection,
	weekStartDate: string,
	archivedCount: number,
): Omit<TaskViewCounts, "badge"> {
	return {
		today: collection.myDay.filter((task) => task.status === "pending").length,
		week: collection.myWeek.filter((task) =>
			isPendingTaskInWeekBadgeScope(task, weekStartDate),
		).length,
		pending: collection.pending.length,
		overdue: collection.overdue.length,
		upcoming: collection.upcoming.length,
		reminders: collection.withReminders.length,
		completed: collection.completed.length,
		archived: archivedCount,
	};
}

function isPendingTaskInWeekBadgeScope(task: Task, weekStartDate: string) {
	if (task.status !== "pending") {
		return false;
	}

	const weekStart = parseLocalDate(weekStartDate);
	const today = parseLocalDate(todayLocalDate());

	if (!weekStart || !today) {
		return false;
	}

	const effectiveStart = weekStart <= today ? addDays(today, 1) : weekStart;
	const weekEnd = new Date(effectiveStart);
	weekEnd.setDate(weekEnd.getDate() + 6);

	return (
		isDateInsideWindow(task.plannedFor, effectiveStart, weekEnd) ||
		isDateInsideWindow(datePart(task.dueAt), effectiveStart, weekEnd)
	);
}

function addDays(date: Date, days: number) {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + days);
	return nextDate;
}

function datePart(value: string | null) {
	if (!value) {
		return null;
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const timezoneOffset = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseLocalDate(value: string | null) {
	if (!value) {
		return null;
	}

	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function isDateInsideWindow(value: string | null, start: Date, end: Date) {
	const date = parseLocalDate(value);
	return Boolean(date && date >= start && date <= end);
}
