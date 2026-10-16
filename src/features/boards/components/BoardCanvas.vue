<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MousePointer2,
  Hand,
  RectangleHorizontal,
  Circle,
  MoveUpRight,
  Pencil,
  PenTool,
  RotateCcw,
  RotateCw,
  Type,
  StickyNote,
  ImagePlus,
  Frame,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Scan,
  Copy,
  Layers,
  Trash2,
  X,
  Play,
  LockKeyhole,
} from '@lucide/vue'
import type {
  BoardColor,
  BoardElement,
  BoardElementKind,
  BoardPoint,
  BoardStrokeStyle,
  BoardTextFont,
  BoardTextHighlight,
  BoardRichText,
  BoardTextBackground,
  BoardTextAlign,
  BoardTextVerticalAlign,
  PaperBackground,
  PaperColorScheme,
  BoardTextAnnotation,
  BoardDrawBrush,
} from '@/shared/types/board'
import BoardSketch from './BoardSketch.vue'
import BoardArtisticBrush from './BoardArtisticBrush.vue'
import PaperBrushLibrary from '@/features/papers/components/PaperBrushLibrary.vue'
import {
  brushPresets,
  renderArtisticBrush,
  applyBrushRaster,
  releaseArtisticBrushes,
} from '../lib/artistic-brush'
import PaperToolWheel from './PaperToolWheel.vue'
import BoardLabel from './BoardLabel.vue'
import BoardRichLabel from './BoardRichLabel.vue'
import BoardRichTextEditor from './BoardRichTextEditor.vue'
import BoardAnnotationControls from './BoardAnnotationControls.vue'
import PaperElementControls from './PaperElementControls.vue'
import { arrangeElements, type Arrangement } from '../lib/arrange'
import { finishNotationExport, safeAnnotation } from '../lib/notation'
import {
  fitRichText,
  layoutRichText,
  plainToRich,
  richTextPlain,
  richAnnotationShapes,
} from '../lib/rich-text'
import { loadBoardFont, embedBoardFont } from '../lib/font'
import { boardInkColor, fitBoardText, textVerticalOffset } from '../lib/label'
import { saveBoardPng } from '@/shared/lib/boards/board-export.service'
import { appendPaperBackground, paperBackgroundStyle } from '../lib/background'
import {
  bounds,
  connectorPoints,
  exportSize,
  MAX_POINTS,
  normalizedStroke,
  worldPoint,
  zoomAt,
  pointInElement,
  resizeElement,
  normalizeAngle,
  type ResizeOptions,
  type Camera,
} from '../lib/geometry'
import { boardImage } from '../lib/image'
import { copyElements, createHistory, sameElements } from '../model/history'
import { isWritingBrush } from '../lib/writing'
import { resizeTextElement } from '../lib/resize-text'

const props = defineProps<{
  elements: BoardElement[]
  taskTitles?: Record<string, { title: string; status: string }>
  distractionFree?: boolean
  background?: PaperBackground
  colorScheme?: PaperColorScheme
  readOnly?: boolean
}>()
const emit = defineEmits<{
  change: [elements: BoardElement[]]
  select: [id: string | null]
  lockPaper: []
  interact: []
}>()
const { t } = useI18n()
const viewport = ref<HTMLDivElement>()
const svg = ref<SVGSVGElement>()
const imageInput = ref<HTMLInputElement>()
const textInput = ref<HTMLTextAreaElement>()
const local = ref(copyElements(props.elements))
const camera = ref<Camera>({ x: 40, y: 40, zoom: 1 })
const tool = ref<BoardElementKind | 'select' | 'pan'>(
  props.elements.length ? 'select' : 'draw'
)
const tools = [
  { id: 'select', icon: MousePointer2, shortcut: 'V' },
  { id: 'pan', icon: Hand, shortcut: 'H' },
  { id: 'rectangle', icon: RectangleHorizontal, shortcut: 'R' },
  { id: 'ellipse', icon: Circle, shortcut: 'O' },
  { id: 'arrow', icon: MoveUpRight, shortcut: 'A' },
  { id: 'draw', icon: Pencil, shortcut: 'P' },
  { id: 'pen', icon: PenTool, shortcut: 'B' },
  { id: 'text', icon: Type, shortcut: 'T' },
  { id: 'note', icon: StickyNote, shortcut: 'N' },
  { id: 'image', icon: ImagePlus, shortcut: '' },
  { id: 'frame', icon: Frame, shortcut: 'F' },
] as const
const keepTool = ref(!props.elements.length)
const viewportSize = ref({ width: 640, height: 480 })
let resizeObserver: ResizeObserver | undefined
const colors: BoardColor[] = ['neutral', 'amber', 'sage', 'blue', 'rose', 'purple']
const color = ref<BoardColor>('neutral')
const strokeStyle = ref<BoardStrokeStyle>('pencil')
const drawBrush = ref<BoardDrawBrush | null>(null)
const brushLibraryOpen = ref(false)
const brushFallback = ref(false)
const strokeStyles: BoardStrokeStyle[] = ['pencil', 'pen', 'clean']
const settingsOpen = ref(false)
const brushWidth = ref(1.5)
const brushOpacity = ref(1)
const customColor = ref<string | null>(null)
const shapeFill = ref<string | null>(null)
const selectionPropertiesOpen = ref(true)
const activeWheelTool = computed(() =>
  tool.value === 'draw' && strokeStyle.value === 'pen' ? 'pen' : tool.value
)
const styleElement = computed(() =>
  tool.value === 'select' ? selectedElement.value : undefined
)
const wheelColor = computed(() =>
  boardInkColor(
    styleElement.value ??
      ({ color: color.value, strokeColor: customColor.value } as BoardElement)
  )
)
const wheelWidth = computed(
  () =>
    styleElement.value?.strokeWidth ??
    (styleElement.value
      ? styleElement.value.strokeStyle === 'pencil'
        ? 1.5
        : 2
      : brushWidth.value)
)
const wheelOpacity = computed(() => styleElement.value?.opacity ?? brushOpacity.value)
const penColorsAvailable = computed(() => {
  const element = styleElement.value
  if (element ? element.kind !== 'draw' : tool.value !== 'draw') return false
  const material = element?.drawBrush ?? drawBrush.value
  return (
    material === 'ink' ||
    material === 'fountain' ||
    (!material && (element?.strokeStyle ?? strokeStyle.value) === 'pen')
  )
})
const textFont = ref<BoardTextFont>('handwritten')
const textHighlight = ref<BoardTextHighlight>('none')
const textAnnotation = ref<BoardTextAnnotation | null>(null)
const notationReplay = ref(0)
const notationGroupDelays = computed(() => {
  const result: Record<string, number> = {}
  if (!notationReplay.value) return result
  let delay = 0
  for (const element of local.value) {
    result[element.id] = delay
    const shapes = richAnnotationShapes(
      element,
      layoutRichText(element, element.richText ?? plainToRich(element.text, element))
    )
    for (const shape of shapes)
      if (shape.config.animate)
        delay += shape.config.animationDelay + shape.config.animationDuration
  }
  return result
})
const hasAnnotations = computed(() =>
  local.value.some(
    (element) =>
      element.textAnnotation ||
      element.richText?.paragraphs.some((paragraph) =>
        paragraph.runs.some((run) => run.annotation)
      )
  )
)
const hasAnimatedAnnotations = computed(() =>
  local.value.some(
    (element) =>
      element.textAnnotation?.animate ||
      element.richText?.paragraphs.some((paragraph) =>
        paragraph.runs.some((run) => run.annotation?.animate)
      )
  )
)
const textBackground = ref<BoardTextBackground>('none')
const textAlign = ref<BoardTextAlign>('left')
const textVerticalAlign = ref<BoardTextVerticalAlign>('top')
const textBackgrounds: BoardTextBackground[] = ['none', 'rectangle', 'ellipse']
const textAlignments: BoardTextAlign[] = ['left', 'center', 'right']
const textVerticalAlignments: BoardTextVerticalAlign[] = ['top', 'middle', 'bottom']
const fontReady = ref(0)
const textFonts: BoardTextFont[] = ['handwritten', 'sans']
const canHaveText = (element: BoardElement) =>
  !['arrow', 'draw', 'image'].includes(element.kind)
const canHaveFill = (element: BoardElement) =>
  canHaveText(element) &&
  (element.kind !== 'text' || (element.textBackground ?? 'none') !== 'none')
