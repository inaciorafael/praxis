<script setup lang="ts">
import { computed } from 'vue'
import type { SketchPath } from '../lib/sketch'
import { zoomInkPaths } from '../lib/zoom-ink'
const props = defineProps<{ paths: SketchPath[]; zoom: number; width: number }>()
const visible = computed(() => zoomInkPaths(props.paths, props.zoom, props.width))
</script>
<template>
  <g
    v-if="visible.length"
    data-editor-only
    data-zoom-ink
    pointer-events="none"
  >
    <path
      v-for="(path, index) in visible"
      :key="index"
      :d="path.d"
      :stroke="path.stroke"
      :stroke-width="path.strokeWidth"
      fill="none"
      :opacity="path.opacity"
      :stroke-dasharray="path.dash"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</template>
