<script setup lang="ts">
import { onMounted } from "vue";
import { Archive } from "@lucide/vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";
import { useI18n } from "vue-i18n";

const tasks = useTaskStore();
const { t } = useI18n();

onMounted(async () => {
	tasks.setActiveTaskView("completed");
	await tasks.hydrateCompleted({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col">
        <span class="text-display">{{ t('completed.title') }}</span>
        <span class="text-body text-ink-soft">{{ t('completed.subtitle') }}</span>
      </div>

      <RouterLink
        to="/app/archived"
        class="flex items-center gap-2 border border-border bg-surface px-3 py-2 text-body font-semibold text-ink hover:bg-hover"
      >
        <Archive :size="17" />
        <span>{{ t('completed.viewArchived') }}</span>
        <span v-if="tasks.viewCounts.archived > 0" class="text-ink-soft">
          {{ tasks.viewCounts.archived }}
        </span>
      </RouterLink>
    </div>

    <div v-if="tasks.completed.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      {{ t('completed.empty') }}
    </div>

    <template v-for="task in tasks.completed" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
