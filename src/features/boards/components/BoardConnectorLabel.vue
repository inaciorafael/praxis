<script setup lang="ts">
import { computed } from 'vue'
import type { BoardElement, BoardPoint, PaperColorScheme } from '@/shared/types/board'
import { connectorRoute, connectorLabel } from '../lib/connector-path'
import { paperPalette } from '../lib/background'
const props = defineProps<{
  element: BoardElement
  endpoints?: readonly [BoardPoint, BoardPoint]
  colorScheme?: PaperColorScheme
}>()
const label = computed(() =>
  connectorLabel(
    props.element.text,
    connectorRoute(
      props.endpoints ?? [
        { x: props.element.x, y: props.element.y },
        {
          x: props.element.x + props.element.width,
          y: props.element.y + props.element.height,
        },
      ],
      props.element.connectorStyle
    ).middle
  )
)
const palette = computed(() => paperPalette(props.colorScheme))
</script>
<template>
  <g
    v-if="label.text"
    data-connector-label
  >
    <rect
      :x="label.x"
      :y="label.y"
      :width="label.width"
      :height="label.height"
      :fill="palette.paper"
      rx="4"
    />
    <text
      :x="label.x + label.width / 2"
      :y="label.y + 19"
      text-anchor="middle"
      font-family="sans-serif"
      font-size="16"
      :fill="palette.ink"
      >{{ label.text }}</text
    >
  </g>
</template>
