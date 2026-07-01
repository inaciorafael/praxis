<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { todayLocalDate } from "@/shared/lib/tasks/task.rules";
import { useTaskStore } from "@/stores/task.store";
import HelpKey from "@/features/help/components/HelpKey.vue";
import { formatLongDate } from "@/shared/lib/date/date-format";

const tasks = useTaskStore();
const { t } = useI18n();
const pendingTasks = computed(() =>
	tasks.myDay.filter((task) => task.status === "pending"),
);
const completedTasks = computed(() =>
	tasks.myDay.filter((task) => task.status === "completed"),
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
		label: t("nav.today"),
		plannedFor: today,
		dueDate: today,
	});
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col gap-2">
      <span class="text-display">{{ t('today.title') }}</span>
      <span class="text-heading">{{ formatLongDate(new Date()) }}</span>
    </div>

    <div class="text-body flex flex-row items-center gap-2">
      <HelpKey
        :keys="['Ctrl', 'N']"
        :label="t('today.shortcut')"
      />
    </div>

    <div
      v-if="tasks.myDay.length === 0"
      class="border border-border bg-surface p-4 text-body text-ink-soft"
    >
      {{ t('today.empty') }}
    </div>

    <section
      v-if="pendingTasks.length > 0"
      class="grid gap-3"
    >
      <div class="flex items-center justify-between border-b border-border pb-2">
        <span class="text-heading">{{ t('today.todo') }}</span>
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
        <span class="text-heading text-sage">{{ t('today.completed') }}</span>
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
