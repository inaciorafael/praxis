<script setup lang="ts">
import TaskFormFields from '@/features/tasks/components/TaskFormFields.vue'
import TaskFormPreview from '@/features/tasks/components/TaskFormPreview.vue'
import TaskTimelinePanel from '@/features/tasks/components/TaskTimelinePanel.vue'
import {
  createTaskFormDraft,
  syncTaskTags,
  tagNamesForTask,
  toDatetimeLocal,
  toIsoDateTime,
  type TaskFormDraft,
} from '@/features/tasks/lib/task-form'
import type { ChecklistItem } from '@/shared/types/checklist'
import BaseButton from '@/shared/ui/BaseButton.vue'
import Input from '@/shared/ui/Input.vue'
import { useTagStore } from '@/stores/tag.store'
import { useTaskStore } from '@/stores/task.store'
import { X } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const tasks = useTaskStore()
const tags = useTagStore()
const { t } = useI18n()
const formFields = ref<InstanceType<typeof TaskFormFields> | null>(null)
const draft = ref<TaskFormDraft>(createTaskFormDraft())
const selectedTagNames = ref<string[]>([])
const newChecklistItem = ref('')
const checklistTitles = ref<Record<string, string>>({})
const isSaving = ref(false)
const isLoadingTimeline = ref(false)

const selectedTask = computed(() => tasks.getSelectedTask())
const checklistItems = computed(() => {
  if (!selectedTask.value) {
    return []
  }

  return tasks.checklistItemsByTaskId(selectedTask.value.id)
})
const selectedTaskTimeline = computed(() => {
  const task = selectedTask.value

  if (!task) {
    return []
  }

  return tasks.timelinesByTaskId[task.id]?.events ?? []
})
const canSave = computed(() =>
  Boolean(selectedTask.value && draft.value.title.trim() && !isSaving.value)
)

watch(
  selectedTask,
  (task) => {
    if (!task) {
      resetForm()
      return
    }

    draft.value = createTaskFormDraft({
      title: task.title,
      notes: task.notes ?? '',
      plannedFor: task.plannedFor ?? '',
      dueAt: toDatetimeLocal(task.dueAt),
      reminderAt: toDatetimeLocal(task.reminderAt),
    })
    selectedTagNames.value = tagNamesForTask(tags, task.id)
    syncChecklistTitles(checklistItems.value)
    void loadSelectedTaskTimeline(task.id)
  },
  { immediate: true }
)

watch(checklistItems, (items) => {
  syncChecklistTitles(items)
})

watch([() => tags.tags, () => tags.taskTags], () => {
  if (selectedTask.value) {
    selectedTagNames.value = tagNamesForTask(tags, selectedTask.value.id)
  }
})

async function saveTask() {
  formFields.value?.commitPendingTag()
  await nextTick()
  const task = selectedTask.value

  if (!task || !canSave.value) {
    return
  }

  isSaving.value = true

  try {
    const updated = await tasks.update(task.id, {
      title: draft.value.title.trim(),
      notes: draft.value.notes.trim() || null,
      plannedFor: draft.value.plannedFor || null,
      dueAt: toIsoDateTime(draft.value.dueAt),
      reminderAt: toIsoDateTime(draft.value.reminderAt),
    })

    if (updated) {
      await syncTaskTags(tags, task.id, selectedTagNames.value)
    }
  } finally {
    isSaving.value = false
  }
}

async function toggleCompleted() {
  const task = selectedTask.value

  if (task) {
    await tasks.setCompleted(task.id, task.status !== 'completed')
  }
}

async function createChecklistItem() {
  const task = selectedTask.value
  const itemTitle = newChecklistItem.value.trim()

  if (!task || !itemTitle) {
    return
  }

  const created = await tasks.createChecklistItem({
    taskId: task.id,
    title: itemTitle,
  })

  if (created) {
    newChecklistItem.value = ''
  }
}

async function saveChecklistItem(item: ChecklistItem) {
  const itemTitle = checklistTitles.value[item.id]?.trim()

  if (!itemTitle || itemTitle === item.title) {
    return
  }

  await tasks.updateChecklistItem(item.id, { title: itemTitle })
}

async function toggleChecklistItem(item: ChecklistItem, checked: boolean) {
  await tasks.setChecklistItemCompleted(item.id, checked)
}

async function deleteChecklistItem(item: ChecklistItem) {
  await tasks.deleteChecklistItem(item.id)
}

async function deleteSelectedTask() {
  const task = selectedTask.value

  if (!task) {
    return
  }

  await tasks.delete(task.id)
  tasks.clearSelectedTask()
}

