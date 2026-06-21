<script setup lang="ts">
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

onMounted(async () => {
  tasks.setActiveTaskView("completed");
  await tasks.hydrateCompleted({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Concluídas</span>
      <span class="text-body text-ink-soft">Histórico das tarefas finalizadas.</span>
    </div>

    <div v-if="tasks.completed.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa concluída.
    </div>

    <template v-for="task in tasks.completed" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
