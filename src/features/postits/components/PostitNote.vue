<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, X, Pencil, GripVertical, ArrowUpRight, Minimize2 } from '@lucide/vue'
import type { PostitView, PostitMode, PostitSize } from '@/shared/types/postit'
import PostitModeControls from './PostitModeControls.vue'
import { usePostitDraft, type PostitTextChange } from '../composables/usePostitDraft'
const props = defineProps<{
  note: PostitView
  busy?: boolean
  error?: string
  desktop?: boolean
}>()
const emit = defineEmits<{
  unpin: []
  complete: []
  drag: []
  mode: [mode: PostitMode]
  lock: [locked: boolean]
  present: [mode: PostitMode | null, editing: boolean]
  resize: [size: PostitSize]
  resizePreview: [size: PostitSize]
  save: [values: PostitTextChange, settled: (value: PostitView | string) => void]
}>()
const { t } = useI18n()
const editor = usePostitDraft(
  (value) =>
    new Promise((resolve, reject) => {
      emit('save', value, (result) =>
        typeof result === 'string' ? reject(result) : resolve(result)
      )
    })
)
const { draft, editing, saving, error: draftError } = editor
const input = ref<HTMLTextAreaElement | null>(null)
const root = ref<HTMLElement | null>(null)
const preview = ref<PostitMode | null>(null)
const sticky = ref(false),
  dragging = ref(false)
