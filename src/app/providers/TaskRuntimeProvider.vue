<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import TaskCreateModal from "@/features/tasks/components/TaskCreateModal.vue";
import { createTaskStatusScheduler } from "@/shared/lib/scheduler/task-status-scheduler";
import { todayLocalDate } from "@/shared/lib/tasks/task.rules";
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
    .map((task) => `${task.id}:${task.status}:${task.dueAt ?? ""}:${task.isOverdue}`)
    .join("|"),
);

watch(
  () => route.name,
  (routeName) => {
    const activeView = taskViewFromRouteName(routeName);
    taskStore.setActiveTaskView(activeView);
    taskStore.setCreateContext(createContextFromRouteName(routeName));
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
  document.removeEventListener("visibilitychange", refreshAfterVisibilityChange);
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
    case "today":
    default:
      return "today";
  }
}

function createContextFromRouteName(routeName: unknown) {
  const today = todayLocalDate();
  const tomorrow = localDateFromOffset(1);

  switch (routeName) {
    case "my-week":
      return {
        source: "week" as const,
        label: "Minha semana",
        plannedFor: tomorrow,
        dueDate: tomorrow,
      };
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
        dueDate: today,
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
    case "today":
    default:
      return {
        source: "today" as const,
        label: "Meu dia",
        plannedFor: today,
        dueDate: today,
      };
  }
}

function localDateFromOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
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
  taskStore.openCreateTaskModal();
}
</script>

<template>
  <slot />
  <TaskCreateModal />
</template>
