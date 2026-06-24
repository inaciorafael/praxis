<script setup lang="ts">
defineProps<{
	steps: string[];
}>();
</script>

<template>
  <ol class="grid border-t border-border">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="grid grid-cols-[2rem_1fr] gap-3 border-b border-border py-3"
    >
      <span class="flex h-7 w-7 items-center justify-center border border-border bg-surface text-small font-semibold text-ink">
        {{ index + 1 }}
      </span>
      <span class="pt-0.5 text-body leading-6 text-ink-soft">{{ step }}</span>
    </li>
  </ol>
</template>
