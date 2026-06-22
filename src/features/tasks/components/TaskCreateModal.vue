<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import dayjs from "dayjs";

import BaseButton from "@/shared/ui/BaseButton.vue";
import Input from "@/shared/ui/Input.vue";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();
const tags = useTagStore();
const titleInput = ref<HTMLInputElement | null>(null);
const title = ref("");
const notes = ref("");
const dueTime = ref("");
const useContextDueDate = ref(true);
const reminderAt = ref("");
const tagId = ref("");
const checklistText = ref("");
const isCreating = ref(false);

const canCreate = computed(() =>
	Boolean(title.value.trim() && !isCreating.value),
);
const contextLabel = computed(() => tasks.createContext.label);
const dueDateLabel = computed(() => {
	if (!tasks.createContext.dueDate) {
		return "Sem vencimento definido pelo contexto";
	}

	return dayjs(tasks.createContext.dueDate).format("DD/MM/YYYY");
});

watch(
	() => tasks.createModalOpen,
	async (open) => {
		if (!open) {
			return;
		}

		resetForm();
		await nextTick();
		titleInput.value?.focus();
	},
);

async function createTask() {
	if (!canCreate.value) {
		return;
	}

	const previousTaskIds = new Set(tasks.tasks.map((task) => task.id));
	isCreating.value = true;

	try {
		const created = await tasks.create({
			title: title.value,
			notes: notes.value || null,
			plannedFor: tasks.createContext.plannedFor,
			dueAt: contextDueAt(),
			reminderAt: toIsoDateTime(reminderAt.value),
		});

		if (!created) {
			return;
		}

		const createdTask = tasks.tasks.find(
			(task) => !previousTaskIds.has(task.id),
		);

		if (!createdTask) {
			tasks.closeCreateTaskModal();
			return;
		}

		if (tagId.value) {
			await tags.assignToTask(createdTask.id, tagId.value);
		}

		for (const itemTitle of checklistItemsFromText(checklistText.value)) {
			await tasks.createChecklistItem({
				taskId: createdTask.id,
				title: itemTitle,
			});
		}

		await tasks.refreshActiveTaskView();
		tasks.closeCreateTaskModal();
	} finally {
		isCreating.value = false;
	}
}

function contextDueAt() {
	const dueDate = tasks.createContext.dueDate;

	if (!dueDate || !useContextDueDate.value) {
		return null;
	}

	return toIsoDateTime(`${dueDate}T${dueTime.value || "23:59"}`);
}

function closeModal() {
	if (isCreating.value) {
		return;
	}

	tasks.closeCreateTaskModal();
}

function resetForm() {
	title.value = "";
	notes.value = "";
	dueTime.value = "";
	useContextDueDate.value = Boolean(tasks.createContext.dueDate);
	reminderAt.value = "";
	tagId.value = "";
	checklistText.value = "";
}

function clearReminderAt() {
	reminderAt.value = "";
}

function toIsoDateTime(value: string) {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function checklistItemsFromText(value: string) {
	return value
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter(Boolean);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tasks.createModalOpen"
      class="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-6"
      @keydown.escape="closeModal"
    >
      <form class="grid w-full max-w-2xl gap-4 border border-border bg-paper p-5 shadow-xl" @submit.prevent="createTask">
        <div class="flex items-start justify-between gap-4">
          <div class="grid gap-1">
            <span class="text-heading">Nova tarefa</span>
            <span class="text-body text-ink-soft">{{ contextLabel }} · vencimento {{ dueDateLabel }}</span>
          </div>

          <button type="button" class="px-2 py-1 text-heading text-ink-soft hover:bg-hover hover:text-ink" @click="closeModal">
            ×
          </button>
        </div>

        <Input
          ref="titleInput"
          v-model="title"
          label="Título"
          placeholder="O que precisa ser feito?"
          autocomplete="off"
        />

        <label class="grid gap-1">
          <span class="font-semibold text-ink">Nota</span>
          <textarea
            v-model="notes"
            class="min-h-24 resize-y border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
            placeholder="Detalhes opcionais"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold text-ink">Vencimento</span>
              <button
                v-if="tasks.createContext.dueDate"
                type="button"
                class="text-caption font-semibold text-ink-soft hover:text-brick"
                @click="useContextDueDate = !useContextDueDate"
              >
                {{ useContextDueDate ? "Remover" : "Usar contexto" }}
              </button>
            </div>
            <input
              v-model="dueTime"
              type="time"
              :disabled="!useContextDueDate"
              class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
            />
          </label>

          <div class="grid gap-1">
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold text-ink">Lembrete</span>
              <button
                v-if="reminderAt"
                type="button"
                class="text-caption font-semibold text-ink-soft hover:text-brick"
                @click="clearReminderAt"
              >
                Remover
              </button>
            </div>
            <input
              v-model="reminderAt"
              type="datetime-local"
              class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            <span class="font-semibold text-ink">Tag</span>
            <select
              v-model="tagId"
              class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
            >
              <option value="">Sem tag</option>
              <option v-for="tag in tags.tags" :key="tag.id" :value="tag.id">
                {{ tag.name }}
              </option>
            </select>
          </label>

          <label class="grid gap-1">
            <span class="font-semibold text-ink">Checklist</span>
            <textarea
              v-model="checklistText"
              class="min-h-20 resize-y border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
              placeholder="Um item por linha"
            />
          </label>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="border border-border bg-surface px-3 py-2 text-body font-semibold text-ink hover:bg-hover"
            @click="closeModal"
          >
            Cancelar
          </button>
          <BaseButton
            :disabled="!canCreate"
            :label="isCreating ? 'Criando...' : 'Criar tarefa'"
            variant="primary"
          />
        </div>
      </form>
    </div>
  </Teleport>
</template>
