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
import { getActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app.store'
import {
  MousePointer2,
  Hand,
  RectangleHorizontal,
  Circle,
  Minus,
  Triangle,
  Hexagon,
  MoveUpRight,
  Pencil,
  PenTool,
  Eraser,
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
  BoardScene,
  BoardFillStyle,
  BoardLayer,
  BoardSketchOptions,
  BoardConnectorStyle,
} from '@/shared/types/board'
import PaperPresentationLaser from './PaperPresentationLaser.vue'
import PaperBrushLibrary from '@/features/papers/components/PaperBrushLibrary.vue'
import {
  brushPresets,
  renderArtisticBrush,
  applyBrushRaster,
  releaseArtisticBrushes,
} from '../lib/artistic-brush'
import PaperToolRail from './PaperToolRail.vue'
import {
  createGuideIndex,
  smartGuides,
  type GuideBox,
  type GuideIndex,
  type SmartGuide,
} from '../lib/smart-guides'
import { DEFAULT_PEN_COLOR } from '../lib/ink-colors'
import { recognizeShape } from '../lib/shape-recognition'
import type { ConnectorEndpoints } from '../lib/connector-path'
import PaperContextBar from './PaperContextBar.vue'
import PaperNavigator from './PaperNavigator.vue'
import BoardSceneContent from './BoardSceneContent.vue'
import PaperSketchControls from './PaperSketchControls.vue'
import '../paper-editor.css'
import { elementsInLasso } from '../lib/lasso'
import BoardRichTextEditor from './BoardRichTextEditor.vue'
import BoardAnnotationControls from './BoardAnnotationControls.vue'
import { validatePaperClipboard } from '@/shared/lib/boards/board-clipboard.service'
import {
  encodePaperClipboard,
  decodePaperClipboard,
  PAPER_CLIPBOARD_MIME,
} from '../lib/clipboard'
import PaperLibraryPanel from './PaperLibraryPanel.vue'
import { librarySelection, instantiateLibraryItem } from '../lib/library-items'
import PaperElementControls from './PaperElementControls.vue'
import { DEFAULT_SKETCH_OPTIONS } from '../lib/sketch-options'
import PaperFillStylePicker from './PaperFillStylePicker.vue'
import { elementFillStyle } from '../lib/element-style'
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
  connectorOutline,
  exportSize,
  MAX_POINTS,
  normalizedStroke,
  worldPoint,
  zoomAt,
  pointInElement,
  linePoints,
  resizeElement,
  normalizeAngle,
  type ResizeOptions,
  type Camera,
} from '../lib/geometry'
import { boardImage } from '../lib/image'
import { copyElements, sameElements, sameValue } from '../model/history'
import { createPaperHistory } from '../model/paper-history'
import {
  copyScenes,
  sceneBox,
  sceneCamera,
  sceneAtCamera,
  MAX_SCENES,
  type SceneRatio,
} from '../lib/scenes'
import PaperScenesPanel from './PaperScenesPanel.vue'
import { buildPresentationPdf } from '../lib/presentation-pdf'
import { saveBoardPdf } from '@/shared/lib/boards/board-export.service'
import { isWritingBrush } from '../lib/writing'
import { resizeTextElement } from '../lib/resize-text'
import { elementFill, elementLabelScheme } from '../lib/element-style'
import { eraseStrokes } from '../lib/eraser'
import { expandGroups, groupBox, transformGroup } from '../lib/groups'
import PaperLayersPanel from './PaperLayersPanel.vue'
import {
  copyLayers,
  elementLayerId,
  editableInLayers,
  orderedLayerElements,
  MAX_LAYERS,
} from '../lib/layers'

