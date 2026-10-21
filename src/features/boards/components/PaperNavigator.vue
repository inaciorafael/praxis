<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BoardElement } from '@/shared/types/board'
import { bounds, type Camera } from '../lib/geometry'
const props = defineProps<{ elements: BoardElement[]; camera: Camera; size: { width: number; height: number } }>()
const emit = defineEmits<{ navigate: [point: { x: number; y: number }]; close: [] }>()
const { t } = useI18n()
const visible = computed(() => ({ x: -props.camera.x / props.camera.zoom, y: -props.camera.y / props.camera.zoom, width: props.size.width / props.camera.zoom, height: props.size.height / props.camera.zoom }))
const contentBounds = computed(() => props.elements.length ? bounds(props.elements) : null)
const area = computed(() => {
  const content = contentBounds.value ?? visible.value
  const x = Math.min(content.x, visible.value.x) - 80
  const y = Math.min(content.y, visible.value.y) - 80
  return { x, y, width: Math.max(content.x + content.width, visible.value.x + visible.value.width) + 80 - x, height: Math.max(content.y + content.height, visible.value.y + visible.value.height) + 80 - y }
})
function navigate(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const matrix = svg.getScreenCTM()
  if (!matrix) return
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const world = point.matrixTransform(matrix.inverse())
  emit('navigate', { x: world.x, y: world.y })
}
function keyboard(event: KeyboardEvent) {
  const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const delta = direction[event.key]
  if (!delta) return
  event.preventDefault()
  event.stopPropagation()
  emit('navigate', { x: visible.value.x + visible.value.width * (0.5 + delta[0] * 0.2), y: visible.value.y + visible.value.height * (0.5 + delta[1] * 0.2) })
}
</script>
<template>
  <aside class="paper-navigator" @pointerdown.stop @wheel.stop>
    <header>{{ t('boards.navigation.title') }}<button type="button" :aria-label="t('boards.navigation.close')" @click="emit('close')">×</button></header>
    <svg :viewBox="`${area.x} ${area.y} ${area.width} ${area.height}`" role="group" tabindex="0" @keydown="keyboard" :aria-label="t('boards.navigation.title')" @click="navigate">
      <rect v-for="element in elements" :key="element.id" :x="element.x" :y="element.y" :width="Math.max(element.width, 2)" :height="Math.max(element.height, 2)" fill="currentColor" opacity=".35" />
      <rect v-bind="visible" fill="var(--focus-ring)" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
  </aside>
</template>
<style scoped>
.paper-navigator { position: absolute; right: 12px; bottom: 104px; width: 200px; z-index: 20; background: var(--surface, white); color: var(--ink, #333); border: 1px solid var(--border, #aaa); border-radius: 8px; padding: 8px; }
header { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
svg { width: 100%; height: 120px; cursor: crosshair; }
button { cursor: pointer; padding: 2px 6px; }
</style>
