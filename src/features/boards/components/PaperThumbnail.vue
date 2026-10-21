<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FilePenLine, Image as ImageIcon } from '@lucide/vue'
import type { BoardElement, BoardSummary } from '@/shared/types/board'
import type { BoardPreview } from '../lib/preview-model'
import {
  loadPaperPreview,
  retainPaperPreviews,
  releasePaperPreviews,
} from '../lib/preview-loader'
import { boardInkColor } from '../lib/label'
import { elementFill, elementLabelScheme } from '../lib/element-style'
import { paperPalette } from '../lib/background'
import { bounds, connectorPoints, normalizeAngle } from '../lib/geometry'
import { loadBoardFont } from '../lib/font'
import { isWritingBrush } from '../lib/writing'
import BoardConnectorLabel from './BoardConnectorLabel.vue'
import BoardSketch from './BoardSketch.vue'
import BoardArtisticBrush from './BoardArtisticBrush.vue'
import BoardRichLabel from './BoardRichLabel.vue'
import BoardLabel from './BoardLabel.vue'
const props = defineProps<{ paper: BoardSummary }>()
const root = ref<HTMLElement>()
const preview = ref<BoardPreview>()
const visible = ref(false)
const fontReady = ref(0)
let observer: IntersectionObserver | undefined
let controller: AbortController | undefined
const palette = computed(() => paperPalette(props.paper.colorScheme))
const colors = computed(() => ({
  backgroundColor: palette.value.paper,
  color: palette.value.ink,
  '--board-ink': palette.value.ink,
  '--board-note': '#fff7cf',
  '--board-amber': '#985610',
  '--board-sage': '#397349',
  '--board-blue': '#285bb5',
  '--board-rose': '#b13f60',
  '--board-purple': '#7846ac',
}))
const viewBox = computed(() => {
  const original = preview.value?.bounds
  const labels = preview.value?.elements.filter(
    (e) => e.kind === 'arrow' && e.text.trim()
  )
  const extra = labels?.length ? bounds(labels, preview.value!.elements) : undefined
  const box =
    original && extra
      ? {
          x: Math.min(original.x, extra.x),
          y: Math.min(original.y, extra.y),
          width:
            Math.max(original.x + original.width, extra.x + extra.width) -
            Math.min(original.x, extra.x),
          height:
            Math.max(original.y + original.height, extra.y + extra.height) -
            Math.min(original.y, extra.y),
        }
      : original
  if (!box) return '0 0 240 160'
  const margin = Math.max(box.width, box.height) * 0.06 + 4
  return `${box.x - margin} ${box.y - margin} ${box.width + margin * 2} ${box.height + margin * 2}`
})
function rotation(element: BoardElement) {
  return element.angle
    ? `rotate(${(normalizeAngle(element.angle) * 180) / Math.PI} ${element.x + element.width / 2} ${element.y + element.height / 2})`
    : undefined
}
async function load() {
  controller?.abort()
  preview.value = undefined
  if (!visible.value || !props.paper.elementCount) return
  const request = new AbortController()
  controller = request
  try {
    const result = await loadPaperPreview(
      props.paper.id,
      props.paper.revision,
      request.signal
    )
    if (!request.signal.aborted) preview.value = result
    await loadBoardFont()
    if (!request.signal.aborted) fontReady.value++
  } catch {
    /* Keep the paper background and placeholder when the preview is unavailable. */
  }
}
watch(
  () => [props.paper.id, props.paper.revision, visible.value],
  () => void load()
)
onMounted(() => {
  retainPaperPreviews()
  if (typeof IntersectionObserver === 'undefined') {
    visible.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      visible.value = entries.some((entry) => entry.isIntersecting)
      if (!visible.value) {
        controller?.abort()
        preview.value = undefined
      }
    },
    { rootMargin: '120px' }
  )
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  controller?.abort()
  releasePaperPreviews()
})
</script>
<template>
  <span
    ref="root"
    class="paper-thumbnail"
    :style="colors"
    :data-background="paper.background ?? 'plain'"
    aria-hidden="true"
  >
    <svg
      v-if="preview?.elements.length"
      class="paper-thumbnail-content"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        v-for="element in preview.elements"
        :key="element.id"
        :transform="rotation(element)"
        :opacity="element.opacity ?? 1"
        :data-preview-element="element.id"
      >
        <image
          v-if="element.kind === 'image' && element.imageData"
          :x="element.x"
          :y="element.y"
          :width="element.width"
          :height="element.height"
          :href="element.imageData"
          preserveAspectRatio="xMidYMid meet"
        />
        <g v-else-if="element.kind === 'image'">
          <rect
            :x="element.x"
            :y="element.y"
            :width="element.width"
            :height="element.height"
            fill="none"
            :stroke="palette.muted"
          />
          <ImageIcon
            :x="element.x + element.width * 0.25"
            :y="element.y + element.height * 0.25"
            :width="element.width * 0.5"
            :height="element.height * 0.5"
            :stroke="palette.muted"
          />
        </g>
        <BoardArtisticBrush
          v-else-if="
            element.kind === 'draw' && element.drawBrush && isWritingBrush(element)
          "
          :element="element"
          :stroke="boardInkColor(element, paper.colorScheme)"
        />
        <BoardSketch
          v-else
          :element="element"
          :stroke="boardInkColor(element, paper.colorScheme)"
          :fill="elementFill(element)"
          :endpoints="
            element.kind === 'arrow'
              ? connectorPoints(element, preview.elements)
              : undefined
          "
        />
        <BoardConnectorLabel
          v-if="element.kind === 'arrow'"
          :element="element"
          :endpoints="connectorPoints(element, preview.elements)"
          :color-scheme="paper.colorScheme"
        />
        <BoardRichLabel
          v-if="
            element.richText && !['draw', 'arrow', 'line', 'image'].includes(element.kind)
          "
          :element="element"
          :font-ready="fontReady"
          :color-scheme="elementLabelScheme(element, paper.colorScheme)"
        />
        <BoardLabel
          v-else-if="
            element.text && !['draw', 'arrow', 'line', 'image'].includes(element.kind)
          "
          :element="element"
          :label="element.text"
          :font-ready="fontReady"
          :color-scheme="elementLabelScheme(element, paper.colorScheme)"
        />
      </g>
    </svg>
    <FilePenLine
      v-else
      class="paper-thumbnail-placeholder"
      :size="24"
      :stroke-width="1.3"
    />
  </span>
</template>
<style scoped>
.paper-thumbnail {
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  pointer-events: none;
}
.paper-thumbnail[data-background='grid'] {
  background-image:
    linear-gradient(#9ba5b42b 1px, transparent 1px),
    linear-gradient(90deg, #9ba5b42b 1px, transparent 1px);
  background-size: 12px 12px;
}
.paper-thumbnail[data-background='ruled'] {
  background-image: repeating-linear-gradient(transparent 0 14px, #9ba5b42b 14px 15px);
}
.paper-thumbnail[data-background='dots'] {
  background-image: radial-gradient(#9ba5b466 0.7px, transparent 0.7px);
  background-size: 12px 12px;
}
.paper-thumbnail-content {
  display: block;
  width: 100%;
  height: 100%;
}
.paper-thumbnail-placeholder {
  position: absolute;
  bottom: 12px;
  left: 12px;
  opacity: 0.55;
}
</style>
