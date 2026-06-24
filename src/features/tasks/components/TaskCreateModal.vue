<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import dayjs from "dayjs";
import { Plus, X } from "@lucide/vue";

import BaseButton from "@/shared/ui/BaseButton.vue";
import {
	findActiveInlineTag,
	normalizeTagName,
	removeInlineTagToken,
	type ActiveInlineTag,
} from "@/shared/lib/tags/inline-tag";
import { pickTagColorByName } from "@/shared/lib/tags/tag-color";
import type { Tag } from "@/shared/types/tag";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";

const tasks = useTaskStore();
const tags = useTagStore();
const titleInput = ref<HTMLInputElement | null>(null);
const title = ref("");
const notes = ref("");
const dueAt = ref("");
const reminderAt = ref("");
const selectedTagNames = ref<string[]>([]);
const activeTag = ref<ActiveInlineTag | null>(null);
const activeSuggestionIndex = ref(0);
const checklistText = ref("");
const isCreating = ref(false);

const canCreate = computed(() =>
	Boolean(title.value.trim() && !isCreating.value),
);
const selectedTagNameSet = computed(
	() => new Set(selectedTagNames.value.map(normalizeTagName)),
);
const matchingTags = computed(() => {
	const query = normalizeTagName(activeTag.value?.query ?? "");

	return tags.tags
		.filter((tag) => !selectedTagNameSet.value.has(normalizeTagName(tag.name)))
		.filter((tag) => !query || normalizeTagName(tag.name).includes(query))
		.slice(0, 6);
});
const exactMatchingTag = computed(() => {
	const query = normalizeTagName(activeTag.value?.query ?? "");
	return matchingTags.value.find(
		(tag) => normalizeTagName(tag.name) === query,
	);
});
const canCreateInlineTag = computed(
	() =>
		Boolean(activeTag.value?.query.trim()) &&
		!exactMatchingTag.value &&
		!selectedTagNameSet.value.has(
			normalizeTagName(activeTag.value?.query ?? ""),
		),
);
const tagSuggestionCount = computed(
	() => matchingTags.value.length + (canCreateInlineTag.value ? 1 : 0),
);
const tagSuggestionsOpen = computed(
	() => Boolean(activeTag.value && tagSuggestionCount.value > 0),
);
const contextLabel = computed(() => tasks.createContext.label);
const contextDescription = computed(() => {
	if (!tasks.createContext.dueDate) {
		return `${contextLabel.value} · sem vencimento inicial`;
	}

	return `${contextLabel.value} · vencimento sugerido ${dayjs(
		tasks.createContext.dueDate,
	).format("DD/MM/YYYY")}`;
});

watch(
	() => tasks.createModalOpen,
	async (open) => {
		if (!open) {
			return;
		}

		resetForm();
		if (!tags.isReady) {
			await tags.hydrate();
		}
		await nextTick();
		titleInput.value?.focus();
	},
);

