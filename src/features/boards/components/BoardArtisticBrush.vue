<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BoardElement } from '@/shared/types/board'
import BoardSketch from './BoardSketch.vue'
import { isWritingBrush, writingPaths } from '../lib/writing'
import {
  artisticBrushKey,
  cachedArtisticBrush,
  renderArtisticBrush,
  type BrushRaster,
} from '../lib/artistic-brush'
const props = withDefaults(
  defineProps<{
    element: BoardElement
    stroke: string
    preview?: boolean
    visible?: boolean
  }>(),
  { visible: true, preview: false }
)
const emit = defineEmits<{ fallback: [] }>()
const raster = ref<BrushRaster>()
const writing = computed(() => isWritingBrush(props.element))
const ink = computed(() =>
  writing.value ? writingPaths(props.element, props.stroke) : []
)
let request = 0
const key = computed(() =>
  writing.value
    ? `writing:${props.element.drawBrush}`
    : artisticBrushKey(props.element, props.stroke)
)
const fallback = computed(() => ({
  ...props.element,
  drawBrush: undefined,
  strokeStyle: 'pen' as const,
}))
watch(
  () => [key.value, props.preview, props.visible],
  async () => {
    const current = ++request
    raster.value = undefined
    if (writing.value || props.visible === false || props.preview) return
    raster.value = cachedArtisticBrush(props.element, props.stroke)
    if (raster.value) return
    const result = await renderArtisticBrush(props.element, props.stroke)
    if (current !== request) return
    if (result) raster.value = result
    else emit('fallback')
  },
  { immediate: true }
)
onBeforeUnmount(() => request++)
</script>
<template>
  <g
    :data-artistic-brush="element.id"
    :data-brush="element.drawBrush"
    :data-brush-render-ms="raster?.elapsed.toFixed(1)"
    :transform="`translate(${element.x} ${element.y})`"
    pointer-events="none"
  >
    <template v-if="writing"
      ><path
        v-for="(path, index) in ink"
        :key="index"
        data-writing-ink
        :d="path.d"
        :stroke="path.stroke"
        :stroke-width="path.strokeWidth"
        :fill="path.fill"
        :opacity="path.opacity"
        :stroke-dasharray="path.dash"
        stroke-linecap="round"
        stroke-linejoin="round"
    /></template>
    <image
      v-else-if="raster"
      :href="raster.href"
      :x="raster.x"
      :y="raster.y"
      :width="raster.width"
      :height="raster.height"
      preserveAspectRatio="none"
    />
    <g
      v-else
      :transform="`translate(${-element.x} ${-element.y})`"
      :opacity="
        element.drawBrush === 'watercolor' || element.drawBrush === 'marker' ? 0.45 : 0.75
      "
      ><BoardSketch
        :element="fallback"
        :stroke="stroke"
        fill="transparent"
    /></g>
  </g>
</template>
