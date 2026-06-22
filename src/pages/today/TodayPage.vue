<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";

import DayStatusClock from "@/features/tasks/components/DayStatusClock.vue";
import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { todayLocalDate } from "@/shared/lib/tasks/task.rules";
import { useBadgeStore } from "@/stores/badge.store";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";
import { useVaultStore } from "@/stores/vault.store";

const router = useRouter();
const badge = useBadgeStore();
const tags = useTagStore();
const tasks = useTaskStore();
const vault = useVaultStore();
const completedCount = computed(
	() => tasks.myDay.filter((task) => task.status === "completed").length,
);
const overdueCount = computed(
	() =>
		tasks.myDay.filter((task) => task.status === "pending" && task.isOverdue)
			.length,
);

onMounted(async () => {
	tasks.setActiveTaskView("today");
	setTodayCreateContext();
	await tasks.hydrateToday({ limit: 100 });
});

async function lockVault() {
	await vault.close();
	tasks.resetLocal();
	tags.resetLocal();
	await badge.clear();
	await router.replace({ name: "vault" });
}

function openCreateModal() {
	setTodayCreateContext();
	tasks.openCreateTaskModal();
}

function setTodayCreateContext() {
	const today = todayLocalDate();

	tasks.setCreateContext({
		source: "today",
		label: "Meu dia",
		plannedFor: today,
		dueDate: today,
	});
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col gap-2">
      <span class="text-display">Meu dia</span>
      <span class="text-heading">{{ dayjs().format('dddd[,] DD [de] MMMM YYYY.') }}</span>
    </div>

    <div class="flex flex-wrap gap-2">
      <div class="bg-sage px-3 py-1 flex items-center justify-center">
        <span class="text-caption text-paper font-semibold uppercase"
          >Completed {{ completedCount }}</span
        >
      </div>

      <div class="bg-brick px-3 py-1 flex items-center justify-center">
        <span class="text-caption font-semibold uppercase text-paper"
          >OVERDUE {{ overdueCount }}</span
        >
      </div>
    </div>

    <DayStatusClock :tasks="tasks.myDay" />

    <button
      class="w-fit border border-border bg-surface px-4 py-2 text-body font-semibold text-ink hover:bg-hover"
      @click="openCreateModal"
    >
      Nova tarefa
    </button>

    <div
      v-if="tasks.myDay.length === 0"
      class="border border-border bg-surface p-4 text-body text-ink-soft"
    >
      Nenhuma tarefa para hoje.
    </div>

    <template
      v-for="task in tasks.myDay"
      :key="task.id"
    >
      <TaskCard v-bind="task" />
    </template>

    <button
      class="w-fit border border-border bg-surface px-4 py-2 text-body text-ink hover:bg-hover"
      @click="lockVault"
    >
      Bloquear cofre
    </button>
  </section>
</template>
