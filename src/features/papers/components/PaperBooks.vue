<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { BookOpen, Plus, Pencil, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { PaperBook, PaperBookChange } from '@/shared/lib/papers/paper-books.service'

const props = defineProps<{
  books: PaperBook[]
  modelValue: string
  busy: boolean
  total: number
  loose: number
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [change: PaperBookChange, done: () => void]
}>()
const { t } = useI18n()
const editing = ref(false)
const removing = ref(false)
const name = ref('')
const nameInput = ref<HTMLInputElement>()
const target = ref<PaperBook | null>(null)
const selected = computed(() => props.books.find((book) => book.id === props.modelValue))
function edit(book: PaperBook | null) {
  target.value = book ? { ...book } : null
  name.value = book?.name ?? ''
  editing.value = true
  removing.value = false
  void nextTick(() => nameInput.value?.focus())
}
function close() {
  editing.value = false
  removing.value = false
}
function selectBook(id: string) {
  emit('update:modelValue', id)
  close()
}
function save() {
  if (!name.value.trim() || props.busy) return
  const book = props.books.find((book) => book.id === target.value?.id) ?? target.value
  emit(
    'change',
    book
      ? { type: 'rename', id: book.id, revision: book.revision, name: name.value }
      : { type: 'create', name: name.value },
    close
  )
}
function remove() {
  const book = selected.value
  if (book)
    emit('change', { type: 'remove', id: book.id, revision: book.revision }, close)
}
</script>

<template>
  <section
    class="book-shelf"
    :aria-label="t('papers.books.title')"
  >
    <div class="flex flex-wrap items-center gap-2">
      <BookOpen
        :size="18"
        aria-hidden="true"
      />
      <h2 class="text-body font-semibold">{{ t('papers.books.title') }}</h2>
      <p class="text-small text-ink-muted">{{ t('papers.books.hint') }}</p>
      <button
        class="book-action ml-auto"
        :disabled="busy"
        @click="edit(null)"
      >
        <Plus :size="15" />{{ t('papers.books.new') }}
      </button>
    </div>
    <div
      class="book-tabs flex flex-wrap gap-2"
      role="group"
      :aria-label="t('papers.books.browse')"
    >
      <button
        v-for="item in [
          { id: 'all', name: t('papers.books.all'), count: total },
          { id: 'loose', name: t('papers.books.loose'), count: loose },
          ...books.map((book) => ({
            id: book.id,
            name: book.name,
            count: book.paperIds.length,
          })),
        ]"
        :key="item.id"
        class="book-tab"
        :aria-pressed="modelValue === item.id"
        @click="selectBook(item.id)"
      >
        <BookOpen
          v-if="item.id !== 'all' && item.id !== 'loose'"
          :size="15"
          aria-hidden="true"
        />
        <span>{{ item.name }}</span
        ><span class="text-ink-muted">{{ item.count }}</span>
      </button>
    </div>
    <div
      v-if="selected && !editing && !removing"
      class="flex flex-wrap items-center gap-3 text-small"
    >
      <span class="text-ink-muted">{{
        t('papers.books.current', { name: selected.name })
      }}</span>
      <button
        class="book-action"
        :disabled="busy"
        @click="edit(selected)"
      >
        <Pencil :size="13" />{{ t('papers.books.rename') }}
      </button>
      <button
        class="book-action"
        :disabled="busy"
        @click="removing = true"
      >
        {{ t('papers.books.remove') }}
      </button>
    </div>
    <form
      v-if="editing"
      class="flex flex-wrap items-center gap-2"
      @submit.prevent="save"
    >
      <label
        for="book-name"
        class="text-small"
        >{{ t('papers.books.name') }}</label
      >
      <input
        id="book-name"
        ref="nameInput"
        v-model="name"
        class="board-input min-w-0"
        maxlength="80"
        required
        :disabled="busy"
        autofocus
      />
      <button
        class="book-action"
        type="submit"
        :disabled="busy || !name.trim()"
      >
        {{ t('papers.books.save') }}
      </button>
      <button
        class="book-action"
        type="button"
        :disabled="busy"
        @click="close"
      >
        <X :size="14" />{{ t('papers.books.cancel') }}
      </button>
    </form>
    <div
      v-if="removing"
      class="flex flex-wrap items-center gap-3 text-small"
    >
      <p>{{ t('papers.books.removeHint') }}</p>
      <button
        class="book-action"
        :disabled="busy"
        @click="remove"
      >
        {{ t('papers.books.confirmRemove') }}
      </button>
      <button
        class="book-action"
        :disabled="busy"
        @click="close"
      >
        {{ t('papers.books.cancel') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.book-shelf {
  display: grid;
  gap: 12px;
  padding: 16px 0;
  border-block: 1px solid var(--border);
}
.book-tabs {
  max-height: 140px;
  overflow: auto;
}
.book-tab,
.book-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border: 1px solid var(--border);
  background: var(--paper);
  font-size: var(--text-small);
}
.book-tab {
  max-width: 100%;
}
.book-tab span:first-of-type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-tab[aria-pressed='true'] {
  background: var(--selection);
  border-color: var(--ink);
  box-shadow: inset 3px 0 var(--ink);
}
.book-tab:hover,
.book-action:hover {
  background: var(--hover);
}
button:disabled {
  opacity: 0.5;
}
</style>
