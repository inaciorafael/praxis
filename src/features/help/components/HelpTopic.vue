<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
	id: string;
	eyebrow: string;
	title: string;
	description: string;
	icon: Component;
}>();
</script>

<template>
  <section :id="id" class="scroll-mt-8 border-t border-border pt-7">
    <header class="grid grid-cols-[2.75rem_1fr] gap-4">
      <div class="flex h-11 w-11 items-center justify-center border border-border bg-surface text-blue">
        <component :is="icon" :size="21" />
      </div>

      <div class="grid gap-1">
        <span class="text-caption font-semibold uppercase text-ink-muted">{{ eyebrow }}</span>
        <h2 class="text-heading text-ink">{{ title }}</h2>
        <p class="max-w-3xl text-body leading-6 text-ink-soft">{{ description }}</p>
      </div>
    </header>

    <div class="mt-5 grid gap-5 desktop:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
      <div class="min-w-0">
        <slot />
      </div>
      <div class="min-w-0">
        <slot name="visual" />
      </div>
    </div>
  </section>
</template>
