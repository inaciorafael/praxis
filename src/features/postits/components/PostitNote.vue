<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  Minus,
  X,
  ChevronDown,
  StickyNote,
  Pencil,
  GripVertical,
} from '@lucide/vue'
import type { PostitView } from '@/shared/types/postit'
const props = defineProps<{
  note: PostitView
  busy?: boolean
  error?: string
  desktop?: boolean
}>()
const emit = defineEmits<{
  collapse: []
  unpin: []
  complete: []
  drag: []
  save: [values: { title: string; body: string; expectedRevision: number }]
}>()
const { t } = useI18n()
const editing = ref(false)
const input = ref<HTMLTextAreaElement | null>(null)
const draft = ref({ title: '', body: '', expectedRevision: 0 })
async function startEditing() {
  if (props.busy) return
  draft.value = {
    title: props.note.record.title,
    body: props.note.record.body,
    expectedRevision: props.note.record.revision,
  }
  editing.value = true
  await nextTick()
  input.value?.focus()
}
function save() {
  if (props.busy || (!draft.value.title.trim() && !draft.value.body.trim())) return
  emit('save', { ...draft.value })
}
watch(
  () => props.note.record.revision,
  (revision) => {
    if (
      editing.value &&
      revision > draft.value.expectedRevision &&
      props.note.record.title === draft.value.title.trim() &&
      props.note.record.body === draft.value.body
    )
      editing.value = false
  }
)
</script>
<template>
  <article
    class="postit-note"
    :class="[note.record.color, { compact: note.record.collapsed }]"
    :aria-label="t('postits.note', { title: note.title })"
  >
    <div
      v-if="note.record.collapsed"
      class="postit-tab"
    >
      <span
        class="postit-grip"
        aria-hidden="true"
        @pointerdown.left="desktop && emit('drag')"
        ><GripVertical :size="14"
      /></span>
      <button
        type="button"
        class="postit-tab-open"
        :disabled="busy"
        :aria-label="t('postits.reveal', { title: note.title || t('postits.untitled') })"
        :aria-expanded="false"
        @click="emit('collapse')"
      >
        <StickyNote
          :size="21"
          :stroke-width="1.8"
          aria-hidden="true"
        />
        <span>Post-it</span>
        <ChevronDown
          :size="14"
          aria-hidden="true"
        />
      </button>
    </div>
    <header
      v-else
      @pointerdown.left="
        desktop && !($event.target as HTMLElement).closest('button') && emit('drag')
      "
    >
      <span class="postit-brand">{{ t('postits.title') }}</span>
      <div class="postit-header-actions">
        <button
          type="button"
          :disabled="busy || editing"
          :aria-label="t('postits.collapse')"
          @click="emit('collapse')"
        >
          <Minus :size="15" />
        </button>
        <button
          type="button"
          :disabled="busy || editing"
          :aria-label="t('postits.unpin')"
          @click="emit('unpin')"
        >
          <X :size="14" />
        </button>
      </div>
    </header>
    <div
      v-if="!note.record.collapsed"
      class="postit-body"
    >
      <form
        v-if="editing"
        class="postit-inline-editor"
        @submit.prevent="save"
        @keydown.ctrl.enter.prevent="save"
        @keydown.meta.enter.prevent="save"
      >
        <input
          v-model="draft.title"
          :aria-label="t('postits.name')"
          :placeholder="t('postits.name')"
          maxlength="200"
          :disabled="busy"
        />
        <textarea
          ref="input"
          v-model="draft.body"
          :aria-label="t('postits.content')"
          maxlength="10000"
          :disabled="busy"
        />
        <footer>
          <button
            type="button"
            :disabled="busy"
            @click="editing = false"
          >
            {{ t('postits.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="busy || (!draft.title.trim() && !draft.body.trim())"
            :title="t('postits.saveShortcut')"
          >
            <Check :size="14" />{{ t('postits.save') }}
          </button>
        </footer>
      </form>
      <template v-else>
        <h2 @dblclick="startEditing">{{ note.title }}</h2>
        <p
          class="postit-content"
          @dblclick="startEditing"
        >
          {{ note.record.body }}
        </p>
      </template>
      <footer v-if="!editing">
        <button
          type="button"
          :disabled="busy"
          @click="emit('complete')"
        >
          <Check :size="15" />{{ t('postits.complete') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          @click="startEditing"
        >
          <Pencil :size="14" />{{ t('postits.edit') }}
        </button>
      </footer>
    </div>
    <p
      v-if="error"
      class="postit-error"
      role="alert"
    >
      {{ error }}
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
  min-height: 48px;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  border: 1px solid #5c52231c;
  border-radius: 2px;
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
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  min-height: 34px;
  box-sizing: border-box;
  background: var(--note-top);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.postit-brand {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #57533d;
}
.postit-header-actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
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
  padding: 4px;
  border-radius: 3px;
  min-height: 26px;
}
button:hover {
  background: #423d2510;
}
button:focus-visible {
  outline: 2px solid #5d583b;
  outline-offset: -2px;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.postit-body {
  padding: 11px 14px;
}
.postit-date {
  font-size: 11px;
  color: #625e48;
}
h2 {
  font-size: 17px;
  font-weight: 500;
  margin: 0 0 6px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
}
footer button {
  font-size: 12px;
  padding: 5px;
}
footer button:first-child {
  background: #4b452010;
}
.compact {
  background: var(--note-tab);
  border-color: #40340040;
}
.postit-tab {
  display: flex;
  align-items: stretch;
  height: 46px;
  position: relative;
}
.postit-tab::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  background: #ffffff60;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  pointer-events: none;
}
.postit-tab-open {
  flex: 1;
  min-width: 0;
  gap: 6px;
  padding: 0 8px 0 2px;
  font-size: 13px;
  font-weight: 650;
  border-radius: 0;
}
.postit-tab-open:hover {
  background: #ffffff30;
}
.postit-grip {
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38382b80;
  cursor: grab;
  touch-action: none;
}
.postit-error {
  background: var(--note-paper);
  position: absolute;
  inset: auto 5px 5px;
  font-size: 11px;
  margin: 0;
  padding: 4px;
  border: 1px solid #815a38;
}
.postit-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 70px;
  overflow: auto;
  margin: 0;
  font-size: 13px;
}
</style>

<style scoped>
.postit-inline-editor {
  display: grid;
  gap: 6px;
}
.postit-inline-editor input,
.postit-inline-editor textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #38382b40;
  background: #ffffff35;
  color: #38382b;
  font: inherit;
  padding: 5px;
  border-radius: 2px;
}
.postit-inline-editor input {
  font-size: 13px;
  font-weight: 600;
}
.postit-inline-editor textarea {
  resize: none;
  height: 78px;
  font-size: 13px;
  line-height: 1.4;
}
.postit-inline-editor :focus-visible {
  outline: 2px solid #5d583b;
  outline-offset: 0;
}
</style>
