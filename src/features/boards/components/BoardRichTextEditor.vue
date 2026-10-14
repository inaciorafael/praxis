<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Editor, EditorContent, Mark, Extension, mergeAttributes } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { useI18n } from 'vue-i18n'
import type { BoardRichText } from '@/shared/types/board'
import {
  editorToRichText,
  richTextToEditor,
  safeRichAttributes,
} from '../lib/rich-editor'
import { markerBackground } from '../lib/marker'
import type { BoardTextHighlight } from '@/shared/types/board'

const props = defineProps<{
  modelValue: BoardRichText
  autoWidth?: boolean
  markerSeed?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: BoardRichText]
  finish: []
  cancel: []
}>()
const { t } = useI18n()
const selectionRevision = ref(0)
const BoardStyle = Mark.create({
  name: 'boardStyle',
  addAttributes() {
    return Object.fromEntries(
      Object.entries(safeRichAttributes()).map(([key, value]) => [
        key,
        {
          default: value,
          parseHTML: (element: HTMLElement) =>
            safeRichAttributes({
              font: element.dataset.font,
              fontSize: Number(element.dataset.fontSize),
              color: element.dataset.color,
              highlight: element.dataset.highlight,
            })[key as keyof ReturnType<typeof safeRichAttributes>],
          renderHTML: () => ({}),
        },
      ])
    )
  },
  parseHTML() {
    return [{ tag: 'span[data-board-style]' }]
  },
  renderHTML({ HTMLAttributes, mark }) {
    const attributes = safeRichAttributes(mark.attrs)
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-board-style': '',
        'data-font': attributes.font,
        'data-font-size': attributes.fontSize,
        'data-color': attributes.color,
        'data-highlight': attributes.highlight,
        style: `font-family:${attributes.font === 'sans' ? 'Arial, sans-serif' : "'Praxis Caveat', cursive"};font-size:${attributes.fontSize}px;color:${attributes.color};background-image:${markerBackground(attributes.highlight as BoardTextHighlight, props.markerSeed)};background-size:100% 85%;background-position:0 65%;background-repeat:no-repeat;box-decoration-break:clone;-webkit-box-decoration-break:clone`,
      }),
      0,
    ]
  },
})
const Alignment = Extension.create({
  name: 'boardAlignment',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          textAlign: {
            default: 'left',
            parseHTML: (element: HTMLElement) =>
              ['center', 'right'].includes(element.style.textAlign)
                ? element.style.textAlign
                : 'left',
            renderHTML: (attributes: Record<string, unknown>) => ({
              style: `text-align:${attributes.textAlign}`,
            }),
          },
        },
      },
    ]
  },
})
const editor = new Editor({
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      strike: false,
    }),
    BoardStyle,
    Alignment,
  ],
  content: richTextToEditor(props.modelValue),
  onUpdate: ({ editor: instance }) =>
    emit('update:modelValue', editorToRichText(instance.getJSON())),
  onSelectionUpdate: () => {
    selectionRevision.value++
  },
  onTransaction: () => {
    selectionRevision.value++
  },
  editorProps: {
    attributes: {
      'aria-label': t('boards.rich.editor'),
      role: 'textbox',
      'aria-multiline': 'true',
    },
    handleKeyDown: (_view, event) => {
      if (event.isComposing) return false
      if (event.key === 'Escape') {
        event.preventDefault()
        emit('cancel')
        return true
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        emit('finish')
        return true
      }
      return false
    },
  },
})
function style(key: string, value: unknown) {
  editor
    .chain()
    .focus()
    .setMark('boardStyle', {
      ...safeRichAttributes(editor.getAttributes('boardStyle')),
      [key]: value,
    })
    .run()
}
function select(event: Event, key: string) {
  const value = (event.target as HTMLSelectElement).value
  style(key, key === 'fontSize' ? Number(value) : value)
}
function align(value: string) {
  editor.chain().focus().updateAttributes('paragraph', { textAlign: value }).run()
}
onMounted(() => {
  editor.commands.focus('end')
  const firstRun = props.modelValue.paragraphs[0]?.runs[0]
  if (!editor.getText() && firstRun)
    editor.commands.setMark('boardStyle', safeRichAttributes(firstRun))
})
onBeforeUnmount(() => editor.destroy())
defineExpose({
  focus: () => editor.commands.focus('end'),
  getDocument: () => editorToRichText(editor.getJSON()),
})
</script>

