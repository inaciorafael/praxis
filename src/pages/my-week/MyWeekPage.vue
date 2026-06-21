<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { tomorrowLocalDate } from "@/shared/lib/tasks/task.rules";
import type { Task } from "@/shared/types/task";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();
const weekStartDate = tomorrowLocalDate();
const selectedDate = ref(weekStartDate);

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = dayjs(weekStartDate).add(index, "day");

    return {
      key: date.format("YYYY-MM-DD"),
      weekday: date.format("ddd"),
      day: date.format("DD"),
      month: date.format("MMM"),
      count: tasks.myWeek.filter((task) => isTaskOnDate(task, date.format("YYYY-MM-DD"))).length,
    };
  }),
);

const selectedDayTasks = computed(() =>
  tasks.myWeek.filter((task) => isTaskOnDate(task, selectedDate.value)),
);

const selectedDayLabel = computed(() =>
  dayjs(selectedDate.value).format("dddd[,] DD [de] MMMM"),
);

onMounted(async () => {
  tasks.setActiveTaskView("week");
  setWeekCreateContext(selectedDate.value);
  await tasks.hydrateWeek({ limit: 150 }, weekStartDate);
});

function selectDate(date: string) {
  selectedDate.value = date;
  setWeekCreateContext(date);
}

function openCreateModal() {
  setWeekCreateContext(selectedDate.value);
  tasks.openCreateTaskModal();
}

function setWeekCreateContext(date: string) {
  tasks.setCreateContext({
    source: "week",
    label: `Minha semana · ${dayjs(date).format("DD/MM/YYYY")}`,
    plannedFor: date,
    dueDate: date,
  });
}

function isTaskOnDate(task: Task, date: string) {
  return (
    task.plannedFor === date ||
    datePart(task.dueAt) === date ||
    datePart(task.completedAt) === date
  );
}

function datePart(value: string | null) {
  if (!value) {
    return null;
  }

  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD") : null;
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Minha semana</span>
      <span class="text-body text-ink-soft">Próximos 7 dias a partir de amanhã.</span>
    </div>

    <div class="grid grid-cols-7 gap-2">
      <button
        v-for="day in weekDays"
        :key="day.key"
        type="button"
        :class="[
          'min-h-24 border px-3 py-2 text-left transition-colors',
          selectedDate === day.key
            ? 'border-black bg-black text-ink'
            : 'border-border bg-surface text-ink-soft hover:bg-hover hover:text-ink',
        ]"
        @click="selectDate(day.key)"
      >
        <span class="block text-small text-paper font-semibold uppercase">{{ day.weekday }}</span>
        <span class="block text-heading text-paper">{{ day.day }}</span>
        <span class="block text-caption text-paper">{{ day.month }}</span>
        <span v-if="day.count > 0" class="mt-2 inline-flex border border-border bg-paper px-2 py-0.5 text-caption text-ink">
          {{ day.count }}
        </span>
      </button>
    </div>

    <div class="flex flex-col">
      <span class="text-heading">{{ selectedDayLabel }}</span>
      <span class="text-body text-ink-soft">{{ selectedDayTasks.length }} tarefa(s)</span>
    </div>

    <button class="w-fit border border-border bg-surface px-4 py-2 text-body font-semibold text-ink hover:bg-hover" @click="openCreateModal">
      Nova tarefa para este dia
    </button>

    <div v-if="selectedDayTasks.length === 0" class="border border-border bg-surface p-4 text-body text-ink-soft">
      Nenhuma tarefa para este dia.
    </div>

    <template v-for="task in selectedDayTasks" :key="task.id">
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
