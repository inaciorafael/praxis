<script setup lang="ts">
import BoardZoomInk from './BoardZoomInk.vue'
import { computed } from 'vue'
import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { sketchPaths } from '../lib/sketch'
import { localConnectorEndpoints } from '../lib/connector-path'

const props = defineProps<{
  element: BoardElement
  zoom?: number
  endpoints?: readonly [BoardPoint, BoardPoint]
  stroke: string
  fill: string
}>()
// RoughJS consumes local geometry. Position and labels must not invalidate it.
const geometry = computed<BoardElement>(() => ({
  id: props.element.id,
  kind: props.element.kind,
  x: 0,
  y: 0,
  width: props.element.width,
  height: props.element.height,
  strokeStyle: props.element.strokeStyle,
  connectorStyle: props.element.connectorStyle,
  strokeWidth: props.element.strokeWidth,
  drawBrush: props.element.drawBrush,
  sketch: props.element.sketch,
  fillStyle: props.element.fillStyle,
  textBackground: props.element.textBackground,
  points: props.element.points,
  text: '',
  color: 'neutral',
  resolved: false,
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
}))
const localEndpoints = computed(() =>
  props.element.kind === 'arrow' && props.endpoints
    ? localConnectorEndpoints(props.endpoints, props.element)
    : undefined
)
const paths = computed(() =>
  sketchPaths(geometry.value, props.stroke, props.fill, localEndpoints.value)
)
</script>

<template>
  <g :transform="`translate(${element.x} ${element.y})`">
    <path
      v-for="(path, index) in paths"
      :key="index"
      :d="path.d"
      :stroke="path.stroke"
      :stroke-width="path.strokeWidth"
      :fill="path.fill"
      :opacity="path.opacity"
      :stroke-dasharray="path.dash"
      stroke-linecap="round"
      stroke-linejoin="round"
      pointer-events="none"
    />
    <BoardZoomInk
      :paths="paths"
      :zoom="zoom ?? 1"
      :width="element.strokeWidth ?? (element.strokeStyle === 'pencil' ? 1.5 : 2)"
    />
  </g>
</template>