async function createTask() {
	commitUnfinishedInlineTag();
	const taskTitle = title.value.trim();

	if (!taskTitle || isCreating.value) {
		return;
	}

	const previousTaskIds = new Set(tasks.tasks.map((task) => task.id));
	isCreating.value = true;

	try {
		const created = await tasks.create({
			title: taskTitle,
			notes: notes.value || null,
			plannedFor: tasks.createContext.plannedFor,
			dueAt: toIsoDateTime(dueAt.value),
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

		for (const tagName of selectedTagNames.value) {
			const tag = await resolveTag(tagName);

			if (tag) {
				await tags.assignToTask(createdTask.id, tag.id);
			}
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

function closeModal() {
	if (isCreating.value) {
		return;
	}

	tasks.closeCreateTaskModal();
}

function resetForm() {
	title.value = "";
	notes.value = "";
	dueAt.value = tasks.createContext.dueDate
		? `${tasks.createContext.dueDate}T23:59`
		: "";
	reminderAt.value = "";
	selectedTagNames.value = [];
	activeTag.value = null;
	activeSuggestionIndex.value = 0;
	checklistText.value = "";
}

function updateTitle(value: string) {
	title.value = value;
	void nextTick(updateActiveTagFromInput);
}

function updateActiveTagFromInput() {
	const input = titleInput.value;
	activeTag.value = findActiveInlineTag(
		title.value,
		input?.selectionStart ?? title.value.length,
	);
	activeSuggestionIndex.value = 0;
}

function handleTitleKeydown(event: KeyboardEvent) {
	if (!tagSuggestionsOpen.value) {
		return;
	}

	if (event.key === "ArrowDown") {
		event.preventDefault();
		activeSuggestionIndex.value =
			(activeSuggestionIndex.value + 1) % tagSuggestionCount.value;
		return;
	}

	if (event.key === "ArrowUp") {
		event.preventDefault();
		activeSuggestionIndex.value =
			(activeSuggestionIndex.value - 1 + tagSuggestionCount.value) %
			tagSuggestionCount.value;
		return;
	}

	if (event.key === "Enter" || event.key === "Tab") {
		event.preventDefault();
		commitSuggestion(activeSuggestionIndex.value);
		return;
	}

	if (event.key === "Escape") {
		event.preventDefault();
		activeTag.value = null;
	}
}

function handleTitleKeyup(event: KeyboardEvent) {
	if (
		["Enter", "Tab", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)
	) {
		return;
	}

	updateActiveTagFromInput();
}

function commitSuggestion(index: number) {
	const existingTag = matchingTags.value[index];

	if (existingTag) {
		selectInlineTag(existingTag.name);
		return;
	}

	if (canCreateInlineTag.value && index === matchingTags.value.length) {
		selectInlineTag(activeTag.value?.query ?? "");
	}
}

function selectInlineTag(name: string) {
	const normalizedName = normalizeTagName(name);

	if (!activeTag.value || !normalizedName) {
		return;
	}

	if (!selectedTagNameSet.value.has(normalizedName)) {
		const existingTag = tags.tags.find(
			(tag) => normalizeTagName(tag.name) === normalizedName,
		);
		selectedTagNames.value.push(existingTag?.name ?? name.trim());
	}

	const result = removeInlineTagToken(title.value, activeTag.value);
	title.value = result.value;
	activeTag.value = null;
	activeSuggestionIndex.value = 0;

	void nextTick(() => {
		titleInput.value?.focus();
		titleInput.value?.setSelectionRange(
			result.caretPosition,
			result.caretPosition,
		);
	});
}

function commitUnfinishedInlineTag() {
	if (!activeTag.value) {
		return;
	}

	if (activeTag.value.query.trim()) {
		selectInlineTag(activeTag.value.query);
		return;
	}

	const result = removeInlineTagToken(title.value, activeTag.value);
	title.value = result.value;
	activeTag.value = null;
}

function removeSelectedTag(name: string) {
	const normalizedName = normalizeTagName(name);
	selectedTagNames.value = selectedTagNames.value.filter(
		(tagName) => normalizeTagName(tagName) !== normalizedName,
	);
	titleInput.value?.focus();
}

async function resolveTag(name: string): Promise<Tag | null> {
	const normalizedName = normalizeTagName(name);
	const existingTag = tags.tags.find(
		(tag) => normalizeTagName(tag.name) === normalizedName,
	);

	if (existingTag) {
		return existingTag;
	}

	const color = pickTagColorByName(name);
	const created = await tags.create({
		name: name.trim(),
		color: color.text,
	});

	if (!created) {
		return null;
	}

	return (
		tags.tags.find((tag) => normalizeTagName(tag.name) === normalizedName) ??
		null
	);
}

function clearDueAt() {
	dueAt.value = "";
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
            <span class="text-body text-ink-soft">{{ contextDescription }}</span>
          </div>

          <button type="button" class="px-2 py-1 text-heading text-ink-soft hover:bg-hover hover:text-ink" @click="closeModal">
            ×
          </button>
        </div>

        <div class="relative grid gap-1">
          <label
            for="task-title"
            class="font-semibold text-ink"
          >
            Título
          </label>
          <div class="flex min-h-11 flex-wrap items-center gap-2 rounded border border-border bg-surface px-3 py-1 focus-within:border-accent">
            <span
              v-for="tagName in selectedTagNames"
              :key="normalizeTagName(tagName)"
              class="inline-flex h-7 items-center gap-1 rounded-full bg-blue-bg px-2 text-small font-semibold text-blue"
            >
              +{{ tagName }}
              <button
                type="button"
                class="grid h-5 w-5 place-items-center rounded-full hover:bg-hover"
                :aria-label="`Remover tag ${tagName}`"
                @click="removeSelectedTag(tagName)"
              >
                <X :size="13" />
              </button>
            </span>
            <input
              id="task-title"
              ref="titleInput"
              :value="title"
              class="min-w-40 flex-1 bg-transparent py-2 text-body text-ink"
              placeholder="O que precisa ser feito? Use + para adicionar tags"
              autocomplete="off"
              @input="updateTitle(($event.target as HTMLInputElement).value)"
              @click="updateActiveTagFromInput"
              @keyup="handleTitleKeyup"
              @keydown="handleTitleKeydown"
            />
          </div>

          <div
            v-if="tagSuggestionsOpen"
            class="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden border border-border bg-surface shadow-lg"
          >
            <button
              v-for="(tag, index) in matchingTags"
              :key="tag.id"
              type="button"
              :class="[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-body',
                index === activeSuggestionIndex ? 'bg-selection' : 'hover:bg-hover',
              ]"
              @mousedown.prevent="selectInlineTag(tag.name)"
            >
              <span
                class="h-3 w-3 border border-border"
                :style="{ backgroundColor: tag.color }"
              ></span>
              <span>+{{ tag.name }}</span>
            </button>

            <button
              v-if="canCreateInlineTag"
              type="button"
              :class="[
                'flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-body font-semibold text-accent',
                activeSuggestionIndex === matchingTags.length
                  ? 'bg-selection'
                  : 'hover:bg-hover',
              ]"
              @mousedown.prevent="selectInlineTag(activeTag?.query ?? '')"
            >
              <Plus :size="16" />
              <span>Criar +{{ activeTag?.query }}</span>
            </button>
          </div>
        </div>

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
                v-if="dueAt"
                type="button"
                class="text-caption font-semibold text-ink-soft hover:text-brick"
                @click="clearDueAt"
              >
                Remover
              </button>
            </div>
            <input
              v-model="dueAt"
              type="datetime-local"
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

        <div class="grid gap-3">
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
