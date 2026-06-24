<script setup lang="ts">
import { computed, onMounted } from "vue";
import dayjs from "dayjs";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { todayLocalDate } from "@/shared/lib/tasks/task.rules";
import { useTaskStore } from "@/stores/task.store";
import HelpKey from "@/features/help/components/HelpKey.vue";

const tasks = useTaskStore();
const pendingTasks = computed(() =>
	tasks.myDay.filter((task) => task.status === "pending"),
);
const completedTasks = computed(() =>
	tasks.myDay.filter((task) => task.status === "completed"),
);
const completedCount = computed(() => completedTasks.value.length);
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
        <span class="text-caption text-on-accent font-semibold uppercase"
          >Completed {{ completedCount }}</span
        >
      </div>

      <div class="bg-brick px-3 py-1 flex items-center justify-center">
        <span class="text-caption font-semibold uppercase text-on-accent"
          >OVERDUE {{ overdueCount }}</span
        >
      </div>
    </div>

    <div class="text-body flex flex-row items-center gap-2">
      <HelpKey
        :keys="['Ctrl', 'N']"
        label="Para criar uma tarefa hoje."
      />
    </div>

    <div
      v-if="tasks.myDay.length === 0"
      class="border border-border bg-surface p-4 text-body text-ink-soft"
    >
      Nenhuma tarefa para hoje.
    </div>

    <section
      v-if="pendingTasks.length > 0"
      class="grid gap-3"
    >
      <div class="flex items-center justify-between border-b border-border pb-2">
        <span class="text-heading">Para fazer</span>
        <span class="text-body text-ink-soft">{{ pendingTasks.length }}</span>
      </div>

      <TaskCard
        v-for="task in pendingTasks"
        :key="task.id"
        v-bind="task"
      />
    </section>

    <section
      v-if="completedTasks.length > 0"
      class="grid gap-3"
    >
      <div class="flex items-center justify-between border-b border-border pb-2">
        <span class="text-heading text-sage">Concluídas</span>
        <span class="text-body text-ink-soft">{{ completedTasks.length }}</span>
      </div>

      <TaskCard
        v-for="task in completedTasks"
        :key="task.id"
        v-bind="task"
      />
    </section>
  </section>
</template>
