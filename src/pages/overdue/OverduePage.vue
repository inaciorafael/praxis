<script setup lang="ts">
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

onMounted(async () => {
  tasks.setActiveTaskView("overdue");
  await tasks.hydrateOverdue({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Vencidas</span>
      <span class="text-body text-ink-soft">Pendências cujo vencimento já passou.</span>
    </div>

    <div v-if="tasks.overdue.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa vencida.
    </div>

    <template v-for="task in tasks.overdue" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
