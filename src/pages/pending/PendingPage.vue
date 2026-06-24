<script setup lang="ts">
import dayjs from "dayjs";
import { computed } from "vue";
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import type { Task } from "@/shared/types/task";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

type PendingGroup = {
	key: string;
	title: string;
	description: string;
	tasks: Task[];
};

onMounted(async () => {
	tasks.setActiveTaskView("pending");
	await tasks.hydratePending({ limit: 150 });
});

const pendingGroups = computed<PendingGroup[]>(() => {
	const groups = createEmptyGroups();
	const now = dayjs();

	for (const task of sortedPendingTasks(tasks.pending)) {
		if (!task.dueAt) {
			groups.noDate.tasks.push(task);
			continue;
		}

		const dueAt = dayjs(task.dueAt);

		if (!dueAt.isValid()) {
			groups.noDate.tasks.push(task);
			continue;
		}

		if (dueAt.isBefore(now)) {
			groups.overdue.tasks.push(task);
			continue;
		}

		if (dueAt.isSame(now, "day")) {
			groups.today.tasks.push(task);
			continue;
		}

		if (dueAt.isSame(now.add(1, "day"), "day")) {
			groups.tomorrow.tasks.push(task);
			continue;
		}

		if (dueAt.isBefore(now.add(7, "day").endOf("day"))) {
			groups.week.tasks.push(task);
			continue;
		}

		groups.later.tasks.push(task);
	}

	return Object.values(groups).filter((group) => group.tasks.length > 0);
});

function sortedPendingTasks(source: Task[]) {
	return [...source].sort((left, right) => {
		const leftTime = left.dueAt
			? new Date(left.dueAt).getTime()
			: Number.POSITIVE_INFINITY;
		const rightTime = right.dueAt
			? new Date(right.dueAt).getTime()
			: Number.POSITIVE_INFINITY;

		return (
			leftTime - rightTime ||
			new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
		);
	});
}

function createEmptyGroups() {
	return {
		overdue: {
			key: "overdue",
			title: "Vencidas",
			description: "Tarefas pendentes cujo vencimento já passou.",
			tasks: [] as Task[],
		},
		today: {
			key: "today",
			title: "Hoje",
			description: "Tarefas pendentes que vencem ainda hoje.",
			tasks: [] as Task[],
		},
		tomorrow: {
			key: "tomorrow",
			title: "Amanhã",
			description: "Pendências já separadas para amanhã.",
			tasks: [] as Task[],
		},
		week: {
			key: "week",
			title: "Esta semana",
			description: "Tarefas dos próximos dias.",
			tasks: [] as Task[],
		},
		later: {
			key: "later",
			title: "Próximas",
			description: "Tarefas com vencimento fora da janela desta semana.",
			tasks: [] as Task[],
		},
		noDate: {
			key: "no-date",
			title: "Sem data",
			description: "Tarefas abertas sem vencimento definido.",
			tasks: [] as Task[],
		},
	} satisfies Record<string, PendingGroup>;
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Pendentes</span>
      <span class="text-body text-ink-soft">Tudo que ainda está aberto.</span>
    </div>

    <div v-if="pendingGroups.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa pendente.
    </div>

    <section
      v-for="group in pendingGroups"
      :key="group.key"
      class="grid gap-2"
    >
      <div class="flex items-end justify-between gap-4 border-b border-border pb-2">
        <div class="grid gap-1">
          <span class="text-heading text-ink">{{ group.title }}</span>
          <span class="text-caption text-ink-soft">{{ group.description }}</span>
        </div>
        <span class="text-caption font-semibold text-ink-soft">{{ group.tasks.length }}</span>
      </div>

      <div class="grid gap-2">
        <TaskCard
          v-for="task in group.tasks"
          :key="task.id"
          v-bind="task"
        />
      </div>
    </section>
  </section>
</template>
