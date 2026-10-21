<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue'
import PostitModeControls from '@/features/postits/components/PostitModeControls.vue'
import { usePostitDraft } from '@/features/postits/composables/usePostitDraft'
import { Plus, StickyNote, Check, Search } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
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
  changePostitGroup,
} from '@/shared/lib/postits/postit.service'
import { useAppStore } from '@/stores/app.store'
import { DEFAULT_POSTIT_PREFERENCES } from '@/shared/lib/postits/postit-preferences'
const app = useAppStore()
const preferences = computed(
  () => app.config?.postitPreferences ?? DEFAULT_POSTIT_PREFERENCES
)
const { t, locale } = useI18n()
const bodyInput = ref<HTMLTextAreaElement | null>(null)
const search = ref('')
const placement = ref('all')
const route = useRoute(),
  router = useRouter()
const list = ref<PostitList>({ notes: [] })
const error = ref(''),
  busy = ref(false),
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
        (!groupFilter.value || note.record.groupId === groupFilter.value) &&
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
const desktopIds = computed(() => {
  if (!preferences.value.desktopEnabled) return []
  const keys: string[] = []
  const notes = list.value.notes.filter((n) => n.record.pinned && !n.record.archived)
  for (const note of notes) {
    const key = note.record.groupId ?? note.record.id
    if (!keys.includes(key)) keys.push(key)
  }
  const shown = keys.slice(0, preferences.value.desktopLimit)
  return notes
    .filter((n) => shown.includes(n.record.groupId ?? n.record.id))
    .map((n) => n.record.id)
})
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
const selected = ref<string[]>([])
const groupName = ref('')
const groupFilter = ref('')
const groups = computed(() => list.value.groups ?? [])
const editor = usePostitDraft(async (values) => {
  await changePostit({
    id: draft.value.id,
    ...values,
    color: draft.value.color,
    pinned: draft.value.pinned,
    ...(values.expectedRevision === 0 ? { preferredMode: 'compact' as const } : {}),
  })
  await refresh()
  const note = list.value.notes.find((n) => n.record.id === draft.value.id)
  if (!note) throw new Error(t('postits.adaptive.unavailable'))
  return note
})
const editing = editor.editing
watch(
  () => list.value.notes.find((n) => n.record.id === draft.value.id),
  (note) => {
    if (note) editor.receive(note)
  }
)
async function create() {
  draft.value = {
    id: crypto.randomUUID(),
    expectedRevision: 0,
    title: '',
    body: '',
    color: preferences.value.color,
    pinned: preferences.value.pinNew,
  }
  editor.begin({
    title: '',
    record: { ...draft.value, revision: 0, collapsed: false, archived: false },
  })
  await nextTick()
  bodyInput.value?.focus()
}
async function edit(note: PostitView) {
  if (editing.value) return
  draft.value = {
    id: note.record.id,
    expectedRevision: note.record.revision,
    title: note.record.title,
    body: note.record.body,
    color: note.record.color,
    pinned: note.record.pinned,
  }
  editor.begin(note)
  await nextTick()
  bodyInput.value?.focus()
}
async function save() {
  if (
    !editor.draft.title.trim() &&
    !editor.draft.body.trim() &&
    draft.value.expectedRevision === 0 &&
    !list.value.notes.some((n) => n.record.id === draft.value.id)
  ) {
    editing.value = false
    return
  }
  if (!(await editor.flush())) {
    error.value = editor.error.value.startsWith('postits.')
      ? t(editor.error.value)
      : editor.error.value
    return
  }
  const note = list.value.notes.find((n) => n.record.id === draft.value.id)
  if (
    note &&
    (note.record.color !== draft.value.color || note.record.pinned !== draft.value.pinned)
  ) {
    await action(() =>
      changePostit({
        id: note.record.id,
        expectedRevision: note.record.revision,
        color: draft.value.color,
        pinned: draft.value.pinned,
      })
    )
    if (error.value) return
  }
  editing.value = false
}
async function groupSelected() {
  const members = list.value.notes.filter(
    (n) => selected.value.includes(n.record.id) && !n.record.archived && !n.record.groupId
  )
  await action(() =>
    changePostitGroup({
      id: crypto.randomUUID(),
      expectedRevision: 0,
      name: groupName.value,
      members: members.map((n) => ({ id: n.record.id, revision: n.record.revision })),
    })
  )
  if (!error.value) {
    selected.value = []
    groupName.value = ''
  }
}
function ungroup(id: string, revision: number) {
  void action(() => changePostitGroup({ id, expectedRevision: revision, ungroup: true }))
}
function toggleSelected(id: string, checked: boolean) {
  selected.value = checked
    ? [...selected.value, id]
    : selected.value.filter((value) => value !== id)
}
function groupTitle(id?: string | null) {
  return groups.value.find((g) => g.id === id)?.name
}
function highlighted(value: string) {
  const query = search.value.trim()
  if (!query) return [{ text: value, match: false }]
  const lower = value.toLocaleLowerCase(),
    needle = query.toLocaleLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let offset = 0,
    index = lower.indexOf(needle)
  while (index >= 0) {
    parts.push(
      { text: value.slice(offset, index), match: false },
      { text: value.slice(index, index + query.length), match: true }
    )
    offset = index + query.length
    index = lower.indexOf(needle, offset)
  }
  parts.push({ text: value.slice(offset), match: false })
  return parts
}
onBeforeRouteLeave(async () => {
  if (!editing.value) return true
  await save()
  return !editing.value
})
function reloadDraft() {
  const current = list.value.notes.find((n) => n.record.id === draft.value.id)
  if (current) editor.begin(current)
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
      @keydown.esc.prevent="save"
    >
      <label for="postit-body">{{ t('postits.content') }}</label>
      <textarea
        id="postit-body"
        ref="bodyInput"
        v-model="editor.draft.body"
        maxlength="10000"
        rows="5"
        :disabled="busy"
      />
      <label for="postit-title">{{ t('postits.name') }}</label>
      <input
        id="postit-title"
        v-model="editor.draft.title"
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
          :disabled="busy || (!editor.draft.title.trim() && !editor.draft.body.trim())"
        >
          {{ t('postits.save') }} <kbd>Ctrl+Enter</kbd>
        </button>
        <button
          type="button"
          :disabled="busy"
          @click="save"
        >
          {{ t('postits.adaptive.finish') }}
        </button>
      </div>
      <p role="status">
        {{
          editor.saving.value
            ? t('postits.adaptive.saving')
            : editor.dirty.value
              ? t('postits.adaptive.pending')
              : t('postits.adaptive.saved')
        }}
      </p>
      <p
        v-if="editor.error.value"
        role="alert"
      >
        {{
          editor.error.value.startsWith('postits.')
            ? t(editor.error.value)
            : editor.error.value
        }}<button
          v-if="editor.error.value !== 'postits.adaptive.conflict'"
          type="button"
          @click="editor.retry"
        >
          {{ t('postits.adaptive.retry') }}
        </button>
        <button
          v-if="editor.error.value === 'postits.adaptive.conflict'"
          type="button"
          @click="reloadDraft"
        >
          {{ t('postits.adaptive.reloadDraft') }}
        </button>
      </p>
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
    <p
      v-if="!preferences.desktopEnabled"
      class="postits-hint"
    >
      {{ t('postits.desktopDisabled') }}
    </p>
    <div
      v-if="!archived"
      class="postit-groups"
    >
      <label
        >{{ t('postits.adaptive.pileFilter') }}
        <select v-model="groupFilter">
          <option value="">{{ t('postits.everywhere') }}</option>
          <option
            v-for="group in groups"
            :key="group.id"
            :value="group.id"
          >
            {{ group.name }} ({{
              list.notes.filter(
                (n) => !n.record.archived && n.record.groupId === group.id
              ).length
            }})
          </option>
        </select></label
      >
      <div
        v-for="group in groups"
        :key="group.id"
        class="postit-group-row"
      >
        <button
          :aria-pressed="groupFilter === group.id"
          @click="groupFilter = groupFilter === group.id ? '' : group.id"
        >
          {{ group.name }} ·
          {{
            list.notes.filter((n) => !n.record.archived && n.record.groupId === group.id)
              .length
          }}
        </button>
        <button
          :disabled="busy || editing"
          @click="ungroup(group.id, group.revision)"
        >
          {{ t('postits.adaptive.ungroup') }}
        </button>
      </div>
      <form
        v-if="selected.length"
        class="postit-group-create"
        @submit.prevent="groupSelected"
      >
        <span>{{ t('postits.adaptive.selected', { count: selected.length }) }}</span>
        <input
          v-model="groupName"
          :aria-label="t('postits.adaptive.pileName')"
          :placeholder="t('postits.adaptive.pileName')"
          maxlength="100"
          required
        />
        <button :disabled="busy || editing || selected.length < 2 || !groupName.trim()">
          {{ t('postits.adaptive.group') }}
        </button>
        <button
          type="button"
          @click="selected = []"
        >
          {{ t('postits.adaptive.clearSelection') }}
        </button>
      </form>
    </div>
    <div class="postit-grid">
      <article
        v-for="note in visible"
        :key="note.record.id"
        class="postit-row"
        :data-completed="note.record.archived"
        :class="{
          'search-match': !!search.trim(),
          selected: selected.includes(note.record.id),
        }"
      >
        <div
          class="postit-color"
          :data-color="note.record.color"
          aria-hidden="true"
        ></div>
        <div class="postit-row-content">
          <label
            v-if="!note.record.archived && !note.record.groupId"
            class="postit-select"
            ><input
              type="checkbox"
              :checked="selected.includes(note.record.id)"
              :disabled="editing || busy"
              @change="
                toggleSelected(
                  note.record.id,
                  ($event.target as HTMLInputElement).checked
                )
              "
            />{{ t('postits.adaptive.select') }}</label
          >
          <small v-if="note.record.groupId">{{ groupTitle(note.record.groupId) }}</small>
          <h2>
            <template
              v-for="(part, index) in highlighted(
                note.title || note.record.body.split('\\n')[0] || t('postits.untitled')
              )"
              :key="index"
              ><mark v-if="part.match">{{ part.text }}</mark
              ><template v-else>{{ part.text }}</template></template
            >
          </h2>
          <p class="note-preview">
            <template
              v-for="(part, index) in highlighted(note.record.body)"
              :key="index"
              ><mark v-if="part.match">{{ part.text }}</mark
              ><template v-else>{{ part.text }}</template></template
            >
          </p>
          <PostitModeControls
            v-if="!note.record.archived"
            :mode="
              note.record.preferredMode ?? (note.record.collapsed ? 'micro' : 'expanded')
            "
            :locked="note.record.modeLocked"
            :disabled="busy || editing"
            @mode="patch(note, { preferredMode: $event })"
            @lock="patch(note, { modeLocked: $event })"
          />
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
              @click="patch(note, { pinned: !note.record.pinned })"
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
<style scoped>
.postit-groups {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.postit-group-row {
  display: flex;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--border);
}
.postit-group-create {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  padding: 12px;
  background: var(--surface);
}
.postit-select {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-soft);
  margin-bottom: 8px;
}
.postit-row.selected,
.postit-row.search-match {
  outline: 2px solid var(--ink-soft);
  outline-offset: 2px;
}
.postit-row-content {
  display: grid;
  gap: 6px;
}
mark {
  background: #ffe17c;
  color: #38382b;
}
</style>
