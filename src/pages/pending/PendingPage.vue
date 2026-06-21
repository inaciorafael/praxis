<script setup lang="ts">
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

onMounted(async () => {
  tasks.setActiveTaskView("pending");
  await tasks.hydratePending({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Pendentes</span>
      <span class="text-body text-ink-soft">Tudo que ainda está aberto.</span>
    </div>

    <div v-if="tasks.pending.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa pendente.
    </div>

    <template v-for="task in tasks.pending" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
