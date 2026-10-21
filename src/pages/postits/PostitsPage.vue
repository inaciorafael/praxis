<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue'
import { Plus, StickyNote, Check, Search } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type {
  PostitList,
  PostitView,
  PostitColor,
  PostitChange,
} from '@/shared/types/postit'
import {
  listPostits,
  changePostit,
  onPostitsChanged,
  onPostitError,
  syncPostits,
} from '@/shared/lib/postits/postit.service'
const { t, locale } = useI18n()
const bodyInput = ref<HTMLTextAreaElement | null>(null)
const search = ref('')
const placement = ref('all')
const route = useRoute(),
  router = useRouter()
const list = ref<PostitList>({ notes: [] })
const error = ref(''),
  busy = ref(false),
  editing = ref(false),
  archived = ref(false)
const draft = ref({
  id: '',
  expectedRevision: 0,
  title: '',
  body: '',
  color: 'yellow' as PostitColor,
  pinned: true,
})
const colors: PostitColor[] = ['yellow', 'pink', 'green', 'blue']
const activeCount = computed(
  () => list.value.notes.filter((note) => !note.record.archived).length
)
const doneCount = computed(
  () => list.value.notes.filter((note) => note.record.archived).length
)
const visible = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return list.value.notes
    .filter(
      (note) =>
        note.record.archived === archived.value &&
        (!query ||
          (note.title + ' ' + note.record.body).toLocaleLowerCase().includes(query)) &&
        (archived.value ||
          placement.value === 'all' ||
          note.record.pinned === (placement.value === 'desktop'))
    )
    .slice()
    .sort((a, b) =>
      archived.value
        ? (b.record.completedAt ?? 0) - (a.record.completedAt ?? 0)
        : Number(b.record.pinned) - Number(a.record.pinned)
    )
})
function expiry(note: PostitView) {
  if (!note.record.completedAt) return t('postits.retention')
  return t('postits.expires', {
    date: new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
    }).format(note.record.completedAt + 7 * 86400000),
  })
}
const desktopIds = computed(() =>
  list.value.notes
    .filter((note) => note.record.pinned && !note.record.archived)
    .slice(0, 3)
    .map((note) => note.record.id)
)
let stops: (() => void)[] = [],
  disposed = false
