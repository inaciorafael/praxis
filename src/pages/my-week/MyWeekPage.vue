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
			weekday: date.format("dddd"),
			day: date.format("DD"),
			month: date.format("MMMM YYYY"),
			count: tasks.myWeek.filter((task) =>
				isTaskOnDate(task, date.format("YYYY-MM-DD")),
			).length,
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
      <span class="text-body text-ink-soft"
        >{{ dayjs().add(1, 'day').format('DD dddd MMMM YYYY') }} -
        {{ dayjs().add(7, 'day').format('DD dddd MMMM YYYY') }}</span
      >
    </div>

    <div class="flex flex-row items-center justify-between">
      <div
        v-for="day in weekDays"
        :key="day.key"
        class="flex flex-col gap-1 items-center"
      >
        <span :class="[selectedDate === day.key ? 'font-semibold text-rose' : '']">{{
          day.weekday
        }}</span>
        <button
          type="button"
          :class="[
            'w-30 h-30 transition-all flex flex-col border item-center justify-center relative',
            selectedDate === day.key
              ? 'bg-rose border-rose'
              : 'bg-transparent border-black hover:bg-hover',
          ]"
          @click="selectDate(day.key)"
        >
          <span
            :class="[
              'text-4xl',
              selectedDate === day.key ? 'text-paper font-bold' : 'text-ink',
            ]"
          >
            {{ day.day }}
          </span>
          <span :class="[selectedDate === day.key ? 'text-paper' : 'text-ink']">
            {{ day.month }}
          </span>

          <div
            v-if="day.count > 0"
            :class="[
              'absolute rounded-full flex items-center justify-center font-semibold bg-paper border -top-3 -right-3 w-8 h-8',
              selectedDate === day.key ? 'text-rose border-rose' : 'text-ink border-ink',
            ]"
          >
            {{ day.count > 99 ? `+${99}` : day.count }}
          </div>
        </button>
      </div>
    </div>

    <div class="flex flex-col">
      <span class="text-heading">{{ selectedDayLabel }}</span>
      <span class="text-body text-ink-soft">{{ selectedDayTasks.length }} tarefa(s)</span>
    </div>

    <button
      class="w-fit border border-border bg-surface px-4 py-2 text-body font-semibold text-ink hover:bg-hover"
      @click="openCreateModal"
    >
      Nova tarefa para este dia
    </button>

    <div
      v-if="selectedDayTasks.length === 0"
      class="border border-border bg-surface p-4 text-body text-ink-soft"
    >
      Nenhuma tarefa para este dia.
    </div>

    <template
      v-for="task in selectedDayTasks"
      :key="task.id"
    >
      <TaskCard v-bind="task" />
    </template>
  </section>
</template>
