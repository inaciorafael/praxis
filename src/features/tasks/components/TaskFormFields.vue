<script setup lang="ts">
import type { TaskFormDraft } from '@/features/tasks/lib/task-form'
import {
  findActiveInlineTag,
  normalizeTagName,
  removeInlineTagToken,
  type ActiveInlineTag,
} from '@/shared/lib/tags/inline-tag'
import { resolveTagColor } from '@/shared/lib/tags/tag-color'
import { useTagStore } from '@/stores/tag.store'
import { Plus, X } from '@lucide/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    showChecklist?: boolean
    fieldIdPrefix?: string
    compact?: boolean
  }>(),
  {
    showChecklist: false,
    fieldIdPrefix: 'task',
    compact: false,
  }
)

const model = defineModel<TaskFormDraft>({ required: true })
const selectedTagNames = defineModel<string[]>('selectedTagNames', {
  required: true,
})
const checklistText = defineModel<string>('checklistText', { default: '' })
const tags = useTagStore()
const { t } = useI18n()
const titleInput = ref<HTMLInputElement | null>(null)
const activeTag = ref<ActiveInlineTag | null>(null)
const activeSuggestionIndex = ref(0)

const title = fieldModel('title')
const notes = fieldModel('notes')
const plannedFor = fieldModel('plannedFor')
const dueAt = fieldModel('dueAt')
const reminderAt = fieldModel('reminderAt')
const selectedTagNameSet = computed(
  () => new Set(selectedTagNames.value.map(normalizeTagName))
)
const matchingTags = computed(() => {
  const query = normalizeTagName(activeTag.value?.query ?? '')

  return tags.tags
    .filter((tag) => !selectedTagNameSet.value.has(normalizeTagName(tag.name)))
    .filter((tag) => !query || normalizeTagName(tag.name).includes(query))
    .slice(0, 6)
})
const exactMatchingTag = computed(() => {
  const query = normalizeTagName(activeTag.value?.query ?? '')
  return matchingTags.value.find((tag) => normalizeTagName(tag.name) === query)
})
const canCreateInlineTag = computed(
  () =>
    Boolean(activeTag.value?.query.trim()) &&
    !exactMatchingTag.value &&
    !selectedTagNameSet.value.has(normalizeTagName(activeTag.value?.query ?? ''))
)
const tagSuggestionCount = computed(
  () => matchingTags.value.length + (canCreateInlineTag.value ? 1 : 0)
)
const tagSuggestionsOpen = computed(() =>
  Boolean(activeTag.value && tagSuggestionCount.value > 0)
)

onMounted(async () => {
  if (!tags.isReady) {
    await tags.hydrate()
  }
})

function fieldModel(key: keyof TaskFormDraft) {
  return computed({
    get: () => model.value[key],
    set: (value: string) => {
      model.value = { ...model.value, [key]: value }
    },
  })
}

function focusTitle() {
  titleInput.value?.focus()
}

function updateTitle(value: string) {
  title.value = value
  void nextTick(updateActiveTagFromInput)
}

function updateActiveTagFromInput() {
  const input = titleInput.value
  activeTag.value = findActiveInlineTag(
    title.value,
    input?.selectionStart ?? title.value.length
  )
  activeSuggestionIndex.value = 0
}

function handleTitleKeydown(event: KeyboardEvent) {
  if (!tagSuggestionsOpen.value) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestionIndex.value =
      (activeSuggestionIndex.value + 1) % tagSuggestionCount.value
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestionIndex.value =
      (activeSuggestionIndex.value - 1 + tagSuggestionCount.value) %
      tagSuggestionCount.value
    return
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    commitSuggestion(activeSuggestionIndex.value)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    activeTag.value = null
  }
}

function handleTitleKeyup(event: KeyboardEvent) {
  if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) {
    return
  }

  updateActiveTagFromInput()
}

function commitSuggestion(index: number) {
  const existingTag = matchingTags.value[index]

  if (existingTag) {
    selectInlineTag(existingTag.name)
    return
  }

  if (canCreateInlineTag.value && index === matchingTags.value.length) {
    selectInlineTag(activeTag.value?.query ?? '')
  }
}

function selectInlineTag(name: string) {
  const normalizedName = normalizeTagName(name)

  if (!activeTag.value || !normalizedName) {
    return
  }

  if (!selectedTagNameSet.value.has(normalizedName)) {
    const existingTag = tags.tags.find(
      (tag) => normalizeTagName(tag.name) === normalizedName
    )
    selectedTagNames.value = [...selectedTagNames.value, existingTag?.name ?? name.trim()]
  }

  const result = removeInlineTagToken(title.value, activeTag.value)
  title.value = result.value
  activeTag.value = null
  activeSuggestionIndex.value = 0

  void nextTick(() => {
    focusTitle()
    titleInput.value?.setSelectionRange(result.caretPosition, result.caretPosition)
  })
}

