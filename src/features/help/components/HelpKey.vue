<script setup lang="ts">
defineProps<{
	keys: string[];
	label?: string;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div
      class="flex items-center gap-1"
      aria-label="Atalho de teclado"
    >
      <template
        v-for="(key, index) in keys"
        :key="key"
      >
        <span
          v-if="index > 0"
          class="text-small text-ink-muted"
        >
          +
        </span>
        <kbd
          class="min-w-8 border border-border bg-surface px-2 py-1 text-center text-small font-semibold text-ink"
        >
          {{ key }}
        </kbd>
      </template>
    </div>
    <span
      v-if="label"
      class="text-body text-ink-soft"
      >{{ label }}</span
    >
  </div>
</template>
