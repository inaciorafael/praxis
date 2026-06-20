<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { buildDayStatus } from "@/shared/lib/tasks/day-status.service";
import type { Task } from "@/shared/types/task";

const props = defineProps<{
  tasks: Task[];
  warningWindowMinutes?: number;
}>();

const now = ref(new Date());
let timer: number | undefined;

const status = computed(() =>
  buildDayStatus(props.tasks, now.value, {
    warningWindowMinutes: props.warningWindowMinutes,
  }),
);

const levelClasses = computed(() => {
  if (status.value.level === "critical") {
    return "border-brick bg-brick/15 text-ink";
  }

  if (status.value.level === "warning") {
    return "border-amber bg-amber/15 text-ink";
  }

  return "border-sage bg-sage/10 text-ink";
});

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<template>
  <div class="rounded-md border px-4 py-3" :class="levelClasses">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">{{ status.dateLabel }}</p>
        <p class="text-3xl font-bold leading-none text-ink">{{ status.clockLabel }}</p>
      </div>

      <div class="text-right">
        <p class="text-sm font-semibold text-ink">{{ status.title }}</p>
        <p class="text-xs text-ink-soft">{{ status.message }}</p>
      </div>
    </div>
  </div>
</template>
