<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";

import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { tomorrowLocalDate } from "@/shared/lib/tasks/task.rules";
import type { Task } from "@/shared/types/task";
import { useTaskStore } from "@/stores/task.store";
import HelpKey from "@/features/help/components/HelpKey.vue";
import { useI18n } from "vue-i18n";
import { formatLongDate } from "@/shared/lib/date/date-format";

const tasks = useTaskStore();
const { t, locale } = useI18n();
const weekStartDate = tomorrowLocalDate();
const selectedDate = ref(weekStartDate);

const weekDays = computed(() =>
	Array.from({ length: 7 }, (_, index) => {
		const date = dayjs(weekStartDate).add(index, "day");

		return {
			key: date.format("YYYY-MM-DD"),
			weekday: new Intl.DateTimeFormat(locale.value, { weekday: "long" }).format(date.toDate()),
			day: date.format("DD"),
			month: new Intl.DateTimeFormat(locale.value, { month: "long", year: "numeric" }).format(date.toDate()),
			count: tasks.myWeek.filter((task) =>
				isTaskOnDate(task, date.format("YYYY-MM-DD")),
			).length,
		};
	}),
);

const selectedDayTasks = computed(() =>
	tasks.myWeek.filter((task) => isTaskOnDate(task, selectedDate.value)),
);
const selectedDayPendingTasks = computed(() =>
	selectedDayTasks.value.filter((task) => task.status === "pending"),
);
const selectedDayCompletedTasks = computed(() =>
	selectedDayTasks.value.filter((task) => task.status === "completed"),
);

const selectedDayLabel = computed(() => formatLongDate(selectedDate.value));

onMounted(async () => {
	tasks.setActiveTaskView("week");
	setWeekCreateContext(selectedDate.value);
	await tasks.hydrateWeek({ limit: 150 }, weekStartDate);
});

function selectDate(date: string) {
	selectedDate.value = date;
	setWeekCreateContext(date);
}

function setWeekCreateContext(date: string) {
	tasks.setCreateContext({
		source: "week",
		label: t("week.context", { date: new Intl.DateTimeFormat(locale.value).format(dayjs(date).toDate()) }),
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
      <span class="text-display">{{ t('week.title') }}</span>
      <span class="text-body text-ink-soft"
        >{{ formatLongDate(dayjs().add(1, 'day').toDate()) }} -
        {{ formatLongDate(dayjs().add(7, 'day').toDate()) }}</span
      >
    </div>

    <div class="flex flex-row items-center justify-between">
      <div
        v-for="day in weekDays"
        :key="day.key"
        class="flex flex-col gap-1 items-center"
      >
        <span :class="[selectedDate === day.key ? 'text-ink' : '']">{{
          day.weekday
        }}</span>
        <button
          type="button"
          :class="[
            'w-30 h-30 transition-colors flex flex-col item-center justify-center relative',
            selectedDate === day.key ? 'bg-hover' : 'bg-transparent',
          ]"
          @click="selectDate(day.key)"
        >
          <span
            :class="[
              'text-4xl',
              selectedDate === day.key ? 'text-on-accent' : 'text-ink',
            ]"
          >
            {{ day.day }}
          </span>
          <span :class="[selectedDate === day.key ? 'text-on-accent' : 'text-ink']">
            {{ day.month }}
          </span>

          <div
            v-if="day.count > 0"
            :class="[
              'absolute rounded-full flex items-center justify-center font-semibold border -top-3 -right-3 w-8 h-8',
              selectedDate === day.key
                ? 'text-on-accent bg-hover border-on-accent'
                : 'bg-paper text-ink border-ink',
            ]"
          >
            {{ day.count > 99 ? `+${99}` : day.count }}
          </div>
        </button>
      </div>
    </div>

    <div class="flex flex-row items-center gap-5">
      <div class="flex flex-col gap-2">
        <span class="text-heading">{{ selectedDayLabel }}</span>
        <div class="flex flex-row items-center gap-3">
          <span class="text-body text-ink-soft"
            >{{ selectedDayTasks.length }} tarefa(s)</span
          >
          <HelpKey
            :keys="['Ctrl', 'N']"
            :label="t('week.newTask')"
          />
        </div>
      </div>
    </div>

    <div
      v-if="selectedDayTasks.length === 0"
      class="border border-border bg-surface p-4 text-body text-ink-soft"
    >
      {{ t('week.empty') }}
    </div>

    <section
      v-if="selectedDayPendingTasks.length > 0"
      class="grid gap-3"
    >
      <div class="flex items-center justify-between border-b border-border pb-2">
        <span class="text-heading">{{ t('week.todo') }}</span>
        <span class="text-body text-ink-soft">
          {{ selectedDayPendingTasks.length }}
        </span>
      </div>

      <TaskCard
        v-for="task in selectedDayPendingTasks"
        :key="task.id"
        v-bind="task"
      />
    </section>

    <section
      v-if="selectedDayCompletedTasks.length > 0"
      class="grid gap-3"
    >
      <div class="flex items-center justify-between border-b border-border pb-2">
        <span class="text-heading text-sage">{{ t('week.completed') }}</span>
        <span class="text-body text-ink-soft">
          {{ selectedDayCompletedTasks.length }}
        </span>
      </div>

      <TaskCard
        v-for="task in selectedDayCompletedTasks"
        :key="task.id"
        v-bind="task"
      />
    </section>
  </section>
</template>
