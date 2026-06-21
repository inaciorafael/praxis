<script setup lang="ts">
import { Task } from '@/shared/types/task';
import { useTagStore } from '@/stores/tag.store';
import { useTaskStore } from '@/stores/task.store';
import { Bell, CalendarCheck, CalendarDays, Check } from '@lucide/vue';
import TaskTag from './TaskTag.vue';
import { computed, ref, type ComputedRef } from 'vue';
import { Tag } from '@/shared/types/tag';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';

dayjs.extend(calendar)

dayjs().calendar(null, {
  sameDay: "[Today at] h:mm A", // The same day ( Today at 2:30 AM )
  nextDay: "[Tomorrow at] h:mm A", // The next day ( Tomorrow at 2:30 AM )
  nextWeek: "dddd [at] h:mm A", // The next week ( Sunday at 2:30 AM )
  lastDay: "[Yesterday at] h:mm A", // The day before ( Yesterday at 2:30 AM )
  lastWeek: "[Last] dddd [at] h:mm A", // Last week ( Last Monday at 2:30 AM )
  sameElse: "DD/MM/YYYY", // Everything else ( 17/10/2011 )
});

const props = defineProps<Task>()

const tags = useTagStore();
const tasks = useTaskStore();
const isUpdatingStatus = ref(false);
const updatingChecklistItemIds = ref(new Set<string>());

const taskTags: ComputedRef<Tag[]> = computed(() => tags.tagsByTask[props.id] ?? [])
const isSelected = computed(() => tasks.selectedTaskId === props.id)

const checklistItems = computed(() =>
  tasks.checklistItemsByTaskId(props.id)
);

function selectTask() {
  tasks.selectTask(props.id);
}

async function toggleCompleted() {
  if (isUpdatingStatus.value) {
    return;
  }

  isUpdatingStatus.value = true;

  try {
    await tasks.setCompleted(props.id, props.status !== 'completed');
  } finally {
    isUpdatingStatus.value = false;
  }
}

async function toggleChecklistItem(itemId: string, completed: boolean) {
  if (updatingChecklistItemIds.value.has(itemId)) {
    return;
  }

  updatingChecklistItemIds.value = new Set([...updatingChecklistItemIds.value, itemId]);

  try {
    await tasks.setChecklistItemCompleted(itemId, completed);
  } finally {
    const nextIds = new Set(updatingChecklistItemIds.value);
    nextIds.delete(itemId);
    updatingChecklistItemIds.value = nextIds;
  }
}

function isChecklistItemUpdating(itemId: string) {
  return updatingChecklistItemIds.value.has(itemId);
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :class="[
    'p-3 border-l-5 gap-3 hover:bg-hover transition-all flex flex-col',
    {
      'border-brick': isOverdue,
      'border-transparent': status === 'pending' && !isOverdue,
      'border-sage': status === 'completed',
      'bg-selection': isSelected
    }
  ]"
    @click="selectTask"
    @keydown.enter.prevent="selectTask"
    @keydown.space.prevent="selectTask"
  >
    <div class="flex cursor-pointer flex-row gap-3 items-center">
      <template v-if="checklistItems.length > 0">
        <div class="flex flex-row gap-2">
          <div class="bg-rose px-3 text-paper">{{ progress.completedItems }}/{{ progress.totalItems }}</div>
          <div class="bg-sage px-3 text-paper">{{ progress.percentage }}%</div>
        </div>
      </template>

      <button
        v-if="checklistItems.length === 0"
        type="button"
        :disabled="isUpdatingStatus"
        :aria-label="status === 'completed' ? 'Marcar tarefa como pendente' : 'Concluir tarefa'"
        :title="status === 'completed' ? 'Marcar como pendente' : 'Concluir tarefa'"
        :class="[
          'border w-8 h-8 flex items-center justify-center rounded-xl',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-sage border-sage text-paper': status === 'completed',
            'bg-transparent': status === 'pending'
          }
        ]"
        @click.stop="toggleCompleted"
      >
        <Check class="text-paper" v-if="status === 'completed'" :size="18" />
      </button>
      <span
        :class="[
          'text-title',
          {
            'line-through': status === 'completed',
          }
        ]"
      >
        {{ title }}
      </span>

      <template v-if="taskTags.length > 0" v-for="tag in taskTags">
        <TaskTag v-bind="tag" />
      </template>
    </div>

    <template v-if="checklistItems.length > 0">
      <div v-for="item in checklistItems" :key="item.id" class="ml-5">
        <button
          type="button"
          :disabled="isChecklistItemUpdating(item.id)"
          class="flex flex-row items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          :aria-label="item.status === 'completed' ? 'Marcar subtask como pendente' : 'Concluir subtask'"
          :title="item.status === 'completed' ? 'Marcar subtask como pendente' : 'Concluir subtask'"
          @click.stop="toggleChecklistItem(item.id, item.status !== 'completed')"
        >
          <div
            :class="[
              'h-6 w-6 rounded-md border flex items-center justify-center',
              {
                'bg-sage text-paper line-through': item.status === 'completed',
              }
            ]"
          >
            <Check v-if="item.status === 'completed'" :size="18" />
          </div>
          <span
            :class="
              {
                'line-through': item.status === 'completed',
              }
            "
          >{{ item.title }}</span>
        </button>
      </div>
    </template>


    <span class="text-ink-soft text-body" v-if="notes">{{ notes }}</span>

    <div class="flex flex-row gap-4">
      <div
        v-if="dueAt && status === 'pending'"
        :class="[
          'flex text-paper px-3 flex-row items-center gap-1',
          {
            'border border-brick': !isOverdue,
            'bg-brick': isOverdue,
          }
        ]">
        <CalendarDays
          :class="{
            'text-brick': !isOverdue,
            'text-paper': isOverdue
          }"
          :size="15"
        />
        <span
          :class="{
            'text-brick': !isOverdue,
            'text-paper': isOverdue
          }"
        >{{ dayjs(dueAt).calendar() }}</span>
      </div>

      <div v-if="status === 'completed'" class="flex bg-sage text-paper px-3 flex-row items-center gap-1">
        <CalendarCheck :size="15" />
        <span>{{ dayjs(completedAt).calendar() }}</span>
      </div>

      <template v-if="reminderAt && !isOverdue && status === 'pending'">
        <div class="bg-purple text-paper px-3 flex flex-row items-center gap-2">
          <Bell :size="15" />
          <span>{{ dayjs(reminderAt).calendar() }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