const fillAvailable = computed(() =>
  selected.value.length
    ? local.value.some(
        (element) => selected.value.includes(element.id) && canHaveFill(element)
      )
    : ['rectangle', 'ellipse', 'frame', 'note', 'question', 'decision', 'task'].includes(
        tool.value
      ) ||
      (tool.value === 'text' && textBackground.value !== 'none')
)
const selectedFill = computed(() => {
  const fills = new Set(
    local.value
      .filter((element) => selected.value.includes(element.id) && canHaveFill(element))
      .map((element) => element.fillColor ?? null)
  )
  return selected.value.length
    ? fills.size === 1
      ? [...fills][0]
      : undefined
    : shapeFill.value
})
const selectedFontSize = computed(() =>
  currentTextStyle(
    (element) => {
      const sizes = new Set(
        toPlainRich(element).paragraphs.flatMap((paragraph) =>
          paragraph.runs.map((run) => run.fontSize)
        )
      )
      return sizes.size === 1 ? [...sizes][0] : undefined
    },
    textFont.value === 'handwritten' ? 22 : 14
  )
)
const selectedTextColor = computed(() =>
  currentTextStyle((element) => {
    const colors = new Set(
      toPlainRich(element).paragraphs.flatMap((paragraph) =>
        paragraph.runs.map((run) => run.color)
      )
    )
    return colors.size === 1 ? [...colors][0] : undefined
  }, '#263238')
)
const movableCount = computed(
  () =>
    local.value.filter(
      (element) => selected.value.includes(element.id) && element.kind !== 'arrow'
    ).length
)
const showTextStyle = computed(() =>
  selected.value.length
    ? local.value.some(
        (element) => selected.value.includes(element.id) && canHaveText(element)
      )
    : ['text', 'note', 'rectangle', 'ellipse', 'frame'].includes(tool.value)
)
function currentTextStyle<T>(
  value: (element: BoardElement) => T,
  fallback: T
): T | undefined {
  const values = new Set(
    local.value
      .filter((element) => selected.value.includes(element.id) && canHaveText(element))
      .map(value)
  )
  return selected.value.length
    ? values.size === 1
      ? [...values][0]
      : undefined
    : fallback
}
const selectedTextFont = computed(() =>
  currentTextStyle((element) => element.textFont ?? 'sans', textFont.value)
)
const selectedTextBackground = computed(() =>
  currentTextStyle((element) => element.textBackground ?? 'none', textBackground.value)
)
const selectedTextAlign = computed(() =>
  currentTextStyle((element) => {
    const alignments = element.richText?.paragraphs.map((paragraph) => paragraph.align)
    return alignments?.length
      ? alignments.every((align) => align === alignments[0])
        ? alignments[0]
        : undefined
      : (element.textAlign ?? 'left')
  }, textAlign.value)
)
const selectedTextVerticalAlign = computed(() =>
  currentTextStyle(
    (element) => element.textVerticalAlign ?? 'top',
    textVerticalAlign.value
  )
)
const showStrokeStyle = computed(() =>
  selected.value.length
    ? local.value.some(
        (e) =>
          selected.value.includes(e.id) &&
          (e.kind !== 'text' || (e.textBackground ?? 'none') !== 'none') &&
          e.kind !== 'image'
      )
    : !['select', 'pan', 'image'].includes(tool.value) &&
      (tool.value !== 'text' || textBackground.value !== 'none')
)
const selectedStrokeStyle = computed(() => {
  const styles = new Set(
    local.value
      .filter(
        (e) =>
          selected.value.includes(e.id) &&
          e.kind !== 'image' &&
          (e.kind !== 'text' || (e.textBackground ?? 'none') !== 'none')
      )
      .map((e) => e.strokeStyle ?? 'clean')
  )
  return selected.value.length
    ? styles.size === 1
      ? [...styles][0]
      : undefined
    : strokeStyle.value
})
const connectorEndpoints = computed(
  () =>
    new Map(
      local.value
        .filter((e) => e.kind === 'arrow')
        .map((e) => [e.id, connectorPoints(e, local.value)])
    )
)
const selected = ref<string[]>([])
const space = ref(false)
const editing = ref<string | null>(null)
const draft = ref('')
const richDraft = ref<BoardRichText | null>(null)
const richEditor = ref<InstanceType<typeof BoardRichTextEditor>>()
const error = ref('')
const history = createHistory()
let textCreationBefore: BoardElement[] | null = null
const historyVersion = ref(0)
const canUndo = computed(() => {
  void historyVersion.value
  return history.canUndo
})
const canRedo = computed(() => {
  void historyVersion.value
  return history.canRedo
})
let disposed = false
type ResizeHandle = ResizeOptions['handle']
type Gesture = {
  mode: 'pan' | 'move' | 'create' | 'marquee' | 'resize' | 'rotate'
  pointer: number
  start: BoardPoint
  before: BoardElement[]
  camera: Camera
  id?: string
  stroke?: BoardPoint[]
  end?: BoardPoint
  handle?: ResizeHandle
}
const gesture = ref<Gesture | null>(null)
const selectedElement = computed(() =>
  selected.value.length === 1
    ? local.value.find((element) => element.id === selected.value[0])
    : undefined
)
const rotatableElement = computed(() =>
  selectedElement.value?.kind !== 'arrow' ? selectedElement.value : undefined
)
function rotationTransform(element?: BoardElement) {
  return element && element.kind !== 'arrow' && element.angle
    ? `rotate(${(element.angle * 180) / Math.PI} ${element.x + element.width / 2} ${element.y + element.height / 2})`
    : undefined
}
const selectionBox = computed(() =>
  rotatableElement.value
    ? {
        x: rotatableElement.value.x,
        y: rotatableElement.value.y,
        width: rotatableElement.value.width,
        height: rotatableElement.value.height,
      }
    : selected.value.length
      ? bounds(
          local.value.filter((e) => selected.value.includes(e.id)),
          local.value
        )
      : null
)
const selectedArrow = computed(() =>
  selected.value.length === 1
    ? local.value.find((e) => e.id === selected.value[0] && e.kind === 'arrow')
    : undefined
)
const resizeHandles = computed(() => {
  const box = selectionBox.value
  if (!box || !rotatableElement.value) return []
  return [
    { id: 'nw' as const, x: box.x, y: box.y, cursor: 'nwse-resize' },
    { id: 'ne' as const, x: box.x + box.width, y: box.y, cursor: 'nesw-resize' },
    { id: 'sw' as const, x: box.x, y: box.y + box.height, cursor: 'nesw-resize' },
    {
      id: 'se' as const,
      x: box.x + box.width,
      y: box.y + box.height,
      cursor: 'nwse-resize',
    },
  ]
})
const showStyle = computed(
  () =>
    !isEditingFreeText.value &&
    (settingsOpen.value ||
      selected.value.length > 0 ||
      !['select', 'pan', 'image'].includes(tool.value))
)
const textEditorStyle = computed(() => {
  const element = local.value.find((e) => e.id === editing.value)
  if (!element) return {}
  const width = Math.min(300, viewportSize.value.width - 24)
  return {
    width: `${width}px`,
    left: `${Math.max(12, Math.min(viewportSize.value.width - width - 12, element.x * camera.value.zoom + camera.value.x))}px`,
    top: `${Math.max(72, Math.min(Math.max(72, viewportSize.value.height - 210), element.y * camera.value.zoom + camera.value.y))}px`,
  }
})
const editingElement = computed(() =>
  local.value.find((element) => element.id === editing.value)
)
const isEditingFreeText = computed(
  () => !!editingElement.value && canHaveText(editingElement.value)
)
const freeTextEditorStyle = computed(() => {
  const element = editingElement.value
  if (!element) return {}
  void fontReady.value
  const naturalSize = richDraft.value
    ? fitRichText(element, richDraft.value)
    : fitBoardText(element, draft.value)
  const size =
    element.kind === 'text'
      ? naturalSize
      : { width: element.width, height: element.height }
  const contentHeight = richDraft.value
    ? layoutRichText(element, richDraft.value).lines.reduce(
        (height, line) => height + line.height,
        0
      )
    : size.height - 18
  return {
    left: `${element.x * camera.value.zoom + camera.value.x}px`,
    top: `${element.y * camera.value.zoom + camera.value.y}px`,
    width: `${element.textAutoWidth ? Math.max(240, size.width) : size.width}px`,
    minHeight: `${size.height}px`,
    '--text-vertical-offset': `${textVerticalOffset({ ...element, height: size.height }, contentHeight)}px`,
    '--paper-ink-opacity': element.opacity ?? 1,
    transform: `scale(${camera.value.zoom}) translate(${element.width / 2}px, ${element.height / 2}px) rotate(${element.angle ?? 0}rad) translate(${-element.width / 2}px, ${-element.height / 2}px)`,
  }
})
const gridStyle = computed(() =>
  paperBackgroundStyle(props.background, props.colorScheme, camera.value)
)
function chooseTool(id: (typeof tools)[number]['id']) {
  const sameBrush =
    !drawBrush.value &&
    tool.value === 'draw' &&
    strokeStyle.value === (id === 'pen' ? 'pen' : 'pencil')
  finishEditing()
  tool.value = id === 'pen' ? 'draw' : id
  if (id === 'pen' || id === 'draw') {
    drawBrush.value = null
    strokeStyle.value = id === 'pen' ? 'pen' : 'pencil'
    if (!sameBrush) brushWidth.value = id === 'pen' ? 1.6 : 1.2
    keepTool.value = true
    select([])
  } else keepTool.value = false
  closeSettings()
  selectionPropertiesOpen.value = false
  if (id === 'image') imageInput.value?.click()
  else nextTick(() => viewport.value?.focus())
}
function closeSettings() {
  settingsOpen.value = false
  brushLibraryOpen.value = false
}
function dismissOutside(event: PointerEvent) {
  if (event.target instanceof Node && !viewport.value?.contains(event.target)) {
    closeSettings()
    selectionPropertiesOpen.value = false
  }
}
watch(
  () => props.distractionFree,
  (active) => {
    if (active) closeSettings()
  }
)
function chooseBaseInstrument(id: 'draw' | 'pen') {
  if (tool.value === 'select' && selectedElement.value?.kind === 'draw') {
    drawBrush.value = null
    strokeStyle.value = id === 'draw' ? 'pencil' : 'pen'
    const before = copyElements(local.value)
    for (const element of local.value)
      if (selected.value.includes(element.id) && element.kind === 'draw') {
        element.drawBrush = null
        element.strokeStyle = id === 'draw' ? 'pencil' : 'pen'
      }
    commit(before)
    closeSettings()
    selectionPropertiesOpen.value = false
  } else chooseTool(id)
}
const instrumentBrush = computed(() =>
  tool.value === 'select' && selectedElement.value?.kind === 'draw'
    ? selectedElement.value.drawBrush
    : drawBrush.value
)
const instrumentBase = computed(() => {
  if (instrumentBrush.value) return undefined
  const style =
    tool.value === 'select' && selectedElement.value?.kind === 'draw'
      ? selectedElement.value.strokeStyle
      : strokeStyle.value
  return style === 'pencil' ? 'draw' : style === 'pen' ? 'pen' : undefined
})
function chooseWheelTool(id: string) {
  const item = tools.find((tool) => tool.id === id)
  if (item) chooseTool(item.id)
}
function toggleBrushLibrary() {
  finishEditing()
  if (settingsOpen.value && brushLibraryOpen.value) {
    closeSettings()
    return
  }
  brushLibraryOpen.value = true
  settingsOpen.value = true
  selectionPropertiesOpen.value = false
}
function toggleBrushSettings() {
  const open = !settingsOpen.value || brushLibraryOpen.value
  brushLibraryOpen.value = false
  settingsOpen.value = open
  selectionPropertiesOpen.value = false
}
function toggleSelectionProperties() {
  closeSettings()
  selectionPropertiesOpen.value = !selectionPropertiesOpen.value
}
function setDrawingBrush(next: BoardDrawBrush | null) {
  finishEditing()
  const editingStroke = tool.value === 'select' && selectedElement.value?.kind === 'draw'
  const same = drawBrush.value === next
  drawBrush.value = next
  if (editingStroke) {
    const before = copyElements(local.value)
    for (const element of local.value)
      if (element.kind === 'draw' && selected.value.includes(element.id))
        element.drawBrush = next
    commit(before)
  } else {
    select([])
    tool.value = 'draw'
    keepTool.value = true
    if (next && !same) {
      brushWidth.value = brushPresets[next].width
      brushOpacity.value = brushPresets[next].opacity
    }
  }
  if (next) strokeStyle.value = 'pen'
  closeSettings()
  selectionPropertiesOpen.value = false
  nextTick(() => viewport.value?.focus())
}
function artisticVisible(element: BoardElement) {
  const area = bounds([element], local.value),
    margin = (element.strokeWidth ?? 2) * 3
  return (
    (area.x + area.width + margin) * camera.value.zoom + camera.value.x >= 0 &&
    (area.y + area.height + margin) * camera.value.zoom + camera.value.y >= 0 &&
    (area.x - margin) * camera.value.zoom + camera.value.x <= viewportSize.value.width &&
    (area.y - margin) * camera.value.zoom + camera.value.y <= viewportSize.value.height
  )
}
const marquee = computed(() => {
  const g = gesture.value
  if (!g || g.mode !== 'marquee' || !g.end) return null
  return {
    x: Math.min(g.start.x, g.end.x),
    y: Math.min(g.start.y, g.end.y),
    width: Math.abs(g.end.x - g.start.x),
    height: Math.abs(g.end.y - g.start.y),
  }
})
const sceneTransform = computed(
  () => `translate(${camera.value.x} ${camera.value.y}) scale(${camera.value.zoom})`
)
watch(
  () => props.elements,
  (elements) => {
    if (gesture.value) return
    if (textCreationBefore && sameElements(elements, textCreationBefore)) return
    if (!sameElements(elements, local.value)) {
      local.value = copyElements(elements)
      editing.value = null
      richDraft.value = null
      textCreationBefore = null
      history.clear()
      historyVersion.value++
      selected.value = selected.value.filter((id) => elements.some((e) => e.id === id))
    }
  },
  { deep: true }
)
watch(
  () => props.readOnly,
  (locked) => {
    if (!locked) return
    if (gesture.value) local.value = copyElements(gesture.value.before)
    if (textCreationBefore) local.value = copyElements(textCreationBefore)
    textCreationBefore = null
    gesture.value = null
    editing.value = null
    richDraft.value = null
    settingsOpen.value = false
    brushLibraryOpen.value = false
    select([])
  },
  { immediate: true }
)
function select(ids: string[]) {
  if (ids.join(',') !== selected.value.join(',')) selectionPropertiesOpen.value = true
  selected.value = ids
  if (ids.length === 1) {
    const element = local.value.find((e) => e.id === ids[0])
    color.value = element?.color ?? color.value
    if (element) {
      brushWidth.value =
        element.strokeWidth ?? (element.strokeStyle === 'pencil' ? 1.5 : 2)
      brushOpacity.value = element.opacity ?? 1
      customColor.value = element.strokeColor ?? null
      shapeFill.value = element.fillColor ?? null
      if (element.kind === 'draw') drawBrush.value = element.drawBrush ?? null
    }
    if (element && canHaveText(element)) {
      textFont.value = element.textFont ?? 'sans'
      textHighlight.value = element.textHighlight ?? 'none'
      textAnnotation.value = element.textAnnotation ?? null
      textBackground.value = element.textBackground ?? 'none'
      textAlign.value = element.textAlign ?? 'left'
      textVerticalAlign.value = element.textVerticalAlign ?? 'top'
    }
    if (element && element.kind !== 'image')
      strokeStyle.value = element.strokeStyle ?? 'clean'
  }
  emit('select', ids.length === 1 ? ids[0]! : null)
}
function screen(event: { clientX: number; clientY: number }): BoardPoint {
  const rect = viewport.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}