async function refresh() {
  try {
    const value = await listPostits()
    if (!disposed) list.value = value
  } catch (reason) {
    if (!disposed) error.value = String(reason)
  }
}
async function action(run: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await run()
    await refresh()
  } catch (reason) {
    error.value = String(reason)
  } finally {
    busy.value = false
  }
}
function patch(note: PostitView, values: Partial<PostitChange>) {
  void action(() =>
    changePostit({
      id: note.record.id,
      expectedRevision: note.record.revision,
      ...values,
    })
  )
}
async function create() {
  draft.value = {
    id: crypto.randomUUID(),
    expectedRevision: 0,
    title: '',
    body: '',
    color: 'yellow',
    pinned: true,
  }
  editing.value = true
  await nextTick()
  bodyInput.value?.focus()
}
async function edit(note: PostitView) {
  const record = note.record
  draft.value = {
    id: record.id,
    expectedRevision: record.revision,
    title: record.title,
    body: record.body,
    color: record.color,
    pinned: record.pinned,
  }
  editing.value = true
  await nextTick()
  bodyInput.value?.focus()
}
async function save() {
  if (busy.value) return
  await action(() =>
    changePostit({
      ...draft.value,
      ...(draft.value.expectedRevision === 0 ? { collapsed: true } : {}),
    })
  )
  if (!error.value) editing.value = false
}
function openRequested() {
  if (editing.value) return
  const note = list.value.notes.find((note) => note.record.id === route.query.note)
  if (note) {
    edit(note)
    void router.replace({ query: {} })
  }
}
watch(() => route.query.note, openRequested)
function shortcut(event: KeyboardEvent) {
  if (
    event.altKey &&
    event.key.toLowerCase() === 'n' &&
    !event.repeat &&
    !editing.value &&
    !busy.value
  ) {
    event.preventDefault()
    void create()
  }
}
onMounted(async () => {
  window.addEventListener('keydown', shortcut)
  const listeners = await Promise.all([
    onPostitsChanged(() => {
      void refresh()
    }),
    onPostitError((message) => {
      error.value = message
    }),
  ])
  if (disposed) listeners.forEach((stop) => stop())
  else stops = listeners
  await refresh()
  openRequested()
  void syncPostits().catch(() => {})
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', shortcut)
  stops.forEach((stop) => stop())
})
</script>
<template>
  <section class="postits-page">
    <header class="postits-heading">
      <div>
        <h1>{{ t('postits.title') }}</h1>
        <p>{{ t('postits.subtitle') }}</p>
      </div>
      <button
        type="button"
        :disabled="busy || editing"
        @click="create"
      >
        <Plus :size="16" />{{ t('postits.create') }} <kbd>Alt+N</kbd>
      </button>
    </header>
    <p
      v-if="error"
      role="alert"
      class="postits-error"
    >
      {{ error }}
    </p>
    <form
      v-if="editing"
      class="postit-picker"
      @submit.prevent="save"
      @keydown.ctrl.enter.prevent="save"
      @keydown.meta.enter.prevent="save"
    >
      <label for="postit-body">{{ t('postits.content') }}</label>
      <textarea
        id="postit-body"
        ref="bodyInput"
        v-model="draft.body"
        maxlength="10000"
        rows="5"
        :disabled="busy"
      />
      <label for="postit-title">{{ t('postits.name') }}</label>
      <input
        id="postit-title"
        v-model="draft.title"
        maxlength="200"
        :disabled="busy"
      />
      <div
        class="postit-colors"
        role="group"
        :aria-label="t('postits.color')"
      >
        <button
          v-for="color in colors"
          :key="color"
          type="button"
          :data-color="color"
          :aria-label="t('postits.colors.' + color)"
          :aria-pressed="draft.color === color"
          :disabled="busy"
          @click="draft.color = color"
        ></button>
      </div>
      <label
        ><input
          v-model="draft.pinned"
          type="checkbox"
          :disabled="busy"
        />
        {{ t('postits.pin') }}</label
      >
      <div>
        <button
          type="submit"
          :disabled="busy || (!draft.title.trim() && !draft.body.trim())"
        >
          {{ t('postits.save') }} <kbd>Ctrl+Enter</kbd>
        </button>
        <button
          type="button"
          :disabled="busy"
          @click="editing = false"
        >
          {{ t('postits.cancel') }}
        </button>
      </div>
    </form>
    <div
      role="group"
      :aria-label="t('postits.filter')"
      class="postit-filters"
    >
      <button
        type="button"
        :aria-pressed="!archived"
        @click="archived = false"
      >
        {{ t('postits.active') }} <span>{{ activeCount }}</span>
      </button>
      <button
        type="button"
        :aria-pressed="archived"
        @click="archived = true"
      >
        {{ t('postits.archived') }} <span>{{ doneCount }}</span>
      </button>
    </div>
    <div class="postit-search">
      <label
        ><Search :size="16" /><input
          v-model="search"
          type="search"
          :placeholder="t('postits.search')"
          :aria-label="t('postits.search')"
      /></label>
      <select
        v-if="!archived"
        v-model="placement"
        :aria-label="t('postits.location')"
      >
        <option value="all">{{ t('postits.everywhere') }}</option>
        <option value="desktop">{{ t('postits.fixed') }}</option>
        <option value="stored">{{ t('postits.offscreen') }}</option>
      </select>
    </div>
    <p
      v-if="archived"
      class="postits-hint"
    >
      {{ t('postits.retention') }}
    </p>
    <p
      v-else
      class="postits-hint"
    >
      {{ t('postits.hint') }}
    </p>
    <div
      v-if="!visible.length"
      class="postits-empty"
    >
      <StickyNote :size="28" />
      <p>{{ t('postits.empty') }}</p>
    </div>
    <div class="postit-grid">
      <article
        v-for="note in visible"
        :key="note.record.id"
        class="postit-row"
        :data-completed="note.record.archived"
      >
        <div
          class="postit-color"
          :data-color="note.record.color"
          aria-hidden="true"
        ></div>
        <div class="postit-row-content">
          <h2>{{ note.title || t('postits.untitled') }}</h2>
          <p class="note-preview">{{ note.record.body }}</p>
          <small v-if="note.record.archived">{{ expiry(note) }}</small>
          <small v-else>{{
            t(
              note.record.archived
                ? 'postits.archived'
                : !note.record.pinned
                  ? 'postits.offscreen'
                  : desktopIds.includes(note.record.id)
                    ? 'postits.pinned'
                    : 'postits.queued'
            )
          }}</small>
        </div>
        <div class="postit-row-actions">
          <button
            type="button"
            v-if="!note.record.archived"
            :disabled="busy || editing"
            @click="edit(note)"
          >
            {{ t('postits.edit') }}
          </button>
          <template v-if="!note.record.archived">
            <button
              type="button"
              :disabled="busy"
              @click="patch(note, { pinned: !note.record.pinned, collapsed: true })"
            >
              {{ t(note.record.pinned ? 'postits.unpin' : 'postits.pin') }}
            </button>
            <button
              type="button"
              :disabled="busy"
              @click="patch(note, { completed: true })"
            >
              <Check :size="14" />{{ t('postits.complete') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            :disabled="busy"
            @click="patch(note, { completed: false })"
          >
            {{ t('postits.restore') }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
<style scoped>
.postits-page {
  display: grid;
  gap: 20px;
  color: var(--ink);
}
.postits-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 16px;
  flex-wrap: wrap;
}
h1 {
  font-size: 28px;
  font-weight: 500;
  margin: 0 0 4px;
}
p {
  margin: 0;
  color: var(--ink-soft);
}
button,
select,
input:not([type='checkbox']),
textarea {
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px 10px;
  min-height: 36px;
  box-sizing: border-box;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}
button:hover {
  background: var(--hover);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ink-soft);
  outline-offset: 2px;
}
.postit-picker {
  display: grid;
  gap: 10px;
  padding: 20px;
  max-width: 680px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--surface);
}
.postit-picker input:not([type='checkbox']),
textarea {
  width: 100%;
}
textarea {
  resize: vertical;
}
.postit-picker > div,
.postit-filters {
  display: flex;
  gap: 8px;
}
.postit-filters {
  border-bottom: 1px solid var(--border);
}
.postit-filters button {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  padding: 10px 14px;
}
.postit-filters [aria-pressed='true'] {
  border-bottom-color: var(--ink);
  font-weight: 600;
}
.postit-filters span {
  color: var(--ink-soft);
  font-size: 12px;
}
.postit-search {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.postit-search label {
  display: flex;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--border);
  padding-left: 10px;
  max-width: 420px;
  flex: 1;
}
.postit-search input {
  border: 0;
  background: transparent;
  min-width: 140px;
  width: 100%;
}
.postits-hint {
  font-size: 12px;
  max-width: 760px;
  line-height: 1.6;
}
.postits-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 40px;
  border: 1px dashed var(--border);
}
.postits-error {
  color: var(--brick);
}
.postit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  align-items: stretch;
}
.postit-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  padding: 20px 16px 14px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.postit-color {
  position: absolute;
  inset: 0 0 auto;
  height: 5px;
}
.postit-row-content {
  flex: 1;
  min-width: 0;
}
h2 {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  overflow-wrap: anywhere;
}
.note-preview {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
  margin: 10px 0 16px;
}
small {
  font-size: 11px;
  color: var(--ink-soft);
}
.postit-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.postit-row-actions button {
  font-size: 12px;
  min-height: 30px;
  padding: 5px 8px;
}
.postit-row-actions button:last-child {
  margin-left: auto;
}
.postit-colors {
  display: flex;
  gap: 8px;
}
.postit-colors button {
  width: 24px;
  min-height: 24px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}
.postit-colors [aria-pressed='true'] {
  outline: 1px solid var(--ink);
  outline-offset: 2px;
}
[data-color='yellow'] {
  background: #ffe14f;
}
[data-color='pink'] {
  background: #ff9ec4;
}
[data-color='green'] {
  background: #b9e66c;
}
[data-color='blue'] {
  background: #88d1f3;
}
</style>
<style scoped>
kbd {
  font-size: 10px;
  opacity: 0.6;
  margin-left: 6px;
  font-family: inherit;
}
</style>