const props = defineProps<{
  elements: BoardElement[]
  scenes?: BoardScene[]
  layers?: BoardLayer[]
  title?: string
  taskTitles?: Record<string, { title: string; status: string }>
  distractionFree?: boolean
  background?: PaperBackground
  colorScheme?: PaperColorScheme
  readOnly?: boolean
}>()
const emit = defineEmits<{
  change: [elements: BoardElement[]]
  contentChange: [
    content: { elements: BoardElement[]; scenes: BoardScene[]; layers: BoardLayer[] },
  ]
  presentation: [active: boolean]
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
const localScenes = ref(copyScenes(props.scenes ?? []))
const localLayers = ref(copyLayers(props.layers))
const activeLayerId = ref(
  localLayers.value.find((layer) => layer.visible && !layer.locked)?.id ??
    localLayers.value[0]!.id
)
const layersCollapsed = ref(true)
const renderedElements = computed(() =>
  orderedLayerElements(local.value, localLayers.value)
)
const editableElements = computed(() =>
  renderedElements.value.filter((element) => editableInLayers(element, localLayers.value))
)
const activeLayer = computed(() =>
  localLayers.value.find((layer) => layer.id === activeLayerId.value)
)
const activeLayerEditable = computed(
  () =>
    activeLayer.value?.visible &&
    !activeLayer.value.locked &&
    activeLayer.value.opacity > 0
)
function isEditable(element: BoardElement) {
  return editableInLayers(element, localLayers.value)
}
const editorRoot = ref<HTMLDivElement>()
const contentId = `paper-content-${crypto.randomUUID()}`
const scenesOpen = ref(false)
const showScenes = ref(true)
const activeSceneId = ref<string | null>(null)
const sceneMode = ref<'create' | 'adjust' | null>(null)
const sceneRatio = ref<SceneRatio>('16:9')
const presenting = ref(false)
const smoothTransition = ref(true)
const laserEnabled = ref(true)
const exportingPresentation = ref(false)
const interactionLocked = computed(
  () => props.readOnly || presenting.value || exportingPresentation.value
)
const hideTools = computed(() => props.distractionFree || presenting.value)
const activeScene = computed(() =>
  localScenes.value.find((scene) => scene.id === activeSceneId.value)
)
const presentationIndex = ref(0)
const presentationScene = computed(() => localScenes.value[presentationIndex.value])
let savedCamera: Camera | null = null
let cameraFrame = 0
let ownsFullscreen = false
type SceneGesture = {
  pointer: number
  start: BoardPoint
  end: BoardPoint
  original?: BoardScene
  resize?: boolean
}
const sceneGesture = ref<SceneGesture | null>(null)
const sceneDraft = computed(() => {
  const g = sceneGesture.value
  if (!g) return null
  if (!g.original) return sceneBox(g.start, g.end, sceneRatio.value)
  if (g.resize)
    return sceneBox({ x: g.original.x, y: g.original.y }, g.end, g.original.aspectRatio)
  return {
    ...g.original,
    x: g.original.x + g.end.x - g.start.x,
    y: g.original.y + g.end.y - g.start.y,
  }
})
const sceneViewport = computed(() => {
  const scene = presentationScene.value
  if (!scene) return {}
  return {
    left: `${scene.x * camera.value.zoom + camera.value.x}px`,
    top: `${scene.y * camera.value.zoom + camera.value.y}px`,
    width: `${scene.width * camera.value.zoom}px`,
    height: `${scene.height * camera.value.zoom}px`,
  }
})
const camera = ref<Camera>({ x: 40, y: 40, zoom: 1 })
const tool = ref<BoardElementKind | 'select' | 'pan' | 'eraser'>(
  props.elements.length ? 'select' : 'draw'
)
const selectionMode = ref<'rectangle' | 'lasso'>('rectangle')
const tools = [
  { id: 'select', icon: MousePointer2, shortcut: 'V' },
  { id: 'pan', icon: Hand, shortcut: 'H' },
  { id: 'rectangle', icon: RectangleHorizontal, shortcut: 'R' },
  { id: 'ellipse', icon: Circle, shortcut: 'O' },
  { id: 'line', icon: Minus, shortcut: 'L' },
  { id: 'triangle', icon: Triangle, shortcut: '' },
  { id: 'hexagon', icon: Hexagon, shortcut: '' },
  { id: 'arrow', icon: MoveUpRight, shortcut: 'A' },
  { id: 'draw', icon: Pencil, shortcut: 'P' },
  { id: 'pen', icon: PenTool, shortcut: 'B' },
  { id: 'eraser', icon: Eraser, shortcut: 'E' },
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
const connectorStyle = ref<BoardConnectorStyle>('straight')
const selectedConnector = computed(() =>
  selected.value.length === 1
    ? local.value.find((e) => e.id === selected.value[0] && e.kind === 'arrow')
    : undefined
)
function setConnectorStyle(style: BoardConnectorStyle) {
  if (interactionLocked.value) return
  connectorStyle.value = style
  const before = copyElements(local.value)
  for (const e of local.value)
    if (selected.value.includes(e.id) && e.kind === 'arrow' && isEditable(e))
      e.connectorStyle = style
  commit(before)
}
function setConnectorLabel(label: string) {
  const e = selectedConnector.value
  if (interactionLocked.value || !e || !isEditable(e)) return
  const before = copyElements(local.value)
  e.text = label.replace(/\s+/g, ' ').trim().slice(0, 80)
  commit(before)
}
const strokeStyle = ref<BoardStrokeStyle>('pencil')
const drawBrush = ref<BoardDrawBrush | null>(null)
const brushLibraryOpen = ref(false)
const brushFallback = ref(false)
const strokeStyles: BoardStrokeStyle[] = ['pencil', 'pen', 'clean']
const settingsOpen = ref(false)
const brushWidth = ref(1.5)
const eraserSize = ref(24)
const eraserPosition = ref<BoardPoint | null>(null)
const brushOpacity = ref(1)
const customColor = ref<string | null>(DEFAULT_PEN_COLOR)
type WritingInstrument = 'pencil' | 'pen' | 'graphite' | 'fountain' | 'ink'
const writingPreferences = new Map<
  WritingInstrument,
  {
    width: number
    opacity: number
    color: BoardColor
    customColor: string | null
  }
>()
function rememberWritingPreferences() {
  if (tool.value !== 'draw') return
  const id = (drawBrush.value ??
    (strokeStyle.value === 'pen' ? 'pen' : 'pencil')) as WritingInstrument
  writingPreferences.set(id, {
    width: brushWidth.value,
    opacity: brushOpacity.value,
    color: color.value,
    customColor: customColor.value,
  })
}
function useWritingInstrument(id: WritingInstrument) {
  const saved = writingPreferences.get(id)
  const preset = id === 'pencil' || id === 'pen' ? null : brushPresets[id]
  drawBrush.value = id === 'pencil' || id === 'pen' ? null : id
  strokeStyle.value = id === 'pencil' ? 'pencil' : 'pen'
  brushWidth.value = saved?.width ?? preset?.width ?? (id === 'pen' ? 1.6 : 1.2)
  brushOpacity.value = saved?.opacity ?? preset?.opacity ?? 1
  color.value = saved?.color ?? 'neutral'
  customColor.value = saved ? saved.customColor : DEFAULT_PEN_COLOR
}
type FavoritePen = { instrument: WritingInstrument; width: number; opacity: number; color: BoardColor; customColor: string | null }
const preferencesStore = getActivePinia() ? useAppStore() : null
const favoritePens = ref<FavoritePen[]>([...(preferencesStore?.config?.favoritePaperPens ?? [])])
const savingFavorites = ref(false)
async function persistFavoritePens(pens: FavoritePen[]) {
  if (savingFavorites.value) return
  savingFavorites.value = true
  try {
    if (preferencesStore && !(await preferencesStore.updateConfig({ favoritePaperPens: pens }))) {
      error.value = preferencesStore.error
      return
    }
    favoritePens.value = pens
  } finally { savingFavorites.value = false }
}
function removeFavoritePen(index: number) {
  void persistFavoritePens(favoritePens.value.filter((_, i) => i !== index))
}
function saveFavoritePen() {
  if (tool.value !== 'draw' || interactionLocked.value) return
  const instrument = (drawBrush.value ?? (strokeStyle.value === 'pen' ? 'pen' : 'pencil')) as WritingInstrument
  if (!['pencil', 'pen', 'graphite', 'fountain', 'ink'].includes(instrument)) return
  const pen = { instrument, width: brushWidth.value, opacity: brushOpacity.value, color: color.value, customColor: customColor.value }
  if (!favoritePens.value.some(saved => JSON.stringify(saved) === JSON.stringify(pen)) && favoritePens.value.length < 6) void persistFavoritePens([...favoritePens.value, pen])
}
function applyFavoritePen(pen: FavoritePen) {
  if (interactionLocked.value) return
  commitPendingEdit()
  selected.value = []
  tool.value = 'draw'
  writingPreferences.set(pen.instrument, pen)
  useWritingInstrument(pen.instrument)
  dismissToolPanels()
}
const navigationOpen = ref(false)
const previousCamera = ref<Camera | null>(null)
function navigatePaper(point: { x: number; y: number }) {
  previousCamera.value ??= { ...camera.value }
  camera.value = { ...camera.value, x: viewportSize.value.width / 2 - point.x * camera.value.zoom, y: viewportSize.value.height / 2 - point.y * camera.value.zoom }
}
function returnToPosition() {
  if (!previousCamera.value) return
  const current = { ...camera.value }
  camera.value = previousCamera.value
  previousCamera.value = current
}
const shapeFill = ref<string | null>(null)
const shapeFillStyle = ref<BoardFillStyle>()
const shapeSketch = ref<BoardSketchOptions>()
const selectionPropertiesOpen = ref(false)
const contextHeight = ref(40)
const activeWheelTool = computed(() =>
  tool.value === 'draw' &&
  (drawBrush.value
    ? ['fountain', 'ink'].includes(drawBrush.value)
    : strokeStyle.value === 'pen')
    ? 'pen'
    : tool.value
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
const textFont = ref<BoardTextFont>('handwritten')
const defaultFontSize = ref<number>()
const defaultTextColor = ref<string>()
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
  !['arrow', 'line', 'draw', 'image', 'iframe'].includes(element.kind)
const canHaveFill = (element: BoardElement) =>
  canHaveText(element) &&
  (element.kind !== 'text' || (element.textBackground ?? 'none') !== 'none')
const fillAvailable = computed(() =>
  selected.value.length
    ? local.value.some(
        (element) => selected.value.includes(element.id) && canHaveFill(element)
      )
    : [
        'rectangle',
        'ellipse',
        'triangle',
        'hexagon',
        'frame',
        'note',
        'question',
        'decision',
        'task',
      ].includes(tool.value) ||
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
const selectedFillStyle = computed(() => {
  if (!selected.value.length)
    return (
      shapeFillStyle.value ??
      (['rectangle', 'ellipse', 'triangle', 'hexagon', 'text'].includes(tool.value)
        ? 'hachure'
        : 'solid')
    )
  const values = new Set(
    local.value
      .filter((element) => selected.value.includes(element.id) && canHaveFill(element))
      .map(elementFillStyle)
  )
  return values.size === 1 ? [...values][0] : undefined
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
    defaultFontSize.value ?? (textFont.value === 'handwritten' ? 22 : 14)
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
  }, defaultTextColor.value ?? '#263238')
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
    : ['text', 'note', 'rectangle', 'ellipse', 'triangle', 'hexagon', 'frame'].includes(
        tool.value
      )
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
          !['image', 'iframe'].includes(e.kind)
      )
    : !['select', 'pan', 'image', 'iframe', 'eraser'].includes(tool.value) &&
      (tool.value !== 'text' || textBackground.value !== 'none')
)
const selectedStrokeStyle = computed(() => {
  const styles = new Set(
    local.value
      .filter(
        (e) =>
          selected.value.includes(e.id) &&
          !['image', 'iframe'].includes(e.kind) &&
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
const elementLookup = computed(
  () => new Map(local.value.map((element) => [element.id, element]))
)
const connectorEndpoints = computed<Map<string, ConnectorEndpoints>>((previous) => {
  const result = new Map<string, ConnectorEndpoints>()
  for (const element of local.value) {
    if (element.kind !== 'arrow') continue
    const points = connectorPoints(element, elementLookup.value)
    const old = previous?.get(element.id)
    result.set(
      element.id,
      old &&
        old[0].x === points[0].x &&
        old[0].y === points[0].y &&
        old[1].x === points[1].x &&
        old[1].y === points[1].y &&
        old.axis === points.axis
        ? old
        : points
    )
  }
  return result
})
const selected = ref<string[]>([])
const space = ref(false)
const editing = ref<string | null>(null)
const draft = ref('')
const richDraft = ref<BoardRichText | null>(null)
const richEditor = ref<InstanceType<typeof BoardRichTextEditor>>()
const error = ref('')
const history = createPaperHistory()
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
  mode: 'pan' | 'move' | 'create' | 'marquee' | 'lasso' | 'resize' | 'rotate' | 'erase'
  pointer: number
  start: BoardPoint
  before: BoardElement[]
  camera: Camera
  id?: string
  stroke?: BoardPoint[]
  end?: BoardPoint
  handle?: ResizeHandle
  lasso?: BoardPoint[]
  initialSelection?: string[]
  additive?: boolean
  guideBox?: GuideBox
  guideIndex?: GuideIndex
  heldShape?: { original: BoardElement; anchor: BoardPoint }
  moving?: { element: BoardElement; x: number; y: number }[]
}
const gesture = ref<Gesture | null>(null)
const libraryOpen = ref(false)
const selectionForLibrary = computed(() =>
  libraryOpen.value
    ? librarySelection(
        local.value.map((e) =>
          e.kind === 'task'
            ? {
                ...e,
                text: props.taskTitles?.[e.taskId ?? '']?.title ?? e.text,
                richText: null,
              }
            : e
        ),
        selected.value
      )
    : []
)
function openPersonalLibrary() {
  finishEditing()
  openToolMenu()
  libraryOpen.value = true
}
function insertLibraryItem(source: BoardElement[]) {
  if (
    interactionLocked.value ||
    !activeLayerEditable.value ||
    local.value.length + source.length > 2000
  ) {
    error.value = t('boards.library.insertBlocked')
    return
  }
  finishEditing()
  const before = copyElements(local.value)
  const center = worldPoint(
    {
      x: (viewport.value?.clientWidth || 640) / 2,
      y: (viewport.value?.clientHeight || 480) / 2,
    },
    camera.value
  )
  const elements = instantiateLibraryItem(source, center, activeLayerId.value)
  local.value.push(...elements)
  tool.value = 'select'
  select(elements.map((e) => e.id))
  libraryOpen.value = false
  commit(before)
  nextTick(() => viewport.value?.focus())
}
const guidesEnabled = ref(true)
const snapEnabled = ref(false)
const activeGuides = ref<SmartGuide[]>([])
function toggleGuides() {
  guidesEnabled.value = !guidesEnabled.value
  activeGuides.value = []
}
function dragGuides() {
  if (!guidesEnabled.value) return {}
  const ids = new Set(selected.value)
  const moving = local.value.filter((e) => ids.has(e.id) && e.kind !== 'arrow')
  if (!moving.length) return {}
  const topLeft = worldPoint({ x: 0, y: 0 }, camera.value)
  const bottomRight = worldPoint(
    { x: viewport.value?.clientWidth || 640, y: viewport.value?.clientHeight || 480 },
    camera.value
  )
  const margin = 80 / camera.value.zoom
  const references = renderedElements.value
    .filter(
      (e) =>
        !ids.has(e.id) && !['arrow', 'line', 'draw', 'frame', 'iframe'].includes(e.kind)
    )
    .map((e) => bounds([e]))
    .filter(
      (b) =>
        b.x + b.width >= topLeft.x - margin &&
        b.x <= bottomRight.x + margin &&
        b.y + b.height >= topLeft.y - margin &&
        b.y <= bottomRight.y + margin
    )
  return {
    guideBox: bounds(moving, local.value),
    guideIndex: createGuideIndex(references),
  }
}
const shapeRecognition = ref(true)
let shapeHoldTimer: ReturnType<typeof setTimeout> | undefined
let shapeHoldAnchor: BoardPoint | undefined
function clearShapeHold() {
  clearTimeout(shapeHoldTimer)
  shapeHoldTimer = undefined
  shapeHoldAnchor = undefined
}
function armShapeHold(g: Gesture, position: BoardPoint) {
  if (!shapeRecognition.value || g.mode !== 'create' || !g.stroke) return
  if (
    shapeHoldTimer &&
    shapeHoldAnchor &&
    Math.hypot(position.x - shapeHoldAnchor.x, position.y - shapeHoldAnchor.y) *
      camera.value.zoom <
      3
  )
    return
  clearShapeHold()
  shapeHoldAnchor = position
  shapeHoldTimer = setTimeout(() => {
    shapeHoldTimer = undefined
    if (
      disposed ||
      interactionLocked.value ||
      !shapeRecognition.value ||
      gesture.value !== g
    )
      return
    const element = local.value.find((e) => e.id === g.id)
    if (!element || element.kind !== 'draw') return
    const shape = recognizeShape(g.stroke!, camera.value.zoom)
    if (!shape) return
    g.heldShape = {
      original: JSON.parse(JSON.stringify(element)) as BoardElement,
      anchor: position,
    }
    Object.assign(element, shape, {
      points: [],
      drawBrush: null,
      fillColor: shape.kind === 'line' ? null : 'transparent',
      startId: null,
      endId: null,
    })
  }, 650)
}
function toggleShapeRecognition() {
  shapeRecognition.value = !shapeRecognition.value
  clearShapeHold()
}
const lassoPath = computed(() => {
  const points = gesture.value?.mode === 'lasso' ? gesture.value.lasso : undefined
  return points?.length
    ? points.map((p, index) => `${index ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') + ' Z'
    : null
})
const selectedElement = computed(() =>
  selected.value.length === 1
    ? local.value.find((element) => element.id === selected.value[0])
    : undefined
)
const selectedGroup = computed(() => groupBox(local.value, selected.value))
const contextMenu = ref<{ x: number; y: number } | null>(null)
const canGroup = computed(() => selected.value.length > 1 && !selectedGroup.value)
const canUngroup = computed(() =>
  local.value.some((e) => selected.value.includes(e.id) && e.groupId)
)
const rotatableElement = computed(
  () =>
    selectedGroup.value ??
    (selectedElement.value && !['arrow', 'line'].includes(selectedElement.value.kind)
      ? selectedElement.value
      : undefined)
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
    ? local.value.find(
        (e) => e.id === selected.value[0] && ['arrow', 'line'].includes(e.kind)
      )
    : undefined
)
const selectedLinePoints = computed(() =>
  selectedArrow.value
    ? selectedArrow.value.kind === 'line'
      ? linePoints(selectedArrow.value)
      : connectorPoints(selectedArrow.value, local.value)
    : null
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
  libraryOpen.value = false
  if (gesture.value?.mode === 'lasso') cancelGesture()
  selectionMode.value = 'rectangle'
  sceneMode.value = null
  finishEditing()
  if (id !== 'select') select([])
  layersCollapsed.value = true
  contextMenu.value = null
  tool.value = id === 'pen' ? 'draw' : id
  if (id === 'eraser') select([])
  if (id === 'pen' || id === 'draw') {
    useWritingInstrument(id === 'pen' ? 'pen' : 'pencil')
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
function dismissToolPanels() {
  closeSettings()
  selectionPropertiesOpen.value = false
  libraryOpen.value = false
  nextTick(() => viewport.value?.focus())
}
function settingsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissToolPanels()
  }
}
function toggleLayersPanel() {
  libraryOpen.value = false
  layersCollapsed.value = !layersCollapsed.value
  closeSettings()
  selectionPropertiesOpen.value = false
}
function openToolMenu() {
  libraryOpen.value = false
  closeSettings()
  selectionPropertiesOpen.value = false
  layersCollapsed.value = true
  contextMenu.value = null
}
function dismissOutside(event: PointerEvent) {
  if (!(event.target as Element).closest?.('.paper-context-menu'))
    contextMenu.value = null
  if (event.target instanceof Node && !viewport.value?.contains(event.target)) {
    closeSettings()
    selectionPropertiesOpen.value = false
  }
}
watch(
  () => props.distractionFree,
  (active) => {
    if (active) {
      closeSettings()
      libraryOpen.value = false
    }
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
  if (id === 'lasso') {
    chooseTool('select')
    selectionMode.value = 'lasso'
    return
  }
  const item = tools.find((tool) => tool.id === id)
  if (item) chooseTool(item.id)
}
function chooseContextInstrument(id: string) {
  if (id === 'library') {
    toggleBrushLibrary()
    return
  }
  if (id === 'pencil' || id === 'pen')
    chooseBaseInstrument(id === 'pencil' ? 'draw' : 'pen')
  else if (id === 'graphite' || id === 'fountain' || id === 'ink') setDrawingBrush(id)
}
function toggleContextSettings() {
  libraryOpen.value = false
  layersCollapsed.value = true
  if (
    tool.value === 'select' &&
    selected.value.length &&
    selectedElement.value?.kind !== 'draw'
  )
    toggleSelectionProperties()
  else toggleBrushSettings()
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
  if (tool.value === 'eraser') return
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
    if (next && ['graphite', 'fountain', 'ink'].includes(next))
      useWritingInstrument(next as WritingInstrument)
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
const visibleArtisticIds = computed(() => {
  const legacy = renderedElements.value.filter(
    (element) => element.kind === 'draw' && element.drawBrush && !isWritingBrush(element)
  )
  return legacy.length
    ? new Set(legacy.filter(artisticVisible).map((element) => element.id))
    : undefined
})
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
  () => [props.elements, props.scenes, props.layers] as const,
  ([elements, scenes, layers]) => {
    if (gesture.value) return
    if (sceneGesture.value) return
    if (textCreationBefore && sameElements(elements, textCreationBefore)) return
    if (
      !sameElements(elements, local.value) ||
      !sameValue(scenes ?? [], localScenes.value) ||
      !sameValue(copyLayers(layers), localLayers.value)
    ) {
      local.value = copyElements(elements)
      localScenes.value = copyScenes(scenes ?? [])
      localLayers.value = copyLayers(layers)
      ensureActiveLayer()
      editing.value = null
      richDraft.value = null
      textCreationBefore = null
      history.clear()
      historyVersion.value++
      selected.value = selected.value.filter((id) =>
        elements.some((e) => e.id === id && isEditable(e))
      )
    }
  },
  { deep: true }
)
watch(
  () => interactionLocked.value,
  (locked) => {
    if (!locked) return
    sceneGesture.value = null
    sceneMode.value = null
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
  const editableIds = new Set(editableElements.value.map((element) => element.id))
  ids = expandGroups(local.value, ids).filter((id) => editableIds.has(id))
  if (ids.join(',') !== selected.value.join(',')) {
    selectionPropertiesOpen.value = false
    closeSettings()
  }
  selected.value = ids
  if (ids.length === 1) {
    const element = local.value.find((e) => e.id === ids[0])
    if (element) {
      brushWidth.value =
        element.strokeWidth ?? (element.strokeStyle === 'pencil' ? 1.5 : 2)
      brushOpacity.value = element.opacity ?? 1
      shapeFill.value = element.fillColor ?? null
      shapeFillStyle.value = elementFillStyle(element)
      if (element.kind !== 'draw' && element.kind !== 'image')
        shapeSketch.value = element.sketch ? { ...element.sketch } : undefined
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
function ensureActiveLayer() {
  if (!localLayers.value.some((layer) => layer.id === activeLayerId.value))
    activeLayerId.value = localLayers.value[localLayers.value.length - 1]!.id
}
function activateLayer(id: string) {
  finishEditing()
  cancelGesture()
  if (localLayers.value.some((layer) => layer.id === id)) activeLayerId.value = id
}
function changeLayers(action: () => void) {
  if (interactionLocked.value) return
  finishEditing()
  cancelGesture()
  const before = copyElements(local.value),
    layers = copyLayers(localLayers.value)
  action()
  ensureActiveLayer()
  select(selected.value)
  commit(before, localScenes.value, layers)
}
function addLayer() {
  if (localLayers.value.length >= MAX_LAYERS) return
  changeLayers(() => {
    const layer: BoardLayer = {
      id: crypto.randomUUID(),
      name: t('boards.layers.newName', { number: localLayers.value.length + 1 }),
      visible: true,
      locked: false,
      opacity: 1,
    }
    localLayers.value.push(layer)
    activeLayerId.value = layer.id
  })
}
function patchLayer(id: string, patch: Partial<BoardLayer>) {
  changeLayers(() => {
    const layer = localLayers.value.find((layer) => layer.id === id)
    if (!layer) return
    if (patch.name !== undefined) layer.name = patch.name.trim().slice(0, 80)
    if (patch.visible !== undefined) layer.visible = patch.visible
    if (patch.locked !== undefined) layer.locked = patch.locked
    if (patch.opacity !== undefined && Number.isFinite(patch.opacity))
      layer.opacity = Math.max(0, Math.min(1, patch.opacity))
  })
}
function reorderLayer(id: string, direction: number) {
  changeLayers(() => {
    const index = localLayers.value.findIndex((layer) => layer.id === id),
      next = index + direction
    if (index < 0 || next < 0 || next >= localLayers.value.length) return
    const layer = localLayers.value.splice(index, 1)[0]!
    localLayers.value.splice(next, 0, layer)
  })
}
function removeLayer(id: string) {
  if (
    localLayers.value.length < 2 ||
    local.value.some((element) => elementLayerId(element) === id)
  )
    return
  changeLayers(() => {
    localLayers.value = localLayers.value.filter((layer) => layer.id !== id)
  })
}
function moveSelectionToLayer(id: string) {
  const target = localLayers.value.find((layer) => layer.id === id)
  if (!target || target.locked || !target.visible || target.opacity === 0) return
  changeLayers(() => {
    for (const element of local.value)
      if (selected.value.includes(element.id) && isEditable(element)) element.layerId = id
  })
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
function publishContent() {
  emit('change', copyElements(local.value))
  emit('contentChange', {
    elements: copyElements(local.value),
    scenes: copyScenes(localScenes.value),
    layers: copyLayers(localLayers.value),
  })
}
function commit(
  before: BoardElement[],
  beforeScenes = localScenes.value,
  beforeLayers = localLayers.value
) {
  if (interactionLocked.value) return
  if (
    sameElements(before, local.value) &&
    sameValue(beforeScenes, localScenes.value) &&
    sameValue(beforeLayers, localLayers.value)
  )
    return
  history.push({ elements: before, scenes: beforeScenes, layers: beforeLayers })
  historyVersion.value++
  publishContent()
}
function newElement(kind: BoardElementKind, position: BoardPoint): BoardElement {
  const element: BoardElement = {
    id: crypto.randomUUID(),
    layerId: activeLayerId.value,
    kind,
    x: position.x,
    y: position.y,
    width: kind === 'text' ? 220 : 180,
    height: kind === 'text' ? (textBackground.value === 'none' ? 60 : 100) : 120,
    text: '',
    color: color.value,
    strokeStyle: strokeStyle.value,
    ...(kind === 'arrow' ? { connectorStyle: connectorStyle.value } : {}),
    ...(shapeSketch.value &&
    kind !== 'draw' &&
    !['image', 'iframe'].includes(kind) &&
    (kind !== 'text' || textBackground.value !== 'none')
      ? { sketch: { ...shapeSketch.value } }
      : {}),
    ...(kind === 'draw' && drawBrush.value ? { drawBrush: drawBrush.value } : {}),
    strokeWidth: brushWidth.value,
    strokeColor: customColor.value,
    ...(shapeFillStyle.value &&
    !['image', 'iframe', 'draw', 'arrow', 'line'].includes(kind) &&
    (kind !== 'text' || textBackground.value !== 'none')
      ? { fillStyle: shapeFillStyle.value }
      : {}),
    ...(!['image', 'iframe', 'draw', 'arrow', 'line'].includes(kind) &&
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
  if (canHaveText(element) && (defaultFontSize.value || defaultTextColor.value)) {
    element.richText = plainToRich('', element)
    for (const paragraph of element.richText.paragraphs)
      for (const run of paragraph.runs) {
        if (defaultFontSize.value) run.fontSize = defaultFontSize.value
        if (defaultTextColor.value) run.color = defaultTextColor.value
      }
  }
  return element
}
function hit(
  position: BoardPoint,
  exclude?: string,
  tolerance = 0
): BoardElement | undefined {
  return [...editableElements.value]
    .reverse()
    .find(
      (e) =>
        e.id !== exclude &&
        e.kind !== 'arrow' &&
        e.kind !== 'line' &&
        e.kind !== 'draw' &&
        pointInElement(e, position, tolerance)
    )
}
function pointerDown(event: PointerEvent) {
  if (
    !(event.target as Element).closest(
      '.paper-favorites, .paper-navigator, .board-floating, .paper-context-bar, .paper-element-controls, .paper-library-panel, .paper-tool-rail'
    )
  ) {
    closeSettings()
    selectionPropertiesOpen.value = false
  }
  libraryOpen.value = false
  contextMenu.value = null
  layersCollapsed.value = true
  if (presenting.value) {
    event.preventDefault()
    return
  }
  if (sceneMode.value && !interactionLocked.value && event.button === 0 && !space.value) {
    event.preventDefault()
    viewport.value?.focus()
    finishEditing()
    const original = sceneMode.value === 'adjust' ? activeScene.value : undefined
    if (sceneMode.value === 'adjust' && !original) return
    sceneGesture.value = {
      pointer: event.pointerId,
      start: point(event),
      end: point(event),
      original: original ? { ...original } : undefined,
      resize: !!(event.target as Element).closest('[data-scene-resize]'),
    }
    viewport.value?.setPointerCapture?.(event.pointerId)
    return
  }
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
  const panning =
    interactionLocked.value || event.button === 1 || space.value || tool.value === 'pan'
  const before = panning ? local.value : copyElements(local.value)
  if (interactionLocked.value) {
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
  if (
    !['select', 'pan', 'eraser'].includes(tool.value) &&
    !activeLayerEditable.value &&
    event.button !== 1 &&
    !space.value
  )
    return
  if (event.button === 1 || space.value || tool.value === 'pan') {
    gesture.value = { ...base, mode: 'pan', start: screen(event) }
  } else if (tool.value === 'eraser') {
    eraserPosition.value = screen(event)
    local.value = eraseStrokes(
      local.value,
      p,
      p,
      eraserSize.value / camera.value.zoom / 2,
      undefined,
      isEditable
    )
    gesture.value = { ...base, mode: 'erase', end: p }
  } else if (
    tool.value === 'select' &&
    (event.target as Element).getAttribute('data-rotate') &&
    rotatableElement.value
  ) {
    gesture.value = { ...base, mode: 'rotate', id: rotatableElement.value.id }
  } else if (
    tool.value === 'select' &&
    (event.target as Element).getAttribute('data-resize') &&
    (selected.value.length === 1 || selectedGroup.value)
  ) {
    gesture.value = {
      ...base,
      mode: 'resize',
      id: selectedGroup.value?.id ?? selected.value[0],
      handle: ((event.target as Element).getAttribute('data-resize-handle') ??
        'se') as ResizeHandle,
    }
  } else if (
    tool.value === 'select' &&
    selectionMode.value === 'lasso' &&
    !(target && selected.value.includes(target))
  ) {
    const initialSelection = [...selected.value]
    if (!event.shiftKey) select([])
    gesture.value = {
      ...base,
      mode: 'lasso',
      lasso: [p],
      initialSelection,
      additive: event.shiftKey,
    }
  } else if (tool.value === 'select') {
    if (target) {
      if (event.shiftKey) {
        const targetIds = expandGroups(local.value, [target])
        select(
          selected.value.includes(target)
            ? selected.value.filter((id) => !targetIds.includes(id))
            : [...selected.value, ...targetIds]
        )
      } else if (!selected.value.includes(target)) select([target])
      gesture.value = {
        ...base,
        mode: 'move',
        ...dragGuides(),
        moving: selected.value.flatMap((id) => {
          const element = elementLookup.value.get(id)
          return element ? [{ element, x: element.x, y: element.y }] : []
        }),
      }
    } else {
      if (!event.shiftKey) select([])
      gesture.value = { ...base, mode: 'marquee', end: p }
    }
  } else if (tool.value === 'image') {
    imageInput.value?.click()
    return
  } else {
    const element = newElement(tool.value, p)
    if (element.kind === 'arrow' || element.kind === 'line') {
      element.startId =
        element.kind === 'arrow'
          ? (hit(p, undefined, 6 / camera.value.zoom)?.id ?? null)
          : null
      element.width = 0
      element.height = 0
    }
    local.value.push(element)
    select([element.id])
    gesture.value = { ...base, mode: 'create', id: element.id, stroke: [p] }
  }
  viewport.value?.setPointerCapture?.(event.pointerId)
}
function groupSelection() {
  contextMenu.value = null
  if (interactionLocked.value || !canGroup.value) return
  finishEditing()
  const before = copyElements(local.value)
  const id = crypto.randomUUID()
  for (const element of local.value)
    if (selected.value.includes(element.id)) {
      element.groupId = id
      element.layerId = elementLayerId(
        local.value.find((item) => selected.value.includes(item.id))!
      )
    }
  commit(before)
}
function ungroupSelection() {
  contextMenu.value = null
  if (interactionLocked.value || !canUngroup.value) return
  finishEditing()
  const before = copyElements(local.value)
  for (const element of local.value)
    if (selected.value.includes(element.id)) element.groupId = null
  commit(before)
}
function openContextMenu(event: MouseEvent) {
  if ((event.target as Element).closest('input,textarea,[contenteditable="true"]')) return
  event.preventDefault()
  if (interactionLocked.value) return
  finishEditing()
  cancelGesture()
  closeSettings()
  tool.value = 'select'
  const target = (event.target as Element)
    .closest('[data-element-id]')
    ?.getAttribute('data-element-id')
  if (target && !selected.value.includes(target)) select([target])
  if (!target) select([])
  selectionPropertiesOpen.value = false
  const position = screen(event)
  contextMenu.value = {
    x: Math.max(8, Math.min(position.x, (viewport.value?.clientWidth || 640) - 240)),
    y: Math.max(8, Math.min(position.y, (viewport.value?.clientHeight || 480) - 360)),
  }
  nextTick(() =>
    viewport.value
      ?.querySelector<HTMLButtonElement>('.paper-context-menu button:not(:disabled)')
      ?.focus()
  )
}
function contextAction(action: () => void) {
  contextMenu.value = null
  if (interactionLocked.value) return
  action()
  nextTick(() => viewport.value?.focus())
}
function contextKeyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    contextMenu.value = null
    viewport.value?.focus()
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const buttons = [
      ...viewport.value!.querySelectorAll<HTMLButtonElement>(
        '.paper-context-menu button:not(:disabled)'
      ),
    ]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
            buttons.length
    buttons[next]?.focus()
  }
}
function pointerMove(event: PointerEvent) {
  if (tool.value === 'eraser' && !interactionLocked.value)
    eraserPosition.value = screen(event)
  if (presenting.value) {
    return
  }
  if (sceneGesture.value?.pointer === event.pointerId) {
    sceneGesture.value.end = point(event)
    return
  }
  const g = gesture.value
  if (!g || g.pointer !== event.pointerId) return
  const p = point(event)
  if (g.heldShape) {
    if (
      Math.hypot(p.x - g.heldShape.anchor.x, p.y - g.heldShape.anchor.y) *
        camera.value.zoom <
      8
    )
      return
    const element = local.value.find((e) => e.id === g.id)
    if (element) local.value[local.value.indexOf(element)] = g.heldShape.original
    g.heldShape = undefined
  }
  if (g.mode === 'erase') {
    local.value = eraseStrokes(
      local.value,
      g.end ?? g.start,
      p,
      eraserSize.value / camera.value.zoom / 2,
      undefined,
      isEditable
    )
    g.end = p
  } else if (g.mode === 'pan') {
    const s = screen(event)
    camera.value = {
      ...g.camera,
      x: g.camera.x + s.x - g.start.x,
      y: g.camera.y + s.y - g.start.y,
    }
  } else if (g.mode === 'move') {
    const rawX = p.x - g.start.x,
      rawY = p.y - g.start.y
    const locked = event.shiftKey
      ? Math.abs(rawY) > Math.abs(rawX)
        ? 'x'
        : 'y'
      : undefined
    let dx = locked === 'x' ? 0 : rawX,
      dy = locked === 'y' ? 0 : rawY
    activeGuides.value = []
    if (guidesEnabled.value && g.guideBox && g.guideIndex) {
      const box = { ...g.guideBox, x: g.guideBox.x + dx, y: g.guideBox.y + dy }
      const result = smartGuides(box, g.guideIndex, 6 / camera.value.zoom, locked)
      if (snapEnabled.value && !event.altKey) {
        dx += result.dx
        dy += result.dy
        activeGuides.value = smartGuides(
          { ...box, x: box.x + result.dx, y: box.y + result.dy },
          g.guideIndex,
          0.01,
          locked
        ).guides
      } else activeGuides.value = result.guides
    }
    for (const original of g.moving ?? []) {
      original.element.x = original.x + dx
      original.element.y = original.y + dy
    }
  } else if (g.mode === 'marquee') g.end = p
  else if (g.mode === 'lasso') {
    const points = g.lasso!
    const last = points[points.length - 1]!
    if (Math.hypot(p.x - last.x, p.y - last.y) * camera.value.zoom >= 2) {
      if (points.length >= 1024) g.lasso = points.filter((_, index) => index % 2 === 0)
      g.lasso!.push(p)
    }
  } else {
    const group = groupBox(g.before, selected.value)
    if (group && (g.mode === 'rotate' || g.mode === 'resize')) {
      let transformed: BoardElement[]
      if (g.mode === 'rotate') {
        const center = { x: group.x + group.width / 2, y: group.y + group.height / 2 }
        let angle =
          Math.atan2(p.y - center.y, p.x - center.x) -
          Math.atan2(g.start.y - center.y, g.start.x - center.x)
        if (event.shiftKey) angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12
        transformed = transformGroup(g.before, selected.value, group, group, angle, true)
      } else {
        const resized = resizeElement(group, p, {
          handle: g.handle ?? 'se',
          proportional: true,
          fromCenter: event.altKey,
        })
        transformed = transformGroup(
          g.before,
          selected.value,
          group,
          {
            ...group,
            ...resized,
          },
          0,
          true
        )
      }
      for (const element of transformed) {
        const target = elementLookup.value.get(element.id)
        if (target) Object.assign(target, element)
      }
      return
    }
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
      if (element.kind === 'line') {
        const original = g.before.find((item) => item.id === element.id)!
        const [a, b] = linePoints(original)
        if (g.handle === 'nw') {
          let delta = { width: b.x - p.x, height: b.y - p.y }
          if (event.shiftKey) delta = constrainedArrow(delta.width, delta.height)
          Object.assign(element, {
            x: b.x - delta.width,
            y: b.y - delta.height,
            ...delta,
            angle: 0,
          })
        } else {
          let delta = { width: p.x - a.x, height: p.y - a.y }
          if (event.shiftKey) delta = constrainedArrow(delta.width, delta.height)
          Object.assign(element, { x: a.x, y: a.y, ...delta, angle: 0 })
        }
        return
      }
      if (element.kind === 'arrow') {
        element.width = p.x - element.x
        element.height = p.y - element.y
        if (event.shiftKey)
          Object.assign(element, constrainedArrow(element.width, element.height))
        element.endId = hit(p, element.id, 6 / camera.value.zoom)?.id ?? null
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
      armShapeHold(g, p)
    } else if (element.kind === 'arrow' || element.kind === 'line') {
      element.width = p.x - g.start.x
      element.height = p.y - g.start.y
      if (event.shiftKey)
        Object.assign(element, constrainedArrow(element.width, element.height))
      element.endId =
        element.kind === 'arrow'
          ? (hit(p, element.id, 6 / camera.value.zoom)?.id ?? null)
          : null
    } else {
      element.x = Math.min(g.start.x, p.x)
      element.y = Math.min(g.start.y, p.y)
      element.width = Math.max(24, Math.abs(p.x - g.start.x))
      element.height = Math.max(24, Math.abs(p.y - g.start.y))
      if (
        event.shiftKey &&
        ['rectangle', 'ellipse', 'triangle', 'hexagon', 'frame'].includes(element.kind)
      ) {
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
  activeGuides.value = []
  if (gesture.value?.pointer === event.pointerId) clearShapeHold()
  if (sceneGesture.value?.pointer === event.pointerId) {
    const g = sceneGesture.value
    g.end = point(event)
    const box =
      !g.original && Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y) < 4
        ? sceneAtCamera(camera.value, viewportSize.value, sceneRatio.value)
        : sceneDraft.value
    const before = copyScenes(localScenes.value)
    sceneGesture.value = null
    viewport.value?.releasePointerCapture?.(event.pointerId)
    if (!box || interactionLocked.value) return
    if (g.original)
      localScenes.value = localScenes.value.map((scene) =>
        scene.id === g.original!.id ? { ...scene, ...box } : scene
      )
    else if (localScenes.value.length < MAX_SCENES) {
      const scene: BoardScene = {
        id: crypto.randomUUID(),
        title: t('papers.presentation.sceneName', {
          number: localScenes.value.length + 1,
        }),
        ...box,
        aspectRatio: sceneRatio.value,
      }
      localScenes.value.push(scene)
      activeSceneId.value = scene.id
      sceneMode.value = 'adjust'
    }
    commit(copyElements(local.value), before)
    return
  }
  const g = gesture.value
  if (!g || g.pointer !== event.pointerId) return
  if (g.mode === 'erase') {
    const end = point(event)
    local.value = eraseStrokes(
      local.value,
      g.end ?? g.start,
      end,
      eraserSize.value / camera.value.zoom / 2,
      undefined,
      isEditable
    )
  }
  const box = marquee.value
  if (g.mode === 'lasso') {
    const polygon = [...g.lasso!, point(event)]
    const found = elementsInLasso(
      editableElements.value,
      polygon,
      local.value,
      10 / camera.value.zoom
    )
    select([...(g.additive ? (g.initialSelection ?? []) : []), ...found])
  }
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
  else if (g.mode !== 'pan' && g.mode !== 'marquee' && g.mode !== 'lasso')
    commit(g.before)
  if (g.mode === 'create') {
    const element = local.value.find((e) => e.id === g.id)
    if (!keepTool.value) tool.value = 'select'
    if (element && ['text', 'note', 'question', 'decision'].includes(element.kind))
      startEditing(element.id)
  }
}
function constrainedArrow(width: number, height: number) {
  const angle = (Math.round(Math.atan2(height, width) / (Math.PI / 4)) * Math.PI) / 4
  const length = Math.hypot(width, height)
  return { width: length * Math.cos(angle), height: length * Math.sin(angle) }
}
function cancelGesture() {
  activeGuides.value = []
  clearShapeHold()
  sceneGesture.value = null
  finishEditing()
  const previousSelection =
    gesture.value?.mode === 'lasso' ? gesture.value.initialSelection : undefined
  if (gesture.value) local.value = copyElements(gesture.value.before)
  gesture.value = null
  editing.value = null
  space.value = false
  select(
    (previousSelection ?? selected.value).filter((id) =>
      local.value.some((e) => e.id === id)
    )
  )
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
      if (rect) {
        viewportSize.value = { width: rect.width, height: rect.height }
        if (presenting.value) movePresentation(presentationIndex.value, false)
      }
    })
    resizeObserver.observe(viewport.value)
  }
  if (local.value.length)
    nextTick(() => {
      if (!presenting.value) fitContent()
    })
})
onBeforeUnmount(releaseArtisticBrushes)
onUnmounted(() => {
  disposed = true
  resizeObserver?.disconnect()
  window.removeEventListener('praxis:commit-board-edit', commitForExit)
  document.removeEventListener('pointerdown', dismissOutside, true)
})
function wheel(event: WheelEvent) {
  if (presenting.value) return
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
      x: (viewport.value?.clientWidth || 640) / 2,
      y: (viewport.value?.clientHeight || 480) / 2,
    },
    camera.value.zoom * factor
  )
}
function fitContent() {
  let box = bounds(renderedElements.value)
  if (showScenes.value && localScenes.value.length) {
    const regions = [
      ...(renderedElements.value.length ? [box] : []),
      ...localScenes.value,
    ]
    const x = Math.min(...regions.map((region) => region.x)),
      y = Math.min(...regions.map((region) => region.y))
    box = {
      x,
      y,
      width: Math.max(...regions.map((region) => region.x + region.width)) - x,
      height: Math.max(...regions.map((region) => region.y + region.height)) - y,
    }
  }
  const width = viewport.value?.clientWidth || 640
  const height = viewport.value?.clientHeight || 480
  const left =
    hideTools.value || !viewport.value?.clientWidth
      ? 0
      : Math.min(width <= 650 ? 80 : 120, width * 0.4)
  const top =
    hideTools.value || !viewport.value?.clientHeight ? 0 : width <= 1000 ? 104 : 64
  if (showScenes.value && localScenes.value.length) {
    camera.value = sceneCamera(box, { width: width - left, height: height - top }, 40)
    camera.value.x += left
    camera.value.y += top
    return
  }
  const zoom = Math.max(
    0.1,
    Math.min(2, (width - left - 80) / box.width, (height - top - 80) / box.height)
  )
  camera.value = {
    x: left + (width - left - box.width * zoom) / 2 - box.x * zoom,
    y: top + (height - top - box.height * zoom) / 2 - box.y * zoom,
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
  const groups = new Map(
    originals.filter((e) => e.groupId).map((e) => [e.groupId!, crypto.randomUUID()])
  )
  const copies = copyElements(originals).map((e) => ({
    ...e,
    id: ids.get(e.id)!,
    ...(e.groupId ? { groupId: groups.get(e.groupId)! } : {}),
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
  if (selectedGroup.value) {
    local.value = transformGroup(
      before,
      selected.value,
      selectedGroup.value,
      selectedGroup.value,
      delta
    )
    commit(before)
    return
  }
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
  if (interactionLocked.value) return
  cancelGesture()
  const snapshot = history.undo({
    elements: local.value,
    scenes: localScenes.value,
    layers: localLayers.value,
  })
  historyVersion.value++
  if (snapshot) {
    local.value = snapshot.elements
    localScenes.value = snapshot.scenes
    localLayers.value = copyLayers(snapshot.layers)
    ensureActiveLayer()
    if (!activeScene.value) {
      activeSceneId.value = null
      sceneMode.value = null
    }
    select([])
    publishContent()
    nextTick(() => viewport.value?.focus())
  }
}
function redo() {
  if (interactionLocked.value) return
  cancelGesture()
  const snapshot = history.redo({
    elements: local.value,
    scenes: localScenes.value,
    layers: localLayers.value,
  })
  historyVersion.value++
  if (snapshot) {
    local.value = snapshot.elements
    localScenes.value = snapshot.scenes
    localLayers.value = copyLayers(snapshot.layers)
    ensureActiveLayer()
    if (!activeScene.value) {
      activeSceneId.value = null
      sceneMode.value = null
    }
    select([])
    publishContent()
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
  if (event.key === 'Escape') contextMenu.value = null
  if (presenting.value) return
  if (sceneMode.value && event.key === 'Escape') {
    event.preventDefault()
    sceneMode.value = null
    sceneGesture.value = null
    return
  }
  if ((event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))
    return
  if (
    interactionLocked.value &&
    event.code !== 'Space' &&
    event.key !== 'Escape' &&
    !((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key))
  )
    return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
    event.preventDefault()
    event.shiftKey ? ungroupSelection() : groupSelection()
  } else if (event.code === 'Space') {
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
    if (tool.value !== 'select') chooseTool('select')
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
    if (event.key.toLowerCase() === 'q') {
      event.preventDefault()
      chooseWheelTool('lasso')
      return
    }
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
  libraryOpen.value = false
  if (interactionLocked.value) return
  scenesOpen.value = false
  sceneMode.value = null
  closeSettings()
  selectionPropertiesOpen.value = false
  layersCollapsed.value = true
  if (editing.value && editing.value !== id) finishEditing()
  const element = local.value.find((e) => e.id === id)
  if (element?.kind === 'arrow' && isEditable(element)) {
    select([id])
    nextTick(() => {
      const input = editorRoot.value?.querySelector<HTMLInputElement>(
        '[data-connector-label-input]'
      )
      input?.focus()
      input?.select()
    })
    return
  }
  if (!element || !canEditText(element) || !isEditable(element)) return
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
      '.paper-favorites, .paper-navigator, .board-rich-editor, .board-text-editor, .board-floating'
    )
  )
    return
  if (
    event.button !== 0 ||
    space.value ||
    tool.value === 'pan' ||
    tool.value === 'eraser'
  )
    return
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
  if (interactionLocked.value) {
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
  rememberWritingPreferences()
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
      !['image', 'iframe'].includes(element.kind) &&
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
  rememberWritingPreferences()
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (tool.value !== 'select' || !selected.value.includes(element.id)) continue
    if (patch.opacity !== undefined) element.opacity = brushOpacity.value
    if (!['image', 'iframe'].includes(element.kind)) {
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
function setSketchOptions(patch: Partial<BoardSketchOptions>) {
  if (interactionLocked.value) return
  finishEditing()
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (
      !selected.value.includes(element.id) ||
      element.kind === 'draw' ||
      element.kind === 'image' ||
      element.kind === 'iframe' ||
      (element.kind === 'text' && (element.textBackground ?? 'none') === 'none')
    )
      continue
    element.sketch = {
      ...DEFAULT_SKETCH_OPTIONS,
      strokePattern: element.kind === 'frame' ? 'dashed' : 'solid',
      ...element.sketch,
      ...patch,
    }
  }
  shapeSketch.value = { ...DEFAULT_SKETCH_OPTIONS, ...shapeSketch.value, ...patch }
  commit(before)
}
function setFillStyle(next: BoardFillStyle) {
  if (interactionLocked.value) return
  finishEditing()
  shapeFillStyle.value = next
  const before = copyElements(local.value)
  for (const element of local.value) {
    if (!selected.value.includes(element.id) || !canHaveFill(element)) continue
    element.fillStyle = next
    if (fill(element) === 'transparent') element.fillColor = '#7f91ad'
  }
  if (shapeFill.value === null || shapeFill.value === 'transparent')
    shapeFill.value = '#7f91ad'
  commit(before)
}
function setElementText(patch: { fontSize?: number; color?: string }) {
  if (patch.fontSize !== undefined && !Number.isFinite(patch.fontSize)) return
  finishEditing()
  if (patch.fontSize !== undefined && Number.isFinite(patch.fontSize))
    defaultFontSize.value = Math.round(Math.max(8, Math.min(72, patch.fontSize)))
  if (patch.color && /^#[0-9a-f]{6}$/i.test(patch.color))
    defaultTextColor.value = patch.color
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
    if (next === 'none') {
      element.fillColor = null
      element.fillStyle = null
      element.sketch = null
    }
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
  if (interactionLocked.value || !activeLayerEditable.value) return
  try {
    const image = await boardImage(file)
    if (disposed || interactionLocked.value || !activeLayerEditable.value) return
    insertImage(image, file.name, position)
  } catch {
    error.value = t('boards.imageRejected')
  }
}
function insertImage(
  image: { data: string; width: number; height: number },
  name: string,
  position?: BoardPoint
) {
  if (interactionLocked.value || !activeLayerEditable.value) return
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
    text: name,
  })
  const before = copyElements(local.value)
  local.value.push(element)
  select([element.id])
  commit(before)
  error.value = ''
  tool.value = 'select'
}
function fileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) void addImage(input.files[0])
  input.value = ''
}
function drop(event: DragEvent) {
  if (interactionLocked.value) return
  if (event.dataTransfer?.files[0])
    void addImage(event.dataTransfer.files[0], point(event))
}
let lastPasteId = ''
let pasteCount = 0
let pasteQueue: Promise<void> = Promise.resolve()
function clipboardTextTarget(event: ClipboardEvent) {
  return (
    !!editing.value ||
    (event.target instanceof Element &&
      !!event.target.closest('input,textarea,select,[contenteditable="true"]'))
  )
}
function copySelection(event: ClipboardEvent) {
  if (
    presenting.value ||
    gesture.value ||
    clipboardTextTarget(event) ||
    !selected.value.length ||
    !event.clipboardData
  )
    return
  try {
    const source = librarySelection(
      local.value.map((e) =>
        e.kind === 'task'
          ? {
              ...e,
              text: props.taskTitles?.[e.taskId ?? '']?.title ?? e.text,
              richText: null,
            }
          : e
      ),
      selected.value
    )
    if (!source.length) return
    const value = encodePaperClipboard(source)
    event.clipboardData.setData('text/plain', value)
    try {
      event.clipboardData.setData(PAPER_CLIPBOARD_MIME, value)
    } catch {
      /* Plain text preserves the portable payload. */
    }
    event.preventDefault()
    error.value = ''
  } catch {
    error.value = t('boards.clipboard.copyFailed')
  }
}
async function pasteElements(
  payload: NonNullable<ReturnType<typeof decodePaperClipboard>>
) {
  try {
    const source = await validatePaperClipboard(payload.elements)
    if (
      disposed ||
      interactionLocked.value ||
      !activeLayerEditable.value ||
      editing.value ||
      gesture.value
    )
      return
    if (local.value.length + source.length > 2000) {
      error.value = t('boards.clipboard.limit')
      return
    }
    const count = payload.copyId === lastPasteId ? pasteCount + 1 : 1
    const offset = (((count - 1) % 8) + 1) * 24
    const center = worldPoint(
      {
        x: (viewport.value?.clientWidth || 640) / 2 + offset,
        y: (viewport.value?.clientHeight || 480) / 2 + offset,
      },
      camera.value
    )
    const elements = instantiateLibraryItem(source, center, activeLayerId.value, false)
    const before = copyElements(local.value)
    local.value.push(...elements)
    tool.value = 'select'
    select(elements.map((e) => e.id))
    libraryOpen.value = false
    closeSettings()
    selectionPropertiesOpen.value = false
    lastPasteId = payload.copyId
    pasteCount = count
    commit(before)
    error.value = ''
    nextTick(() => viewport.value?.focus())
  } catch {
    if (!disposed) error.value = t('boards.clipboard.pasteFailed')
  }
}
function paste(event: ClipboardEvent) {
  if (clipboardTextTarget(event) || interactionLocked.value) return
  try {
    const value =
      event.clipboardData?.getData(PAPER_CLIPBOARD_MIME) ||
      event.clipboardData?.getData('text/plain') ||
      ''
    const payload = decodePaperClipboard(value)
    if (payload) {
      event.preventDefault()
      if (!activeLayerEditable.value) {
        error.value = t('boards.clipboard.lockedLayer')
        return
      }
      // Serialize rapid Ctrl+V presses; each insertion is one independent undo step.
      pasteQueue = pasteQueue.then(() => pasteElements(payload))
      return
    }
  } catch {
    event.preventDefault()
    error.value = t('boards.clipboard.pasteFailed')
    return
  }
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
  return elementLabelScheme(element, props.colorScheme)
}
function fill(element: BoardElement) {
  return elementFill(element)
}
async function renderPaperImage(
  region?: { x: number; y: number; width: number; height: number },
  format = 'image/png'
) {
  finishEditing()
  await loadBoardFont()
  fontReady.value++
  await nextTick()
  if (!svg.value) throw new Error('canvas')
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  await embedBoardFont(clone)
  clone.querySelectorAll('[data-editor-only]').forEach((node) => node.remove())
  for (const element of renderedElements.value.filter(
    (element) => element.kind === 'draw' && element.drawBrush && !isWritingBrush(element)
  )) {
    const group = [...clone.querySelectorAll('[data-artistic-brush]')].find(
      (node) => node.getAttribute('data-artistic-brush') === element.id
    )
    const raster = await renderArtisticBrush(element, stroke(element))
    if (group && raster) applyBrushRaster(group, raster)
  }
  finishNotationExport(clone)
  const box = bounds(renderedElements.value)
  // Include anchored connector endpoints, which may extend beyond their original boxes.
  const endpoints = renderedElements.value
    .filter((e) => e.kind === 'arrow')
    .flatMap((e) => connectorOutline(e, local.value))
  const margin = Math.max(
    hasAnnotations.value ? 64 : 32,
    ...renderedElements.value
      .filter((element) => element.drawBrush)
      .map((element) => (element.strokeWidth ?? 2) * 3 + 4)
  )
  const left = region?.x ?? Math.min(box.x, ...endpoints.map((p) => p.x)) - margin
  const top = region?.y ?? Math.min(box.y, ...endpoints.map((p) => p.y)) - margin
  const right = region
    ? region.x + region.width
    : Math.max(box.x + box.width, ...endpoints.map((p) => p.x)) + margin
  const bottom = region
    ? region.y + region.height
    : Math.max(box.y + box.height, ...endpoints.map((p) => p.y)) + margin
  const qualityScale = region
    ? Math.max(1, 1920 / Math.max(region.width, region.height))
    : 1
  const size = exportSize((right - left) * qualityScale, (bottom - top) * qualityScale)
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
        format,
        0.94
      )
    )
    return { blob, width: size.width, height: size.height }
  } catch {
    error.value = t('boards.exportFailed')
    throw new Error(error.value)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function exportPng(title: string) {
  const result = await renderPaperImage()
  await saveBoardPng(result.blob, title)
  error.value = ''
}

async function exportPresentation() {
  if (!localScenes.value.length || exportingPresentation.value) return
  commitPendingEdit()
  exportingPresentation.value = true
  try {
    const scenes = copyScenes(localScenes.value)
    const pages = []
    let exportedBytes = 0
    for (const scene of scenes) {
      if (disposed) return
      const { blob, width, height } = await renderPaperImage(scene, 'image/jpeg')
      exportedBytes += blob.size
      if (exportedBytes > 64 * 1024 * 1024) throw new Error('PDF exceeds 64 MiB')
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width, height })
    }
    if (!disposed)
      await saveBoardPdf(buildPresentationPdf(pages), props.title ?? 'Praxis')
    error.value = ''
  } catch {
    error.value = t('boards.exportFailed')
  } finally {
    exportingPresentation.value = false
  }
}

function toggleScenes() {
  libraryOpen.value = false
  commitPendingEdit()
  closeSettings()
  select([])
  scenesOpen.value = !scenesOpen.value
  if (!scenesOpen.value) sceneMode.value = null
}
function finishSceneMode() {
  sceneMode.value = null
  sceneGesture.value = null
  nextTick(() => viewport.value?.focus())
}
function closeScenes() {
  scenesOpen.value = false
  finishSceneMode()
}
function createScene(ratio: SceneRatio) {
  if (interactionLocked.value || localScenes.value.length >= MAX_SCENES) return
  commitPendingEdit()
  select([])
  sceneRatio.value = ratio
  sceneMode.value = 'create'
  showScenes.value = true
  nextTick(() => viewport.value?.focus())
}
function focusScene(id: string) {
  const scene = localScenes.value.find((scene) => scene.id === id)
  if (!scene || presenting.value) return
  commitPendingEdit()
  activeSceneId.value = id
  sceneMode.value = null
  const left = hideTools.value ? 0 : Math.min(210, viewportSize.value.width / 3)
  const available = {
    ...viewportSize.value,
    width: Math.max(200, viewportSize.value.width - (scenesOpen.value ? 310 : 0) - left),
  }
  camera.value = sceneCamera(scene, available, 48)
  camera.value.x += left
}
function adjustScene(id: string) {
  if (interactionLocked.value) return
  focusScene(id)
  sceneMode.value = 'adjust'
  showScenes.value = true
  select([])
  nextTick(() => viewport.value?.focus())
}
function updateScene(scene: BoardScene) {
  if (
    interactionLocked.value ||
    ![scene.x, scene.y, scene.width, scene.height].every(Number.isFinite) ||
    scene.width < 24 ||
    scene.height < 24
  )
    return
  commitPendingEdit()
  const before = copyScenes(localScenes.value)
  localScenes.value = localScenes.value.map((item) =>
    item.id === scene.id ? { ...scene, title: scene.title.slice(0, 200) } : item
  )
  commit(copyElements(local.value), before)
}
function removeScene(id: string) {
  if (interactionLocked.value) return
  commitPendingEdit()
  const before = copyScenes(localScenes.value)
  localScenes.value = localScenes.value.filter((scene) => scene.id !== id)
  if (activeSceneId.value === id) {
    activeSceneId.value = null
    sceneMode.value = null
  }
  commit(copyElements(local.value), before)
}
function reorderScenes(ids: string[]) {
  if (
    interactionLocked.value ||
    ids.length !== localScenes.value.length ||
    new Set(ids).size !== ids.length
  )
    return
  const ordered = ids.map((id) => localScenes.value.find((scene) => scene.id === id))
  if (ordered.some((scene) => !scene)) return
  commitPendingEdit()
  const before = copyScenes(localScenes.value)
  localScenes.value = ordered as BoardScene[]
  commit(copyElements(local.value), before)
}
function movePresentation(index: number, animate = true) {
  const scene = localScenes.value[index]
  if (!scene) return
  presentationIndex.value = index
  cancelAnimationFrame(cameraFrame)
  const target = sceneCamera(scene, viewportSize.value)
  const previous = { ...camera.value }
  const distant =
    Math.hypot(target.x - previous.x, target.y - previous.y) >
    Math.max(viewportSize.value.width, viewportSize.value.height) * 2
  if (
    !animate ||
    !smoothTransition.value ||
    distant ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    camera.value = target
    return
  }
  const started = performance.now()
  function step(now: number) {
    const progress = Math.min(1, (now - started) / 260)
    const eased = progress * progress * (3 - 2 * progress)
    camera.value = {
      x: previous.x + (target.x - previous.x) * eased,
      y: previous.y + (target.y - previous.y) * eased,
      zoom: previous.zoom + (target.zoom - previous.zoom) * eased,
    }
    if (progress < 1) cameraFrame = requestAnimationFrame(step)
  }
  cameraFrame = requestAnimationFrame(step)
}
async function startPresentation() {
  if (!localScenes.value.length || presenting.value) return
  commitPendingEdit()
  closeSettings()
  select([])
  sceneMode.value = null
  savedCamera = { ...camera.value }
  presentationIndex.value = Math.max(
    0,
    localScenes.value.findIndex((scene) => scene.id === activeSceneId.value)
  )
  presenting.value = true
  emit('presentation', true)
  try {
    if (editorRoot.value?.requestFullscreen && !document.fullscreenElement) {
      await editorRoot.value.requestFullscreen()
      ownsFullscreen = true
    }
  } catch {
    /* Fixed overlay remains available when fullscreen is denied. */
  }
  await nextTick()
  if (!presenting.value) return
  measurePresentation()
  viewport.value?.focus()
}
function measurePresentation() {
  if (!presenting.value) return
  const box = viewport.value?.getBoundingClientRect()
  if (box?.width && box.height)
    viewportSize.value = { width: box.width, height: box.height }
  movePresentation(presentationIndex.value, false)
}
function stopPresentation() {
  if (!presenting.value) return
  cancelAnimationFrame(cameraFrame)
  presenting.value = false
  if (savedCamera) camera.value = savedCamera
  savedCamera = null
  emit('presentation', false)
  if (ownsFullscreen && document.fullscreenElement === editorRoot.value)
    void document.exitFullscreen().catch(() => {})
  ownsFullscreen = false
  nextTick(() => viewport.value?.focus())
}
function presentationKeyboard(event: KeyboardEvent) {
  if (
    !presenting.value ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  if (
    ![
      'Escape',
      'ArrowRight',
      'ArrowLeft',
      'ArrowDown',
      'ArrowUp',
      'PageDown',
      'PageUp',
      ' ',
      'Home',
      'End',
    ].includes(event.key)
  )
    return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.key === 'Escape') stopPresentation()
  else if (event.key === 'Home') movePresentation(0)
  else if (event.key === 'End') movePresentation(localScenes.value.length - 1)
  else
    movePresentation(
      presentationIndex.value +
        (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ||
        (event.key === ' ' && event.shiftKey)
          ? -1
          : 1)
    )
}
function fullscreenChanged() {
  if (
    presenting.value &&
    ownsFullscreen &&
    document.fullscreenElement !== editorRoot.value
  )
    stopPresentation()
}
onMounted(() => {
  window.addEventListener('keydown', presentationKeyboard, true)
  window.addEventListener('resize', measurePresentation)
  document.addEventListener('fullscreenchange', fullscreenChanged)
})
onBeforeUnmount(() => {
  clearShapeHold()
  stopPresentation()
  cancelAnimationFrame(cameraFrame)
  window.removeEventListener('keydown', presentationKeyboard, true)
  window.removeEventListener('resize', measurePresentation)
  document.removeEventListener('fullscreenchange', fullscreenChanged)
})
defineExpose({
  toggleScenes,
  startPresentation,
  stopPresentation,
  exportPresentation,
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
    ref="editorRoot"
    class="board-editor"
    :data-paper-scheme="colorScheme ?? 'light'"
    @copy="copySelection"
    @paste="paste"
    :style="{ '--pe-context-height': `${contextHeight}px` }"
    :class="{ 'board-distraction-free': hideTools, 'paper-presenting': presenting }"
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
      :class="{ 'board-panning': interactionLocked || space || tool === 'pan' }"
      :style="gridStyle"
      tabindex="0"
      :aria-label="t('boards.canvasLabel')"
      @pointerdown="pointerDown"
      @contextmenu="openContextMenu"
      @pointermove="pointerMove"
      @pointerleave="eraserPosition = null"
      @pointerup="pointerUp"
      @dblclick="editAtPointer"
      @pointercancel="cancelGesture"
      @lostpointercapture="(gesture || sceneGesture) && cancelGesture()"
      @wheel.prevent="wheel"
      @keydown="keyboard"
      @keydown.capture="historyKeyboard"
      @keyup="space = false"
      @blur="space = false"
      @dragover.prevent
      @drop.prevent="drop"
    >
      <div
        v-if="readOnly && !presenting"
        class="board-lock-hint board-floating"
        role="status"
      >
        <LockKeyhole :size="16" />{{ t('boards.lockedHint') }}
      </div>
      <div
        v-if="tool === 'eraser' && eraserPosition && !interactionLocked && !space"
        class="paper-eraser-cursor"
        :style="{
          left: `${eraserPosition.x}px`,
          top: `${eraserPosition.y}px`,
          width: `${eraserSize}px`,
          height: `${eraserSize}px`,
        }"
        aria-hidden="true"
      />
      <div
        v-if="contextMenu && !interactionLocked"
        class="paper-context-menu board-floating"
        role="menu"
        :aria-label="t('boards.grouping.menu')"
        :style="{
          left: `${contextMenu.x}px`,
          top: `${contextMenu.y}px`,
          maxHeight: `calc(100% - ${contextMenu.y + 8}px)`,
        }"
        @pointerdown.stop
        @wheel.stop
        @keydown.stop="contextKeyboard"
      >
        <button
          role="menuitem"
          data-context-group
          :disabled="!canGroup"
          @click="contextAction(groupSelection)"
        >
          {{ t('boards.grouping.group') }} <kbd>Ctrl+G</kbd>
        </button>
        <button
          role="menuitem"
          data-context-ungroup
          :disabled="!canUngroup"
          @click="contextAction(ungroupSelection)"
        >
          {{ t('boards.grouping.ungroup') }} <kbd>Ctrl+Shift+G</kbd>
        </button>
        <hr />
        <button
          role="menuitem"
          :disabled="!selected.length"
          @click="contextAction(duplicateSelection)"
        >
          {{ t('boards.duplicate') }} <kbd>Ctrl+D</kbd>
        </button>
        <button
          role="menuitem"
          :disabled="!selected.length"
          @click="contextAction(() => orderSelection(true))"
        >
          {{ t('boards.grouping.front') }}
        </button>
        <button
          role="menuitem"
          :disabled="!selected.length"
          @click="contextAction(() => orderSelection(false))"
        >
          {{ t('boards.grouping.back') }}
        </button>
        <button
          role="menuitem"
          data-context-delete
          :disabled="!selected.length"
          @click="contextAction(removeSelection)"
        >
          {{ t('boards.grouping.delete') }} <kbd>Delete</kbd>
        </button>
        <hr />
        <button
          role="menuitem"
          :disabled="!canUndo"
          @click="contextAction(undo)"
        >
          {{ t('boards.undo') }} <kbd>Ctrl+Z</kbd>
        </button>
        <button
          role="menuitem"
          :disabled="!canRedo"
          @click="contextAction(redo)"
        >
          {{ t('boards.redo') }} <kbd>Ctrl+Shift+Z</kbd>
        </button>
      </div>
      <PaperLayersPanel
        v-if="!hideTools"
        :layers="localLayers"
        :elements="local"
        :active-id="activeLayerId"
        :selected-count="selected.length"
        :read-only="!!interactionLocked"
        :collapsed="layersCollapsed"
        @collapse="toggleLayersPanel"
        @active="activateLayer"
        @add="addLayer"
        @patch="patchLayer"
        @order="reorderLayer"
        @remove="removeLayer"
        @move-selection="moveSelectionToLayer"
      />
      <PaperToolRail
        v-if="!hideTools && !interactionLocked"
        :tools="[...tools]"
        :active-tool="activeWheelTool"
        :selection-mode="selectionMode"
        @library="openPersonalLibrary"
        @choose="chooseWheelTool"
        @menu-open="openToolMenu"
        @undo="undo"
        @redo="redo"
      />
      <div v-if="!hideTools && !interactionLocked && !editing && tool === 'draw'" class="paper-favorites" @pointerdown.stop @wheel.stop>
        <span>{{ t('boards.favorites.title') }}</span>
        <button type="button" :disabled="favoritePens.length >= 6 || savingFavorites" @click="saveFavoritePen">{{ t('boards.favorites.save') }}</button>
        <span v-for="(pen, index) in favoritePens" :key="index" class="paper-favorite">
          <button type="button" :title="t('boards.favorites.use', { instrument: pen.instrument, width: pen.width })" @click="applyFavoritePen(pen)">
            <i :style="{ background: pen.customColor || DEFAULT_PEN_COLOR, opacity: pen.opacity }" />{{ index + 1 }} · {{ pen.width }}
          </button>
          <button type="button" :aria-label="t('boards.favorites.remove', { number: index + 1 })" :disabled="savingFavorites" @click="removeFavoritePen(index)">×</button>
        </span>
      </div>
      <PaperContextBar
        v-if="!hideTools && !interactionLocked && !editing"
        :tool="tool === 'select' && selectionMode === 'lasso' ? 'lasso' : activeWheelTool"
        :selection-key="selected.join(',')"
        :keep-tool="keepTool"
        @keep-tool="keepTool = $event"
        @dismiss="dismissToolPanels"
        :connector="tool === 'arrow' || !!selectedConnector"
        :connector-style="
          selectedConnector
            ? (selectedConnector.connectorStyle ?? 'straight')
            : connectorStyle
        "
        :connector-label="selectedConnector?.text ?? ''"
        @connector-style="setConnectorStyle"
        @connector-label="setConnectorLabel"
        :can-group="canGroup"
        :can-ungroup="canUngroup"
        :movable-count="movableCount"
        :rotatable="!!rotatableElement"
        :auto-width="selectedElement?.textAutoWidth"
        :sketch="
          selectedElement?.sketch ??
          shapeSketch ?? {
            ...DEFAULT_SKETCH_OPTIONS,
            strokePattern:
              (selectedElement?.kind ?? tool) === 'frame' ? 'dashed' : 'solid',
          }
        "
        @group="groupSelection"
        @ungroup="ungroupSelection"
        @arrange="organizeSelection"
        @rotate="rotateSelection($event)"
        @auto-width="setTextAutoWidth"
        @sketch="setSketchOptions"
        @library="openPersonalLibrary"
        :guides-enabled="guidesEnabled"
        :snap-enabled="snapEnabled"
        @guides="toggleGuides"
        @snap="snapEnabled = !snapEnabled"
        :shape-recognition="shapeRecognition"
        @shape-recognition="toggleShapeRecognition"
        :brush="instrumentBrush"
        :drawing-selection="tool === 'select' && selectedElement?.kind === 'draw'"
        :base-instrument="instrumentBase"
        :color="wheelColor"
        :width="wheelWidth"
        :stroke="showStrokeStyle"
        :stroke-style="selectedStrokeStyle"
        :fill-style="selectedFillStyle"
        :opacity="wheelOpacity"
        :text-box="
          tool === 'text' ||
          (tool === 'select' &&
            local.some((e) => selected.includes(e.id) && e.kind === 'text'))
        "
        :text-background="selectedTextBackground"
        :vertical-align="selectedTextVerticalAlign"
        :eraser-size="eraserSize"
        :selection="tool === 'select' && selected.length > 0"
        :text="
          [
            'text',
            'note',
            'rectangle',
            'ellipse',
            'triangle',
            'hexagon',
            'frame',
          ].includes(tool) ||
          (tool === 'select' &&
            local.some((e) => selected.includes(e.id) && canEditText(e)))
        "
        :edit-available="!!editableSelection"
        :fill="fillAvailable"
        :font-size="selectedFontSize"
        :font="selectedTextFont"
        :text-color="selectedTextColor"
        :fill-color="selectedFill"
        :align="selectedTextAlign"
        :settings-open="settingsOpen || selectionPropertiesOpen"
        @brush="setBrush"
        @height="contextHeight = $event"
        @stroke-style="setStrokeStyle"
        @fill-style="setFillStyle"
        @background="setTextBackground"
        @vertical-align="setTextAlignment({ textVerticalAlign: $event })"
        @eraser-size="eraserSize = $event"
        @instrument="chooseContextInstrument"
        @font-size="setElementText({ fontSize: $event })"
        @font="setTextStyle({ textFont: $event })"
        @text-color="setElementText({ color: $event })"
        @fill-color="setFillColor"
        @align="setTextAlignment({ textAlign: $event })"
        @settings="toggleContextSettings"
        @edit="editableSelection && startEditing(editableSelection.id)"
        @duplicate="duplicateSelection"
        @remove="removeSelection"
      />
      <PaperLibraryPanel
        v-if="libraryOpen && !hideTools && !interactionLocked"
        :selection="selectionForLibrary"
        :read-only="!activeLayerEditable"
        @close="libraryOpen = false"
        @insert="insertLibraryItem"
      />
      <PaperScenesPanel
        v-if="scenesOpen && !presenting"
        :scenes="localScenes"
        :active-id="activeSceneId"
        :read-only="interactionLocked"
        :content-id="contentId"
        :exporting="exportingPresentation"
        :frames-visible="showScenes"
        @close="closeScenes"
        @create="createScene"
        @focus="focusScene"
        @edit="adjustScene"
        @update="updateScene"
        @remove="removeScene"
        @reorder="reorderScenes"
        @present="startPresentation"
        @export-pdf="exportPresentation"
        @visibility="showScenes = $event"
      />
      <div
        v-if="sceneMode && !presenting"
        class="paper-scene-hint board-floating"
        role="status"
        @pointerdown.stop
      >
        <span>{{
          t(
            sceneMode === 'create'
              ? 'papers.presentation.drawHint'
              : 'papers.presentation.adjustHint'
          )
        }}</span>
        <button
          type="button"
          @click="finishSceneMode"
        >
          {{ t('papers.presentation.done') }}
        </button>
      </div>
      <div
        v-if="showStyle && !hideTools && !interactionLocked"
        v-show="settingsOpen"
        class="board-style-panel board-floating"
        :style="{
          left: `${Math.max(12, Math.min(layersCollapsed ? 264 : 444, viewportSize.width - 300))}px`,
        }"
        :class="{ 'board-instruments-panel': brushLibraryOpen }"
        @pointerdown.stop
        @wheel.stop
        @keydown.stop="settingsKeydown"
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
          <PaperSketchControls
            v-if="showStrokeStyle && tool !== 'draw' && selectedElement?.kind !== 'draw'"
            :model-value="shapeSketch ?? DEFAULT_SKETCH_OPTIONS"
            :stroke-style="selectedStrokeStyle"
            :fill="fillAvailable && selectedFillStyle !== 'solid'"
            @change="setSketchOptions"
            @style="setStrokeStyle"
          />
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
            v-if="rotatableElement && !selectedGroup"
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
              :aria-pressed="(selectedElement?.color ?? color) === item"
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
          <PaperFillStylePicker
            v-if="fillAvailable"
            :model-value="selectedFillStyle"
            @update:model-value="setFillStyle"
          />
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
          !scenesOpen &&
          !editing &&
          !hideTools &&
          !interactionLocked
        "
        :count="selected.length"
        :group="!!selectedGroup"
        :sketch="
          selectedElement?.sketch ?? {
            ...DEFAULT_SKETCH_OPTIONS,
            strokePattern: selectedElement?.kind === 'frame' ? 'dashed' : 'solid',
          }
        "
        :stroke-style="selectedElement?.strokeStyle"
        :sketch-available="
          local.some(
            (element) =>
              selected.includes(element.id) &&
              !['image', 'iframe'].includes(element.kind) &&
              element.kind !== 'draw' &&
              (element.kind !== 'text' || (element.textBackground ?? 'none') !== 'none')
          )
        "
        @sketch="setSketchOptions"
        @stroke-style="setStrokeStyle"
        :text="
          local.some((element) => selected.includes(element.id) && canEditText(element))
        "
        :fill="fillAvailable"
        :font-size="selectedFontSize"
        :text-color="selectedTextColor"
        :fill-color="selectedFill"
        :fill-style="selectedFillStyle"
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
        @fill-style="setFillStyle"
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
        v-if="!hideTools && !interactionLocked && !editing"
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
      <details
        v-if="!hideTools && !selected.length && !editing && tool !== 'eraser'"
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
      <PaperNavigator v-if="navigationOpen && !hideTools && !presenting" :elements="renderedElements" :camera="camera" :size="viewportSize" @navigate="navigatePaper" @close="navigationOpen = false" />
      <div
        v-if="!hideTools"
        class="board-zoom board-floating"
        @pointerdown.stop
        @wheel.stop
      >
        <button type="button" class="paper-navigation-button" :aria-pressed="navigationOpen" @click="navigationOpen = !navigationOpen">{{ t('boards.navigation.map') }}</button>
        <button type="button" class="paper-navigation-button" :disabled="!previousCamera" @click="returnToPosition">{{ t('boards.navigation.back') }}</button>
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
          <BoardSceneContent
            :content-id="contentId"
            :elements="renderedElements"
            :layers="localLayers"
            :endpoints="connectorEndpoints"
            :zoom="camera.zoom"
            :color-scheme="colorScheme"
            :editing="editing"
            :font-ready="fontReady"
            :replay="notationReplay"
            :group-delays="notationGroupDelays"
            :preview-id="gesture?.mode === 'create' ? gesture.id : undefined"
            :visible-artistic-ids="visibleArtisticIds"
            :eraser="tool === 'eraser'"
            :task-titles="taskTitles"
            @edit="startEditing"
            @fallback="brushFallback = true"
          />
          <g
            v-if="showScenes && !presenting"
            data-editor-only
            class="paper-scene-frames"
          >
            <g
              v-for="(scene, index) in localScenes"
              :key="scene.id"
              :data-paper-scene="scene.id"
            >
              <rect
                :x="scene.x"
                :y="scene.y"
                :width="scene.width"
                :height="scene.height"
                fill="none"
                :stroke="
                  activeSceneId === scene.id ? 'var(--paper-canvas-ink)' : '#8b9198'
                "
                :stroke-width="(activeSceneId === scene.id ? 2 : 1) / camera.zoom"
                :stroke-dasharray="`${8 / camera.zoom} ${5 / camera.zoom}`"
                pointer-events="none"
              />
              <text
                :x="scene.x"
                :y="scene.y - 8 / camera.zoom"
                :font-size="12 / camera.zoom"
                fill="var(--paper-canvas-ink)"
                font-family="Arial,sans-serif"
                pointer-events="all"
                @pointerdown.stop
                @click.stop="focusScene(scene.id)"
              >
                {{ index + 1 }} · {{ scene.title }}
              </text>
              <rect
                v-if="sceneMode === 'adjust' && activeSceneId === scene.id"
                data-scene-resize
                :x="scene.x + scene.width - 6 / camera.zoom"
                :y="scene.y + scene.height - 6 / camera.zoom"
                :width="12 / camera.zoom"
                :height="12 / camera.zoom"
                fill="white"
                stroke="#263238"
                :stroke-width="1 / camera.zoom"
                pointer-events="all"
                style="cursor: nwse-resize"
              />
            </g>
          </g>
          <rect
            v-if="sceneDraft"
            data-editor-only
            :x="sceneDraft.x"
            :y="sceneDraft.y"
            :width="sceneDraft.width"
            :height="sceneDraft.height"
            fill="none"
            stroke="#64748b"
            :stroke-width="2 / camera.zoom"
            :stroke-dasharray="`${6 / camera.zoom} ${3 / camera.zoom}`"
            pointer-events="none"
          />
          <g
            v-if="
              tool === 'select' &&
              selectionBox &&
              !isEditingFreeText &&
              !interactionLocked
            "
            data-editor-only
            :transform="rotationTransform(rotatableElement)"
          >
            <rect
              data-selection-outline
              :x="selectionBox.x"
              :y="selectionBox.y"
              :width="selectionBox.width"
              :height="selectionBox.height"
              fill="none"
              stroke="var(--accent)"
              :stroke-width="1.5 / camera.zoom"
              pointer-events="none"
            />
            <circle
              v-if="selectedArrow"
              data-resize="true"
              :cx="selectedLinePoints![1].x"
              :cy="selectedLinePoints![1].y"
              :r="6 / camera.zoom"
              fill="white"
              stroke="var(--accent)"
              :stroke-width="2 / camera.zoom"
              style="cursor: crosshair"
            />
            <circle
              v-if="selectedArrow?.kind === 'line' && selectedLinePoints"
              data-resize="true"
              data-resize-handle="nw"
              :cx="selectedLinePoints[0].x"
              :cy="selectedLinePoints[0].y"
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
              :y1="selectionBox.y"
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
          <g
            v-if="activeGuides.length"
            data-editor-only
            data-smart-guides
            pointer-events="none"
            aria-hidden="true"
          >
            <g
              v-for="(guide, index) in activeGuides"
              :key="index"
              :style="{
                color:
                  guide.kind === 'spacing'
                    ? colorScheme === 'dark'
                      ? '#d8b4fe'
                      : '#9333a7'
                    : colorScheme === 'dark'
                      ? '#93c5fd'
                      : '#2563b5',
              }"
            >
              <line
                :x1="guide.x1"
                :y1="guide.y1"
                :x2="guide.x2"
                :y2="guide.y2"
                stroke="currentColor"
                :stroke-width="1 / camera.zoom"
                :stroke-dasharray="
                  guide.kind === 'alignment'
                    ? [4 / camera.zoom, 3 / camera.zoom].join(' ')
                    : undefined
                "
              />
              <template v-if="guide.label">
                <circle
                  :cx="guide.x1"
                  :cy="guide.y1"
                  :r="2 / camera.zoom"
                  fill="currentColor"
                />
                <circle
                  :cx="guide.x2"
                  :cy="guide.y2"
                  :r="2 / camera.zoom"
                  fill="currentColor"
                />
                <text
                  :x="(guide.x1 + guide.x2) / 2"
                  :y="(guide.y1 + guide.y2) / 2 - 6 / camera.zoom"
                  text-anchor="middle"
                  :font-size="11 / camera.zoom"
                  font-family="sans-serif"
                  fill="currentColor"
                  stroke="var(--paper-canvas-bg, white)"
                  :stroke-width="3 / camera.zoom"
                  paint-order="stroke"
                >
                  {{ guide.label }}
                </text>
              </template>
            </g>
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
          <path
            v-if="lassoPath"
            data-editor-only
            data-lasso-path
            :d="lassoPath"
            fill="var(--focus-ring)"
            fill-rule="evenodd"
            stroke="var(--accent)"
            :stroke-width="1.5 / camera.zoom"
            :stroke-dasharray="`${5 / camera.zoom} ${4 / camera.zoom}`"
            pointer-events="none"
          />
        </g>
      </svg>

      <template v-if="presenting">
        <div
          class="paper-presentation-matte"
          :style="sceneViewport"
          aria-hidden="true"
        />
        <PaperPresentationLaser
          v-if="laserEnabled"
          :key="presentationScene?.id ?? 'presentation'"
          :surface="viewport"
        />
        <nav
          class="paper-presentation-controls"
          :aria-label="t('papers.presentation.title')"
          @pointerdown.stop
          @wheel.stop
        >
          <button
            type="button"
            :disabled="presentationIndex === 0"
            :aria-label="t('papers.presentation.previous')"
            @click="movePresentation(presentationIndex - 1)"
          >
            ←
          </button>
          <span aria-live="polite"
            >{{ presentationIndex + 1 }} / {{ localScenes.length }} ·
            {{ presentationScene?.title }}</span
          >
          <button
            type="button"
            :disabled="presentationIndex === localScenes.length - 1"
            :aria-label="t('papers.presentation.next')"
            @click="movePresentation(presentationIndex + 1)"
          >
            →
          </button>
          <label
            ><input
              v-model="laserEnabled"
              type="checkbox"
            />{{ t('papers.presentation.pointer') }}</label
          >
          <label
            ><input
              v-model="smoothTransition"
              type="checkbox"
            />{{ t('papers.presentation.smooth') }}</label
          >
          <button
            type="button"
            @click="stopPresentation"
          >
            {{ t('papers.presentation.exit') }} (Esc)
          </button>
        </nav>
      </template>
      <div
        v-if="!local.length && !hideTools"
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
.paper-context-menu.board-floating {
  position: absolute;
  z-index: 20;
  width: 232px;
  padding: 6px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px var(--shadow-color);
  max-height: calc(100% - 16px);
  overflow: auto;
}
.paper-context-menu.board-floating button {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 34px;
  white-space: nowrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  border: 0;
  border-radius: 5px;
  padding: 9px 8px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.paper-context-menu button:hover:not(:disabled),
.paper-context-menu button:focus-visible {
  background: var(--hover);
  outline: 1px solid var(--border);
}
.paper-context-menu button:disabled {
  opacity: 0.4;
  cursor: default;
}
.paper-context-menu.board-floating kbd {
  min-height: 0;
  height: auto;
  min-width: 0;
  width: auto;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  line-height: 1.3;
  font-size: 10px;
  opacity: 0.7;
}
.paper-context-menu hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 5px 0;
}
.paper-eraser-cursor {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  border: 1.5px solid var(--ink);
  box-shadow: 0 0 0 1px var(--paper);
  border-radius: 50%;
  background: color-mix(in srgb, var(--paper) 25%, transparent);
  pointer-events: none;
}
.paper-eraser-options {
  position: absolute;
  z-index: 3;
  right: 12px;
  top: 76px;
  display: grid;
  gap: 10px;
  width: 240px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
}
.paper-eraser-options div {
  display: flex;
  gap: 6px;
}
.paper-eraser-options button {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.paper-eraser-options button[aria-pressed='true'] {
  border-color: var(--ink);
  background: var(--hover);
}
.board-editor.paper-presenting {
  position: fixed;
  inset: 0;
  z-index: 1000;
  width: 100vw;
  height: 100vh;
  border: 0;
  border-radius: 0;
  background: #111;
}
.paper-presenting .board-viewport {
  min-height: 0;
}
.paper-presentation-matte {
  position: absolute;
  box-shadow: 0 0 0 200vmax #111;
  pointer-events: none;
  z-index: 10;
}
.paper-presentation-controls {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 24px);
  padding: 8px 12px;
  background: #fffffff0;
  color: #252a34;
  border: 1px solid #d3d5d8;
  border-radius: 8px;
  z-index: 40;
  font:
    12px Arial,
    sans-serif;
  box-shadow: 0 2px 12px #0002;
}
.paper-presentation-controls button,
.paper-scene-hint button {
  padding: 6px 10px;
  border: 1px solid #d3d5d8;
  border-radius: 4px;
  background: white;
  color: #252a34;
  white-space: nowrap;
}
.paper-presentation-controls button:disabled {
  opacity: 0.35;
}
.paper-presentation-controls span {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.paper-presentation-controls label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.paper-scene-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 10px;
  display: flex;
  gap: 12px;
  align-items: center;
  max-width: calc(100% - 32px);
  z-index: 15;
  font:
    12px/1.4 Arial,
    sans-serif;
}
@media (max-width: 720px) {
  .paper-presentation-controls label {
    display: none;
  }
  .paper-presentation-controls span {
    max-width: 140px;
  }
}
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
  border: 0;
  border-radius: 0;
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

<style scoped>
.board-zoom .paper-navigation-button { width: auto; padding: 0 8px; white-space: nowrap; font-size: 11px; }
</style>
