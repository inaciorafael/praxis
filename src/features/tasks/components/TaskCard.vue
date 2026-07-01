<script setup lang="ts">
import type { ChecklistItem } from '@/shared/types/checklist'
import type { Tag } from '@/shared/types/tag'
import type { Task } from '@/shared/types/task'
import { useTagStore } from '@/stores/tag.store'
import { useTaskStore } from '@/stores/task.store'
import {
  Archive,
  ArchiveRestore,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  Trash2,
} from '@lucide/vue'
import TaskTag from './TaskTag.vue'
import { computed, ref, type ComputedRef } from 'vue'
import { formatCalendarDateTime } from '@/shared/lib/date/date-format'
import { useI18n } from 'vue-i18n'

type TaskCardProps = Task & {
  readonly?: boolean
  displayTags?: Tag[]
  displayChecklistItems?: ChecklistItem[]
}

const props = withDefaults(defineProps<TaskCardProps>(), {
  readonly: false,
  displayTags: undefined,
  displayChecklistItems: undefined,
})

const tags = useTagStore()
const tasks = useTaskStore()
const { t } = useI18n()
const isUpdatingStatus = ref(false)
const isDeleting = ref(false)
const isRestoring = ref(false)
const updatingChecklistItemIds = ref(new Set<string>())

const taskTags: ComputedRef<Tag[]> = computed(
  () => props.displayTags ?? tags.tagsByTask[props.id] ?? []
)
const isSelected = computed(() => tasks.selectedTaskId === props.id)

const checklistItems = computed(
  () => props.displayChecklistItems ?? tasks.checklistItemsByTask[props.id] ?? []
)

function selectTask() {
  if (props.readonly) {
    return
  }

  tasks.selectTask(props.id)
}

async function toggleCompleted() {
  if (isUpdatingStatus.value) {
    return
  }

  isUpdatingStatus.value = true

  try {
    await tasks.setCompleted(props.id, props.status !== 'completed')
  } finally {
    isUpdatingStatus.value = false
  }
}

async function deleteTask() {
  if (isDeleting.value) {
    return
  }

  isDeleting.value = true

  try {
    await tasks.delete(props.id)
  } finally {
    isDeleting.value = false
  }
}

async function restoreTask() {
  if (isRestoring.value || !props.archivedAt) {
    return
  }

  isRestoring.value = true

  try {
    await tasks.restoreArchived(props.id)
  } finally {
    isRestoring.value = false
  }
}

async function toggleChecklistItem(itemId: string, completed: boolean) {
  if (updatingChecklistItemIds.value.has(itemId)) {
    return
  }

  updatingChecklistItemIds.value = new Set([...updatingChecklistItemIds.value, itemId])

  try {
    await tasks.setChecklistItemCompleted(itemId, completed)
  } finally {
    const nextIds = new Set(updatingChecklistItemIds.value)
    nextIds.delete(itemId)
    updatingChecklistItemIds.value = nextIds
  }
}

function isChecklistItemUpdating(itemId: string) {
  return updatingChecklistItemIds.value.has(itemId)
}
</script>

