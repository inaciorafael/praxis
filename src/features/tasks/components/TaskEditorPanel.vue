<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "@lucide/vue";

import BaseButton from "@/shared/ui/BaseButton.vue";
import Input from "@/shared/ui/Input.vue";
import type { ChecklistItem } from "@/shared/types/checklist";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();
const tags = useTagStore();
const title = ref("");
const notes = ref("");
const plannedFor = ref("");
const dueAt = ref("");
const reminderAt = ref("");
const newChecklistItem = ref("");
const checklistTitles = ref<Record<string, string>>({});
const isSaving = ref(false);

const selectedTask = computed(() => tasks.getSelectedTask());
const selectedTaskTags = computed(() => {
  if (!selectedTask.value) {
    return new Set<string>();
  }

  return new Set(
    tags.taskTags
      .filter((relation) => relation.taskId === selectedTask.value?.id)
      .map((relation) => relation.tagId),
  );
});
const checklistItems = computed(() => {
  if (!selectedTask.value) {
    return [];
  }

  return tasks.checklistItemsByTaskId(selectedTask.value.id);
});
const canSave = computed(() => Boolean(selectedTask.value && title.value.trim() && !isSaving.value));

watch(
  selectedTask,
  (task) => {
    if (!task) {
      resetForm();
      return;
    }

    title.value = task.title;
    notes.value = task.notes ?? "";
    plannedFor.value = task.plannedFor ?? "";
    dueAt.value = toDatetimeLocal(task.dueAt);
    reminderAt.value = toDatetimeLocal(task.reminderAt);
    syncChecklistTitles(checklistItems.value);
  },
  { immediate: true },
);

watch(checklistItems, (items) => {
  syncChecklistTitles(items);
});

async function saveTask() {
  const task = selectedTask.value;

  if (!task || !canSave.value) {
    return;
  }

  isSaving.value = true;

  try {
    await tasks.update(task.id, {
      title: title.value,
      notes: notes.value || null,
      plannedFor: plannedFor.value || null,
      dueAt: toIsoDateTime(dueAt.value),
      reminderAt: toIsoDateTime(reminderAt.value),
    });
  } finally {
    isSaving.value = false;
  }
}

async function toggleCompleted() {
  const task = selectedTask.value;

  if (!task) {
    return;
  }

  await tasks.setCompleted(task.id, task.status !== "completed");
}

async function toggleTag(tagId: string, checked: boolean) {
  const task = selectedTask.value;

  if (!task) {
    return;
  }

  if (checked) {
    await tags.assignToTask(task.id, tagId);
    return;
  }

  await tags.removeFromTask(task.id, tagId);
}

async function createChecklistItem() {
  const task = selectedTask.value;
  const itemTitle = newChecklistItem.value.trim();

  if (!task || !itemTitle) {
    return;
  }

  const created = await tasks.createChecklistItem({
    taskId: task.id,
    title: itemTitle,
  });

  if (created) {
    newChecklistItem.value = "";
  }
}

async function saveChecklistItem(item: ChecklistItem) {
  const itemTitle = checklistTitles.value[item.id]?.trim();

  if (!itemTitle || itemTitle === item.title) {
    return;
  }

  await tasks.updateChecklistItem(item.id, {
    title: itemTitle,
  });
}

async function toggleChecklistItem(item: ChecklistItem, checked: boolean) {
  await tasks.setChecklistItemCompleted(item.id, checked);
}

async function deleteChecklistItem(item: ChecklistItem) {
  await tasks.deleteChecklistItem(item.id);
}

async function deleteSelectedTask() {
  const task = selectedTask.value;

  if (!task) {
    return;
  }

  await tasks.delete(task.id);
  tasks.clearSelectedTask();
}

function closePanel() {
  tasks.clearSelectedTask();
}

function syncChecklistTitles(items: ChecklistItem[]) {
  checklistTitles.value = items.reduce<Record<string, string>>((index, item) => {
    index[item.id] = checklistTitles.value[item.id] ?? item.title;
    return index;
  }, {});
}

function resetForm() {
  title.value = "";
  notes.value = "";
  plannedFor.value = "";
  dueAt.value = "";
  reminderAt.value = "";
  newChecklistItem.value = "";
  checklistTitles.value = {};
}

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
</script>

