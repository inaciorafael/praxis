<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  BoardElement,
  BoardLayer,
  BoardPoint,
  PaperColorScheme,
} from '@/shared/types/board'
import { polygonVertices } from '../lib/geometry'
import { layerFor, editableInLayers } from '../lib/layers'
import { boardInkColor } from '../lib/label'
import { elementFill, elementLabelScheme } from '../lib/element-style'
import BoardConnectorLabel from './BoardConnectorLabel.vue'
import BoardSketch from './BoardSketch.vue'
import BoardArtisticBrush from './BoardArtisticBrush.vue'
import BoardRichLabel from './BoardRichLabel.vue'
import BoardLabel from './BoardLabel.vue'
import BoardStrokeHitArea from './BoardStrokeHitArea.vue'
const props = defineProps<{
  contentId: string
  elements: BoardElement[]
  layers: BoardLayer[]
  endpoints: Map<string, [BoardPoint, BoardPoint]>
  zoom: number
  colorScheme?: PaperColorScheme
  editing: string | null
  fontReady: number
  replay: number
  groupDelays: Record<string, number>
  previewId?: string
  visibleArtisticIds?: Set<string>
  eraser: boolean
  taskTitles?: Record<string, { title: string; status: string }>
}>()
const emit = defineEmits<{ edit: [id: string]; fallback: [] }>()
const { t } = useI18n()
const isEditable = (element: BoardElement) => editableInLayers(element, props.layers)
const canHaveText = (element: BoardElement) =>
  !['arrow', 'line', 'draw', 'image', 'iframe'].includes(element.kind)
const stroke = (element: BoardElement) => boardInkColor(element, props.colorScheme)
const fill = elementFill
const labelScheme = (element: BoardElement) =>
  elementLabelScheme(element, props.colorScheme)
const label = (element: BoardElement) =>
  element.kind === 'task'
    ? (props.taskTitles?.[element.taskId ?? '']?.title ??
      (element.text || t('boards.taskUnavailable')))
    : element.text
function rotationTransform(element: BoardElement) {
  return element.kind !== 'arrow' && element.angle
    ? 'rotate(' +
        (element.angle * 180) / Math.PI +
        ' ' +
        (element.x + element.width / 2) +
        ' ' +
        (element.y + element.height / 2) +
        ')'
    : undefined
}
</script>
<template>
  <g :id="contentId">
    <g
      v-for="element in elements"
      :key="element.id"
      :data-element-id="element.id"
      :transform="rotationTransform(element)"
      :opacity="(element.opacity ?? 1) * (layerFor(element, layers)?.opacity ?? 1)"
      :pointer-events="isEditable(element) ? undefined : 'none'"
      @dblclick.stop="!eraser && emit('edit', element.id)"
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
      <g v-else-if="element.kind === 'iframe'">
        <rect
          :x="element.x"
          :y="element.y"
          :width="element.width"
          :height="element.height"
          fill="#f5f5f4"
          stroke="#78716c"
          rx="4"
        />
        <text
          :x="element.x + 16"
          :y="element.y + 30"
          fill="#44403c"
          font-family="sans-serif"
          font-size="16"
        >
          {{ t('boards.web.retired') }}
        </text>
        <text
          :x="element.x + 16"
          :y="element.y + 56"
          fill="#57534e"
          font-family="sans-serif"
          font-size="12"
        >
          {{ element.text.slice(0, Math.max(8, Math.floor(element.width / 8))) }}
        </text>
      </g>
      <BoardArtisticBrush
        v-else-if="element.kind === 'draw' && element.drawBrush"
        :element="element"
        :zoom="zoom"
        :stroke="stroke(element)"
        :preview="previewId === element.id"
        :visible="visibleArtisticIds?.has(element.id) ?? true"
        @fallback="emit('fallback')"
      />
      <BoardSketch
        v-else
        :element="element"
        :endpoints="endpoints.get(element.id)"
        :zoom="zoom"
        :stroke="stroke(element)"
        :fill="fill(element)"
      />
      <rect
        v-if="
          !['arrow', 'line', 'draw', 'image', 'ellipse', 'triangle', 'hexagon'].includes(
            element.kind
          )
        "
        data-editor-only
        :x="element.x"
        :y="element.y"
        :width="element.width"
        :height="element.height"
        fill="transparent"
        stroke="transparent"
        :stroke-width="12 / zoom"
        :pointer-events="element.kind === 'frame' ? 'stroke' : 'all'"
      />
      <polygon
        v-if="polygonVertices(element)"
        data-editor-only
        :points="
          polygonVertices(element)!
            .map((point) => `${element.x + point.x},${element.y + point.y}`)
            .join(' ')
        "
        fill="transparent"
        pointer-events="all"
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
      <BoardStrokeHitArea
        v-if="
          element.kind === 'arrow' || element.kind === 'line' || element.kind === 'draw'
        "
        :element="element"
        :endpoints="endpoints.get(element.id)"
        :zoom="zoom"
      />
      <BoardConnectorLabel
        v-if="element.kind === 'arrow'"
        :element="element"
        :endpoints="endpoints.get(element.id)"
        :color-scheme="colorScheme"
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
        :replay="replay"
        :group-delay="groupDelays[element.id]"
      />
      <BoardLabel
        v-else-if="
          !['arrow', 'line', 'draw', 'image'].includes(element.kind) &&
          label(element) &&
          editing !== element.id
        "
        :element="element"
        :color-scheme="labelScheme(element)"
        :label="label(element)"
        :font-ready="fontReady"
        :replay="replay"
        :group-delay="groupDelays[element.id]"
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
  </g>
</template>
