<script setup lang="ts">
import { decoratePraxisInTaskNotesHtml } from '@/features/tasks/lib/task-notes'
import { computed } from 'vue'

const props = defineProps<{
  notes: string
}>()

const safeHtml = computed(() => decoratePraxisInTaskNotesHtml(props.notes))
</script>

<template>
  <div
    class="task-notes-content text-body text-ink-soft"
    v-html="safeHtml"
  ></div>
</template>

<style scoped>
.task-notes-content :deep(p) {
  margin: 0 0 0.45rem;
}

.task-notes-content :deep(p:last-child) {
  margin-bottom: 0;
}

.task-notes-content :deep(ul),
.task-notes-content :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.35rem;
}

.task-notes-content :deep(ul) {
  list-style: disc;
}

.task-notes-content :deep(ol) {
  list-style: decimal;
}

.task-notes-content :deep(.praxis-word-decoration) {
  border-bottom: 1px solid var(--accent);
  background: var(--selection);
  color: var(--accent);
  font-weight: 700;
}
</style>
