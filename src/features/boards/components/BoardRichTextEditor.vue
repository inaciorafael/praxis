<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Editor, EditorContent, Mark, Extension, mergeAttributes } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { useI18n } from 'vue-i18n'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
} from '@lucide/vue'
import type { BoardRichText, PaperColorScheme } from '@/shared/types/board'
import { paperTextInk } from '../lib/background'
import { BOARD_FONT_SIZE_PRESETS } from '../lib/text'
import {
  editorToRichText,
  richTextToEditor,
  safeRichAttributes,
} from '../lib/rich-editor'
import { markerBackground } from '../lib/marker'
import type { BoardTextHighlight } from '@/shared/types/board'
import type { BoardAnnotationType, BoardTextAnnotation } from '@/shared/types/board'
import {
  annotationTypes,
  defaultAnnotation,
  safeAnnotation,
  type AnnotationShape,
} from '../lib/notation'
import BoardAnnotationControls from './BoardAnnotationControls.vue'
import BoardNotation from './BoardNotation.vue'
import BoardColorPresets from './BoardColorPresets.vue'
import { PEN_COLORS, HIGHLIGHT_COLORS } from '../lib/ink-colors'

const props = defineProps<{
  modelValue: BoardRichText
  autoWidth?: boolean
  markerSeed?: string
  annotation?: BoardTextAnnotation | null
  controlsTarget?: HTMLElement
  colorScheme?: PaperColorScheme
  backgroundColor?: string
  canUndo?: boolean
  canRedo?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: BoardRichText]
  finish: []
  cancel: []
  undo: []
  redo: []
}>()
const { t } = useI18n()
const selectionRevision = ref(0)
const annotationOpen = ref(false)
const annotationReplay = ref(0)
const editorRoot = ref<HTMLElement>()
const notationPreview = ref<AnnotationShape[]>([])
const previewItems = computed(() => {
  let delay = 0
  return notationPreview.value.map((shape) => {
    const groupDelay = delay
    if (shape.config.animate)
      delay += shape.config.animationDelay + shape.config.animationDuration
    return { shape, groupDelay }
  })
})
let previewObserver: ResizeObserver | undefined
let previewPending = false
let destroyed = false
function parseAnnotation(value: string | undefined) {
  try {
    return safeAnnotation(JSON.parse(value ?? 'null'))
  } catch {
    return null
  }
}
async function refreshPreview() {
  if (previewPending || destroyed) return
  previewPending = true
  await nextTick()
  previewPending = false
  if (destroyed || !editorRoot.value) return
  const container = editorRoot.value.getBoundingClientRect()
  const scale = container.width / editorRoot.value.offsetWidth || 1
  function rectsFor(element: Element) {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rects: AnnotationShape['rects'] = []
    for (const rect of [...range.getClientRects()].filter(
      (rect) => rect.width && rect.height
    )) {
      const next = {
        x: (rect.x - container.x) / scale,
        y: (rect.y - container.y) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      }
      const previous = rects[rects.length - 1]
      if (
        previous &&
        Math.abs(previous.y - next.y) < 2 &&
        next.x <= previous.x + previous.width + 1
      ) {
        previous.width =
          Math.max(previous.x + previous.width, next.x + next.width) - previous.x
        previous.height = Math.max(previous.height, next.height)
      } else rects.push(next)
    }
    return rects
  }
  const whole = safeAnnotation(props.annotation)
  notationPreview.value = [
    ...(whole
      ? [
          {
            config: whole,
            rects: [...editorRoot.value.querySelectorAll('.tiptap p')].flatMap(rectsFor),
            seed: `${props.markerSeed}:whole`,
          },
        ]
      : []),
    ...[
      ...editorRoot.value.querySelectorAll<HTMLElement>('.tiptap span[data-annotation]'),
    ].flatMap((span, index) => {
      const config = parseAnnotation(span.dataset.annotation)
      if (!config || !span.textContent) return []
      const rects = rectsFor(span)
      return [
        {
          config,
          rects,
          seed: `${props.markerSeed ?? 'editor'}:run:${index}`,
        },
      ]
    }),
  ]
}
watch(
  () => props.annotation,
  () => void refreshPreview()
)
const BoardStyle = Mark.create({
  name: 'boardStyle',
  addAttributes() {
    return Object.fromEntries(
      Object.entries({ ...safeRichAttributes(), annotation: null }).map(
        ([key, value]) => [
          key,
          {
            default: value,
            parseHTML: (element: HTMLElement) =>
              safeRichAttributes({
                font: element.dataset.font,
                fontSize: Number(element.dataset.fontSize),
                color: element.dataset.color,
                highlight: element.dataset.highlight,
                annotation: parseAnnotation(element.dataset.annotation),
              })[key as keyof ReturnType<typeof safeRichAttributes>],
            renderHTML: () => ({}),
          },
        ]
      )
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
        'data-annotation': attributes.annotation
          ? JSON.stringify(attributes.annotation)
          : undefined,
        style: `font-family:${attributes.font === 'sans' ? 'Arial, sans-serif' : "'Praxis Caveat', cursive"};font-size:${attributes.fontSize}px;color:${attributes.highlight !== 'none' || attributes.annotation?.type === 'highlight' ? attributes.color : `var(--paper-text-${String(attributes.color).slice(1)}, ${attributes.color})`};background-image:${markerBackground(attributes.highlight as BoardTextHighlight, props.markerSeed)};background-size:100% 85%;background-position:0 65%;background-repeat:no-repeat;box-decoration-break:clone;-webkit-box-decoration-break:clone`,
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
  onUpdate: ({ editor: instance }) => {
    emit('update:modelValue', editorToRichText(instance.getJSON()))
    void refreshPreview()
  },
  onSelectionUpdate: () => {
    selectionRevision.value++
  },
  onTransaction: () => {
    selectionRevision.value++
    void refreshPreview()
  },
  editorProps: {
    attributes: {
      'aria-label': t('boards.rich.editor'),
      role: 'textbox',
      'aria-multiline': 'true',
    },
    handleKeyDown: (_view, event) => {
      if (event.isComposing) return false
      if (historyShortcut(event)) {
        event.preventDefault()
        performHistory(
          event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo'
        )
        return true
      }
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
const initialDocument = JSON.stringify(editor.getJSON())
const unchangedDocument = computed(() => {
  void selectionRevision.value
  return JSON.stringify(editor.getJSON()) === initialDocument
})
const externalUndoAvailable = computed(() => unchangedDocument.value && props.canUndo)
const externalRedoAvailable = computed(() => unchangedDocument.value && props.canRedo)
function historyShortcut(event: KeyboardEvent) {
  return (
    !event.isComposing &&
    !event.altKey &&
    (event.ctrlKey || event.metaKey) &&
    ['z', 'y'].includes(event.key.toLowerCase())
  )
}
function performHistory(action: 'undo' | 'redo') {
  if (action === 'undo' ? editor.can().undo() : editor.can().redo()) {
    const chain = editor.chain().focus()
    action === 'undo' ? chain.undo().run() : chain.redo().run()
  } else if (
    action === 'undo' ? externalUndoAvailable.value : externalRedoAvailable.value
  ) {
    action === 'undo' ? emit('undo') : emit('redo')
  }
}
const currentAnnotation = computed(() => {
  void selectionRevision.value
  return safeAnnotation(editor.getAttributes('boardStyle').annotation)
})
const textColorVariables = computed(() => {
  void selectionRevision.value
  const scheme = props.annotation?.type === 'highlight' ? 'light' : props.colorScheme
  return Object.fromEntries(
    editorToRichText(editor.getJSON()).paragraphs.flatMap((paragraph) =>
      paragraph.runs.map((run) => [
        `--paper-text-${run.color.slice(1)}`,
        paperTextInk(
          run.color,
          scheme,
          props.annotation?.type === 'highlight' ? undefined : props.backgroundColor
        ),
      ])
    )
  )
})
const currentFontSize = computed(() => {
  void selectionRevision.value
  return safeRichAttributes(editor.getAttributes('boardStyle')).fontSize
})
const fontSizeDraft = ref<string | number>(String(currentFontSize.value))
watch(currentFontSize, (value) => {
  fontSizeDraft.value = String(value)
})
function commitFontSize(focus = false) {
  const value = Number(fontSizeDraft.value)
  if (!String(fontSizeDraft.value).trim() || !Number.isFinite(value)) {
    fontSizeDraft.value = String(currentFontSize.value)
    return
  }
  const size = safeRichAttributes({ fontSize: value }).fontSize
  fontSizeDraft.value = String(size)
  const chain = editor.chain().setMark('boardStyle', { fontSize: size })
  if (focus) chain.focus()
  chain.run()
}
function cancelFontSize() {
  fontSizeDraft.value = String(currentFontSize.value)
  editor.commands.focus()
}
function stepFontSize(direction: number) {
  style(
    'fontSize',
    safeRichAttributes({ fontSize: currentFontSize.value + direction * 2 }).fontSize
  )
}
function chooseFontSize(size: number) {
  const chain = editor.chain().focus()
  if (editor.state.selection.empty && editor.getText()) chain.selectAll()
  chain.setMark('boardStyle', { fontSize: size }).run()
}
function setAnnotation(annotation: BoardTextAnnotation | null) {
  const chain = editor.chain().focus()
  if (editor.state.selection.empty && editor.getText()) chain.selectAll()
  chain
    .setMark('boardStyle', {
      annotation,
      highlight: 'none',
    })
    .run()
}
const annotationInkColor = ref<string>()
const highlightColor = ref<string>()
const notationColor = computed(
  () => currentAnnotation.value?.color ?? annotationInkColor.value ?? PEN_COLORS[0].color
)
function chooseNotationColor(color: string) {
  if (currentAnnotation.value?.type === 'highlight') highlightColor.value = color
  else annotationInkColor.value = color
  if (currentAnnotation.value) setAnnotation({ ...currentAnnotation.value, color })
}
function chooseQuickAnnotation(type: BoardAnnotationType) {
  const current = currentAnnotation.value
  const sameFamily = current && (current.type === 'highlight') === (type === 'highlight')
  const preferred = type === 'highlight' ? highlightColor.value : annotationInkColor.value
  setAnnotation({
    ...(current ?? defaultAnnotation(type)),
    type,
    color: sameFamily
      ? current.color
      : (preferred ??
        (type === 'highlight' ? HIGHLIGHT_COLORS[0].color : PEN_COLORS[0].color)),
  })
}
function toolbarHistory(event: KeyboardEvent) {
  if (!historyShortcut(event)) return
  const key = event.key.toLowerCase()
  if (!['z', 'y'].includes(key)) return
  if ((event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))
    return
  event.preventDefault()
  event.stopPropagation()
  performHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo')
}
function style(key: string, value: unknown) {
  editor
    .chain()
    .focus()
    .setMark('boardStyle', {
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
  if (typeof ResizeObserver !== 'undefined' && editorRoot.value) {
    previewObserver = new ResizeObserver(() => void refreshPreview())
    previewObserver.observe(editorRoot.value)
  }
  void refreshPreview()
})
onBeforeUnmount(() => {
  destroyed = true
  previewObserver?.disconnect()
  editor.destroy()
})
defineExpose({
  focus: () => editor.commands.focus('end'),
  getDocument: () => editorToRichText(editor.getJSON()),
})
</script>

<template>
  <div
    ref="editorRoot"
    class="board-rich-editor"
    :class="{ 'auto-width': autoWidth }"
    :style="textColorVariables"
    @pointerdown.stop
    @keydown.stop
  >
    <Teleport
      :to="controlsTarget ?? editorRoot"
      :disabled="!controlsTarget"
    >
      <div
        :class="{ 'rich-detached-controls': controlsTarget }"
        @pointerdown.stop
        @keydown.capture="toolbarHistory"
        @keydown.stop
        @wheel.stop
      >
        <div
          class="rich-toolbar"
          role="toolbar"
          :data-selection-revision="selectionRevision"
          :aria-label="t('boards.rich.toolbar')"
        >
          <div
            class="rich-control-group rich-type-controls"
            role="group"
            :aria-label="t('boards.rich.font')"
          >
            <select
              :aria-label="t('boards.rich.font')"
              :value="editor.getAttributes('boardStyle').font ?? 'handwritten'"
              @change="select($event, 'font')"
            >
              <option value="handwritten">{{ t('boards.textFonts.handwritten') }}</option>
              <option value="sans">{{ t('boards.textFonts.sans') }}</option>
            </select>
            <div class="rich-size-control">
              <button
                type="button"
                data-size-decrease
                :aria-label="t('boards.rich.decreaseSize')"
                :title="t('boards.rich.decreaseSize')"
                :disabled="currentFontSize <= 8"
                @mousedown.prevent
                @click="stepFontSize(-1)"
              >
                <Minus :size="14" />
              </button>
              <input
                v-model="fontSizeDraft"
                data-font-size
                type="number"
                min="8"
                max="72"
                step="1"
                :aria-label="t('boards.rich.size')"
                @change="commitFontSize()"
                @keydown.enter.prevent="commitFontSize(true)"
                @keydown.esc.prevent="cancelFontSize"
              />
              <button
                type="button"
                data-size-increase
                :aria-label="t('boards.rich.increaseSize')"
                :title="t('boards.rich.increaseSize')"
                :disabled="currentFontSize >= 72"
                @mousedown.prevent
                @click="stepFontSize(1)"
              >
                <Plus :size="14" />
              </button>
            </div>
          </div>
          <div
            class="rich-control-group rich-size-presets"
            role="group"
            :aria-label="t('boards.rich.sizePresets')"
          >
            <button
              v-for="size in BOARD_FONT_SIZE_PRESETS"
              :key="size"
              type="button"
              :data-font-size-preset="size"
              :aria-label="`${t('boards.rich.size')}: ${size} px`"
              :title="`${size} px`"
              :aria-pressed="currentFontSize === size"
              @mousedown.prevent
              @click="chooseFontSize(size)"
            >
              {{ size }}<span aria-hidden="true">px</span>
            </button>
          </div>
          <div
            class="rich-control-group"
            role="group"
            :aria-label="t('boards.rich.format')"
          >
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
          </div>
          <BoardColorPresets
            :colors="PEN_COLORS"
            :value="editor.getAttributes('boardStyle').color"
            :label="t('boards.penColors')"
            @choose="style('color', $event)"
          />
          <div
            class="rich-control-group rich-organization-controls"
            role="group"
            :aria-label="t('boards.rich.organization')"
          >
            <span class="rich-group-heading">{{ t('boards.rich.organization') }}</span>
            <button
              v-for="value in ['left', 'center', 'right']"
              :key="value"
              type="button"
              :aria-label="t(`boards.rich.${value}`)"
              :aria-pressed="editor.isActive('paragraph', { textAlign: value })"
              @mousedown.prevent
              @click="align(value)"
            >
              <component
                :is="
                  value === 'left'
                    ? AlignLeft
                    : value === 'right'
                      ? AlignRight
                      : AlignCenter
                "
                :size="16"
              />
            </button>
            <button
              type="button"
              :aria-label="t('boards.rich.bullet')"
              :aria-pressed="editor.isActive('bulletList')"
              @mousedown.prevent
              @click="editor.chain().focus().toggleBulletList().run()"
            >
              <List :size="16" />
            </button>
            <button
              type="button"
              :aria-label="t('boards.rich.ordered')"
              :aria-pressed="editor.isActive('orderedList')"
              @mousedown.prevent
              @click="editor.chain().focus().toggleOrderedList().run()"
            >
              <ListOrdered :size="16" />
            </button>
          </div>
          <div
            class="rich-control-group"
            role="group"
            :aria-label="t('boards.rich.clear')"
          >
            <button
              type="button"
              :aria-label="t('boards.rich.clear')"
              @mousedown.prevent
              @click="editor.chain().focus().unsetAllMarks().run()"
            >
              Tx
            </button>
          </div>
          <div
            class="rich-notation-tools"
            role="group"
            aria-label="Rough Notation"
          >
            <span class="rich-notation-heading">Rough Notation</span>
            <button
              v-for="type in annotationTypes"
              :key="type"
              type="button"
              :data-annotation-quick="type"
              :aria-label="`${t(`boards.notation.types.${type}`)} — Rough Notation`"
              :title="t(`boards.notation.types.${type}`)"
              :aria-pressed="currentAnnotation?.type === type"
              @mousedown.prevent
              @click="chooseQuickAnnotation(type)"
            >
              <svg
                viewBox="0 0 42 26"
                width="26"
                height="20"
                aria-hidden="true"
              >
                <path
                  v-if="type === 'highlight'"
                  d="M5 13 Q21 11 37 13"
                  stroke="#fde875"
                  stroke-width="16"
                  opacity=".75"
                />
                <text
                  x="21"
                  y="17"
                  text-anchor="middle"
                  font-family="Arial, sans-serif"
                  font-size="13"
                  fill="#263238"
                >
                  Abc
                </text>
                <g
                  fill="none"
                  stroke="#b56f22"
                  stroke-width="1.5"
                  stroke-linecap="round"
                >
                  <path
                    v-if="type === 'underline'"
                    d="M5 22 Q20 21 37 22"
                  />
                  <path
                    v-else-if="type === 'box'"
                    d="M3 3 L39 4 L38 23 L4 22 Z"
                  />
                  <ellipse
                    v-else-if="type === 'circle'"
                    cx="21"
                    cy="13"
                    rx="19"
                    ry="11"
                  />
                  <path
                    v-else-if="type === 'strike-through'"
                    d="M4 12 Q22 14 38 12"
                  />
                  <path
                    v-else-if="type === 'crossed-off'"
                    d="M4 3 L38 23 M38 3 L4 23"
                  />
                  <path
                    v-else-if="type === 'bracket'"
                    d="M8 3 L3 3 L4 23 L9 23 M34 3 L39 3 L38 23 L33 23"
                  />
                </g>
              </svg>
            </button>
            <button
              type="button"
              data-annotation-menu
              :aria-label="t('boards.notation.options')"
              :title="t('boards.notation.options')"
              :aria-expanded="annotationOpen"
              @mousedown.prevent
              @click="annotationOpen = !annotationOpen"
            >
              <SlidersHorizontal :size="15" />
            </button>
            <button
              type="button"
              data-annotation-remove
              :aria-label="t('boards.notation.remove')"
              :title="t('boards.notation.remove')"
              :disabled="!currentAnnotation"
              @mousedown.prevent
              @click="setAnnotation(null)"
            >
              <X :size="15" />
            </button>
          </div>
          <div
            class="rich-control-group"
            data-notation-colors
          >
            <span class="rich-group-heading">{{ t('boards.notation.color') }}</span>
            <BoardColorPresets
              :colors="
                currentAnnotation?.type === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS
              "
              :value="notationColor"
              :label="t('boards.notation.color')"
              @choose="chooseNotationColor"
            />
            <input
              type="color"
              data-notation-color
              :aria-label="t('boards.notation.color')"
              :value="notationColor"
              @input="chooseNotationColor(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div
            class="rich-control-group rich-action-controls"
            role="group"
            :aria-label="t('boards.rich.actions')"
          >
            <button
              type="button"
              :aria-label="t('boards.undo')"
              :disabled="!editor.can().undo() && !externalUndoAvailable"
              @mousedown.prevent
              @click="performHistory('undo')"
            >
              ↶
            </button>
            <button
              type="button"
              :aria-label="t('boards.redo')"
              :disabled="!editor.can().redo() && !externalRedoAvailable"
              @mousedown.prevent
              @click="performHistory('redo')"
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
        </div>
        <div
          v-if="annotationOpen"
          class="rich-annotation-panel"
          role="dialog"
          :aria-label="t('boards.notation.title')"
          @pointerdown.stop
          @keydown.esc.capture.stop.prevent="annotationOpen = false"
        >
          <p class="rich-annotation-hint">{{ t('boards.notation.selectionHint') }}</p>
          <BoardAnnotationControls
            :model-value="currentAnnotation"
            @update:model-value="setAnnotation"
            @replay="annotationReplay++"
          />
        </div>
      </div>
    </Teleport>
    <svg
      class="rich-notation-preview behind"
      aria-hidden="true"
    >
      <BoardNotation
        v-for="item in previewItems.filter(
          (item) => item.shape.config.type === 'highlight'
        )"
        :key="item.shape.seed"
        :shape="item.shape"
        :replay="annotationReplay"
        :group-delay="item.groupDelay"
        preview-only
      />
    </svg>
    <EditorContent :editor="editor" />
    <svg
      class="rich-notation-preview"
      aria-hidden="true"
    >
      <BoardNotation
        v-for="item in previewItems.filter(
          (item) => item.shape.config.type !== 'highlight'
        )"
        :key="item.shape.seed"
        :shape="item.shape"
        :replay="annotationReplay"
        :group-delay="item.groupDelay"
        preview-only
      />
    </svg>
  </div>
</template>

<style scoped>
.board-rich-editor {
  position: relative;
  color: #263238;
  background: transparent;
  outline: 1px dashed #94a3b8;
}
.rich-notation-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 2;
}
.rich-notation-preview.behind {
  z-index: 0;
}
.rich-annotation-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 310px;
  max-height: min(420px, 55vh);
  overflow: auto;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #263238;
  box-shadow: 0 6px 24px #0002;
  z-index: 5;
}
.rich-annotation-hint {
  margin: 0 0 10px;
  font:
    12px/1.5 Arial,
    sans-serif;
  color: #64748b;
}
.rich-detached-controls {
  position: absolute;
  top: 72px;
  right: 12px;
  width: min(350px, calc(100% - 24px));
  max-height: calc(100% - 145px);
  overflow: auto;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: white;
  color: #263238;
  box-shadow: 0 6px 24px #0002;
  z-index: 8;
}
.rich-detached-controls .rich-toolbar {
  position: static;
  min-width: 0;
  max-width: none;
  box-shadow: none;
  border: 0;
  padding: 10px;
}
.rich-detached-controls .rich-annotation-panel {
  position: static;
  box-sizing: border-box;
  width: 100%;
  max-height: none;
  box-shadow: none;
  border: 0;
  border-top: 1px solid #e2e8f0;
  border-radius: 0;
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
.rich-control-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}
.rich-control-group + .rich-control-group {
  padding-top: 7px;
  margin-top: 4px;
  border-top: 1px solid #e2e8f0;
}
.rich-size-presets button {
  flex: 1;
  min-height: 32px;
  font-weight: 600;
}
.rich-size-presets button span {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 400;
}
.rich-group-heading {
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}
.rich-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
}
.rich-type-controls > select:first-child {
  flex: 1;
  min-width: 100px;
}
.rich-size-control {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.rich-toolbar .rich-size-control input {
  box-sizing: border-box;
  width: 50px;
  height: 32px;
  border-radius: 4px;
  text-align: center;
  font: inherit;
}
.rich-size-presets {
  width: 100%;
}
.rich-action-controls button:last-child {
  margin-left: auto;
  background: #dbeafe;
}
.rich-toolbar :is(button, input, select):focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.rich-notation-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  flex-basis: 100%;
  margin-top: 3px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
}
.rich-notation-heading {
  flex-basis: 100%;
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}
.rich-notation-tools button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  width: 32px;
  min-width: 32px;
  min-height: 30px;
}
.rich-toolbar input {
  width: 28px;
  height: 28px;
  padding: 1px;
  border: 1px solid #e2e8f0;
}
:deep(.tiptap) {
  position: relative;
  z-index: 1;
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