function commitPendingTag() {
  if (!activeTag.value) {
    return
  }

  if (activeTag.value.query.trim()) {
    selectInlineTag(activeTag.value.query)
    return
  }

  const result = removeInlineTagToken(title.value, activeTag.value)
  title.value = result.value
  activeTag.value = null
}

function removeSelectedTag(name: string) {
  const normalizedName = normalizeTagName(name)
  selectedTagNames.value = selectedTagNames.value.filter(
    (tagName) => normalizeTagName(tagName) !== normalizedName
  )
  focusTitle()
}

function selectedTagStyle(name: string) {
  const tag = tags.tags.find(
    (candidate) => normalizeTagName(candidate.name) === normalizeTagName(name)
  )
  return resolveTagColor(tag?.color ?? '', name)
}

defineExpose({
  focusTitle,
  commitPendingTag,
})
</script>

<template>
  <div class="grid gap-4">
    <div class="relative grid gap-1">
      <label
        :for="`${props.fieldIdPrefix}-title`"
        class="font-semibold text-ink"
        >{{ t('task.title') }}</label
      >
      <div
        class="flex min-h-11 flex-wrap items-center gap-2 border border-border bg-surface px-3 py-1 focus-within:border-accent"
      >
        <span
          v-for="tagName in selectedTagNames"
          :key="normalizeTagName(tagName)"
          class="inline-flex h-7 items-center gap-1 rounded-full px-2 text-small font-semibold"
          :style="{
            backgroundColor: selectedTagStyle(tagName).background,
            color: selectedTagStyle(tagName).text,
          }"
        >
          +{{ tagName }}
          <button
            type="button"
            class="grid h-5 w-5 place-items-center rounded-full hover:bg-hover"
            :aria-label="t('task.removeTag', { name: tagName })"
            :title="t('task.removeTag', { name: tagName })"
            @click="removeSelectedTag(tagName)"
          >
            <X :size="13" />
          </button>
        </span>

        <input
          :id="`${props.fieldIdPrefix}-title`"
          ref="titleInput"
          :value="title"
          class="min-w-40 flex-1 bg-transparent py-2 text-body text-ink outline-none placeholder:text-ink-muted"
          :placeholder="t('task.titlePlaceholder')"
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
          <span>{{ t('task.createTag', { name: activeTag?.query }) }}</span>
        </button>
      </div>
    </div>

    <label class="grid gap-1">
      <span class="font-semibold text-ink">{{ t('task.notes') }}</span>
      <textarea
        v-model="notes"
        class="min-h-24 resize-y border border-border bg-surface px-3 py-2 text-body text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        :placeholder="t('task.notesPlaceholder')"
      />
    </label>

    <div :class="['grid gap-3', props.compact ? 'grid-cols-1' : 'tablet:grid-cols-2']">
      <label class="grid gap-1">
        <span class="font-semibold text-ink">{{ t('task.plannedFor') }}</span>
        <input
          v-model="plannedFor"
          type="date"
          class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
      </label>

      <div class="grid gap-1">
        <div class="flex items-center justify-between gap-3">
          <span class="font-semibold text-ink">{{ t('task.dueAt') }}</span>
          <button
            v-if="dueAt"
            type="button"
            class="flex h-6 w-6 items-center justify-center text-ink-soft hover:bg-hover hover:text-brick"
            :aria-label="t('task.removeDue')"
            :title="t('task.removeDue')"
            @click="dueAt = ''"
          >
            <X :size="14" />
          </button>
        </div>
        <input
          v-model="dueAt"
          type="datetime-local"
          class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
      </div>
    </div>

    <div class="grid gap-1">
      <div class="flex items-center justify-between gap-3">
        <span class="font-semibold text-ink">{{ t('task.reminderAt') }}</span>
        <button
          v-if="reminderAt"
          type="button"
          class="flex h-6 w-6 items-center justify-center text-ink-soft hover:bg-hover hover:text-brick"
          :aria-label="t('task.removeReminder')"
          :title="t('task.removeReminder')"
          @click="reminderAt = ''"
        >
          <X :size="14" />
        </button>
      </div>
      <input
        v-model="reminderAt"
        type="datetime-local"
        class="border border-border bg-surface px-3 py-2 text-body text-ink outline-none focus:border-accent"
      />
    </div>

    <label
      v-if="showChecklist"
      class="grid gap-1"
    >
      <span class="font-semibold text-ink">{{ t('task.checklist') }}</span>
      <textarea
        v-model="checklistText"
        class="min-h-20 resize-y border border-border bg-surface px-3 py-2 text-body text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        :placeholder="t('task.checklistPlaceholder')"
      />
    </label>
  </div>
</template>
