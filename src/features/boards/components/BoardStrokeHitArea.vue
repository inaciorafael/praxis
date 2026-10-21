<script setup lang="ts">
import { computed } from 'vue'
import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { connectorRoute, localConnectorEndpoints } from '../lib/connector-path'
const props = defineProps<{
  element: BoardElement
  endpoints?: readonly [BoardPoint, BoardPoint]
  zoom: number
}>()
// Local paths survive camera changes and translations without rebuilding handwriting.
const path = computed(() => {
  const element = props.element
  if (element.kind === 'draw')
    return element.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  if (element.kind === 'arrow' && props.endpoints) {
    return connectorRoute(
      localConnectorEndpoints(props.endpoints, element),
      element.connectorStyle
    ).d
  }
  if (element.kind === 'arrow')
    return connectorRoute(
      [
        { x: 0, y: 0 },
        { x: element.width, y: element.height },
      ],
      element.connectorStyle
    ).d
  return `M0 0 L${element.width} ${element.height}`
})
</script>
<template>
  <g
    data-editor-only
    :transform="`translate(${element.x} ${element.y})`"
  >
    <path
      :d="path"
      fill="none"
      stroke="transparent"
      :stroke-width="12 / zoom"
    />
  </g>
</template>