function point(event: { clientX: number; clientY: number }) {
  const position = worldPoint(screen(event), camera.value)
  const pointer = event as PointerEvent
  return pointer.pointerType === 'pen' && Number.isFinite(pointer.pressure)
    ? { ...position, pressure: Math.max(0, Math.min(1, pointer.pressure)) }
    : position
}
function commit(before: BoardElement[]) {
  if (props.readOnly) return
  if (sameElements(before, local.value)) return
  history.push(before)
  historyVersion.value++
  emit('change', copyElements(local.value))
}
function newElement(kind: BoardElementKind, position: BoardPoint): BoardElement {
  return {
    id: crypto.randomUUID(),
    kind,
    x: position.x,
    y: position.y,
    width: kind === 'text' ? 220 : 180,
    height: kind === 'text' ? (textBackground.value === 'none' ? 60 : 100) : 120,
    text: '',
    color: color.value,
    strokeStyle: strokeStyle.value,
    ...(kind === 'draw' && drawBrush.value ? { drawBrush: drawBrush.value } : {}),
    strokeWidth: brushWidth.value,
    strokeColor: customColor.value,
    ...(!['image', 'draw', 'arrow'].includes(kind) &&
    (kind !== 'text' || textBackground.value !== 'none') &&
    shapeFill.value
      ? { fillColor: shapeFill.value }
      : {}),
    opacity: brushOpacity.value,
    textFont: textFont.value,
    textHighlight: textHighlight.value,
    ...(textAnnotation.value
      ? { textAnnotation: JSON.parse(JSON.stringify(textAnnotation.value)) }
      : {}),
    textAutoWidth: kind === 'text' && textBackground.value === 'none',
    textBackground: kind === 'text' ? textBackground.value : undefined,
    textAlign: textAlign.value,
    textVerticalAlign: textVerticalAlign.value,
    resolved: false,
    points: [],
    startId: null,
    endId: null,
    taskId: null,
    imageData: null,
  }
}
function hit(position: BoardPoint, exclude?: string): BoardElement | undefined {
  return [...local.value]
    .reverse()
    .find(
      (e) =>
        e.id !== exclude &&
        e.kind !== 'arrow' &&
        e.kind !== 'draw' &&
        pointInElement(e, position)
    )
}
function pointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 1) return
  closeSettings()
  emit('interact')
  viewport.value
    ?.querySelectorAll('details[open]')
    .forEach((menu) => menu.removeAttribute('open'))
  if (editing.value) finishEditing()
  viewport.value?.focus()
  event.preventDefault()
  const p = point(event)
  const before = copyElements(local.value)
  if (props.readOnly) {
    gesture.value = {
      mode: 'pan',
      pointer: event.pointerId,
      start: screen(event),
      before,
      camera: { ...camera.value },
    }
    viewport.value?.setPointerCapture?.(event.pointerId)
    return
  }
  const target = (event.target as Element)
    .closest('[data-element-id]')
    ?.getAttribute('data-element-id')
  if (event.button === 0 && tool.value === 'text' && target) {
    const element = local.value.find((item) => item.id === target)
    if (element && canEditText(element)) {
      startEditing(target)
      return
    }
  }
  const base = { pointer: event.pointerId, start: p, before, camera: { ...camera.value } }
  if (event.button === 1 || space.value || tool.value === 'pan') {
    gesture.value = { ...base, mode: 'pan', start: screen(event) }
  } else if (
    tool.value === 'select' &&
    (event.target as Element).getAttribute('data-rotate') &&
    rotatableElement.value
  ) {
    gesture.value = { ...base, mode: 'rotate', id: rotatableElement.value.id }
  } else if (
    tool.value === 'select' &&
    (event.target as Element).getAttribute('data-resize') &&
    selected.value.length === 1
  ) {
    gesture.value = {
      ...base,
      mode: 'resize',
      id: selected.value[0],
      handle: ((event.target as Element).getAttribute('data-resize-handle') ??
        'se') as ResizeHandle,
    }
  } else if (tool.value === 'select') {
    if (target) {
      if (event.shiftKey)
        select(
          selected.value.includes(target)
            ? selected.value.filter((id) => id !== target)
            : [...selected.value, target]
        )
      else if (!selected.value.includes(target)) select([target])
      gesture.value = { ...base, mode: 'move' }
    } else {
      if (!event.shiftKey) select([])
      gesture.value = { ...base, mode: 'marquee', end: p }
    }
  } else if (tool.value === 'image') {
    imageInput.value?.click()
    return
  } else {
    const element = newElement(tool.value, p)
    if (element.kind === 'arrow') {
      element.startId = hit(p)?.id ?? null
      element.width = 0
      element.height = 0
    }
    local.value.push(element)
    select([element.id])
    gesture.value = { ...base, mode: 'create', id: element.id, stroke: [p] }
  }
  viewport.value?.setPointerCapture?.(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  const g = gesture.value
  if (!g || g.pointer !== event.pointerId) return
  const p = point(event)
  if (g.mode === 'pan') {
    const s = screen(event)
    camera.value = {
      ...g.camera,
      x: g.camera.x + s.x - g.start.x,
      y: g.camera.y + s.y - g.start.y,
    }
  } else if (g.mode === 'move') {
    const dx = p.x - g.start.x,
      dy = p.y - g.start.y
    local.value = g.before.map((e) =>
      selected.value.includes(e.id)
        ? {
            ...e,
            x: e.x + (event.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx),
            y: e.y + (event.shiftKey && Math.abs(dx) >= Math.abs(dy) ? 0 : dy),
          }
        : e
    )
  } else if (g.mode === 'marquee') g.end = p
  else {
    const element = local.value.find((e) => e.id === g.id)
    if (!element) return
    if (g.mode === 'rotate') {
      const original = g.before.find((item) => item.id === element.id)!
      const center = {
        x: original.x + original.width / 2,
        y: original.y + original.height / 2,
      }
      let angle =
        (original.angle ?? 0) +
        Math.atan2(p.y - center.y, p.x - center.x) -
        Math.atan2(g.start.y - center.y, g.start.x - center.x)
      if (event.shiftKey) angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12
      element.angle = normalizeAngle(angle)
    } else if (g.mode === 'resize') {
      if (element.kind === 'arrow') {
        element.width = p.x - element.x
        element.height = p.y - element.y
        if (event.shiftKey)
          Object.assign(element, constrainedArrow(element.width, element.height))
        element.endId = hit(p, element.id)?.id ?? null
        return
      }
      const original = g.before.find((item) => item.id === element.id)!
      if (element.kind === 'text' && !event.ctrlKey && !event.metaKey) {
        Object.assign(
          element,
          resizeTextElement(original, p, {
            handle: g.handle ?? 'se',
            proportional: true,
            fromCenter: event.altKey,
          })
        )
        return
      }
      Object.assign(
        element,
        resizeElement(original, p, {
          handle: g.handle ?? 'se',
          proportional: event.shiftKey || event.ctrlKey || event.metaKey,
          fromCenter: event.altKey,
        })
      )
      if (element.kind === 'text') {
        element.richText = original.richText
          ? JSON.parse(JSON.stringify(original.richText))
          : original.richText
        element.textAutoWidth = false
        Object.assign(element, textDimensions(element))
      }
      if (original && element.kind === 'draw')
        element.points = original.points.map((point) => ({
          ...point,
          x: (point.x * element.width) / original.width,
          y: (point.y * element.height) / original.height,
        }))
    } else if (element.kind === 'draw') {
      const samples =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : []
      for (const sample of samples.length ? samples : [event]) {
        if (g.stroke!.length >= MAX_POINTS) break
        const next = point(sample)
        const previous = g.stroke![g.stroke!.length - 1]!
        if (
          Math.hypot(next.x - previous.x, next.y - previous.y) >=
          0.75 / camera.value.zoom
        )
          g.stroke!.push(next)
      }
      Object.assign(element, normalizedStroke(g.stroke!))
    } else if (element.kind === 'arrow') {
      element.width = p.x - g.start.x
      element.height = p.y - g.start.y
      if (event.shiftKey)
        Object.assign(element, constrainedArrow(element.width, element.height))
      element.endId = hit(p, element.id)?.id ?? null
    } else {
      element.x = Math.min(g.start.x, p.x)
      element.y = Math.min(g.start.y, p.y)
      element.width = Math.max(24, Math.abs(p.x - g.start.x))
      element.height = Math.max(24, Math.abs(p.y - g.start.y))
      if (event.shiftKey && ['rectangle', 'ellipse', 'frame'].includes(element.kind)) {
        const size = Math.max(element.width, element.height)
        element.width = size
        element.height = size
        element.x = p.x < g.start.x ? g.start.x - size : g.start.x
        element.y = p.y < g.start.y ? g.start.y - size : g.start.y
      }
      if (element.kind === 'text' && Math.abs(p.x - g.start.x) > 4)
        element.textAutoWidth = false
    }
  }
}
function pointerUp(event: PointerEvent) {
  const g = gesture.value
  if (!g || g.pointer !== event.pointerId) return
  const box = marquee.value
  if (box)
    select([
      ...new Set([
        ...selected.value,
        ...local.value
          .filter((e) => {
            const area = bounds([e], local.value)
            return (
              area.x <= box.x + box.width &&
              area.x + area.width >= box.x &&
              area.y <= box.y + box.height &&
              area.y + area.height >= box.y
            )
          })
          .map((e) => e.id),
      ]),
    ])
  if (g.mode === 'create') {
    const element = local.value.find((e) => e.id === g.id)
    if (element?.kind === 'draw') {
      const last = g.stroke![g.stroke!.length - 1]!
      const end = point(event)
      if (
        g.stroke!.length < MAX_POINTS &&
        Math.hypot(end.x - last.x, end.y - last.y) > 0.05
      )
        g.stroke!.push({
          ...end,
          ...(last.pressure !== undefined ? { pressure: last.pressure } : {}),
        })
      Object.assign(element, normalizedStroke(g.stroke!))
    }
  }
  gesture.value = null
  viewport.value?.releasePointerCapture?.(event.pointerId)
  const createdText =
    g.mode === 'create' &&
    local.value.find((element) => element.id === g.id)?.kind === 'text'
  if (createdText) textCreationBefore = g.before
  else if (g.mode !== 'pan' && g.mode !== 'marquee') commit(g.before)
  if (g.mode === 'create') {
    const element = local.value.find((e) => e.id === g.id)
    if (!keepTool.value) tool.value = 'select'
    if (
      element &&
      ['text', 'note', 'question', 'decision', 'frame'].includes(element.kind)
    )
      startEditing(element.id)
  }
}
function constrainedArrow(width: number, height: number) {
  const angle = (Math.round(Math.atan2(height, width) / (Math.PI / 4)) * Math.PI) / 4
  const length = Math.hypot(width, height)
  return { width: length * Math.cos(angle), height: length * Math.sin(angle) }
}
function cancelGesture() {
  finishEditing()
  if (gesture.value) local.value = copyElements(gesture.value.before)
  gesture.value = null
  editing.value = null
  space.value = false
  select(selected.value.filter((id) => local.value.some((e) => e.id === id)))
}
function commitPendingEdit() {
  finishEditing()
  cancelGesture()
}
function commitForExit() {
  commitPendingEdit()
}
onMounted(() => {
  void loadBoardFont()
    .then(() => {
      if (!disposed) fontReady.value++
    })
    .catch(() => {
      if (!disposed) error.value = t('boards.fontUnavailable')
    })
  window.addEventListener('praxis:commit-board-edit', commitForExit)
  document.addEventListener('pointerdown', dismissOutside, true)
  if (viewport.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) viewportSize.value = { width: rect.width, height: rect.height }
    })
    resizeObserver.observe(viewport.value)
  }
  if (local.value.length) nextTick(fitContent)
})
onBeforeUnmount(releaseArtisticBrushes)
onUnmounted(() => {
  disposed = true
  resizeObserver?.disconnect()
  window.removeEventListener('praxis:commit-board-edit', commitForExit)
  document.removeEventListener('pointerdown', dismissOutside, true)
})
function wheel(event: WheelEvent) {
  camera.value = zoomAt(
    camera.value,
    screen(event),
    camera.value.zoom * Math.exp(-event.deltaY * 0.0015)
  )
}
function zoom(factor: number) {
  camera.value = zoomAt(
    camera.value,
    {
      x: (viewport.value?.clientWidth ?? 640) / 2,
      y: (viewport.value?.clientHeight ?? 480) / 2,
    },
    camera.value.zoom * factor
  )
}
function fitContent() {
  const box = bounds(local.value)
  const width = viewport.value?.clientWidth || 640
  const height = viewport.value?.clientHeight || 480
  const zoom = Math.max(
    0.1,
    Math.min(2, (width - 80) / box.width, (height - 80) / box.height)
  )
  camera.value = {
    x: (width - box.width * zoom) / 2 - box.x * zoom,
    y: (height - box.height * zoom) / 2 - box.y * zoom,
    zoom,
  }
}
function focusElement(id: string) {
  const element = local.value.find((e) => e.id === id)
  if (!element) return
  select([id])
  camera.value.x =
    (viewport.value?.clientWidth || 640) / 2 -
    (element.x + element.width / 2) * camera.value.zoom
  camera.value.y =
    (viewport.value?.clientHeight || 480) / 2 -
    (element.y + element.height / 2) * camera.value.zoom
}
function removeSelection() {
  const before = copyElements(local.value)
  local.value = local.value
    .filter((e) => !selected.value.includes(e.id))
    .map((e) => ({
      ...e,
      startId: selected.value.includes(e.startId ?? '') ? null : e.startId,
      endId: selected.value.includes(e.endId ?? '') ? null : e.endId,
    }))
  select([])
  commit(before)
}
function duplicateSelection() {
  finishEditing()
  const before = copyElements(local.value)
  const originals = local.value.filter((e) => selected.value.includes(e.id))
  const ids = new Map(originals.map((e) => [e.id, crypto.randomUUID()]))
  const copies = copyElements(originals).map((e) => ({
    ...e,
    id: ids.get(e.id)!,
    x: e.x + 24,
    y: e.y + 24,
    startId: ids.get(e.startId ?? '') ?? e.startId,
    endId: ids.get(e.endId ?? '') ?? e.endId,
  }))
  local.value.push(...copies)
  select(copies.map((e) => e.id))
  commit(before)
}
function orderSelection(front: boolean) {
  const before = copyElements(local.value)
  const chosen = local.value.filter((e) => selected.value.includes(e.id))
  const remaining = local.value.filter((e) => !selected.value.includes(e.id))
  local.value = front ? [...remaining, ...chosen] : [...chosen, ...remaining]
  commit(before)
}
function rotateSelection(delta: number) {
  finishEditing()
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (selected.value.includes(element.id) && element.kind !== 'arrow')
      element.angle = normalizeAngle((element.angle ?? 0) + delta)
  }
  commit(before)
}
function resetRotation() {
  if (rotatableElement.value) rotateSelection(-(rotatableElement.value.angle ?? 0))
}
function moveSelection(dx: number, dy: number) {
  const before = copyElements(local.value)
  local.value.forEach((e) => {
    if (selected.value.includes(e.id)) {
      e.x += dx
      e.y += dy
    }
  })
  commit(before)
}
function undo() {
  if (props.readOnly) return
  cancelGesture()
  const elements = history.undo(local.value)
  historyVersion.value++
  if (elements) {
    local.value = elements
    select([])
    emit('change', copyElements(elements))
    nextTick(() => viewport.value?.focus())
  }
}
function redo() {
  if (props.readOnly) return
  cancelGesture()
  const elements = history.redo(local.value)
  historyVersion.value++
  if (elements) {
    local.value = elements
    select([])
    emit('change', copyElements(elements))
    nextTick(() => viewport.value?.focus())
  }
}
function historyKeyboard(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return
  const key = event.key.toLowerCase()
  if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(key)) return
  if ((event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))
    return
  // The text editor owns its own undo stack until the edit is committed.
  if (editing.value) return
  event.preventDefault()
  event.stopPropagation()
  key === 'y' || event.shiftKey ? redo() : undo()
}
function keyboard(event: KeyboardEvent) {
  if ((event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))
    return
  if (
    props.readOnly &&
    event.code !== 'Space' &&
    event.key !== 'Escape' &&
    !((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key))
  )
    return
  if (event.code === 'Space') {
    event.preventDefault()
    space.value = true
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    select(local.value.map((element) => element.id))
  } else if (
    (event.ctrlKey || event.metaKey) &&
    ['+', '=', '-', '0'].includes(event.key)
  ) {
    event.preventDefault()
    if (event.key === '0')
      camera.value = zoomAt(
        camera.value,
        { x: viewportSize.value.width / 2, y: viewportSize.value.height / 2 },
        1
      )
    else zoom(event.key === '-' ? 0.8 : 1.25)
  } else if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    rotateSelection(
      (event.key === 'ArrowLeft' ? -1 : 1) *
        (event.shiftKey ? Math.PI / 180 : Math.PI / 12)
    )
  } else if (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    [']', '[', '}', '{'].includes(event.key)
  ) {
    event.preventDefault()
    orderSelection(event.key === ']' || event.key === '}')
  } else if (event.key === 'Escape') {
    closeSettings()
    selectionPropertiesOpen.value = false
    editing.value = null
    cancelGesture()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeSelection()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? redo() : undo()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelection()
  } else if (
    selected.value.length &&
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
  ) {
    event.preventDefault()
    const step = event.shiftKey ? 10 : 1
    moveSelection(
      event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
    )
  } else if (event.key === 'Enter' && selected.value.length === 1)
    startEditing(selected.value[0]!)
  else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    const chosen = tools.find(
      (item) => item.shortcut && item.shortcut.toLowerCase() === event.key.toLowerCase()
    )
    if (chosen) {
      event.preventDefault()
      chooseTool(chosen.id)
    }
  }
}
function startEditing(id: string) {
  if (props.readOnly) return
  closeSettings()
  if (editing.value && editing.value !== id) finishEditing()
  const element = local.value.find((e) => e.id === id)
  if (!element || !canEditText(element)) return
  select([id])
  editing.value = id
  draft.value = element.text
  richDraft.value = JSON.parse(JSON.stringify(toPlainRich(element))) as BoardRichText
  nextTick(() => richEditor.value?.focus())
}
function canEditText(element: BoardElement) {
  return canHaveText(element) && !(element.kind === 'task' && element.taskId)
}
const editableSelection = computed(() =>
  selected.value.length === 1
    ? local.value.find(
        (element) => element.id === selected.value[0] && canEditText(element)
      )
    : undefined
)
function editAtPointer(event: MouseEvent) {
  if (
    (event.target as Element).closest(
      '.board-rich-editor, .board-text-editor, .board-floating'
    )
  )
    return
  if (event.button !== 0 || space.value || tool.value === 'pan') return
  const target = hit(point(event))
  if (!target || !canEditText(target)) return
  if (gesture.value) {
    local.value = copyElements(gesture.value.before)
    gesture.value = null
  }
  startEditing(target.id)
}
function toPlainRich(element: BoardElement): BoardRichText {
  return element.richText ?? plainToRich(element.text, element)
}
function textDimensions(element: BoardElement) {
  return element.richText
    ? fitRichText(element, element.richText)
    : fitBoardText(element, element.text)
}
function updateRichDraft(document: BoardRichText) {
  richDraft.value = document
  draft.value = richTextPlain(document)
}
function finishEditing() {
  if (props.readOnly) {
    editing.value = null
    richDraft.value = null
    return
  }
  const element = local.value.find((e) => e.id === editing.value)
  if (element) {
    const before = textCreationBefore ?? copyElements(local.value)
    textCreationBefore = null
    if (
      richDraft.value &&
      JSON.stringify(richDraft.value) !== JSON.stringify(toPlainRich(element))
    ) {
      element.richText = JSON.parse(JSON.stringify(richDraft.value)) as BoardRichText
      element.text = richTextPlain(element.richText)
      if (element.kind === 'text') Object.assign(element, textDimensions(element))
    } else if (!richDraft.value) element.text = draft.value.slice(0, 10000)
    if (element.kind === 'text' && !element.text.trim()) {
      local.value = local.value.filter((item) => item.id !== element.id)
      select([])
    }
    commit(before)
  }
  editing.value = null
  richDraft.value = null
}
function cancelRichEditing() {
  const element = editingElement.value
  editing.value = null
  if (textCreationBefore) {
    local.value = copyElements(textCreationBefore)
    textCreationBefore = null
    select([])
  } else if (element && !element.text) {
    const before = copyElements(local.value)
    local.value = local.value.filter((item) => item.id !== element.id)
    select([])
    commit(before)
  }
  nextTick(() => viewport.value?.focus())
  richDraft.value = null
}
function completeRichEditing() {
  finishEditing()
  nextTick(() => viewport.value?.focus())
}
function setTextAutoWidth(auto: boolean) {
  finishEditing()
  const before = copyElements(local.value)
  local.value.forEach((element) => {
    if (selected.value.includes(element.id) && element.kind === 'text') {
      element.textAutoWidth = auto
      Object.assign(element, textDimensions(element))
    }
  })
  commit(before)
}
function setColor(next: BoardColor) {
  finishEditing()
  color.value = next
  customColor.value = null
  const before = copyElements(local.value)
  local.value.forEach((e) => {
    if (tool.value === 'select' && selected.value.includes(e.id)) {
      if (canHaveText(e) && !e.richText) e.richText = plainToRich(e.text, e)
      e.color = color.value
      e.strokeColor = null
    }
  })
  commit(before)
}
function setStrokeStyle(next: BoardStrokeStyle) {
  finishEditing()
  strokeStyle.value = next
  const before = copyElements(local.value)
  local.value.forEach((element) => {
    if (
      selected.value.includes(element.id) &&
      element.kind !== 'image' &&
      (element.kind !== 'text' || (element.textBackground ?? 'none') !== 'none')
    ) {
      element.strokeStyle = next
    }
  })
  commit(before)
}
function setBrush(patch: {
  strokeWidth?: number
  opacity?: number
  strokeColor?: string
}) {
  finishEditing()
  if (patch.strokeWidth !== undefined)
    brushWidth.value = Math.min(32, Math.max(0.5, patch.strokeWidth))
  if (patch.opacity !== undefined)
    brushOpacity.value = Math.min(1, Math.max(0.05, patch.opacity))
  if (patch.strokeColor) customColor.value = patch.strokeColor
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (tool.value !== 'select' || !selected.value.includes(element.id)) continue
    if (patch.opacity !== undefined) element.opacity = brushOpacity.value
    if (element.kind !== 'image') {
      if (patch.strokeWidth !== undefined) element.strokeWidth = brushWidth.value
      if (patch.strokeColor) {
        if (canHaveText(element) && !element.richText)
          element.richText = plainToRich(element.text, element)
        element.strokeColor = customColor.value
      }
    }
  }
  commit(before)
}
function setTextStyle(patch: {
  textFont?: BoardTextFont
  textHighlight?: BoardTextHighlight
}) {
  finishEditing()
  if (patch.textFont) textFont.value = patch.textFont
  if (patch.textHighlight) textHighlight.value = patch.textHighlight
  const before = copyElements(local.value)
  local.value.forEach((element) => {
    if (selected.value.includes(element.id) && canHaveText(element))
      Object.assign(element, patch)
    if (selected.value.includes(element.id) && canHaveText(element)) {
      if (element.richText)
        element.richText.paragraphs.forEach((paragraph) =>
          paragraph.runs.forEach((run) => {
            if (patch.textFont) run.font = patch.textFont
            if (patch.textHighlight) run.highlight = patch.textHighlight
          })
        )
      if (element.kind === 'text') Object.assign(element, textDimensions(element))
    }
  })
  commit(before)
}
function setTextAnnotation(annotation: BoardTextAnnotation | null) {
  finishEditing()
  annotation = safeAnnotation(annotation)
  textAnnotation.value = annotation
  textHighlight.value = 'none'
  const before = copyElements(local.value)
  for (const element of local.value)
    if (selected.value.includes(element.id) && canHaveText(element)) {
      element.textAnnotation = annotation ? JSON.parse(JSON.stringify(annotation)) : null
      element.textHighlight = 'none'
      for (const paragraph of element.richText?.paragraphs ?? [])
        for (const run of paragraph.runs) {
          run.highlight = 'none'
        }
    }
  commit(before)
}
function setFillColor(next: string | null) {
  finishEditing()
  if (next !== null && next !== 'transparent' && !/^#[0-9a-f]{6}$/i.test(next)) return
  shapeFill.value = next
  const before = copyElements(local.value)
  for (const element of local.value)
    if (selected.value.includes(element.id) && canHaveFill(element))
      element.fillColor = next
  commit(before)
}
function setElementText(patch: { fontSize?: number; color?: string }) {
  finishEditing()
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (!selected.value.includes(element.id) || !canEditText(element)) continue
    element.richText = JSON.parse(JSON.stringify(toPlainRich(element))) as BoardRichText
    for (const paragraph of element.richText.paragraphs)
      for (const run of paragraph.runs) {
        if (patch.fontSize !== undefined)
          run.fontSize = Math.round(Math.max(8, Math.min(72, patch.fontSize)))
        if (patch.color) run.color = patch.color
      }
    if (element.kind === 'text') Object.assign(element, textDimensions(element))
  }
  commit(before)
}
function organizeSelection(action: Arrangement) {
  finishEditing()
  const before = copyElements(local.value)
  arrangeElements(local.value, selected.value, action)
  commit(before)
}
function setTextBackground(next: BoardTextBackground) {
  finishEditing()
  textBackground.value = next
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (!selected.value.includes(element.id) || element.kind !== 'text') continue
    element.textBackground = next
    if (next === 'none') element.fillColor = null
    if (next !== 'none') {
      element.textAutoWidth = false
      element.width = Math.max(120, element.width)
      element.height = Math.max(80, element.height)
    }
    Object.assign(element, textDimensions(element))
  }
  commit(before)
}
function setTextAlignment(patch: {
  textAlign?: BoardTextAlign
  textVerticalAlign?: BoardTextVerticalAlign
}) {
  finishEditing()
  if (patch.textAlign) textAlign.value = patch.textAlign
  if (patch.textVerticalAlign) textVerticalAlign.value = patch.textVerticalAlign
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (!selected.value.includes(element.id) || !canHaveText(element)) continue
    Object.assign(element, patch)
    if (patch.textAlign && element.richText)
      for (const paragraph of element.richText.paragraphs)
        paragraph.align = patch.textAlign
  }
  commit(before)
}
async function addImage(file: File, position?: BoardPoint) {
  if (props.readOnly) return
  try {
    const image = await boardImage(file)
    if (disposed || props.readOnly) return
    const p =
      position ??
      worldPoint(
        {
          x: (viewport.value?.clientWidth || 640) / 2,
          y: (viewport.value?.clientHeight || 480) / 2,
        },
        camera.value
      )
    const element = newElement('image', p)
    const scale = Math.min(1, 500 / Math.max(image.width, image.height))
    Object.assign(element, {
      imageData: image.data,
      width: image.width * scale,
      height: image.height * scale,
      text: file.name,
    })
    const before = copyElements(local.value)
    local.value.push(element)
    select([element.id])
    commit(before)
    error.value = ''
    tool.value = 'select'
  } catch {
    error.value = t('boards.imageRejected')
  }
}
function fileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) void addImage(input.files[0])
  input.value = ''
}
function drop(event: DragEvent) {
  if (props.readOnly) return
  if (event.dataTransfer?.files[0])
    void addImage(event.dataTransfer.files[0], point(event))
}
function paste(event: ClipboardEvent) {
  if (props.readOnly) return
  if ((event.target as Element).closest('input,textarea,[contenteditable="true"]')) return
  const file = [...(event.clipboardData?.items ?? [])]
    .find((item) => item.type.startsWith('image/'))
    ?.getAsFile()
  if (file) {
    event.preventDefault()
    void addImage(file)
  }
}
function stroke(element: BoardElement) {
  return boardInkColor(element, props.colorScheme)
}
function labelScheme(element: BoardElement): PaperColorScheme {
  if (element.fillColor?.startsWith('#')) {
    const color = element.fillColor
    const luminance =
      0.2126 * parseInt(color.slice(1, 3), 16) +
      0.7152 * parseInt(color.slice(3, 5), 16) +
      0.0722 * parseInt(color.slice(5, 7), 16)
    return luminance < 128 ? 'dark' : 'light'
  }
  if (element.fillColor === 'transparent') return props.colorScheme ?? 'light'
  if (
    ['note', 'question', 'decision', 'task'].includes(element.kind) ||
    (element.kind === 'text' &&
      element.textBackground &&
      element.textBackground !== 'none') ||
    (element.textHighlight && element.textHighlight !== 'none') ||
    element.textAnnotation?.type === 'highlight'
  )
    return 'light'
  return props.colorScheme ?? 'light'
}
function fill(element: BoardElement) {
  if (canHaveFill(element) && element.fillColor) return element.fillColor
  if (element.kind === 'text' && (element.textBackground ?? 'none') !== 'none')
    return element.color === 'neutral'
      ? '#ffffff'
      : `color-mix(in srgb, var(--board-${element.color}) 14%, white)`
  return ['text', 'frame', 'arrow', 'draw', 'rectangle', 'ellipse'].includes(element.kind)
    ? 'transparent'
    : element.color === 'neutral'
      ? 'var(--board-note)'
      : `color-mix(in srgb, var(--board-${element.color}) 14%, white)`
}
function label(element: BoardElement) {
  return element.kind === 'task'
    ? (props.taskTitles?.[element.taskId ?? '']?.title ??
        (element.text || t('boards.taskUnavailable')))
    : element.text
}
function arrow(element: BoardElement) {
  const [a, b] = connectorPoints(element, local.value)
  return `M${a.x},${a.y} L${b.x},${b.y}`
}
function drawPath(element: BoardElement) {
  return element.points
    .map((p, i) => `${i ? 'L' : 'M'}${element.x + p.x},${element.y + p.y}`)
    .join(' ')
}
async function exportPng(title: string) {
  finishEditing()
  await loadBoardFont()
  fontReady.value++
  await nextTick()
  if (!svg.value) return
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  await embedBoardFont(clone)
  clone.querySelectorAll('[data-editor-only]').forEach((node) => node.remove())
  for (const element of local.value.filter(
    (element) => element.kind === 'draw' && element.drawBrush && !isWritingBrush(element)
  )) {
    const group = [...clone.querySelectorAll('[data-artistic-brush]')].find(
      (node) => node.getAttribute('data-artistic-brush') === element.id
    )
    const raster = await renderArtisticBrush(element, stroke(element))
    if (group && raster) applyBrushRaster(group, raster)
  }
  finishNotationExport(clone)
  const box = bounds(local.value)
  // Include anchored connector endpoints, which may extend beyond their original boxes.
  const endpoints = local.value
    .filter((e) => e.kind === 'arrow')
    .flatMap((e) => connectorPoints(e, local.value))
  const margin = Math.max(
    hasAnnotations.value ? 64 : 32,
    ...local.value
      .filter((element) => element.drawBrush)
      .map((element) => (element.strokeWidth ?? 2) * 3 + 4)
  )
  const left = Math.min(box.x, ...endpoints.map((p) => p.x)) - margin
  const top = Math.min(box.y, ...endpoints.map((p) => p.y)) - margin
  const right = Math.max(box.x + box.width, ...endpoints.map((p) => p.x)) + margin
  const bottom = Math.max(box.y + box.height, ...endpoints.map((p) => p.y)) + margin
  const size = exportSize(right - left, bottom - top)
  clone.setAttribute('width', String(size.width))
  clone.setAttribute('height', String(size.height))
  clone.setAttribute('viewBox', `${left} ${top} ${right - left} ${bottom - top}`)
  clone.querySelector('[data-scene]')?.removeAttribute('transform')
  const computedStyle = getComputedStyle(svg.value)
  const colorCanvas = document.createElement('canvas').getContext('2d')!
  function resolveColor(value: string) {
    const resolved = value.replace(/var\((--[\w-]+)\)/g, (_, token: string) =>
      computedStyle.getPropertyValue(token).trim()
    )
    const probe = document.createElement('span')
    probe.style.color = resolved
    viewport.value?.appendChild(probe)
    colorCanvas.fillStyle = getComputedStyle(probe).color
    probe.remove()
    return colorCanvas.fillStyle
  }
  clone.querySelectorAll('*').forEach((node) => {
    for (const attribute of ['fill', 'stroke']) {
      const value = node.getAttribute(attribute)
      if (value?.includes('var(')) node.setAttribute(attribute, resolveColor(value))
    }
  })
  appendPaperBackground(
    clone,
    { x: left, y: top, width: right - left, height: bottom - top },
    props.background,
    props.colorScheme
  )
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })
  )
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.drawImage(image, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('png'))),
        'image/png'
      )
    )
    await saveBoardPng(blob, title)
    error.value = ''
  } catch {
    error.value = t('boards.exportFailed')
    throw new Error(error.value)
  } finally {
    URL.revokeObjectURL(url)
  }
}
defineExpose({
  fitContent,
  exportPng,
  focusElement,
  cancelGesture,
  commitPendingEdit,
  editText: startEditing,
  isInteracting: () => Boolean(gesture.value || editing.value),
  focusCanvas: () => viewport.value?.focus(),
})
</script>

