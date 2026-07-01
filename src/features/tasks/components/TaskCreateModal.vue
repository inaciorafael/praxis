<script setup lang="ts">
import TaskFormFields from '@/features/tasks/components/TaskFormFields.vue'
import TaskFormPreview from '@/features/tasks/components/TaskFormPreview.vue'
import {
  checklistItemsFromText,
  createTaskFormDraft,
  syncTaskTags,
  toIsoDateTime,
  type TaskFormDraft,
} from '@/features/tasks/lib/task-form'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useTagStore } from '@/stores/tag.store'
import { useTaskStore } from '@/stores/task.store'
import { X } from '@lucide/vue'
import dayjs from 'dayjs'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const tasks = useTaskStore()
const tags = useTagStore()
const { t, locale } = useI18n()
const formFields = ref<InstanceType<typeof TaskFormFields> | null>(null)
const draft = ref<TaskFormDraft>(createTaskFormDraft())
const selectedTagNames = ref<string[]>([])
const checklistText = ref('')
const isCreating = ref(false)

const canCreate = computed(() => Boolean(draft.value.title.trim() && !isCreating.value))
const contextLabel = computed(() => tasks.createContext.label)
const contextDescription = computed(() => {
  if (!tasks.createContext.dueDate) {
    return `${contextLabel.value} · ${t('task.noInitialDue')}`
  }

  return `${contextLabel.value} · ${t('task.suggestedDue', {
    date: new Intl.DateTimeFormat(locale.value).format(dayjs(tasks.createContext.dueDate).toDate()),
  })}`
})

watch(
  () => tasks.createModalOpen,
  async (open) => {
    if (!open) {
      return
    }

    resetForm()
    if (!tags.isReady) {
      await tags.hydrate()
    }
    await nextTick()
    formFields.value?.focusTitle()
  }
)

async function createTask() {
  formFields.value?.commitPendingTag()
  await nextTick()
  const taskTitle = draft.value.title.trim()

  if (!taskTitle || isCreating.value) {
    return
  }

  const previousTaskIds = new Set(tasks.tasks.map((task) => task.id))
  isCreating.value = true

  try {
    const created = await tasks.create({
      title: taskTitle,
      notes: draft.value.notes.trim() || null,
      plannedFor: draft.value.plannedFor || null,
      dueAt: toIsoDateTime(draft.value.dueAt),
      reminderAt: toIsoDateTime(draft.value.reminderAt),
    })

    if (!created) {
      return
    }

    const createdTask = tasks.tasks.find((task) => !previousTaskIds.has(task.id))

    if (!createdTask) {
      tasks.closeCreateTaskModal()
      return
    }

    await syncTaskTags(tags, createdTask.id, selectedTagNames.value)

    for (const itemTitle of checklistItemsFromText(checklistText.value)) {
      await tasks.createChecklistItem({
        taskId: createdTask.id,
        title: itemTitle,
      })
    }

    await tasks.refreshActiveTaskView()
    tasks.closeCreateTaskModal()
  } finally {
    isCreating.value = false
  }
}

function closeModal() {
  if (!isCreating.value) {
    tasks.closeCreateTaskModal()
  }
}

function resetForm() {
  draft.value = createTaskFormDraft({
    plannedFor: tasks.createContext.plannedFor ?? '',
    dueAt: tasks.createContext.dueDate ? `${tasks.createContext.dueDate}T23:59` : '',
  })
  selectedTagNames.value = []
  checklistText.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tasks.createModalOpen"
      class="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-6"
      @keydown.escape="closeModal"
    >
      <form
        class="flex max-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col border border-border bg-paper shadow-xl"
        @submit.prevent="createTask"
      >
        <header class="flex items-start justify-between gap-4 border-b border-border p-5">
          <div class="grid gap-1">
            <span class="text-heading">{{ t('task.new') }}</span>
            <span class="text-body text-ink-soft">{{ contextDescription }}</span>
          </div>

          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center text-ink-soft hover:bg-hover hover:text-ink"
            aria-label="Fechar"
            title="Fechar"
            @click="closeModal"
          >
            <X :size="19" />
          </button>
        </header>

        <div
          class="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 desktop:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]"
        >
          <TaskFormFields
            ref="formFields"
            v-model="draft"
            v-model:selected-tag-names="selectedTagNames"
            v-model:checklist-text="checklistText"
            field-id-prefix="create-task"
            show-checklist
          />

          <TaskFormPreview
            :draft="draft"
            :selected-tag-names="selectedTagNames"
            :checklist-text="checklistText"
          />
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            class="border border-border bg-surface px-3 py-2 text-body font-semibold text-ink hover:bg-hover"
            @click="closeModal"
          >
            {{ t('common.cancel') }}
          </button>
          <BaseButton
            :disabled="!canCreate"
            :label="isCreating ? t('task.creating') : t('task.create')"
            variant="primary"
          />
        </footer>
      </form>
    </div>
  </Teleport>
</template>
