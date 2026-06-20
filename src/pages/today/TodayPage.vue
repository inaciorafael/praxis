<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import DayStatusClock from "@/features/tasks/components/DayStatusClock.vue";
import TaskTimelinePanel from "@/features/tasks/components/TaskTimelinePanel.vue";
import BaseCard from "@/shared/ui/BaseCard.vue";
import { useBadgeStore } from "@/stores/badge.store";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";
import { useVaultStore } from "@/stores/vault.store";
import dayjs from "dayjs";
import TaskCard from "@/features/tasks/components/TaskCard.vue";

const router = useRouter();
const badge = useBadgeStore();
const tags = useTagStore();
const tasks = useTaskStore();
const vault = useVaultStore();

const taskTitle = ref("");
const taskNotes = ref("");
const taskPlannedToday = ref(true);
const taskDueAt = ref("");
const taskReminderAt = ref("");
const taskTagId = ref("");
const tagName = ref("");
const tagColor = ref("#ef4444");
const editingTagId = ref("");
const editingTagName = ref("");
const editingTagColor = ref("#ef4444");
const openTimelineTaskId = ref("");
const checklistTitleByTaskId = ref<Record<string, string>>({});

const vaultPath = computed(() => vault.activeDataFilePath ?? vault.selectedDataFilePath ?? "nenhum arquivo selecionado");
const filteredMyDay = computed(() =>
  filterTasksBySelectedTag(tasks.myDay.filter((task) => task.status === "pending")),
);
const filteredCompleted = computed(() => filterTasksBySelectedTag(tasks.completed));
const taskTagsByTask = computed(() => tags.tagsByTask);
const checklistItemsByTask = computed(() =>
  tasks.checklistItems.reduce<Record<string, typeof tasks.checklistItems>>((groups, item) => {
    groups[item.taskId] = groups[item.taskId] ?? [];
    groups[item.taskId].push(item);
    return groups;
  }, {}),
);

onMounted(async () => {
  await tasks.hydrateCompleted({ limit: 50 });
});

async function createCurrentTask() {
  const created = await tasks.create({
    title: taskTitle.value,
    notes: taskNotes.value,
    plannedFor: taskPlannedToday.value ? todayLocalDate() : null,
    dueAt: taskDueAt.value ? new Date(taskDueAt.value).toISOString() : null,
    reminderAt: taskReminderAt.value ? new Date(taskReminderAt.value).toISOString() : null,
  });

  if (created) {
    const createdTask = tasks.tasks[tasks.tasks.length - 1];

    if (createdTask && taskTagId.value) {
      await tags.assignToTask(createdTask.id, taskTagId.value);
    }

    taskTitle.value = "";
    taskNotes.value = "";
    taskDueAt.value = "";
    taskReminderAt.value = "";
    taskTagId.value = "";
  }
}

async function lockVault() {
  await vault.close();
  tasks.resetLocal();
  tags.resetLocal();
  await badge.clear();
  await router.replace({ name: "vault" });
}

async function createCurrentTag() {
  const created = await tags.create({
    name: tagName.value,
    color: tagColor.value,
  });

  if (created) {
    tagName.value = "";
    tagColor.value = "#ef4444";
  }
}

function startEditingTag(tagId: string) {
  const tag = tags.tags.find((item) => item.id === tagId);

  if (!tag) {
    return;
  }

  editingTagId.value = tag.id;
  editingTagName.value = tag.name;
  editingTagColor.value = tag.color;
}

async function saveEditingTag() {
  if (!editingTagId.value) {
    return;
  }

  const updated = await tags.update(editingTagId.value, {
    name: editingTagName.value,
    color: editingTagColor.value,
  });

  if (updated) {
    editingTagId.value = "";
    editingTagName.value = "";
    editingTagColor.value = "#ef4444";
  }
}

async function assignSelectedTag(taskId: string, event: Event) {
  const select = event.target as HTMLSelectElement;
  const tagId = select.value;

  if (!tagId) {
    return;
  }

  await tags.assignToTask(taskId, tagId);
  select.value = "";
}

async function toggleTaskTimeline(taskId: string) {
  if (openTimelineTaskId.value === taskId) {
    openTimelineTaskId.value = "";
    return;
  }

  openTimelineTaskId.value = taskId;
  await tasks.loadTimeline(taskId);
}

async function addChecklistItem(taskId: string) {
  const title = checklistTitleByTaskId.value[taskId]?.trim() ?? "";

  if (!title) {
    return;
  }

  const created = await tasks.createChecklistItem({ taskId, title });

  if (created) {
    checklistTitleByTaskId.value[taskId] = "";
  }
}

async function toggleChecklistItem(itemId: string, event: Event) {
  const checkbox = event.target as HTMLInputElement;
  await tasks.setChecklistItemCompleted(itemId, checkbox.checked);
}

function filterTasksBySelectedTag<T extends { id: string }>(items: T[]) {
  if (!tags.selectedTagId) {
    return items;
  }

  const allowedTaskIds = new Set(
    tags.taskTags.filter((relation) => relation.tagId === tags.selectedTagId).map((relation) => relation.taskId),
  );

  return items.filter((item) => allowedTaskIds.has(item.id));
}

function todayLocalDate() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}
</script>

<template>
  <section class="grid gap-5">
    <div class="flex flex-col">
      <span class="text-display">Meu dia</span>
      <span class="text-heading">{{ dayjs().format('dddd[,] DD [de] MMMM YYYY.') }}</span>
    </div>

    <template v-for="task of tasks.myDay">
      <TaskCard v-bind="task" />
    </template>
  </section>

  <button @click="lockVault">sair</button>
</template>
