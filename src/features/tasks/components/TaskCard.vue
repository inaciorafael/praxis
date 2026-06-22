<script setup lang="ts">
import { Task } from "@/shared/types/task";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";
import { Bell, CalendarCheck, CalendarDays, Check, Trash2 } from "@lucide/vue";
import TaskTag from "./TaskTag.vue";
import { computed, ref, type ComputedRef } from "vue";
import { Tag } from "@/shared/types/tag";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import "dayjs/locale/pt-br";

dayjs.extend(calendar);

dayjs().calendar(null, {
	sameDay: "[Today at] HH:mm", // The same day ( Today at 2:30 AM )
	nextDay: "[Tomorrow at] HH:mm", // The next day ( Tomorrow at 2:30 AM )
	nextWeek: "dddd [at] HH:mm", // The next week ( Sunday at 2:30 AM )
	lastDay: "[Yesterday at] HH:mm", // The day before ( Yesterday at 2:30 AM )
	lastWeek: "[Last] dddd [at] HH:mm", // Last week ( Last Monday at 2:30 AM )
	sameElse: "DD/MM/YYYY", // Everything else ( 17/10/2011 )
});

const props = defineProps<Task>();

const tags = useTagStore();
const tasks = useTaskStore();
const isUpdatingStatus = ref(false);
const isDeleting = ref(false);
const updatingChecklistItemIds = ref(new Set<string>());

const taskTags: ComputedRef<Tag[]> = computed(
	() => tags.tagsByTask[props.id] ?? [],
);
const isSelected = computed(() => tasks.selectedTaskId === props.id);

const checklistItems = computed(() => tasks.checklistItemsByTaskId(props.id));

function selectTask() {
	tasks.selectTask(props.id);
}

async function toggleCompleted() {
	if (isUpdatingStatus.value) {
		return;
	}

	isUpdatingStatus.value = true;

	try {
		await tasks.setCompleted(props.id, props.status !== "completed");
	} finally {
		isUpdatingStatus.value = false;
	}
}

async function deleteTask() {
	if (isDeleting.value) {
		return;
	}

	isDeleting.value = true;

	try {
		await tasks.delete(props.id);
	} finally {
		isDeleting.value = false;
	}
}

async function toggleChecklistItem(itemId: string, completed: boolean) {
	if (updatingChecklistItemIds.value.has(itemId)) {
		return;
	}

	updatingChecklistItemIds.value = new Set([
		...updatingChecklistItemIds.value,
		itemId,
	]);

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
          <div class="bg-rose px-3 text-paper">
            {{ progress.completedItems }}/{{ progress.totalItems }}
          </div>
          <div class="bg-sage px-3 text-paper">{{ progress.percentage }}%</div>
        </div>
      </template>

      <button
        v-if="checklistItems.length === 0"
        type="button"
        :disabled="isUpdatingStatus"
        :aria-label="
          status === 'completed' ? 'Marcar tarefa como pendente' : 'Concluir tarefa'
        "
        :title="status === 'completed' ? 'Marcar como pendente' : 'Concluir tarefa'"
        :class="[
          'border w-8 h-8 shrink-0 flex items-center justify-center rounded-xl',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-sage border-sage text-paper': status === 'completed',
            'bg-transparent': status === 'pending',
          },
        ]"
        @click.stop="toggleCompleted"
      >
        <Check
          class="text-paper"
          v-if="status === 'completed'"
          :size="18"
        />
      </button>
      <span
        :class="[
          'text-title min-w-0 max-w-full break-words',
          {
            'line-through': status === 'completed',
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
        type="button"
        :disabled="isDeleting"
        aria-label="Excluir tarefa"
        title="Excluir tarefa"
        class="ml-auto flex h-8 w-8 shrink-0 items-center justify-center border border-border text-ink-soft hover:border-brick hover:bg-hover hover:text-brick disabled:pointer-events-none disabled:opacity-50"
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
          :disabled="isChecklistItemUpdating(item.id)"
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
                'bg-sage text-paper line-through': item.status === 'completed',
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

    <div class="flex flex-row gap-4">
      <div
        v-if="dueAt && status === 'pending'"
        :class="[
          'flex text-paper px-3 flex-row items-center gap-1',
          {
            'text-brick': !isOverdue,
            'bg-brick': isOverdue,
          },
        ]"
      >
        <CalendarDays
          :class="{
            'text-brick': !isOverdue,
            'text-paper': isOverdue,
          }"
          :size="15"
        />
        <span
          :class="{
            'text-brick': !isOverdue,
            'text-paper': isOverdue,
          }"
          >{{ dayjs(dueAt).calendar() }}</span
        >
      </div>

      <div
        v-if="status === 'completed'"
        class="flex bg-sage text-paper px-3 flex-row items-center gap-1"
      >
        <CalendarCheck :size="15" />
        <span>{{ dayjs(completedAt).calendar() }}</span>
      </div>

      <template v-if="reminderAt && status === 'pending'">
        <div class="bg-purple text-paper px-3 flex flex-row items-center gap-2">
          <Bell :size="15" />
          <span>{{ dayjs(reminderAt).calendar() }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
