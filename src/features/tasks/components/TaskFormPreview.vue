<script setup lang="ts">
import TaskCard from '@/features/tasks/components/TaskCard.vue'
import {
  checklistItemsFromText,
  toIsoDateTime,
  type TaskFormDraft,
} from '@/features/tasks/lib/task-form'
import { pickTagColorByName } from '@/shared/lib/tags/tag-color'
import { normalizeTagName } from '@/shared/lib/tags/inline-tag'
import type { ChecklistItem } from '@/shared/types/checklist'
import type { Tag } from '@/shared/types/tag'
import type { Task, TaskStatus } from '@/shared/types/task'
import { useTagStore } from '@/stores/tag.store'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    draft: TaskFormDraft
    selectedTagNames: string[]
    checklistText?: string
    checklistItems?: ChecklistItem[]
    status?: TaskStatus
    completedAt?: string | null
  }>(),
  {
    checklistText: '',
    checklistItems: () => [],
    status: 'pending',
    completedAt: null,
  }
)

const tags = useTagStore()
const { t } = useI18n()
const previewTags = computed<Tag[]>(() =>
  props.selectedTagNames.map((name, index) => {
    const existingTag = tags.tags.find(
      (tag) => normalizeTagName(tag.name) === normalizeTagName(name)
    )

    return (
      existingTag ?? {
        id: `preview-tag-${index}`,
        name,
        slug: normalizeTagName(name).replace(/\s+/g, '-'),
        color: pickTagColorByName(name).text,
        createdAt: '',
        updatedAt: '',
      }
    )
  })
)
const previewChecklistItems = computed<ChecklistItem[]>(() => {
  if (props.checklistItems.length > 0) {
    return props.checklistItems
  }

  return checklistItemsFromText(props.checklistText).map((title, index) => ({
    id: `preview-checklist-${index}`,
    taskId: 'preview-task',
    title,
    status: 'pending',
    sortOrder: index,
    completedAt: null,
    createdAt: '',
    updatedAt: '',
  }))
})
const previewTask = computed<Task>(() => {
  const dueAt = toIsoDateTime(props.draft.dueAt)
  const completedItems = previewChecklistItems.value.filter(
    (item) => item.status === 'completed'
  ).length
  const totalItems = previewChecklistItems.value.length

  return {
    id: 'preview-task',
    title: props.draft.title.trim() || t('task.title'),
    notes: props.draft.notes.trim() || null,
    status: props.status,
    plannedFor: props.draft.plannedFor || null,
    dueAt,
    reminderAt: toIsoDateTime(props.draft.reminderAt),
    recurrenceId: null,
    occurrenceDate: null,
    completedAt: props.completedAt,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    isOverdue:
      props.status === 'pending' &&
      Boolean(dueAt && new Date(dueAt).getTime() < Date.now()),
    progress: {
      totalItems,
      completedItems,
      percentage: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100),
    },
  }
})
</script>

<template>
  <div class="grid gap-2">
    <span class="text-label font-semibold text-ink-soft">{{ t('task.preview') }}</span>
    <div class="border border-border bg-paper p-2">
      <TaskCard
        v-bind="previewTask"
        readonly
        :display-tags="previewTags"
        :display-checklist-items="previewChecklistItems"
      />
    </div>
  </div>
</template>