<template>
  <aside class="h-screen overflow-y-auto border-l border-border bg-surface p-5 text-ink">
    <div v-if="selectedTask" class="grid gap-5">
      <div class="flex items-start justify-between gap-3">
        <div class="grid gap-1">
          <span class="text-heading">Editar tarefa</span>
          <span class="text-body text-ink-soft">Ajuste os detalhes da tarefa selecionada.</span>
        </div>

        <button type="button" class="p-2 text-ink-soft hover:bg-hover hover:text-ink" @click="closePanel">
          <X :size="18" />
        </button>
      </div>

      <div class="grid gap-3">
        <Input v-model="title" label="Título" autocomplete="off" />

        <label class="grid gap-1">
          <span class="font-semibold text-ink">Nota</span>
          <textarea
            v-model="notes"
            class="min-h-28 resize-y border border-border bg-paper px-3 py-2 text-body text-ink outline-none focus:border-accent"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            <span class="font-semibold text-ink">Planejado para</span>
            <input
              v-model="plannedFor"
              type="date"
              class="border border-border bg-paper px-3 py-2 text-body text-ink outline-none focus:border-accent"
            />
          </label>

          <label class="grid gap-1">
            <span class="font-semibold text-ink">Status</span>
            <button
              type="button"
              class="border border-border bg-paper px-3 py-2 text-left text-body font-semibold text-ink hover:bg-hover"
              @click="toggleCompleted"
            >
              {{ selectedTask.status === "completed" ? "Concluída" : "Pendente" }}
            </button>
          </label>
        </div>

        <label class="grid gap-1">
          <span class="font-semibold text-ink">Vencimento</span>
          <input
            v-model="dueAt"
            type="datetime-local"
            class="border border-border bg-paper px-3 py-2 text-body text-ink outline-none focus:border-accent"
          />
        </label>

        <label class="grid gap-1">
          <span class="font-semibold text-ink">Lembrete</span>
          <input
            v-model="reminderAt"
            type="datetime-local"
            class="border border-border bg-paper px-3 py-2 text-body text-ink outline-none focus:border-accent"
          />
        </label>

        <BaseButton
          :disabled="!canSave"
          :label="isSaving ? 'Salvando...' : 'Salvar alterações'"
          variant="primary"
          @click="saveTask"
        />
      </div>

      <div class="grid gap-3 border-t border-border pt-4">
        <span class="text-heading">Tags</span>

        <div v-if="tags.tags.length === 0" class="text-body text-ink-soft">
          Nenhuma tag criada.
        </div>

        <label v-for="tag in tags.tags" :key="tag.id" class="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            :checked="selectedTaskTags.has(tag.id)"
            @change="toggleTag(tag.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="h-3 w-3 border border-border" :style="{ backgroundColor: tag.color }"></span>
          <span>{{ tag.name }}</span>
        </label>
      </div>

      <div class="grid gap-3 border-t border-border pt-4">
        <span class="text-heading">Checklist</span>

        <form class="flex gap-2" @submit.prevent="createChecklistItem">
          <Input v-model="newChecklistItem" placeholder="Novo item" autocomplete="off" />
          <BaseButton label="Adicionar" variant="secondary" />
        </form>

        <div v-if="checklistItems.length === 0" class="text-body text-ink-soft">
          Nenhum item de checklist.
        </div>

        <div v-for="item in checklistItems" :key="item.id" class="grid gap-2 border border-border bg-paper p-3">
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              :checked="item.status === 'completed'"
              @change="toggleChecklistItem(item, ($event.target as HTMLInputElement).checked)"
            />
            <input
              v-model="checklistTitles[item.id]"
              class="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              :class="{ 'line-through text-ink-soft': item.status === 'completed' }"
              @blur="saveChecklistItem(item)"
            />
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" class="text-caption font-semibold text-ink-soft hover:text-ink" @click="saveChecklistItem(item)">
              Salvar
            </button>
            <button type="button" class="text-caption font-semibold text-brick" @click="deleteChecklistItem(item)">
              Remover
            </button>
          </div>
        </div>
      </div>

      <div class="border-t border-border pt-4">
        <button type="button" class="w-full bg-brick px-3 py-2 text-body font-semibold text-paper" @click="deleteSelectedTask">
          Remover tarefa
        </button>
      </div>
    </div>
  </aside>
</template>