<template>
  <div
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :class="[
      'p-3 border-l-5 gap-3 transition-all flex flex-col',
      readonly ? 'cursor-default' : 'hover:bg-hover',
      {
        'border-archived opacity-80': archivedAt,
        'border-brick': isOverdue && !archivedAt,
        'border-transparent': status === 'pending' && !isOverdue && !archivedAt,
        'border-sage': status === 'completed' && !archivedAt,
        'bg-selection': isSelected,
      },
    ]"
    @click="selectTask"
    @keydown.enter.prevent="selectTask"
    @keydown.space.prevent="selectTask"
  >
    <div class="flex cursor-pointer flex-row flex-wrap items-center gap-3">
      <template v-if="checklistItems.length > 0">
        <div class="flex shrink-0 flex-row gap-2">
          <div class="bg-rose px-3 text-on-accent">
            {{ progress.completedItems }}/{{ progress.totalItems }}
          </div>
          <div class="bg-sage px-3 text-on-accent">{{ progress.percentage }}%</div>
        </div>
      </template>

      <button
        v-if="checklistItems.length === 0"
        type="button"
        :disabled="readonly || isUpdatingStatus"
        :aria-label="
          status === 'completed' ? t('task.reopen') : t('task.complete')
        "
        :title="status === 'completed' ? t('task.reopen') : t('task.complete')"
        :class="[
          'border w-8 h-8 shrink-0 flex items-center justify-center rounded-xl',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-sage border-sage text-on-accent': status === 'completed',
            'bg-transparent': status === 'pending',
          },
        ]"
        @click.stop="toggleCompleted"
      >
        <Check
          class="text-on-accent"
          v-if="status === 'completed'"
          :size="18"
        />
      </button>
      <span
        :class="[
          'text-title min-w-0 max-w-full wrap-break-words',
          {
            'line-through opacity-40': status === 'completed',
          },
        ]"
      >
        {{ title }}
      </span>

      <template
        v-if="taskTags.length > 0"
        v-for="tag in taskTags"
        :key="tag.id"
      >
        <TaskTag v-bind="tag" />
      </template>

      <button
        v-if="archivedAt && !readonly"
        type="button"
        :disabled="isRestoring"
        :aria-label="t('task.restore')"
        :title="t('task.restore')"
        class="ml-auto flex h-8 w-8 shrink-0 items-center justify-center border border-border text-archived hover:border-blue hover:bg-hover hover:text-blue disabled:pointer-events-none disabled:opacity-50"
        @click.stop="restoreTask"
      >
        <ArchiveRestore :size="16" />
      </button>

      <button
        v-if="!readonly"
        type="button"
        :disabled="isDeleting"
        :aria-label="t('task.delete')"
        :title="t('task.delete')"
        :class="[
          'flex h-8 w-8 shrink-0 items-center justify-center border border-border text-ink-soft hover:border-brick hover:bg-hover hover:text-brick disabled:pointer-events-none disabled:opacity-50',
          archivedAt ? '' : 'ml-auto',
        ]"
        @click.stop="deleteTask"
      >
        <Trash2 :size="16" />
      </button>
    </div>

    <template v-if="checklistItems.length > 0">
      <div
        v-for="item in checklistItems"
        :key="item.id"
        class="ml-5"
      >
        <button
          type="button"
          :disabled="readonly || isChecklistItemUpdating(item.id)"
          class="flex flex-row items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          :aria-label="
            item.status === 'completed'
              ? 'Marcar subtask como pendente'
              : 'Concluir subtask'
          "
          :title="
            item.status === 'completed'
              ? 'Marcar subtask como pendente'
              : 'Concluir subtask'
          "
          @click.stop="toggleChecklistItem(item.id, item.status !== 'completed')"
        >
          <div
            :class="[
              'h-6 w-6 rounded-md border flex items-center justify-center',
              {
                'bg-sage text-on-accent line-through': item.status === 'completed',
              },
            ]"
          >
            <Check
              v-if="item.status === 'completed'"
              :size="18"
            />
          </div>
          <span
            :class="{
              'line-through': item.status === 'completed',
            }"
            >{{ item.title }}</span
          >
        </button>
      </div>
    </template>

    <span
      class="text-ink-soft text-body"
      v-if="notes"
      >{{ notes }}</span
    >

    <div class="flex flex-row flex-wrap gap-4">
      <div
        v-if="dueAt && status === 'pending'"
        :class="[
          'flex text-on-accent px-3 flex-row items-center gap-1',
          {
            'text-brick': !isOverdue,
            'bg-brick': isOverdue,
          },
        ]"
      >
        <CalendarDays
          :class="{
            'text-brick': !isOverdue,
            'text-on-accent': isOverdue,
          }"
          :size="15"
        />
        <span
          :class="{
            'text-brick': !isOverdue,
            'text-on-accent': isOverdue,
          }"
          >{{ formatCalendarDateTime(dueAt) }}</span
        >
      </div>

      <div
        v-if="status === 'completed'"
        class="flex bg-sage text-on-accent px-3 flex-row items-center gap-1"
      >
        <CalendarCheck :size="15" />
        <span>{{ formatCalendarDateTime(completedAt) }}</span>
      </div>

      <div
        v-if="status === 'completed' && archivedAt"
        class="flex bg-archived text-on-accent px-3 flex-row items-center gap-1"
      >
        <Archive :size="15" />
        <span>{{ t('task.archivedAt', { date: formatCalendarDateTime(archivedAt) }) }}</span>
      </div>

      <template v-if="reminderAt && status === 'pending'">
        <div class="bg-purple text-on-accent px-3 flex flex-row items-center gap-2">
          <Bell :size="15" />
          <span>{{ formatCalendarDateTime(reminderAt) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
