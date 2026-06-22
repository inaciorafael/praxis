<script setup lang="ts">
defineProps<{
	title: string;
}>();
</script>

<template>
  <article class="praxis-card p-5">
    <h3 class="text-sm font-semibold uppercase text-ink">{{ title }}</h3>
    <p class="mt-3 text-sm leading-6 text-ink-soft">
      <slot />
    </p>
  </article>
</template>
