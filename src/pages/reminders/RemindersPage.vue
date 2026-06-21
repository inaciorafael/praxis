<script setup lang="ts">
import { onMounted } from "vue";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();

onMounted(async () => {
  tasks.setActiveTaskView("reminders");
  await tasks.hydrateWithReminders({ limit: 150 });
});
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Lembretes</span>
      <span class="text-body text-ink-soft">Tarefas pendentes com notificação configurada.</span>
    </div>

    <div v-if="tasks.withReminders.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa com lembrete.
    </div>

    <template v-for="task in tasks.withReminders" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
