<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import TaskCreateModal from "@/features/tasks/components/TaskCreateModal.vue";
import { createTaskStatusScheduler } from "@/shared/lib/scheduler/task-status-scheduler";
import { useTaskStore } from "@/stores/task.store";

const route = useRoute();
const taskStore = useTaskStore();
let lastRuntimeRefreshAt = 0;
let runtimeRefreshIsRunning = false;

const scheduler = createTaskStatusScheduler({
	getTasks: () => taskStore.getSchedulerTasks(),
	onDueStateMayHaveChanged: () => taskStore.refreshActiveTaskView(),
});

const schedulerFingerprint = computed(() =>
	taskStore
		.getSchedulerTasks()
		.map(
			(task) =>
				`${task.id}:${task.status}:${task.dueAt ?? ""}:${task.isOverdue}`,
		)
		.join("|"),
);

watch(
	() => route.name,
	(routeName) => {
		const activeView = taskViewFromRouteName(routeName);
		taskStore.setActiveTaskView(activeView);
		if (activeView !== "today" && activeView !== "week") {
			taskStore.setCreateContext(freeCreateContextFromRouteName(routeName));
		}
		scheduler.reschedule();
	},
	{ immediate: true },
);

watch(schedulerFingerprint, () => {
	scheduler.reschedule();
});

onMounted(() => {
	scheduler.start();
	void taskStore.hydrateViewCounts();
	window.addEventListener("keydown", openCreateModalFromShortcut);
	window.addEventListener("focus", refreshAfterRuntimeWake);
	document.addEventListener("visibilitychange", refreshAfterVisibilityChange);
});

onBeforeUnmount(() => {
	scheduler.stop();
	window.removeEventListener("keydown", openCreateModalFromShortcut);
	window.removeEventListener("focus", refreshAfterRuntimeWake);
	document.removeEventListener(
		"visibilitychange",
		refreshAfterVisibilityChange,
	);
});

function taskViewFromRouteName(routeName: unknown) {
	switch (routeName) {
		case "my-week":
			return "week";
		case "pending":
			return "pending";
		case "overdue":
			return "overdue";
		case "reminders":
			return "reminders";
		case "completed":
			return "completed";
		case "archived":
			return "archived";
		case "help":
			return "pending";
		case "today":
		default:
			return "today";
	}
}

function freeCreateContextFromRouteName(routeName: unknown) {
	switch (routeName) {
		case "pending":
			return {
				source: "pending" as const,
				label: "Pendentes",
				plannedFor: null,
				dueDate: null,
			};
		case "overdue":
			return {
				source: "overdue" as const,
				label: "Vencidas",
				plannedFor: null,
				dueDate: null,
			};
		case "reminders":
			return {
				source: "reminders" as const,
				label: "Lembretes",
				plannedFor: null,
				dueDate: null,
			};
		case "completed":
			return {
				source: "completed" as const,
				label: "Concluídas",
				plannedFor: null,
				dueDate: null,
			};
		case "archived":
			return {
				source: "pending" as const,
				label: "Nova tarefa",
				plannedFor: null,
				dueDate: null,
			};
		case "help":
			return {
				source: "pending" as const,
				label: "Nova tarefa",
				plannedFor: null,
				dueDate: null,
			};
		case "today":
		default:
			return {
				source: "pending" as const,
				label: "Nova tarefa",
				plannedFor: null,
				dueDate: null,
			};
	}
}

async function refreshAfterRuntimeWake() {
	const now = Date.now();

	if (runtimeRefreshIsRunning || now - lastRuntimeRefreshAt < 5_000) {
		return;
	}

	runtimeRefreshIsRunning = true;
	lastRuntimeRefreshAt = now;

	try {
		await taskStore.refreshActiveTaskView();
		scheduler.reschedule();
	} finally {
		runtimeRefreshIsRunning = false;
	}
}

function refreshAfterVisibilityChange() {
	if (document.visibilityState !== "visible") {
		return;
	}

	void refreshAfterRuntimeWake();
}

function openCreateModalFromShortcut(event: KeyboardEvent) {
	if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "n") {
		return;
	}

	event.preventDefault();

	if (event.shiftKey) {
		taskStore.openFreeCreateTaskModal();
		return;
	}

	taskStore.openCreateTaskModal();
}
</script>

<template>
  <slot />
  <TaskCreateModal />
</template>