<template>
  <div
    class="board-editor"
    :class="{ 'board-distraction-free': distractionFree }"
  >
    <input
      ref="imageInput"
      class="hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      @change="fileSelected"
    />
    <div
      ref="viewport"
      class="board-viewport"
      :class="{ 'board-panning': readOnly || space || tool === 'pan' }"
      :style="gridStyle"
      tabindex="0"
      :aria-label="t('boards.canvasLabel')"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @dblclick="editAtPointer"
      @pointercancel="cancelGesture"
      @lostpointercapture="gesture && cancelGesture()"
      @wheel.prevent="wheel"
      @keydown="keyboard"
      @keydown.capture="historyKeyboard"
      @keyup="space = false"
      @blur="space = false"
      @dragover.prevent
      @drop.prevent="drop"
      @paste="paste"
    >
      <div
        v-if="readOnly"
        class="board-lock-hint board-floating"
        role="status"
      >
        <LockKeyhole :size="16" />{{ t('boards.lockedHint') }}
      </div>
      <PaperToolWheel
        v-if="!distractionFree && !readOnly"
        :tools="[...tools]"
        :active-tool="activeWheelTool"
        :color="wheelColor"
        :width="wheelWidth"
        :opacity="wheelOpacity"
        :settings-open="settingsOpen"
        :active-brush="tool === 'draw' ? drawBrush : undefined"
        :brush-library-open="settingsOpen && brushLibraryOpen"
        :pen-colors="penColorsAvailable"
        @color="setBrush({ strokeColor: $event })"
        @choose="chooseWheelTool"
        @toggle-settings="toggleBrushSettings"
        @toggle-brush-library="toggleBrushLibrary"
        @lock-paper="emit('lockPaper')"
      />
      <div
        v-if="showStyle && !distractionFree && !readOnly"
        v-show="settingsOpen"
        class="board-style-panel board-floating"
        :class="{ 'board-instruments-panel': brushLibraryOpen }"
        @pointerdown.stop
        @wheel.stop
        @keydown.esc.stop.prevent="closeSettings"
        @keydown.stop
      >
        <div class="paper-settings-heading">
          <strong>{{
            t(
              brushLibraryOpen
                ? 'boards.brushes.title'
                : styleElement
                  ? 'boards.studio.elementSettings'
                  : 'boards.studio.toolSettings'
            )
          }}</strong
          ><button
            type="button"
            :aria-label="t('common.close')"
            @click="closeSettings"
          >
            <X :size="15" />
          </button>
        </div>
        <PaperBrushLibrary
          v-if="brushLibraryOpen"
          :model-value="instrumentBrush"
          :base-tool="instrumentBase"
          @update:model-value="setDrawingBrush"
          @base="chooseBaseInstrument"
        />
        <template v-else>
          <label
            v-if="showStrokeStyle"
            class="paper-brush-setting"
            >{{ t('boards.studio.strokeSize') }} <output>{{ wheelWidth }} px</output>
            <input
              data-brush-width
              type="range"
              min="0.5"
              max="32"
              step="0.5"
              :value="wheelWidth"
              @change="
                setBrush({
                  strokeWidth: Number(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <div
            v-if="showStrokeStyle"
            class="paper-width-presets"
            role="group"
            :aria-label="t('boards.studio.quickWidths')"
          >
            <button
              v-for="width in [1, 2, 4, 8]"
              :key="width"
              type="button"
              :data-brush-preset="width"
              :aria-pressed="wheelWidth === width"
              :aria-label="`${width} px`"
              @click="setBrush({ strokeWidth: width })"
            >
              <span
                :style="{ height: `${Math.min(width, 6)}px`, background: wheelColor }"
              />{{ width }} px
            </button>
          </div>
          <label class="paper-brush-setting"
            >{{ t('boards.studio.opacity') }}
            <output>{{ Math.round(wheelOpacity * 100) }}%</output>
            <input
              data-brush-opacity
              type="range"
              min="5"
              max="100"
              step="5"
              :value="Math.round(wheelOpacity * 100)"
              @change="
                setBrush({
                  opacity: Number(($event.target as HTMLInputElement).value) / 100,
                })
              "
          /></label>
          <label
            v-if="showStrokeStyle"
            class="paper-brush-colour"
            >{{ t('boards.usability.stroke')
            }}<input
              data-brush-color
              type="color"
              :value="wheelColor"
              @change="
                setBrush({ strokeColor: ($event.target as HTMLInputElement).value })
              "
          /></label>
          <div
            v-if="rotatableElement"
            class="board-rotation-controls"
          >
            <span class="board-style-label"
              >{{ t('boards.rotation') }} ·
              {{ Math.round(((rotatableElement.angle ?? 0) * 180) / Math.PI) }}°</span
            >
            <div class="board-selection-actions">
              <button
                type="button"
                :aria-label="t('boards.rotateLeft')"
                :title="t('boards.rotateLeft')"
                @click="rotateSelection(-Math.PI / 12)"
              >
                <RotateCcw :size="17" />
              </button>
              <button
                type="button"
                :aria-label="t('boards.rotateRight')"
                :title="t('boards.rotateRight')"
                @click="rotateSelection(Math.PI / 12)"
              >
                <RotateCw :size="17" />
              </button>
            </div>
            <button
              type="button"
              class="board-reset-rotation"
              @click="resetRotation"
            >
              {{ t('boards.resetRotation') }}
            </button>
          </div>
          <span
            v-if="showStrokeStyle"
            class="board-style-label"
            >{{ t('boards.usability.stroke') }}</span
          >
          <div
            v-if="showStrokeStyle"
            class="board-swatches"
            role="group"
            :aria-label="t('boards.usability.stroke')"
          >
            <button
              v-for="item in colors"
              :key="item"
              type="button"
              class="board-swatch"
              :style="{
                '--swatch':
                  item === 'neutral' ? 'var(--board-ink)' : `var(--board-${item})`,
              }"
              :aria-label="t(`boards.colors.${item}`)"
              :title="t(`boards.colors.${item}`)"
              :aria-pressed="color === item"
              @click="setColor(item)"
            >
              <span />
            </button>
          </div>
          <div
            v-if="fillAvailable"
            class="board-tool-fill"
          >
            <label class="paper-brush-colour"
              >{{ t('boards.usability.fill')
              }}<input
                data-tool-fill
                type="color"
                :value="selectedFill?.startsWith('#') ? selectedFill : '#ffffff'"
                @change="setFillColor(($event.target as HTMLInputElement).value)"
            /></label>
            <button
              data-tool-no-fill
              type="button"
              :aria-pressed="selectedFill === 'transparent'"
              @click="setFillColor('transparent')"
            >
              {{ t('boards.usability.transparent') }}
            </button>
          </div>
          <div
            v-if="showStrokeStyle && tool !== 'draw' && selectedElement?.kind !== 'draw'"
            class="board-stroke-styles"
            role="group"
            :aria-label="t('boards.strokeStyle')"
          >
            <span class="board-style-label">{{ t('boards.strokeStyle') }}</span>
            <button
              v-for="style in strokeStyles"
              :key="style"
              type="button"
              :data-stroke-style="style"
              :aria-pressed="selectedStrokeStyle === style"
              @click="setStrokeStyle(style)"
            >
              <svg
                viewBox="0 0 44 14"
                aria-hidden="true"
              >
                <path
                  :d="
                    style === 'clean'
                      ? 'M3 7 H41'
                      : style === 'pen'
                        ? 'M3 10 Q12 1 22 7 T41 5'
                        : 'M3 9 Q12 2 22 8 T41 5 M4 8 Q13 3 23 7 T40 6'
                  "
                  fill="none"
                  :stroke="wheelColor"
                  :stroke-width="style === 'pencil' ? 1 : 2"
                  stroke-linecap="round"
                /></svg
              >{{ t(`boards.strokeStyles.${style}`) }}
            </button>
          </div>
          <details
            v-if="showTextStyle"
            class="board-text-styles"
            :open="tool === 'text' || selectedElement?.kind === 'text'"
          >
            <summary>{{ t('boards.studio.textSettings') }}</summary>
            <label
              v-if="
                local.some(
                  (element) => selected.includes(element.id) && element.kind === 'text'
                )
              "
              class="board-auto-width"
            >
              <input
                type="checkbox"
                :checked="
                  local
                    .filter(
                      (element) =>
                        selected.includes(element.id) && element.kind === 'text'
                    )
                    .every((element) => element.textAutoWidth)
                "
                @change="setTextAutoWidth(($event.target as HTMLInputElement).checked)"
              />
              {{ t('boards.textAutoWidth') }}
            </label>
            <template
              v-if="
                tool === 'text' ||
                local.some(
                  (element) => selected.includes(element.id) && element.kind === 'text'
                )
              "
            >
              <span class="board-style-label">{{ t('boards.textBackground') }}</span>
              <div
                role="group"
                :aria-label="t('boards.textBackground')"
              >
                <button
                  v-for="background in textBackgrounds"
                  :key="background"
                  type="button"
                  :data-text-background="background"
                  :aria-pressed="selectedTextBackground === background"
                  @click="setTextBackground(background)"
                >
                  {{ t(`boards.textBackgrounds.${background}`) }}
                </button>
              </div>
            </template>
            <span class="board-style-label">{{ t('boards.textAlignment') }}</span>
            <div
              role="group"
              :aria-label="t('boards.textAlignment')"
            >
              <button
                v-for="align in textAlignments"
                :key="align"
                type="button"
                :data-text-align="align"
                :aria-pressed="selectedTextAlign === align"
                @click="setTextAlignment({ textAlign: align })"
              >
                {{ t(`boards.textAlignments.${align}`) }}
              </button>
            </div>
            <span class="board-style-label">{{ t('boards.textVerticalAlignment') }}</span>
            <div
              role="group"
              :aria-label="t('boards.textVerticalAlignment')"
            >
              <button
                v-for="align in textVerticalAlignments"
                :key="align"
                type="button"
                :data-text-vertical-align="align"
                :aria-pressed="selectedTextVerticalAlign === align"
                @click="setTextAlignment({ textVerticalAlign: align })"
              >
                {{ t(`boards.textVerticalAlignments.${align}`) }}
              </button>
            </div>
            <span class="board-style-label">{{ t('boards.textFont') }}</span>
            <div
              role="group"
              :aria-label="t('boards.textFont')"
            >
              <button
                v-for="font in textFonts"
                :key="font"
                type="button"
                :data-text-font="font"
                :aria-pressed="selectedTextFont === font"
                @click="setTextStyle({ textFont: font })"
              >
                {{ t(`boards.textFonts.${font}`) }}
              </button>
            </div>
          </details>
          <details
            v-if="tool === 'text' || (selectedElement && canHaveText(selectedElement))"
            class="board-text-style-controls"
          >
            <summary>{{ t('boards.notation.title') }}</summary>
            <p>{{ t('boards.notation.wholeText') }}</p>
            <BoardAnnotationControls
              :model-value="selectedElement?.textAnnotation ?? textAnnotation"
              @update:model-value="setTextAnnotation"
              @replay="notationReplay++"
            />
          </details>
          <div
            v-if="selected.length"
            class="board-selection-actions"
          >
            <button
              type="button"
              :aria-label="t('boards.duplicateSelection')"
              :title="`${t('boards.duplicateSelection')} (Ctrl+D)`"
              @click="duplicateSelection"
            >
              <Copy
                :size="17"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              :aria-label="t('boards.bringToFront')"
              :title="t('boards.bringToFront')"
              @click="orderSelection(true)"
            >
              <Layers
                :size="17"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              :aria-label="t('boards.sendToBack')"
              :title="t('boards.sendToBack')"
              @click="orderSelection(false)"
            >
              <Layers
                :size="17"
                aria-hidden="true"
                class="board-layers-back"
              />
            </button>
            <button
              type="button"
              :aria-label="t('boards.deleteSelection')"
              :title="t('boards.deleteSelection')"
              @click="removeSelection"
            >
              <Trash2
                :size="17"
                aria-hidden="true"
              />
            </button>
          </div>
        </template>
      </div>
      <PaperElementControls
        v-if="
          tool === 'select' &&
          selected.length &&
          selectionPropertiesOpen &&
          !editing &&
          !distractionFree &&
          !readOnly
        "
        :count="selected.length"
        :text="
          local.some((element) => selected.includes(element.id) && canEditText(element))
        "
        :fill="fillAvailable"
        :font-size="selectedFontSize"
        :text-color="selectedTextColor"
        :fill-color="selectedFill"
        :align="selectedTextAlign"
        :vertical-align="selectedTextVerticalAlign"
        :movable-count="movableCount"
        :stroke="showStrokeStyle"
        :stroke-color="wheelColor"
        :stroke-width="wheelWidth"
        :opacity="wheelOpacity"
        :text-box="
          local.some(
            (element) => selected.includes(element.id) && element.kind === 'text'
          )
        "
        :text-background="selectedTextBackground"
        :auto-width="selectedElement?.textAutoWidth"
        @close="selectionPropertiesOpen = false"
        @advanced="toggleBrushSettings"
        @edit="editableSelection && startEditing(editableSelection.id)"
        @font-size="setElementText({ fontSize: $event })"
        @text-color="setElementText({ color: $event })"
        @fill-color="setFillColor"
        @alignment="
          (textAlign, textVerticalAlign) =>
            setTextAlignment({ textAlign, textVerticalAlign })
        "
        @arrange="organizeSelection"
        @brush="setBrush"
        @background="setTextBackground"
        @auto-width="setTextAutoWidth"
      />
      <div
        v-if="!distractionFree && !readOnly && !editing"
        class="board-history board-floating"
        @pointerdown.stop
        @wheel.stop
      >
        <button
          v-if="hasAnimatedAnnotations"
          type="button"
          :aria-label="t('boards.notation.replay')"
          :title="t('boards.notation.replay')"
          @click="notationReplay++"
        >
          <Play :size="18" />
        </button>
        <button
          type="button"
          :aria-label="t('boards.undo')"
          :disabled="!canUndo"
          data-board-undo
          :title="`${t('boards.undo')} (Ctrl+Z)`"
          @click="undo"
        >
          <Undo2
            :size="18"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          :aria-label="t('boards.redo')"
          :disabled="!canRedo"
          data-board-redo
          :title="`${t('boards.redo')} (Ctrl+Shift+Z)`"
          @click="redo"
        >
          <Redo2
            :size="18"
            aria-hidden="true"
          />
        </button>
      </div>
      <div
        v-if="
          tool === 'select' &&
          selected.length &&
          !distractionFree &&
          !editing &&
          !readOnly
        "
        class="paper-selection-bar board-floating"
        @pointerdown.stop
        @wheel.stop
      >
        <button
          v-if="editableSelection"
          data-edit-text
          type="button"
          :aria-label="t('boards.editText')"
          @click="startEditing(editableSelection.id)"
        >
          <Type :size="16" /><span>{{ t('boards.editText') }}</span>
        </button>
        <button
          type="button"
          :aria-label="t('boards.usability.properties')"
          :aria-pressed="selectionPropertiesOpen"
          @click="toggleSelectionProperties"
        >
          <Pencil :size="16" /><span>{{ t('boards.usability.properties') }}</span>
        </button>
        <button
          type="button"
          :aria-label="t('boards.duplicateSelection')"
          @click="duplicateSelection"
        >
          <Copy :size="16" />
        </button>
        <button
          type="button"
          :aria-label="t('boards.deleteSelection')"
          @click="removeSelection"
        >
          <Trash2 :size="16" />
        </button>
      </div>
      <details
        v-if="!distractionFree && !selected.length && !editing"
        class="board-shortcuts board-floating"
        @pointerdown.stop
        @wheel.stop
        @keydown.stop
      >
        <summary>{{ t('boards.shortcuts') }}</summary>
        <ul>
          <li>{{ t('boards.resizeHint') }}</li>
          <li>{{ t('boards.rotateHint') }}</li>
          <li>{{ t('boards.moveHint') }}</li>
          <li>{{ t('boards.shortcutTools') }}</li>
          <li>{{ t('boards.shortcutActions') }}</li>
          <li>{{ t('boards.shortcutRotate') }}</li>
          <li>{{ t('boards.shortcutZoom') }}</li>
        </ul>
      </details>
      <div
        v-if="!distractionFree"
        class="board-zoom board-floating"
        @pointerdown.stop
        @wheel.stop
      >
        <button
          type="button"
          :aria-label="t('boards.zoomOut')"
          :title="t('boards.zoomOut')"
          @click="zoom(0.8)"
        >
          <ZoomOut
            :size="17"
            aria-hidden="true"
          />
        </button>
        <span class="board-zoom-value">{{ Math.round(camera.zoom * 100) }}%</span>
        <button
          type="button"
          :aria-label="t('boards.zoomIn')"
          :title="t('boards.zoomIn')"
          @click="zoom(1.25)"
        >
          <ZoomIn
            :size="17"
            aria-hidden="true"
          />
        </button>
        <span
          class="board-tool-divider"
          aria-hidden="true"
        />
        <button
          type="button"
          :aria-label="t('boards.fitContent')"
          :title="t('boards.fitContent')"
          @click="fitContent"
        >
          <Scan
            :size="17"
            aria-hidden="true"
          />
        </button>
      </div>
      <svg
        ref="svg"
        class="board-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g
          data-scene
          :transform="sceneTransform"
        >
          <g
            v-for="element in local"
            :key="element.id"
            :data-element-id="element.id"
            :transform="rotationTransform(element)"
            :opacity="element.opacity ?? 1"
            @dblclick.stop="startEditing(element.id)"
          >
            <image
              v-if="element.kind === 'image'"
              :x="element.x"
              :y="element.y"
              :width="element.width"
              :height="element.height"
              :href="element.imageData ?? undefined"
              preserveAspectRatio="xMidYMid meet"
            >
              <title>{{ element.text }}</title>
            </image>
            <BoardArtisticBrush
              v-else-if="element.kind === 'draw' && element.drawBrush"
              :element="element"
              :stroke="stroke(element)"
              :preview="gesture?.mode === 'create' && gesture.id === element.id"
              :visible="artisticVisible(element)"
              @fallback="brushFallback = true"
            />
            <BoardSketch
              v-else
              :element="element"
              :endpoints="connectorEndpoints.get(element.id)"
              :stroke="stroke(element)"
              :fill="fill(element)"
            />
            <rect
              v-if="!['arrow', 'draw', 'image', 'ellipse'].includes(element.kind)"
              data-editor-only
              :x="element.x"
              :y="element.y"
              :width="element.width"
              :height="element.height"
              fill="transparent"
              stroke="transparent"
              :stroke-width="12 / camera.zoom"
              :pointer-events="element.kind === 'frame' ? 'stroke' : 'all'"
            />
            <ellipse
              v-if="element.kind === 'ellipse'"
              data-editor-only
              :cx="element.x + element.width / 2"
              :cy="element.y + element.height / 2"
              :rx="element.width / 2"
              :ry="element.height / 2"
              fill="transparent"
              pointer-events="all"
            />
            <path
              v-if="element.kind === 'arrow' || element.kind === 'draw'"
              data-editor-only
              :d="element.kind === 'arrow' ? arrow(element) : drawPath(element)"
              fill="none"
              stroke="transparent"
              :stroke-width="12 / camera.zoom"
            />
            <BoardRichLabel
              v-if="
                canHaveText(element) &&
                element.richText &&
                editing !== element.id &&
                !(element.kind === 'task' && element.taskId)
              "
              :element="element"
              :color-scheme="labelScheme(element)"
              :font-ready="fontReady"
              :replay="notationReplay"
              :group-delay="notationGroupDelays[element.id]"
            />
            <BoardLabel
              v-else-if="
                !['arrow', 'draw', 'image'].includes(element.kind) &&
                label(element) &&
                editing !== element.id
              "
              :element="element"
              :color-scheme="labelScheme(element)"
              :label="label(element)"
              :font-ready="fontReady"
              :replay="notationReplay"
              :group-delay="notationGroupDelays[element.id]"
            />
            <text
              v-if="element.taskId && taskTitles?.[element.taskId]"
              :x="element.x + 12"
              :y="element.y + element.height - 10"
              fill="var(--board-ink)"
              font-size="11"
              font-family="sans-serif"
              pointer-events="none"
            >
              {{ t(`boards.taskStatus.${taskTitles[element.taskId]?.status}`) }}
            </text>
            <text
              v-if="element.resolved && ['question', 'decision'].includes(element.kind)"
              :x="element.x + element.width - 18"
              :y="element.y + 20"
              fill="var(--board-sage)"
              font-size="14"
            >
              ✓
            </text>
          </g>
          <g
            v-if="tool === 'select' && selectionBox && !isEditingFreeText && !readOnly"
            data-editor-only
            :transform="rotationTransform(rotatableElement)"
          >
            <rect
              :x="selectionBox.x - 4"
              :y="selectionBox.y - 4"
              :width="selectionBox.width + 8"
              :height="selectionBox.height + 8"
              fill="none"
              stroke="var(--accent)"
              :stroke-width="1.5 / camera.zoom"
              pointer-events="none"
            />
            <circle
              v-if="selectedArrow"
              data-resize="true"
              :cx="connectorPoints(selectedArrow, local)[1].x"
              :cy="connectorPoints(selectedArrow, local)[1].y"
              :r="6 / camera.zoom"
              fill="white"
              stroke="var(--accent)"
              :stroke-width="2 / camera.zoom"
              style="cursor: crosshair"
            />
            <rect
              v-for="handle in resizeHandles"
              :key="handle.id"
              data-resize="true"
              :data-resize-handle="handle.id"
              :x="handle.x - 5 / camera.zoom"
              :y="handle.y - 5 / camera.zoom"
              :width="10 / camera.zoom"
              :height="10 / camera.zoom"
              fill="var(--accent)"
              :style="{ cursor: handle.cursor }"
            >
              <title>{{ t('boards.resizeHint') }}</title>
            </rect>
            <line
              v-if="rotatableElement"
              :x1="selectionBox.x + selectionBox.width / 2"
              :x2="selectionBox.x + selectionBox.width / 2"
              :y1="selectionBox.y - 4"
              :y2="selectionBox.y - 26 / camera.zoom"
              stroke="var(--accent)"
              :stroke-width="1 / camera.zoom"
              pointer-events="none"
            />
            <circle
              v-if="rotatableElement"
              data-rotate="true"
              :cx="selectionBox.x + selectionBox.width / 2"
              :cy="selectionBox.y - 26 / camera.zoom"
              :r="6 / camera.zoom"
              fill="white"
              stroke="var(--accent)"
              :stroke-width="1.5 / camera.zoom"
              style="cursor: grab"
            >
              <title>{{ t('boards.rotateHint') }}</title>
            </circle>
          </g>
          <rect
            v-if="marquee"
            data-editor-only
            :x="marquee.x"
            :y="marquee.y"
            :width="marquee.width"
            :height="marquee.height"
            fill="var(--focus-ring)"
            stroke="var(--accent)"
            :stroke-width="1 / camera.zoom"
            pointer-events="none"
          />
        </g>
      </svg>
      <div
        v-if="!local.length && !distractionFree"
        class="board-empty"
      >
        <Pencil
          :size="28"
          aria-hidden="true"
        /><strong>{{ t('boards.canvasHintTitle') }}</strong>
        <p>{{ t('boards.canvasHintDescription') }}</p>
      </div>
      <BoardRichTextEditor
        v-if="isEditingFreeText && richDraft"
        ref="richEditor"
        :model-value="richDraft"
        :auto-width="editingElement?.textAutoWidth"
        :marker-seed="editingElement?.id"
        :annotation="editingElement?.textAnnotation"
        :color-scheme="editingElement ? labelScheme(editingElement) : colorScheme"
        :background-color="editingElement?.fillColor ?? undefined"
        :controls-target="viewport ?? undefined"
        :can-undo="canUndo"
        :can-redo="canRedo"
        class="board-rich-editor"
        :style="freeTextEditorStyle"
        @update:model-value="updateRichDraft"
        @finish="completeRichEditing"
        @cancel="cancelRichEditing"
        @undo="undo"
        @redo="redo"
        @pointerdown.stop
        @keydown.stop
        @wheel.stop
      />
      <div
        v-else-if="editing"
        class="board-text-editor"
        :style="textEditorStyle"
        @pointerdown.stop
        @keydown.stop
      >
        <label for="board-text">{{ t('boards.textLabel') }}</label>
        <textarea
          id="board-text"
          ref="textInput"
          v-model="draft"
          maxlength="10000"
          rows="5"
          @blur="finishEditing"
          @keydown.ctrl.enter.prevent="finishEditing"
          @keydown.meta.enter.prevent="finishEditing"
          @keydown.esc.prevent="editing = null"
        />
        <button
          type="button"
          @click="finishEditing"
        >
          {{ t('boards.finishEditing') }}
        </button>
      </div>
    </div>
    <p
      v-if="brushFallback"
      class="board-brush-notice"
      role="status"
    >
      {{ t('boards.brushes.fallback') }}
    </p>
    <p
      v-if="error"
      class="board-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.board-brush-notice {
  position: absolute;
  bottom: 74px;
  right: 12px;
  max-width: 330px;
  margin: 0;
  padding: 10px 12px;
  background: #fff8e8;
  color: #6e5228;
  border: 1px solid #dfc99f;
  border-radius: 8px;
  font-size: 12px;
  z-index: 8;
}
.board-editor {
  --board-ink: #252a34;
  --board-note: #fff7cf;
  --board-amber: #985610;
  --board-sage: #397349;
  --board-blue: #285bb5;
  --board-rose: #b13f60;
  --board-purple: #7846ac;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.board-editor.board-distraction-free {
  border: 0;
  border-radius: 0;
}
.board-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  max-width: calc(100% - 24px);
  width: max-content;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 4px 16px var(--shadow-color);
  flex-shrink: 0;
  font-size: 12px;
}
.board-toolbar > * {
  flex-shrink: 0;
}
.board-toolbar button,
.board-floating button,
.board-text-editor button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.board-floating button:hover {
  background: var(--hover);
}
.board-floating button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.board-floating {
  position: absolute;
  z-index: 3;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 16px var(--shadow-color);
}
.board-style-panel {
  top: 76px;
  left: 208px;
  padding: 16px;
  width: 260px;
  max-height: calc(100% - 140px);
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
  color: #33312c;
  border-color: #e5e0d5;
}
.board-style-panel.board-instruments-panel {
  width: 340px;
  max-width: calc(100% - 224px);
}
.paper-width-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin: -6px 0 20px;
}
.board-style-panel .paper-width-presets button {
  width: 100%;
  min-height: 42px;
  height: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #e5e0d5;
  font-size: 11px;
}
.paper-width-presets span {
  width: 25px;
  border-radius: 6px;
}
.paper-settings-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
.paper-brush-setting {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 16px;
}
.paper-brush-setting input {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: #b57e29;
  min-height: 24px;
}
.paper-brush-setting output {
  color: #85775b;
  font-variant-numeric: tabular-nums;
}
.paper-brush-colour {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 12px;
}
.paper-brush-colour input {
  width: 44px;
  height: 36px;
  padding: 2px;
  background: white;
  border: 1px solid #e5e0d5;
  border-radius: 8px;
}
.paper-grid-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 14px;
}
.paper-grid-control input {
  accent-color: #b57e29;
}
.board-style-panel .board-style-label {
  color: #777164;
}
.board-style-panel button {
  color: #33312c;
}
.board-style-panel button:hover {
  background: #f5f1e8;
}
.board-style-panel button[aria-pressed='true'] {
  background: #f5e6c8;
  border-color: #d4b47a;
}
.paper-selection-bar {
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 5px;
  background: #fff;
  color: #33312c;
  border-color: #e5e0d5;
}
.paper-selection-bar button {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #33312c;
  padding: 4px 8px;
  font-size: 12px;
  width: auto;
  min-width: 40px;
  min-height: 40px;
  white-space: nowrap;
}
.paper-selection-bar button:hover {
  background: #f5f1e8;
}
.board-shortcuts {
  top: 76px;
  right: 12px;
  padding: 8px 10px;
  max-width: min(300px, calc(100% - 24px));
  font-size: 12px;
}
.board-shortcuts summary {
  cursor: pointer;
}
.board-shortcuts ul {
  display: grid;
  gap: 8px;
  padding-top: 10px;
}
.board-style-panel .board-reset-rotation {
  display: flex;
  justify-content: center;
  white-space: nowrap;
  width: 100%;
  font-size: 11px;
  margin-bottom: 10px;
}
.board-text-styles {
  margin-top: 12px;
  border-top: 1px solid #e5e0d5;
  padding-top: 12px;
}
.board-text-styles summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  min-height: 32px;
}
.board-text-styles > div:not(.board-highlight-colors) button {
  width: 100%;
  height: 36px;
  justify-items: start;
  font-size: 12px;
  padding-inline: 8px;
}
.board-text-styles .board-style-label {
  margin-top: 10px;
}
.board-highlight-colors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.board-highlight-colors span {
  width: 20px;
  height: 18px;
  border-radius: 4px;
  text-align: center;
}
.board-text-styles button[aria-pressed='true'] {
  background: var(--selection);
  border-color: var(--accent);
}
.board-stroke-styles {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.board-stroke-styles .board-style-label {
  grid-column: 1 / -1;
}
.board-stroke-styles button {
  width: 100%;
  height: 60px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  padding: 6px;
  border: 1px solid #e5e0d5;
}
.board-stroke-styles svg {
  width: 44px;
  height: 14px;
}
.board-stroke-styles button[aria-pressed='true'] {
  background: var(--selection);
  border-color: var(--accent);
}
.board-style-label {
  display: block;
  font-size: 11px;
  color: var(--ink-soft);
  margin-bottom: 8px;
}
.board-swatches,
.board-selection-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.board-swatches {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px;
}
.board-style-panel .board-swatch {
  width: 100%;
  height: 36px;
}
.board-history button,
.board-zoom button {
  width: 40px;
  height: 40px;
}
.board-style-panel .board-edit-text-action {
  display: flex;
  justify-content: center;
  white-space: nowrap;
  width: 100%;
  margin-bottom: 10px;
  gap: 6px;
  font-size: 12px;
}
.board-selection-actions {
  grid-template-columns: repeat(2, 1fr);
  border-top: 1px solid var(--border);
  margin-top: 8px;
  padding-top: 8px;
}
.board-swatch span {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: var(--swatch);
}
.board-swatch[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--selection);
}
.board-tool-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
  margin: 0 3px;
}
.board-history {
  display: flex;
  bottom: 12px;
  left: 12px;
  padding: 4px;
}
.board-lock-hint {
  top: 76px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 12px;
  max-width: calc(100% - 24px);
  pointer-events: none;
}
.board-zoom {
  display: flex;
  align-items: center;
  bottom: 12px;
  right: 12px;
  padding: 4px;
}
.board-zoom-value {
  min-width: 42px;
  font-size: 11px;
  text-align: center;
  color: var(--ink-soft);
}
.board-layers-back {
  transform: rotate(180deg);
}
.board-toolbar button[aria-pressed='true'] {
  background: var(--selection);
  border-color: var(--accent);
}
.board-toolbar button:disabled {
  opacity: 0.45;
}
.board-viewport {
  position: relative;
  flex: 1;
  min-height: 240px;
  min-width: 0;
  overflow: hidden;
  touch-action: none;
  background-color: #ffffff;
  background-image: radial-gradient(#d9dee5 0.8px, transparent 0.8px);
  outline-offset: -2px;
}
.board-svg {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  user-select: none;
}
.board-panning {
  cursor: grab;
}
.board-empty {
  position: absolute;
  inset: 43% 24px auto 220px;
  text-align: center;
  color: var(--paper-canvas-muted, #646d7b);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
@media (max-width: 700px) {
  .board-style-panel {
    left: 12px;
    top: 352px;
    max-height: calc(100% - 412px);
  }
  .board-empty {
    inset: 48% 24px auto;
  }
  .paper-selection-bar {
    bottom: 60px;
  }
}
.board-empty strong {
  font-weight: 500;
  color: var(--paper-canvas-ink, var(--board-ink));
}
.board-empty p {
  margin: 0;
  max-width: 420px;
  font-size: 12px;
  line-height: 1.7;
}
.board-text-editor {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  width: min(320px, calc(100% - 24px));
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow: 0 6px 20px var(--shadow-color);
}
.board-rich-editor {
  position: absolute;
  z-index: 4;
  transform-origin: top left;
  box-sizing: border-box;
  margin: 0;
  background: transparent;
  color: var(--board-ink);
  resize: none;
  overflow: visible;
  border-radius: 0;
}
.board-auto-width {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  margin-bottom: 8px;
}
.board-text-editor textarea {
  resize: vertical;
  max-height: 260px;
  padding: 8px;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--border);
}
.board-text-editor button {
  width: auto;
  height: auto;
  padding: 6px 10px;
  background: var(--selection);
}
.board-error {
  margin: 0;
  padding: 8px 12px;
  color: var(--brick);
  background: var(--surface);
  font-size: 12px;
}
</style>