async function loadSelectedTaskTimeline(taskId: string) {
  isLoadingTimeline.value = true

  try {
    await tasks.loadTimeline(taskId)
  } finally {
    if (selectedTask.value?.id === taskId) {
      isLoadingTimeline.value = false
    }
  }
}

function closePanel() {
  tasks.clearSelectedTask()
}

function syncChecklistTitles(items: ChecklistItem[]) {
  checklistTitles.value = items.reduce<Record<string, string>>((index, item) => {
    index[item.id] = checklistTitles.value[item.id] ?? item.title
    return index
  }, {})
}

function resetForm() {
  draft.value = createTaskFormDraft()
  selectedTagNames.value = []
  newChecklistItem.value = ''
  checklistTitles.value = {}
}
</script>

<template>
  <aside class="h-screen overflow-y-auto border-l border-border bg-surface p-5 text-ink">
    <div
      v-if="selectedTask"
      class="grid gap-5"
    >
      <header class="flex items-start justify-between gap-3">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('task.edit') }}</span>
          <span class="text-body text-ink-soft">{{ t('task.editSubtitle') }}</span>
        </div>

        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center text-ink-soft hover:bg-hover hover:text-ink"
          aria-label="Fechar painel"
          title="Fechar painel"
          @click="closePanel"
        >
          <X :size="18" />
        </button>
      </header>

      <TaskFormPreview
        :draft="draft"
        :selected-tag-names="selectedTagNames"
        :checklist-items="checklistItems"
        :status="selectedTask.status"
        :completed-at="selectedTask.completedAt"
      />

      <div class="grid gap-3">
        <div class="grid gap-1">
          <span class="font-semibold text-ink">{{ t('task.status') }}</span>
          <button
            type="button"
            :class="[
              'border px-3 py-2 text-left text-body font-semibold hover:bg-hover',
              selectedTask.status === 'completed'
                ? 'border-sage text-sage'
                : 'border-border bg-paper text-ink',
            ]"
            @click="toggleCompleted"
          >
            {{ selectedTask.status === 'completed' ? t('common.completed') : t('common.pending') }}
          </button>
        </div>

        <TaskFormFields
          ref="formFields"
          v-model="draft"
          v-model:selected-tag-names="selectedTagNames"
          field-id-prefix="edit-task"
          compact
        />

        <BaseButton
          :disabled="!canSave"
          :label="isSaving ? t('task.saving') : t('task.saveChanges')"
          variant="primary"
          @click="saveTask"
        />
      </div>

      <div class="grid gap-3 border-t border-border pt-4">
        <span class="text-heading">{{ t('task.checklist') }}</span>

        <form
          class="flex gap-2"
          @submit.prevent="createChecklistItem"
        >
          <Input
            v-model="newChecklistItem"
            :placeholder="t('task.newChecklistItem')"
            autocomplete="off"
          />
          <BaseButton
            :label="t('task.add')"
            variant="secondary"
          />
        </form>

        <div
          v-if="checklistItems.length === 0"
          class="text-body text-ink-soft"
        >
          {{ t('task.noChecklist') }}
        </div>

        <div
          v-for="item in checklistItems"
          :key="item.id"
          class="grid gap-2 border border-border bg-paper p-3"
        >
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              :checked="item.status === 'completed'"
              @change="
                toggleChecklistItem(item, ($event.target as HTMLInputElement).checked)
              "
            />
            <input
              v-model="checklistTitles[item.id]"
              class="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              :class="{ 'line-through text-ink-soft': item.status === 'completed' }"
              @blur="saveChecklistItem(item)"
            />
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="text-caption font-semibold text-ink-soft hover:text-ink"
              @click="saveChecklistItem(item)"
            >
              {{ t('common.save') }}
            </button>
            <button
              type="button"
              class="text-caption font-semibold text-brick"
              @click="deleteChecklistItem(item)"
            >
              {{ t('common.remove') }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid gap-3 border-t border-border pt-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('task.timeline') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('task.timelineSubtitle') }}</span
          >
        </div>

        <div
          v-if="isLoadingTimeline"
          class="border border-border bg-paper p-3 text-body text-ink-soft"
        >
          {{ t('task.timelineLoading') }}
        </div>

        <TaskTimelinePanel
          v-else
          :events="selectedTaskTimeline"
        />
      </div>

      <div class="border-t border-border pt-4">
        <button
          type="button"
          class="w-full bg-brick px-3 py-2 text-body font-semibold text-on-accent"
          @click="deleteSelectedTask"
        >
          {{ t('task.deleteTask') }}
        </button>
      </div>
    </div>
  </aside>
</template>
