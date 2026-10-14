<script setup lang="ts">
import { computed } from 'vue'
import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { sketchPaths } from '../lib/sketch'

const props = defineProps<{
  element: BoardElement
  endpoints?: readonly [BoardPoint, BoardPoint]
  stroke: string
  fill: string
}>()
const paths = computed(() =>
  sketchPaths(props.element, props.stroke, props.fill, props.endpoints)
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
  </g>
</template>
