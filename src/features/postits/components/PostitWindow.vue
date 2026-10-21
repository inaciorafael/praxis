<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, ArrowLeft, GripVertical, X } from '@lucide/vue'
import PostitNote from './PostitNote.vue'
import type {
  DesktopPostit,
  PostitChange,
  PostitMode,
  PostitSize,
  PostitView,
} from '@/shared/types/postit'
import type { PostitTextChange } from '../composables/usePostitDraft'
import {
  changePostit,
  dragPostit,
  getPostitWindow,
  onPostitsChanged,
  onPostitError,
  onPostitFinishRequested,
  presentPostit,
  resizePostit,
  previewPostitSize,
} from '@/shared/lib/postits/postit.service'
const entry = ref<DesktopPostit | null>(null),
  error = ref(''),
  busy = ref(false)
const noteComponent = ref<InstanceType<typeof PostitNote> | null>(null)
const opened = ref(false),
  selected = ref<string | null>(null),
  editing = ref(false)
const note = computed(
  () =>
    entry.value?.notes.find((n) => n.record.id === selected.value) ??
    (!entry.value?.group ? entry.value?.notes[0] : null)
)
const { locale, t } = useI18n()
let stops: (() => void)[] = [],
  disposed = false
let presentation = Promise.resolve()
async function refresh() {
  const [value, config] = await getPostitWindow()
  if (disposed) return
  locale.value = config.language
  entry.value = value
  if (selected.value && !value.notes.some((n) => n.record.id === selected.value)) {
    selected.value = null
    opened.value = false
    setPresentation(null, false)
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
function patch(values: Partial<PostitChange>) {
  if (!note.value) return
  const current = note.value.record
  void action(() =>
    changePostit({ id: current.id, expectedRevision: current.revision, ...values })
  )
}
async function saveInline(
  values: PostitTextChange,
  settled: (result: PostitView | string) => void
) {
  const id = note.value?.record.id
  if (!id) {
    settled(t('postits.adaptive.unavailable'))
    return
  }
  try {
    await changePostit({ id, ...values })
    await refresh()
    const updated = entry.value?.notes.find((n) => n.record.id === id)
    settled(updated ?? t('postits.adaptive.unavailable'))
  } catch (reason) {
    settled(String(reason))
    void refresh()
  }
}
function setPresentation(mode: PostitMode | null, isEditing: boolean) {
  editing.value = isEditing
  const id = note.value?.record.id ?? null
  presentation = presentation
    .then(() => presentPostit(mode, isEditing, id))
    .catch((reason) => {
      error.value = String(reason)
    })
}
function openGroup() {
  opened.value = true
  setPresentation('compact', false)
}
function closeGroup() {
  if (editing.value) return
  selected.value = null
  opened.value = false
  setPresentation(null, false)
}
async function openMember(id: string) {
  selected.value = id
  setPresentation('expanded', false)
  await nextTick()
  noteComponent.value?.focus()
}
function back() {
  if (!editing.value) {
    selected.value = null
    opened.value = true
    setPresentation('compact', false)
  }
}
async function drag() {
  if (entry.value?.group && !note.value && opened.value) closeGroup()
  await presentation
  try {
    await dragPostit()
  } catch (reason) {
    error.value = String(reason)
  }
}
let pendingSize: PostitSize | null = null
let sizing: Promise<void> | null = null
async function resize(size: PostitSize) {
  await presentation
  if (sizing) await sizing
  if (!note.value) return
  try {
    await resizePostit(note.value.record.id, size)
    await refresh()
  } catch (reason) {
    error.value = String(reason)
  }
}
function sizePreview(size: PostitSize) {
  pendingSize = size
  if (sizing) return
  sizing = (async () => {
    await presentation
    while (pendingSize && !disposed) {
      const latest = pendingSize
      pendingSize = null
      await previewPostitSize(latest)
    }
  })()
    .catch((reason) => {
      error.value = String(reason)
    })
    .finally(() => {
      sizing = null
    })
}
onMounted(async () => {
  try {
    const listeners = await Promise.all([
      onPostitsChanged(() => {
        void refresh().catch(() => {})
      }),
      onPostitError((message) => (error.value = message)),
      onPostitFinishRequested(() => {
        void noteComponent.value?.finish()
      }),
    ])
    if (disposed) listeners.forEach((stop) => stop())
    else stops = listeners
    await refresh()
  } catch (reason) {
    error.value = String(reason)
  } finally {
    window.dispatchEvent(new Event('praxis:ready'))
  }
})
onBeforeUnmount(() => {
  disposed = true
  stops.forEach((stop) => stop())
  entry.value = null
})
</script>
<template>
  <div
    v-if="entry"
    class="postit-desktop"
    @keydown.esc.self.prevent="closeGroup"
  >
    <button
      v-if="entry.group && note"
      class="postit-back"
      :disabled="editing"
      :aria-label="t('postits.adaptive.back')"
      @click="back"
    >
      <ArrowLeft :size="14" />
    </button>
    <PostitNote
      ref="noteComponent"
      v-if="note"
      :key="note.record.id"
      :note="note"
      :busy="busy"
      :error="error"
      desktop
      @mode="patch({ preferredMode: $event })"
      @lock="patch({ modeLocked: $event })"
      @unpin="patch({ pinned: false })"
      @complete="patch({ completed: true })"
      @save="saveInline"
      @present="setPresentation"
      @drag="drag"
      @resize="resize"
      @resize-preview="sizePreview"
    />
    <article
      v-else-if="entry.group"
      class="postit-note postit-pile"
      :class="{ 'pile-open': opened }"
      tabindex="0"
      @keydown.esc.stop.prevent="closeGroup"
      @keydown.enter.self.prevent="openGroup"
      @keydown.space.self.prevent="openGroup"
    >
      <header>
        <button
          :aria-label="t('postits.adaptive.move')"
          @pointerdown.left="drag"
        >
          <GripVertical :size="14" />
        </button>
        <button
          class="pile-name"
          :aria-expanded="opened"
          @click="openGroup"
        >
          <Layers :size="16" /><span>{{ entry.group.name }}</span
          ><b>{{ entry.notes.length }}</b>
        </button>
        <button
          v-if="opened"
          :aria-label="t('postits.adaptive.close')"
          @click="closeGroup"
        >
          <X :size="14" />
        </button>
      </header>
      <ul v-if="opened">
        <li
          v-for="member in entry.notes"
          :key="member.record.id"
        >
          <button @click="openMember(member.record.id)">
            <span
              class="pile-dot"
              :data-color="member.record.color"
            ></span
            ><span>{{
              member.title || member.record.body.split('\\n')[0] || t('postits.untitled')
            }}</span>
          </button>
        </li>
      </ul>
      <p
        v-if="error"
        role="alert"
      >
        {{ error }}
      </p>
    </article>
  </div>
</template>
<style>
html:has(.postit-note),
body:has(.postit-note) {
  min-width: 0 !important;
  width: 100%;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
}
body:has(.postit-note) #app {
  height: 100vh;
  min-height: 0;
}
</style>

<style>
.postit-desktop {
  height: 100%;
  position: relative;
}
.postit-back {
  position: absolute;
  top: 2px;
  left: 30px;
  z-index: 2;
  background: #fff2ad;
  border: 0;
  padding: 4px;
  cursor: pointer;
}
.postit-desktop:has(.postit-back) .postit-brand {
  visibility: hidden;
}
.postit-pile {
  background: #f4e7a8;
  color: #38382b;
  box-shadow: inset 0 -3px #aa96443a;
}
.postit-pile header {
  display: flex;
  align-items: center;
  height: 38px;
  flex-shrink: 0;
}
.postit-pile button {
  border: 0;
  color: inherit;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 7px;
  min-height: 30px;
  font: inherit;
}
.pile-name {
  min-width: 0;
  flex: 1;
  font-size: 13px !important;
}
.pile-name span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pile-name b {
  margin-left: auto;
  font-size: 11px;
}
.postit-pile ul {
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 4px;
}
.postit-pile li button {
  width: 100%;
  text-align: left;
  font-size: 13px;
}
.postit-pile li button span:last-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.postit-pile button:hover {
  background: #38382b14;
}
.pile-dot {
  width: 10px;
  height: 10px;
  background: #ffe14f;
  flex-shrink: 0;
}
.pile-dot[data-color='pink'] {
  background: #ff9ec4;
}
.pile-dot[data-color='blue'] {
  background: #88d1f3;
}
.pile-dot[data-color='green'] {
  background: #b9e66c;
}
.postit-pile :focus-visible {
  outline: 2px solid #5d583b;
  outline-offset: -2px;
}
</style>
