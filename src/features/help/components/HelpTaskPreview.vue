<script setup lang="ts">
import {
	ArchiveRestore,
	Bell,
	CalendarDays,
	Check,
	Tag,
} from "@lucide/vue";

withDefaults(
	defineProps<{
		title: string;
		note?: string;
		state?: "pending" | "completed" | "overdue" | "archived";
		showReminder?: boolean;
		showChecklist?: boolean;
	}>(),
	{
		note: "",
		state: "pending",
		showReminder: false,
		showChecklist: false,
	},
);
</script>

<template>
  <div
    :class="[
      'grid gap-3 border-l-4 bg-surface p-4',
      {
        'border-border': state === 'pending',
        'border-sage': state === 'completed',
        'border-brick': state === 'overdue',
        'border-archived opacity-80': state === 'archived',
      },
    ]"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span
        :class="[
          'flex h-7 w-7 shrink-0 items-center justify-center border',
          state === 'completed'
            ? 'border-sage bg-sage text-on-accent'
            : 'border-border text-ink-soft',
        ]"
      >
        <Check v-if="state === 'completed'" :size="16" />
      </span>

      <span
        :class="[
          'min-w-0 flex-1 text-title text-ink',
          state === 'completed' ? 'line-through' : '',
        ]"
      >
        {{ title }}
      </span>

      <ArchiveRestore v-if="state === 'archived'" :size="17" class="text-blue" />
    </div>

    <p v-if="note" class="text-body text-ink-soft">{{ note }}</p>

    <div v-if="showChecklist" class="grid gap-2 pl-10 text-small text-ink-soft">
      <span class="flex items-center gap-2"><Check :size="14" class="text-sage" /> Definir próximo passo</span>
      <span class="flex items-center gap-2"><span class="h-3.5 w-3.5 border border-border" /> Revisar resultado</span>
    </div>

    <div class="flex flex-wrap gap-2 text-caption">
      <span class="flex items-center gap-1 bg-blue px-2 py-1 text-on-accent">
        <CalendarDays :size="13" />
        Hoje às 16:00
      </span>
      <span v-if="showReminder" class="flex items-center gap-1 bg-purple px-2 py-1 text-on-accent">
        <Bell :size="13" />
        15:30
      </span>
      <span class="flex items-center gap-1 border border-border px-2 py-1 text-ink-soft">
        <Tag :size="13" />
        work
      </span>
    </div>
  </div>
</template>