<template>
  <div
    class="board-rich-editor"
    :class="{ 'auto-width': autoWidth }"
    @pointerdown.stop
    @keydown.stop
  >
    <div
      class="rich-toolbar"
      role="toolbar"
      :data-selection-revision="selectionRevision"
      :aria-label="t('boards.rich.toolbar')"
    >
      <select
        :aria-label="t('boards.rich.font')"
        :value="editor.getAttributes('boardStyle').font ?? 'handwritten'"
        @change="select($event, 'font')"
      >
        <option value="handwritten">{{ t('boards.textFonts.handwritten') }}</option>
        <option value="sans">{{ t('boards.textFonts.sans') }}</option>
      </select>
      <select
        :aria-label="t('boards.rich.size')"
        :value="editor.getAttributes('boardStyle').fontSize ?? 22"
        @change="select($event, 'fontSize')"
      >
        <option
          v-for="size in [8, 12, 14, 18, 22, 28, 36, 48, 72]"
          :key="size"
          :value="size"
        >
          {{ size }}
        </option>
      </select>
      <input
        type="color"
        :aria-label="t('boards.rich.color')"
        :value="editor.getAttributes('boardStyle').color ?? '#263238'"
        @input="style('color', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :aria-label="t('boards.rich.bold')"
        :aria-pressed="editor.isActive('bold')"
        @mousedown.prevent
        @click="editor.chain().focus().toggleBold().run()"
      >
        <b>B</b>
      </button>
      <button
        type="button"
        :aria-label="t('boards.rich.italic')"
        :aria-pressed="editor.isActive('italic')"
        @mousedown.prevent
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <i>I</i>
      </button>
      <button
        type="button"
        :aria-label="t('boards.rich.underline')"
        :aria-pressed="editor.isActive('underline')"
        @mousedown.prevent
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <u>U</u>
      </button>
      <button
        v-for="value in ['left', 'center', 'right']"
        :key="value"
        type="button"
        :aria-label="t(`boards.rich.${value}`)"
        :aria-pressed="editor.isActive('paragraph', { textAlign: value })"
        @mousedown.prevent
        @click="align(value)"
      >
        {{ value === 'left' ? '☰←' : value === 'right' ? '→☰' : '☰' }}
      </button>
      <button
        type="button"
        :aria-label="t('boards.rich.bullet')"
        :aria-pressed="editor.isActive('bulletList')"
        @mousedown.prevent
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        • ☰
      </button>
      <button
        type="button"
        :aria-label="t('boards.rich.ordered')"
        :aria-pressed="editor.isActive('orderedList')"
        @mousedown.prevent
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        1. ☰
      </button>
      <select
        :aria-label="t('boards.rich.highlight')"
        :value="editor.getAttributes('boardStyle').highlight ?? 'none'"
        @change="select($event, 'highlight')"
      >
        <option
          v-for="value in ['none', 'yellow', 'green', 'pink', 'blue']"
          :key="value"
          :value="value"
        >
          {{ t(`boards.textHighlights.${value}`) }}
        </option>
      </select>
      <button
        type="button"
        :aria-label="t('boards.rich.clear')"
        @mousedown.prevent
        @click="editor.chain().focus().unsetAllMarks().run()"
      >
        Tx
      </button>
      <button
        type="button"
        :aria-label="t('boards.undo')"
        :disabled="!editor.can().undo()"
        @mousedown.prevent
        @click="editor.chain().focus().undo().run()"
      >
        ↶
      </button>
      <button
        type="button"
        :aria-label="t('boards.redo')"
        :disabled="!editor.can().redo()"
        @mousedown.prevent
        @click="editor.chain().focus().redo().run()"
      >
        ↷
      </button>
      <button
        type="button"
        :aria-label="t('boards.rich.done')"
        @mousedown.prevent
        @click="emit('finish')"
      >
        ✓
      </button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.board-rich-editor {
  position: relative;
  color: #263238;
  background: transparent;
  outline: 1px dashed #94a3b8;
}
.rich-toolbar {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 430px;
  max-width: 600px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  padding: 5px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  box-shadow: 0 6px 24px #0002;
  font:
    12px Arial,
    sans-serif;
}
.rich-toolbar button,
.rich-toolbar select {
  min-height: 28px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  padding: 2px 5px;
  background: white;
  color: #263238;
}
.rich-toolbar button[aria-pressed='true'] {
  background: #dbeafe;
  border-color: #93c5fd;
}
.rich-toolbar button:disabled {
  opacity: 0.4;
}
.rich-toolbar input {
  width: 28px;
  height: 28px;
  padding: 1px;
  border: 1px solid #e2e8f0;
}
:deep(.tiptap) {
  opacity: var(--paper-ink-opacity, 1);
  outline: none;
  padding: 12px;
  padding-top: calc(12px + var(--text-vertical-offset, 0px));
  min-height: 45px;
  font:
    22px/1.2 'Praxis Caveat',
    cursive;
  overflow-wrap: anywhere;
}
:deep(.tiptap p) {
  margin: 0;
}
.auto-width :deep(.tiptap) {
  white-space: pre;
  overflow-wrap: normal;
}
:deep(.tiptap ul),
:deep(.tiptap ol) {
  padding-left: 1.4em;
  margin: 0;
}
:deep(.tiptap li) {
  display: list-item;
}
</style>
