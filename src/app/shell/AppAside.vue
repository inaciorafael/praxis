<script setup lang="ts">
import { RouterLink } from "vue-router";

import { AppNavigationItem, appNavigationItems } from "@/app/shell/navigation";
import { useTaskStore } from "@/stores/task.store";
import { onMounted } from "vue";
import { useTagStore } from "@/stores/tag.store";

const tasks = useTaskStore()
const tags = useTagStore()

function getBadgeCount(key: AppNavigationItem['badgeKey']) {
  const counts = {
    today: tasks.myDay.length,
    week: tasks.myWeek.length,
    pending: tasks.pending.length,
    overdue: tasks.overdue.length,
    reminders: tasks.withReminders.length,
    completed: tasks.completed.length,
  }

  return counts[key as keyof typeof counts] ?? 0;
}

onMounted(() => {
  void tasks.hydrateViewCounts();
});
</script>

<template>
  <nav class="grid gap-1 p-3" aria-label="Navegacao principal">
    <RouterLink
      v-for="item in appNavigationItems"
      :key="item.to"
      :to="item.to"
      class="flex min-h-10 items-center justify-between gap-2 rounded-md px-3 py-2 text-body font-semibold text-ink-soft transition-colors hover:bg-hover hover:text-ink"
      active-class="bg-purple text-paper hover:bg-purple hover:text-paper"
    >
      <div class="flex flex-row items-center gap-2">
        <component :is="item.icon" class="size-5 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </div>
      <span
        v-if="getBadgeCount(item.badgeKey) > 0"
        class="rounded-full border border-border bg-brick px-2 py-0.5 text-caption font-semibold text-paper"
        >
        {{ getBadgeCount(item.badgeKey) }}
      </span>
    </RouterLink>

    <span class="text-title">Tags</span>

    <button class="flex flex-row items-center gap-3" v-for="tag in tags.tags">
      <div
        :style="{ backgroundColor: tag.color }"
        :class="[
        'h-5 w-5 rounded',
      ]"></div>
      <span>{{ tag.name }}</span>
    </button>

  </nav>
</template>
