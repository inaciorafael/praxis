<script setup lang="ts">
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";
import { useI18n } from "vue-i18n";

const tasks = useTaskStore();
const { t } = useI18n();

onMounted(async () => {
	tasks.setActiveTaskView("overdue");
	await tasks.hydrateOverdue({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">{{ t('overdue.title') }}</span>
      <span class="text-body text-ink-soft">{{ t('overdue.subtitle') }}</span>
    </div>

    <div v-if="tasks.overdue.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      {{ t('overdue.empty') }}
    </div>

    <template v-for="task in tasks.overdue" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