const preferred = computed(
  () =>
    props.note.record.preferredMode ??
    (props.note.record.collapsed ? 'micro' : 'expanded')
)
const mode = computed(() =>
  editing.value ? 'expanded' : (preview.value ?? preferred.value)
)
const title = computed(
  () => props.note.title || props.note.record.body.split('\n')[0] || t('postits.untitled')
)
let previewCooldown = 0
let hover: ReturnType<typeof setTimeout> | undefined
let leave: ReturnType<typeof setTimeout> | undefined
function present(value: PostitMode | null, persistent = false) {
  clearTimeout(hover)
  clearTimeout(leave)
  if (value === null) previewCooldown = performance.now() + 700
  sticky.value = persistent
  preview.value = value
  emit('present', value, editing.value)
  // The Micro/Compact opener is removed during expansion. Restore DOM focus
  // to the article so Escape and Enter still work after a mouse activation.
  if (persistent) void nextTick(() => root.value?.focus())
}
function enter(event?: MouseEvent | FocusEvent) {
  clearTimeout(hover)
  if (performance.now() < previewCooldown) return
  if (event instanceof MouseEvent && event.buttons === 0) dragging.value = false
  clearTimeout(leave)
  if (mode.value === 'micro' && !props.note.record.modeLocked && !dragging.value)
    hover = setTimeout(() => present('compact'), 300)
}
function exit(event?: FocusEvent) {
  clearTimeout(hover)
  if (event?.relatedTarget && root.value?.contains(event.relatedTarget as Node)) return
  if (!sticky.value && !editing.value) leave = setTimeout(() => present(null), 180)
}
async function startEditing() {
  if (props.busy || editing.value) return
  clearTimeout(hover)
  clearTimeout(leave)
  editor.begin(props.note)
  emit('present', 'expanded', true)
  await nextTick()
  input.value?.focus()
}
async function finish() {
  if (await editor.finish()) {
    present(null)
    await nextTick()
    root.value?.focus()
  }
}
function escape() {
  if (editing.value) void finish()
  else {
    present(null)
    root.value?.focus()
  }
}
function drag() {
  if (!props.desktop || editing.value) return
  clearTimeout(hover)
  clearTimeout(leave)
  dragging.value = true
  present(null)
  // Parent serializes restoring the preferred frame before starting native drag.
  emit('drag')
}
function changeMode(value: PostitMode) {
  present(null)
  emit('mode', value)
}
function keyboard(event: KeyboardEvent) {
  if (event.target !== root.value) return
  if (event.key === 'Enter') {
    event.preventDefault()
    void startEditing()
  }
  if (event.key === ' ') {
    event.preventDefault()
    present('expanded', true)
  }
}
watch(
  () => props.note.record.revision,
  () => editor.receive(props.note)
)
let resizeStart: { x: number; y: number; width: number; height: number } | null = null
let resizeFrame = 0
let latest: PostitSize | null = null
function startResize(event: PointerEvent) {
  if (!props.desktop || saving.value) return
  const bounds = root.value!.getBoundingClientRect()
  resizeStart = {
    x: event.screenX,
    y: event.screenY,
    width: bounds.width,
    height: bounds.height,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function resizing(event: PointerEvent) {
  if (!resizeStart) return
  latest = {
    width: Math.round(
      Math.max(280, Math.min(600, resizeStart.width + event.screenX - resizeStart.x))
    ),
    height: Math.round(
      Math.max(220, Math.min(700, resizeStart.height + event.screenY - resizeStart.y))
    ),
  }
  if (!resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0
      if (latest) emit('resizePreview', latest)
    })
}
function endResize() {
  if (!resizeStart) return
  cancelAnimationFrame(resizeFrame)
  resizeFrame = 0
  resizeStart = null
  if (latest) emit('resize', latest)
  latest = null
}
defineExpose({ finish, focus: () => root.value?.focus() })
onBeforeUnmount(() => {
  clearTimeout(hover)
  clearTimeout(leave)
  cancelAnimationFrame(resizeFrame)
})
</script>
<template>
  <article
    ref="root"
    class="postit-note"
    :class="[note.record.color, mode]"
    tabindex="0"
    :aria-label="t('postits.note', { title })"
    @mouseenter="enter"
    @mouseleave="exit()"
    @focusin="enter"
    @focusout="exit"
    @keydown="keyboard"
    @keydown.esc.stop.prevent="escape"
    @pointerup="dragging = false"
  >
    <div
      v-if="mode === 'micro'"
      class="postit-tab"
    >
      <button
        class="postit-grip"
        :aria-label="t('postits.adaptive.move')"
        @pointerdown.left="drag"
      >
        <GripVertical :size="14" />
      </button>
      <button
        class="postit-tab-open"
        :aria-label="t('postits.reveal', { title })"
        :aria-expanded="false"
        @click="present('expanded', true)"
        @dblclick="startEditing"
      >
        <span>{{ title }}</span
        ><ArrowUpRight :size="14" />
      </button>
    </div>
    <template v-else>
      <header>
        <button
          class="postit-grip"
          :disabled="editing"
          :aria-label="t('postits.adaptive.move')"
          @pointerdown.left="drag"
        >
          <GripVertical :size="14" />
        </button>
        <span class="postit-brand">Post-it</span>
        <div class="postit-header-actions">
          <button
            :disabled="editing || busy"
            :aria-label="t('postits.collapse')"
            @click="preview ? present(null) : changeMode('micro')"
          >
            <Minimize2 :size="14" />
          </button>
          <button
            :disabled="editing || busy"
            :aria-label="t('postits.unpin')"
            @click="emit('unpin')"
          >
            <X :size="14" />
          </button>
        </div>
      </header>
      <div class="postit-body">
        <form
          v-if="editing"
          class="postit-inline-editor"
          @submit.prevent="finish"
          @keydown.ctrl.enter.prevent="finish"
          @keydown.meta.enter.prevent="finish"
        >
          <input
            v-model="draft.title"
            :aria-label="t('postits.name')"
            :placeholder="t('postits.name')"
            maxlength="200"
          />
          <textarea
            ref="input"
            v-model="draft.body"
            :aria-label="t('postits.content')"
            maxlength="10000"
          />
          <div
            class="postit-save-status"
            role="status"
          >
            {{
              saving
                ? t('postits.adaptive.saving')
                : editor.dirty.value
                  ? t('postits.adaptive.pending')
                  : t('postits.adaptive.saved')
            }}
          </div>
          <footer>
            <button
              type="submit"
              :disabled="saving"
            >
              <Check :size="14" />{{ t('postits.adaptive.finish') }}
            </button>
          </footer>
        </form>
        <template v-else>
          <div
            class="postit-reading"
            @dblclick="startEditing"
          >
            <h2>{{ title }}</h2>
            <p class="postit-content">{{ note.record.body }}</p>
          </div>
          <PostitModeControls
            v-if="mode === 'expanded'"
            :mode="preferred"
            :locked="note.record.modeLocked"
            :disabled="busy"
            @mode="changeMode"
            @lock="emit('lock', $event)"
          />
          <div
            v-if="desktop && mode === 'expanded'"
            class="postit-size"
          >
            <label
              >{{ t('postits.adaptive.width')
              }}<input
                type="number"
                min="280"
                max="600"
                step="10"
                :value="note.record.expandedSize?.width ?? 340"
                @change="
                  emit('resize', {
                    width: Math.max(
                      280,
                      Math.min(600, Number(($event.target as HTMLInputElement).value))
                    ),
                    height: note.record.expandedSize?.height ?? 380,
                  })
                "
            /></label>
            <label
              >{{ t('postits.adaptive.height')
              }}<input
                type="number"
                min="220"
                max="700"
                step="10"
                :value="note.record.expandedSize?.height ?? 380"
                @change="
                  emit('resize', {
                    height: Math.max(
                      220,
                      Math.min(700, Number(($event.target as HTMLInputElement).value))
                    ),
                    width: note.record.expandedSize?.width ?? 340,
                  })
                "
            /></label>
          </div>
          <footer>
            <button
              :disabled="busy"
              @click="emit('complete')"
            >
              <Check :size="14" />{{ t('postits.complete') }}
            </button>
            <button
              v-if="mode === 'compact'"
              :aria-label="t('postits.adaptive.read')"
              @click="present('expanded', true)"
            >
              <ArrowUpRight :size="15" />
            </button>
            <button
              :disabled="busy"
              @click="startEditing"
            >
              <Pencil :size="14" />{{ t('postits.edit') }}
            </button>
          </footer>
        </template>
      </div>
      <button
        v-if="desktop && mode === 'expanded'"
        class="postit-resize"
        :aria-label="t('postits.adaptive.resize')"
        @pointerdown.prevent="startResize"
        @pointermove="resizing"
        @pointerup="endResize"
        @pointercancel="endResize"
      >
        ◢
      </button>
    </template>
    <p
      v-if="error || draftError"
      class="postit-error"
      role="alert"
    >
      {{ error || (draftError.startsWith('postits.') ? t(draftError) : draftError)
      }}<button
        v-if="draftError && draftError !== 'postits.adaptive.conflict'"
        @click="editor.retry"
      >
        {{ t('postits.adaptive.retry') }}
      </button>
      <button
        v-if="draftError === 'postits.adaptive.conflict'"
        @click="editor.begin(note)"
      >
        {{ t('postits.adaptive.reloadDraft') }}
      </button>
    </p>
  </article>
</template>
<style scoped>
.postit-note {
  --note-paper: #fff2ad;
  --note-top: #f6e89e;
  --note-tab: #ffe14f;
  background: var(--note-paper);
  color: #38382b;
  font:
    14px/1.4 system-ui,
    sans-serif;
  width: 100%;
  height: 100%;
  min-height: 40px;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  border: 1px solid #5c522330;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
}
.pink {
  --note-paper: #f8d6df;
  --note-top: #efcbd6;
  --note-tab: #ff9ec4;
}
.green {
  --note-paper: #def0bd;
  --note-top: #d2e5af;
  --note-tab: #b9e66c;
}
.blue {
  --note-paper: #d9edf7;
  --note-top: #cde2ee;
  --note-tab: #88d1f3;
}
header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  min-height: 28px;
  background: var(--note-top);
  user-select: none;
  flex-shrink: 0;
}
.postit-brand {
  font-size: 10px;
  letter-spacing: 0.04em;
}
.postit-header-actions {
  display: flex;
  margin-left: auto;
}
button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 5px;
  border-radius: 2px;
  min-height: 26px;
}
button:hover {
  background: #423d2514;
}
:focus-visible {
  outline: 2px solid #5d583b;
  outline-offset: -2px;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.postit-body {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.postit-reading {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.postit-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 13px;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  flex-shrink: 0;
}
footer button {
  font-size: 12px;
}
footer button:first-child {
  background: #4b452010;
}
.compact .postit-body {
  gap: 3px;
  padding: 5px 10px;
}
.compact .postit-reading {
  overflow: hidden;
}
.compact h2 {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.compact .postit-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.35;
}
.micro {
  background: var(--note-tab);
  border-color: #40340040;
}
.postit-tab {
  display: flex;
  align-items: stretch;
  height: 38px;
  flex: 1;
  min-width: 0;
}
.postit-tab-open {
  flex: 1;
  min-width: 0;
  justify-content: space-between;
  gap: 6px;
  padding: 0 7px 0 0;
  font-size: 13px;
  font-weight: 600;
}
.postit-tab-open span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.postit-tab-open svg {
  flex-shrink: 0;
}
.postit-grip {
  width: 20px;
  flex-shrink: 0;
  color: #38382b99;
  cursor: grab;
  touch-action: none;
  padding: 0;
}
.postit-error {
  background: var(--note-paper);
  position: absolute;
  inset: auto 5px 5px;
  font-size: 11px;
  margin: 0;
  padding: 4px;
  border: 1px solid #815a38;
  z-index: 2;
}
.postit-inline-editor {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
  min-height: 0;
}
.postit-inline-editor input,
.postit-inline-editor textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #38382b40;
  background: #ffffff35;
  color: #38382b;
  font: inherit;
  padding: 6px;
  border-radius: 2px;
}
.postit-inline-editor input {
  font-weight: 600;
}
.postit-inline-editor textarea {
  resize: none;
  flex: 1;
  min-height: 60px;
  line-height: 1.5;
}
.postit-save-status {
  font-size: 11px;
  opacity: 0.75;
}
.postit-resize {
  position: absolute;
  bottom: 0;
  right: 0;
  min-height: 16px;
  font-size: 13px;
  padding: 0 2px;
  cursor: nwse-resize;
  touch-action: none;
}
.expanded footer {
  padding-right: 12px;
}
.postit-size {
  display: flex;
  gap: 8px;
  font-size: 11px;
}
.postit-size label {
  display: flex;
  align-items: center;
  gap: 3px;
}
.postit-size input {
  width: 54px;
  background: transparent;
  border: 1px solid #38382b40;
  color: inherit;
  padding: 2px;
}
</style>
