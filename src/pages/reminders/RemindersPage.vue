<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import type { Task } from "@/shared/types/task";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

type ReminderGroup = {
	key: string;
	title: string;
	description: string;
	tasks: Task[];
};

onMounted(async () => {
	tasks.setActiveTaskView("reminders");
	await tasks.hydrateWithReminders({ limit: 150 });
});

const reminderGroups = computed<ReminderGroup[]>(() => {
	const groups = createEmptyGroups();
	const now = dayjs();

	for (const task of sortedReminderTasks(tasks.withReminders)) {
		const reminderAt = dayjs(task.reminderAt);

		if (!reminderAt.isValid()) {
			continue;
		}

		if (reminderAt.isBefore(now)) {
			groups.overdue.tasks.push(task);
			continue;
		}

		if (reminderAt.isSame(now, "day")) {
			groups.today.tasks.push(task);
			continue;
		}

		if (reminderAt.isSame(now.add(1, "day"), "day")) {
			groups.tomorrow.tasks.push(task);
			continue;
		}

		if (reminderAt.isBefore(now.add(7, "day").endOf("day"))) {
			groups.week.tasks.push(task);
			continue;
		}

		groups.later.tasks.push(task);
	}

	return Object.values(groups).filter((group) => group.tasks.length > 0);
});

function sortedReminderTasks(source: Task[]) {
	return [...source].sort((left, right) => {
		const leftTime = left.reminderAt ? new Date(left.reminderAt).getTime() : 0;
		const rightTime = right.reminderAt ? new Date(right.reminderAt).getTime() : 0;

		return leftTime - rightTime;
	});
}

function createEmptyGroups() {
	return {
		overdue: {
			key: "overdue",
			title: "Atrasados",
			description: "Lembretes que já passaram e ainda precisam de atenção.",
			tasks: [] as Task[],
		},
		today: {
			key: "today",
			title: "Hoje",
			description: "Avisos que ainda vão acontecer hoje.",
			tasks: [] as Task[],
		},
		tomorrow: {
			key: "tomorrow",
			title: "Amanhã",
			description: "Próximos lembretes já separados para amanhã.",
			tasks: [] as Task[],
		},
		week: {
			key: "week",
			title: "Esta semana",
			description: "Lembretes dos próximos dias.",
			tasks: [] as Task[],
		},
		later: {
			key: "later",
			title: "Mais tarde",
			description: "Lembretes fora da janela desta semana.",
			tasks: [] as Task[],
		},
	} satisfies Record<string, ReminderGroup>;
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Lembretes</span>
      <span class="text-body text-ink-soft">Tarefas pendentes com notificação configurada.</span>
    </div>

    <div v-if="reminderGroups.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa com lembrete.
    </div>

    <section
      v-for="group in reminderGroups"
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
